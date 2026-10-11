"""Orchestrates prompt -> model -> parse -> normalise. Never returns unvalidated model output."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Sequence

from app.models.domain import CatalogActivity, PlanInput
from app.services.ai_errors import AIDisabledError
from app.services.ai_provider import AIProvider
from app.services.json_utils import extract_json_object
from app.services.plan_normalizer import normalize_ai_plan
from app.services.prompts import PLAN_JSON_SCHEMA, SYSTEM_PROMPT, build_user_prompt

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class AIStatusInfo:
    provider: str
    model: str
    status: str  # ready | model_missing | unreachable | disabled
    reachable: bool
    model_available: bool
    setup_hint: str | None


@dataclass(frozen=True)
class AIPlanResult:
    plan: dict
    model: str


class AIService:
    def __init__(self, provider: AIProvider | None, *, enabled: bool = True) -> None:
        self._provider = provider
        self._enabled = enabled and provider is not None

    @property
    def enabled(self) -> bool:
        return self._enabled

    async def status(self) -> AIStatusInfo:
        provider = self._provider
        name = provider.name if provider else "ollama"
        model = provider.model if provider else ""
        if not self._enabled or provider is None:
            return AIStatusInfo(
                provider=name, model=model, status="disabled", reachable=False, model_available=False,
                setup_hint="AI is disabled (AI_ENABLED=false). Plans use the built-in non-AI fallback.",
            )
        result = await provider.check()
        if not result.reachable:
            return AIStatusInfo(
                provider=name, model=model, status="unreachable", reachable=False, model_available=False,
                setup_hint="Start Ollama (run `ollama serve` or open the Ollama app) and check OLLAMA_BASE_URL.",
            )
        if not result.model_available:
            return AIStatusInfo(
                provider=name, model=model, status="model_missing", reachable=True, model_available=False,
                setup_hint=f"Download the model with: ollama pull {model}",
            )
        return AIStatusInfo(
            provider=name, model=model, status="ready", reachable=True, model_available=True, setup_hint=None
        )

    async def generate_plan(self, inp: PlanInput, candidates: Sequence[CatalogActivity]) -> AIPlanResult:
        if not self._enabled or self._provider is None:
            raise AIDisabledError("AI disabled")
        user_prompt = build_user_prompt(inp, candidates)
        text = await self._provider.generate_json(system=SYSTEM_PROMPT, user=user_prompt, schema=PLAN_JSON_SCHEMA)
        raw = extract_json_object(text)
        plan = normalize_ai_plan(raw, inp)
        return AIPlanResult(plan=plan, model=self._provider.model)
