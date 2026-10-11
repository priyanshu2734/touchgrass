"""TouchGrass API application factory.

Run with:  uvicorn app.main:create_app --factory --reload --port 8000
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import __version__
from app.api.errors import register_exception_handlers
from app.api.router import api_router
from app.core.config import Settings, get_settings
from app.core.container import build_container
from app.core.logging import configure_logging
from app.core.part3 import mount_part3_into
from app.services.ai_provider import AIProvider
from part3.geocode import Geocoder
from part3.overpass import PlacesProvider
from part3.privacy import install_access_log_redaction

DESCRIPTION = """
Backend for **TouchGrass**: realistic outdoor plans from a local open-weight model (via Ollama),
with a clearly labelled non-AI fallback, a built-in activity catalogue, real place discovery from
OpenStreetMap data, curated quests and saved progress.

No accounts. Send an optional `X-Profile-Id` header to keep your progress separate.
"""


def create_app(
    settings: Settings | None = None,
    *,
    ai_provider: AIProvider | None = None,
    places_provider: PlacesProvider | None = None,
    geocoder: Geocoder | None = None,
) -> FastAPI:
    settings = settings or get_settings()
    configure_logging(settings.log_level)
    install_access_log_redaction()  # uvicorn logs query strings; keep coordinates and typed places out of logs

    app = FastAPI(title="TouchGrass API", version=__version__, description=DESCRIPTION)
    app.state.container = build_container(settings, ai_provider=ai_provider)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(settings.cors_origins),
        allow_credentials=False,
        allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "Accept", "X-Profile-Id"],
    )
    register_exception_handlers(app)
    app.include_router(api_router)
    mount_part3_into(app, settings, app.state.container, places_provider=places_provider, geocoder=geocoder)
    return app
