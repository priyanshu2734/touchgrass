"""Ollama client using its documented HTTP API (/api/tags and /api/chat)."""

from __future__ import annotations

import logging
from typing import Any

import httpx

from app.services.ai_errors import (
    AIModelMissingError,
    AIResponseError,
    AIServerError,
    AITimeoutError,
    AIUnavailableError,
)
from app.services.ai_provider import ProviderStatus

logger = logging.getLogger(__name__)


def normalize_model_name(name: str) -> str:
    """Ollama treats a bare name like "gemma3" as "gemma3:latest"."""
    name = name.strip().lower()
    return name if ":" in name else f"{name}:latest"


class OllamaProvider:
    name = "ollama"

    def __init__(
        self,
        base_url: str,
        model: str,
        *,
        timeout_seconds: float = 120.0,
        connect_timeout_seconds: float = 3.0,
        temperature: float = 0.4,
        num_predict: int = 1800,
        keep_alive: str = "10m",
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self._base_url = base_url.rstrip("/")
        self.model = model
        self._timeout = timeout_seconds
        self._connect_timeout = connect_timeout_seconds
        self._temperature = temperature
        self._num_predict = num_predict
        self._keep_alive = keep_alive
        self._transport = transport

    def _client(self, read_timeout: float) -> httpx.AsyncClient:
        timeout = httpx.Timeout(connect=self._connect_timeout, read=read_timeout, write=10.0, pool=5.0)
        return httpx.AsyncClient(base_url=self._base_url, timeout=timeout, transport=self._transport)

    async def check(self) -> ProviderStatus:
        try:
            async with self._client(self._connect_timeout + 2.0) as client:
                response = await client.get("/api/tags")
        except httpx.HTTPError:
            return ProviderStatus(reachable=False, model_available=False)

        if response.status_code != 200:
            return ProviderStatus(reachable=False, model_available=False)
        try:
            data = response.json()
        except ValueError:
            return ProviderStatus(reachable=False, model_available=False)

        installed: list[str] = []
        models = data.get("models") if isinstance(data, dict) else None
        if isinstance(models, list):
            for entry in models:
                if isinstance(entry, dict):
                    for key in ("name", "model"):
                        value = entry.get(key)
                        if isinstance(value, str) and value:
                            installed.append(value)
        wanted = normalize_model_name(self.model)
        available = any(normalize_model_name(n) == wanted for n in installed)
        return ProviderStatus(reachable=True, model_available=available, installed_models=tuple(sorted(set(installed))))

    def _payload(self, system: str, user: str, response_format: Any) -> dict[str, Any]:
        return {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "stream": False,
            "format": response_format,
            "keep_alive": self._keep_alive,
            "options": {"temperature": self._temperature, "num_predict": self._num_predict},
        }

    @staticmethod
    def _error_text(response: httpx.Response) -> str:
        try:
            body = response.json()
            if isinstance(body, dict) and isinstance(body.get("error"), str):
                return body["error"]
        except ValueError:
            pass
        return ""

    async def generate_json(self, *, system: str, user: str, schema: dict[str, Any]) -> str:
        try:
            async with self._client(self._timeout) as client:
                response = await client.post("/api/chat", json=self._payload(system, user, schema))
                if response.status_code == 400:
                    # Older servers or models may reject a schema; retry with plain JSON mode.
                    logger.info("Ollama rejected the JSON schema; retrying with format=json")
                    response = await client.post("/api/chat", json=self._payload(system, user, "json"))
        except httpx.ConnectTimeout as exc:
            raise AIUnavailableError("connect timeout") from exc
        except httpx.TimeoutException as exc:
            raise AITimeoutError(type(exc).__name__) from exc
        except httpx.HTTPError as exc:
            raise AIUnavailableError(type(exc).__name__) from exc

        return self._content_from(response)

    def _content_from(self, response: httpx.Response) -> str:
        status = response.status_code
        if status == 404:
            raise AIModelMissingError(self._error_text(response) or "404 from /api/chat")
        if status >= 400:
            raise AIServerError(f"status {status}: {self._error_text(response)[:200]}")
        try:
            data = response.json()
        except ValueError as exc:
            raise AIResponseError("Ollama reply was not JSON") from exc
        if not isinstance(data, dict):
            raise AIResponseError("unexpected Ollama reply shape")
        if isinstance(data.get("error"), str):
            raise AIServerError(data["error"][:200])
        if data.get("done_reason") == "length":
            raise AIResponseError("model output was cut off (increase OLLAMA_NUM_PREDICT)")
        message = data.get("message")
        content = message.get("content") if isinstance(message, dict) else None
        if not isinstance(content, str) or not content.strip():
            raise AIResponseError("Ollama reply had no content")
        return content
