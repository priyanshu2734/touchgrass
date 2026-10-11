import json

from app.services.ai_provider import ProviderStatus
from tests.helpers import FakeProvider


def test_health_ok_when_ai_ready(client):
    res = client.get("/api/health")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ok"
    assert body["database"]["status"] == "ok"
    assert body["ai"]["status"] == "ready" and body["ai"]["model"] == "fake-model:1b"
    assert body["ai"]["setup_hint"] is None
    assert body["app"]["name"] == "TouchGrass API"


def test_health_degraded_when_ollama_unreachable(make_client):
    client = make_client(provider=FakeProvider(status=ProviderStatus(False, False)))
    body = client.get("/api/health").json()
    assert body["status"] == "degraded" and body["ai"]["status"] == "unreachable"
    assert "ollama" in body["ai"]["setup_hint"].lower()


def test_health_reports_missing_model_with_setup_instructions(make_client):
    client = make_client(provider=FakeProvider(status=ProviderStatus(True, False, ("other:1b",))))
    ai = client.get("/api/health").json()["ai"]
    assert ai["status"] == "model_missing" and ai["reachable"] is True
    assert "ollama pull fake-model:1b" in ai["setup_hint"]


def test_health_reports_disabled_ai(make_client):
    client = make_client(ai_enabled=False)
    body = client.get("/api/health").json()
    assert body["status"] == "degraded" and body["ai"]["status"] == "disabled"


def test_health_returns_503_when_database_fails(client):
    client.app.state.container.database.ping = lambda: False
    res = client.get("/api/health")
    assert res.status_code == 503
    assert res.json()["status"] == "error" and res.json()["database"]["status"] == "error"


def test_health_does_not_leak_secrets_urls_or_paths(client, settings):
    text = json.dumps(client.get("/api/health").json())
    assert settings.database_path not in text
    assert "11434" not in text and "Traceback" not in text
