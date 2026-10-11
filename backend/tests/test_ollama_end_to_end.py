"""The REAL OllamaProvider talking over a REAL local socket to a stand-in server that speaks Ollama's HTTP protocol.

This proves the application's AI path (request building, HTTP call, JSON parsing, validation, labelling, fallback)
without needing Ollama installed. It does NOT prove the quality of any real model's output.
"""
import dataclasses
import json
import socket
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer

import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from tests.conftest import PLAN_BODY
from tests.helpers import FakeGeocoder, FakePlaces, valid_ai_payload


class FakeOllama:
    """Minimal Ollama: GET /api/tags and POST /api/chat. Records every chat request body it receives."""

    def __init__(self, models=("gemma3:4b",), chat_reply=None, chat_status=200):
        self.models = list(models)
        self.chat_reply = chat_reply if chat_reply is not None else json.dumps(valid_ai_payload())
        self.chat_status = chat_status
        self.chat_requests: list[dict] = []
        outer = self

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *args):  # keep test output quiet
                pass

            def _send(self, status, body):
                data = json.dumps(body).encode()
                self.send_response(status)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(data)))
                self.end_headers()
                self.wfile.write(data)

            def do_GET(self):
                if self.path == "/api/tags":
                    self._send(200, {"models": [{"name": m, "model": m} for m in outer.models]})
                else:
                    self._send(404, {"error": "not found"})

            def do_POST(self):
                length = int(self.headers.get("Content-Length", 0))
                body = json.loads(self.rfile.read(length) or b"{}")
                if self.path != "/api/chat":
                    return self._send(404, {"error": "not found"})
                outer.chat_requests.append(body)
                if outer.chat_status != 200:
                    return self._send(outer.chat_status, {"error": "model failed to load"})
                self._send(200, {"model": body.get("model"), "done": True, "done_reason": "stop",
                                 "message": {"role": "assistant", "content": outer.chat_reply}})

        self.server = HTTPServer(("127.0.0.1", 0), Handler)
        self.url = f"http://127.0.0.1:{self.server.server_port}"
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)

    def __enter__(self):
        self.thread.start()
        return self

    def __exit__(self, *exc):
        self.server.shutdown()
        self.server.server_close()


def app_for(settings, url, **overrides):
    s = dataclasses.replace(settings, ollama_base_url=url, ollama_model="gemma3:4b", ollama_timeout_seconds=10, **overrides)
    app = create_app(s, places_provider=FakePlaces(), geocoder=FakeGeocoder())  # no ai_provider injected: the real client is used
    return TestClient(app, raise_server_exceptions=False)


def test_ai_plan_is_generated_by_a_real_http_call_to_ollama(settings):
    with FakeOllama() as ollama:
        client = app_for(settings, ollama.url)
        body = {**PLAN_BODY, "notes": "I like quiet places", "location": {"label": "Riverside", "lat": 20.2961, "lon": 85.8245}}
        res = client.post("/api/plan", json=body)
        assert res.status_code == 200
        data = res.json()
        assert data["generated_by"] == "ai" and data["model"] == "gemma3:4b"
        assert data["fallback_reason"] is None and data["plan"]["generated_by"] == "ai"
        assert data["plan"]["title"] == "Golden-hour park loop"

        assert len(ollama.chat_requests) == 1
        sent = ollama.chat_requests[0]
        assert sent["model"] == "gemma3:4b" and sent["stream"] is False
        assert isinstance(sent["format"], dict)  # structured-output JSON schema
        prompt = json.dumps(sent["messages"])
        assert "Riverside" in prompt and "quiet places" in prompt
        for private in ("20.29", "85.82", "20.3", "85.8"):  # coordinates never reach the model
            assert private not in prompt


def test_health_reports_ready_when_ollama_has_the_model(settings):
    with FakeOllama() as ollama:
        health = app_for(settings, ollama.url).get("/api/health").json()
    assert health["status"] == "ok" and health["ai"]["status"] == "ready" and health["ai"]["model_available"] is True


def test_missing_model_is_reported_and_the_plan_falls_back_with_a_label(settings):
    with FakeOllama(models=("llama3:8b",), chat_status=404) as ollama:
        client = app_for(settings, ollama.url)
        health = client.get("/api/health").json()
        assert health["status"] == "degraded" and health["ai"]["status"] == "model_missing"
        assert "ollama pull" in health["ai"]["setup_hint"]
        data = client.post("/api/plan", json=PLAN_BODY).json()
    assert data["generated_by"] == "fallback" and data["model"] is None
    assert data["fallback_reason"] in {"ai_model_missing", "ai_error"} and data["message"]
    assert data["plan"]["generated_by"] == "fallback"


def test_garbage_from_the_model_falls_back_instead_of_crashing(settings):
    with FakeOllama(chat_reply="Sure! Here is a lovely plan for you. Enjoy the outdoors.") as ollama:
        data = app_for(settings, ollama.url).post("/api/plan", json=PLAN_BODY).json()
    assert data["generated_by"] == "fallback" and data["fallback_reason"] == "ai_invalid_response"


def test_a_plan_that_breaks_the_budget_is_corrected_and_the_change_is_disclosed(settings):
    over_budget = valid_ai_payload(estimated_cost={"min": 40, "max": 90, "assumptions": "Paid tickets."})
    with FakeOllama(chat_reply=json.dumps(over_budget)) as ollama:
        data = app_for(settings, ollama.url).post("/api/plan", json={**PLAN_BODY, "budget": "free"}).json()
    cost = data["plan"]["estimated_cost"]
    assert data["generated_by"] == "ai" and cost["max"] == 0
    assert "Adjusted to fit your free budget" in cost["assumptions"]


def test_server_error_from_ollama_falls_back(settings):
    with FakeOllama(chat_status=500) as ollama:
        data = app_for(settings, ollama.url).post("/api/plan", json=PLAN_BODY).json()
    assert data["generated_by"] == "fallback" and data["fallback_reason"] == "ai_server_error"


def test_ollama_not_running_falls_back_and_health_says_unreachable(settings):
    sock = socket.socket()
    sock.bind(("127.0.0.1", 0))
    port = sock.getsockname()[1]
    sock.close()  # nothing is listening on this port now
    client = app_for(settings, f"http://127.0.0.1:{port}")
    assert client.get("/api/health").json()["ai"]["status"] == "unreachable"
    data = client.post("/api/plan", json=PLAN_BODY).json()
    assert data["generated_by"] == "fallback" and data["fallback_reason"] == "ai_unreachable"
    assert data["plan"]["steps"] and data["message"]


def test_ai_disabled_never_contacts_the_model(settings):
    with FakeOllama() as ollama:
        client = app_for(settings, ollama.url, ai_enabled=False)
        data = client.post("/api/plan", json=PLAN_BODY).json()
        assert ollama.chat_requests == []
    assert data["generated_by"] == "fallback" and data["fallback_reason"] == "ai_disabled"
