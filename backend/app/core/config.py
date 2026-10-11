"""Environment-driven settings. No secrets are required by this application."""

from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Mapping

BASE_DIR = Path(__file__).resolve().parents[2]  # the backend/ folder

_TRUE = {"1", "true", "yes", "on"}
_FALSE = {"0", "false", "no", "off"}


class ConfigError(ValueError):
    """Raised when an environment variable has an unusable value."""


def load_dotenv_file(path: Path, environ: dict[str, str] | None = None) -> None:
    """Minimal .env reader. Real environment variables win over file values."""
    target = os.environ if environ is None else environ
    try:
        text = path.read_text(encoding="utf-8")
    except OSError:
        return
    for raw in text.splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}:
            value = value[1:-1]
        elif " #" in value:
            value = value.split(" #", 1)[0].rstrip()
        if key and key not in target:
            target[key] = value


def _bool(env: Mapping[str, str], key: str, default: bool) -> bool:
    raw = env.get(key)
    if raw is None or raw.strip() == "":
        return default
    value = raw.strip().lower()
    if value in _TRUE:
        return True
    if value in _FALSE:
        return False
    raise ConfigError(f"{key} must be true or false.")


def _float(env: Mapping[str, str], key: str, default: float, *, minimum: float, maximum: float) -> float:
    raw = env.get(key)
    if raw is None or raw.strip() == "":
        return default
    try:
        value = float(raw)
    except ValueError as exc:
        raise ConfigError(f"{key} must be a number.") from exc
    if not minimum <= value <= maximum:
        raise ConfigError(f"{key} must be between {minimum} and {maximum}.")
    return value


def _int(env: Mapping[str, str], key: str, default: int, *, minimum: int, maximum: int) -> int:
    raw = env.get(key)
    if raw is None or raw.strip() == "":
        return default
    try:
        value = int(raw)
    except ValueError as exc:
        raise ConfigError(f"{key} must be a whole number.") from exc
    if not minimum <= value <= maximum:
        raise ConfigError(f"{key} must be between {minimum} and {maximum}.")
    return value


def _csv(env: Mapping[str, str], key: str, default: tuple[str, ...]) -> tuple[str, ...]:
    raw = env.get(key)
    if raw is None or raw.strip() == "":
        return default
    return tuple(part.strip() for part in raw.split(",") if part.strip())


DEFAULT_CORS = (
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
)


DEFAULT_OVERPASS = ("https://overpass-api.de/api/interpreter",)
PLACES_PROVIDERS = ("overpass", "none")


@dataclass(frozen=True)
class Settings:
    app_env: str = "development"
    log_level: str = "INFO"
    database_path: str = str(BASE_DIR / "data" / "touchgrass.db")
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "gemma3:4b"
    ollama_timeout_seconds: float = 120.0
    ollama_connect_timeout_seconds: float = 3.0
    ollama_temperature: float = 0.4
    ollama_num_predict: int = 1800
    ollama_keep_alive: str = "10m"
    ai_enabled: bool = True
    cors_origins: tuple[str, ...] = DEFAULT_CORS
    # Place discovery (OpenStreetMap). "overpass" = live external data, "none" = disabled (no external calls at all).
    places_provider: str = "overpass"
    overpass_urls: tuple[str, ...] = DEFAULT_OVERPASS
    nominatim_url: str = "https://nominatim.openstreetmap.org/search"
    # Public OSM services require an identifying User-Agent. Put a contact URL or email here.
    osm_contact: str = ""
    places_rate_per_minute: int = 20
    geocode_rate_per_minute: int = 10

    @classmethod
    def from_env(cls, env: Mapping[str, str] | None = None) -> "Settings":
        env = os.environ if env is None else env

        base_url = (env.get("OLLAMA_BASE_URL") or "http://localhost:11434").strip().rstrip("/")
        if not base_url.startswith(("http://", "https://")):
            raise ConfigError("OLLAMA_BASE_URL must start with http:// or https://.")

        model = (env.get("OLLAMA_MODEL") or "gemma3:4b").strip()
        if not model:
            raise ConfigError("OLLAMA_MODEL must not be empty.")

        db_raw = (env.get("DATABASE_PATH") or "data/touchgrass.db").strip()
        db_path = Path(db_raw)
        if not db_path.is_absolute():
            db_path = BASE_DIR / db_path

        places_provider = (env.get("PLACES_PROVIDER") or "overpass").strip().lower()
        if places_provider not in PLACES_PROVIDERS:
            raise ConfigError("PLACES_PROVIDER must be 'overpass' or 'none'.")

        nominatim_url = (env.get("NOMINATIM_URL") or "https://nominatim.openstreetmap.org/search").strip()
        if not nominatim_url.startswith(("http://", "https://")):
            raise ConfigError("NOMINATIM_URL must start with http:// or https://.")

        return cls(
            app_env=(env.get("APP_ENV") or "development").strip().lower(),
            log_level=(env.get("LOG_LEVEL") or "INFO").strip().upper(),
            database_path=str(db_path),
            ollama_base_url=base_url,
            ollama_model=model,
            ollama_timeout_seconds=_float(env, "OLLAMA_TIMEOUT_SECONDS", 120.0, minimum=1.0, maximum=1800.0),
            ollama_connect_timeout_seconds=_float(env, "OLLAMA_CONNECT_TIMEOUT_SECONDS", 3.0, minimum=0.1, maximum=60.0),
            ollama_temperature=_float(env, "OLLAMA_TEMPERATURE", 0.4, minimum=0.0, maximum=2.0),
            ollama_num_predict=_int(env, "OLLAMA_NUM_PREDICT", 1800, minimum=256, maximum=8192),
            ollama_keep_alive=(env.get("OLLAMA_KEEP_ALIVE") or "10m").strip(),
            ai_enabled=_bool(env, "AI_ENABLED", True),
            cors_origins=_csv(env, "CORS_ORIGINS", DEFAULT_CORS),
            places_provider=places_provider,
            overpass_urls=_csv(env, "OVERPASS_URLS", DEFAULT_OVERPASS),
            nominatim_url=nominatim_url,
            osm_contact=(env.get("OSM_CONTACT") or "").strip(),
            places_rate_per_minute=_int(env, "PLACES_RATE_PER_MINUTE", 20, minimum=1, maximum=600),
            geocode_rate_per_minute=_int(env, "GEOCODE_RATE_PER_MINUTE", 10, minimum=1, maximum=600),
        )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    load_dotenv_file(BASE_DIR / ".env")
    return Settings.from_env(os.environ)
