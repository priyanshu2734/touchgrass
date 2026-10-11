"""Mounts the Part 3 package (place discovery, geocoding, quests, progress) into the Part 2 application.

What is shared:
  * one SQLite file (Part 3 tables are prefixed `tg3_`),
  * one anonymous profile mechanism: Part 3's `get_owner` dependency is replaced by Part 2's `X-Profile-Id` header,
  * one set of environment variables (see `app.core.config.Settings`),
  * one error format (`{"error": {...}}`), because Part 3 raises ordinary HTTPExceptions.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, FastAPI

from app.api.deps import get_profile_id
from app.core.config import Settings
from app.core.container import Container
from app.core.errors import NotConfiguredError
from part3 import get_owner, mount_part3
from part3.config import Settings as Part3Settings
from part3.db import Database as Part3Database
from part3.geocode import Geocoder
from part3.legacy import ImportResult, import_part2_completions
from part3.overpass import PlacesProvider
from part3.quest_service import QuestService, load_catalog
from part3.routes import Container as Part3Container
from part3.routes import build_container as build_part3_container

logger = logging.getLogger(__name__)


def part3_settings(settings: Settings) -> Part3Settings:
    return Part3Settings(
        overpass_urls=settings.overpass_urls,
        nominatim_url=settings.nominatim_url,
        contact=settings.osm_contact or "contact-not-set",
        places_rate_per_minute=settings.places_rate_per_minute,
        geocode_rate_per_minute=settings.geocode_rate_per_minute,
        db_path=settings.database_path,
    )


def _disabled_places_router() -> APIRouter:
    """Used when PLACES_PROVIDER=none: honest 501s instead of silently returning nothing."""
    router = APIRouter(prefix="/api", tags=["places"])
    message = "Place discovery is turned off on this server (PLACES_PROVIDER=none)."

    @router.get("/places", summary="Place discovery is disabled")
    @router.get("/places/categories", include_in_schema=False)
    @router.get("/geocode", include_in_schema=False)
    async def _disabled() -> None:
        raise NotConfiguredError(message)

    return router


def mount_part3_into(
    app: FastAPI,
    settings: Settings,
    container: Container,
    *,
    places_provider: PlacesProvider | None = None,
    geocoder: Geocoder | None = None,
) -> tuple[Part3Container, ImportResult]:
    p3_settings = part3_settings(settings)
    places_enabled = settings.places_provider != "none" or places_provider is not None

    if places_enabled and not settings.osm_contact and places_provider is None:
        logger.warning(
            "OSM_CONTACT is not set. The public Overpass and Nominatim services expect an identifying "
            "contact (a URL or email) in the User-Agent. Set OSM_CONTACT in .env."
        )

    p3_db = Part3Database(p3_settings.db_path)
    catalog = load_catalog()
    quest_service = QuestService(p3_db, catalog, plans_counter=container.history.count)
    p3 = build_part3_container(p3_settings, provider=places_provider, geocoder=geocoder, quest_service=quest_service)
    legacy = import_part2_completions(p3_db, catalog)
    if legacy.imported or legacy.skipped:
        logger.info("Imported %s earlier quest completions (%s skipped).", legacy.imported, legacy.skipped)

    app.dependency_overrides[get_owner] = get_profile_id  # anonymous per-browser profiles
    mount_part3(app, p3_settings, include_places=places_enabled, include_quests=True, container=p3)
    if not places_enabled:
        app.include_router(_disabled_places_router())
    return p3, legacy
