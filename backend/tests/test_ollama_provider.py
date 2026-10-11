"""OllamaProvider against a mocked HTTP transport. No Ollama server is needed."""

import asyncio
import json

import httpx
import pytest

from app.services.ai_errors import (
    AIModelMissingError, AIResponseError, AIServerError, AITimeoutError, AIUnavailableError,
)
from app.services.ollama_provider import OllamaProvider, normalize_model_name

SCHEMA = {"type": "object", "properties": {"a": {"type": "string"}}}


def make(handler, model="gemma3:4b"):
    return OllamaProvider("http://ollama.test", model, transport=httpx.MockTransport(handler))


def reply(content='{"a": "b"}', **extra):
    return httpx.Response(200, json={"message": {"role": "assistant", "content": content}, "done": True, **extra})


def generate(provider):
    return asyncio.run(provider.generate_json(system="sys", user="usr", schema=SCHEMA))


def test_request_uses_documented_chat_api_with_structured_output():
    seen = {}

    def handler(request):
        seen["path"], seen["method"], seen["body"] = request.url.path, request.method, json.loads(request.content)
        return reply()

    assert generate(make(handler)) == '{"a": "b"}'
    body = seen["body"]
    assert seen["path"] == "/api/chat" and seen["method"] == "POST"
    assert body["model"] == "gemma3:4b" and body["stream"] is False
    assert body["format"] == SCHEMA
    assert [m["role"] for m in body["messages"]] == ["system", "user"]
    assert "temperature" in body["options"] and "num_predict" in body["options"]


def test_schema_rejection_retries_with_plain_json_mode():
    bodies = []

    def handler(request):
        bodies.append(json.loads(request.content))
        if len(bodies) == 1:
            return httpx.Response(400, json={"error": "invalid format"})
        return reply()

    assert generate(make(handler)) == '{"a": "b"}'
    assert len(bodies) == 2 and bodies[1]["format"] == "json"


def test_missing_model_maps_to_model_missing():
    provider = make(lambda r: httpx.Response(404, json={"error": "model 'gemma3:4b' not found"}))
    with pytest.raises(AIModelMissingError):
        generate(provider)


def test_server_errors_map_to_server_error():
    with pytest.raises(AIServerError):
        generate(make(lambda r: httpx.Response(500, json={"error": "boom"})))
    with pytest.raises(AIServerError):
        generate(make(lambda r: httpx.Response(200, json={"error": "out of memory"})))


def test_read_timeout_maps_to_timeout_error():
    def handler(request):
        raise httpx.ReadTimeout("slow", request=request)

    with pytest.raises(AITimeoutError):
        generate(make(handler))


def test_connection_problems_map_to_unavailable():
    def refuse(request):
        raise httpx.ConnectError("refused", request=request)

    def slow_connect(request):
        raise httpx.ConnectTimeout("no route", request=request)

    with pytest.raises(AIUnavailableError):
        generate(make(refuse))
    with pytest.raises(AIUnavailableError):
        generate(make(slow_connect))


def test_unusable_replies_raise_response_error():
    with pytest.raises(AIResponseError):
        generate(make(lambda r: httpx.Response(200, text="<html>not json</html>")))
    with pytest.raises(AIResponseError):
        generate(make(lambda r: reply(content="   ")))
    with pytest.raises(AIResponseError):
        generate(make(lambda r: reply(done_reason="length")))
    with pytest.raises(AIResponseError):
        generate(make(lambda r: httpx.Response(200, json={"message": {}})))


def tags(*names):
    return lambda request: httpx.Response(200, json={"models": [{"name": n, "model": n} for n in names]})


def test_check_ready_when_model_installed():
    status = asyncio.run(make(tags("gemma3:4b", "llama3.2:3b")).check())
    assert status.reachable and status.model_available


def test_check_reports_missing_model():
    status = asyncio.run(make(tags("llama3.2:3b")).check())
    assert status.reachable and not status.model_available
    assert "llama3.2:3b" in status.installed_models


def test_check_matches_latest_tag_for_bare_names():
    status = asyncio.run(make(tags("gemma3:latest"), model="gemma3").check())
    assert status.model_available


def test_check_unreachable_when_connection_fails_or_server_errors():
    def refuse(request):
        raise httpx.ConnectError("refused", request=request)

    assert asyncio.run(make(refuse).check()).reachable is False
    assert asyncio.run(make(lambda r: httpx.Response(500)).check()).reachable is False
    assert asyncio.run(make(lambda r: httpx.Response(200, text="nope")).check()).reachable is False


def test_normalize_model_name():
    assert normalize_model_name("Gemma3") == "gemma3:latest"
    assert normalize_model_name("gemma3:4b") == "gemma3:4b"
