import pytest

from app.core.config import ConfigError, Settings, load_dotenv_file


def test_defaults():
    s = Settings.from_env({})
    assert s.ollama_base_url == "http://localhost:11434"
    assert s.ollama_model == "gemma3:4b"
    assert s.ai_enabled is True
    assert "http://localhost:5173" in s.cors_origins
    assert s.database_path.endswith("touchgrass.db")
    assert s.places_provider == "overpass"
    assert s.overpass_urls == ("https://overpass-api.de/api/interpreter",)
    assert s.osm_contact == ""


def test_overrides_are_parsed():
    s = Settings.from_env({
        "OLLAMA_BASE_URL": "http://127.0.0.1:9999/", "OLLAMA_MODEL": "gemma3:1b",
        "OLLAMA_TIMEOUT_SECONDS": "30", "AI_ENABLED": "false",
        "CORS_ORIGINS": "http://a.test, http://b.test", "DATABASE_PATH": "/tmp/x.db",
    })
    assert s.ollama_base_url == "http://127.0.0.1:9999"
    assert s.ollama_model == "gemma3:1b" and s.ollama_timeout_seconds == 30.0
    assert s.ai_enabled is False and s.cors_origins == ("http://a.test", "http://b.test")
    assert s.database_path == "/tmp/x.db"


@pytest.mark.parametrize(
    "env",
    [{"OLLAMA_BASE_URL": "localhost:11434"}, {"OLLAMA_TIMEOUT_SECONDS": "abc"}, {"AI_ENABLED": "maybe"},
     {"OLLAMA_TIMEOUT_SECONDS": "0"}, {"OLLAMA_NUM_PREDICT": "1.5"},
     {"PLACES_PROVIDER": "google"}, {"NOMINATIM_URL": "nominatim.test"}, {"PLACES_RATE_PER_MINUTE": "0"}],
)
def test_invalid_values_raise_config_error(env):
    with pytest.raises(ConfigError):
        Settings.from_env(env)


def test_dotenv_does_not_override_real_environment(tmp_path):
    path = tmp_path / ".env"
    path.write_text('# comment\nOLLAMA_MODEL=from-file\nOTHER="quoted value"\nKEEP=1 # trailing\n', encoding="utf-8")
    env = {"OLLAMA_MODEL": "from-env"}
    load_dotenv_file(path, env)
    assert env["OLLAMA_MODEL"] == "from-env"
    assert env["OTHER"] == "quoted value" and env["KEEP"] == "1"
    load_dotenv_file(tmp_path / "missing.env", env)


def test_places_settings_are_parsed():
    s = Settings.from_env({
        "PLACES_PROVIDER": "none", "OVERPASS_URLS": "https://a.test/api, https://b.test/api",
        "NOMINATIM_URL": "https://geo.test/search", "OSM_CONTACT": "me@example.org", "PLACES_RATE_PER_MINUTE": "5",
    })
    assert s.places_provider == "none" and s.overpass_urls == ("https://a.test/api", "https://b.test/api")
    assert s.nominatim_url == "https://geo.test/search" and s.osm_contact == "me@example.org"
    assert s.places_rate_per_minute == 5
