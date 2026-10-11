"""HTTP layer. Two routers so a host app can mount only what it needs:

    places_router  GET /api/places, GET /api/geocode
    quests_router  GET /api/quests, POST /api/quests/{id}/complete, GET /api/progress and the new Part 3 endpoints
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Path, Query, Request
from fastapi.responses import JSONResponse

from .config import Settings
from .db import Database
from .errors import ProviderError
from .geocode import Geocoder, NominatimGeocoder
from .models import (
    CompleteQuestResponse,
    Difficulty,
    QuestCategory,
    CompleteRequest,
    GeocodeResult,
    NoteRequest,
    Place,
    Progress,
    Quest,
    SessionRequest,
)
from .overpass import CATEGORIES, OverpassProvider, PlacesProvider
from .places_service import PlacesService
from .quest_service import Invalid, NotFound, QuestService
from .ratelimit import SlidingWindowLimiter


@dataclass
class Container:
    settings: Settings
    places: PlacesService
    geocoder: Geocoder
    quests: QuestService
    places_limiter: SlidingWindowLimiter
    geocode_limiter: SlidingWindowLimiter


def build_container(
    settings: Optional[Settings] = None,
    provider: Optional[PlacesProvider] = None,
    geocoder: Optional[Geocoder] = None,
    quest_service: Optional[QuestService] = None,
) -> Container:
    settings = settings or Settings()
    return Container(
        settings=settings,
        places=PlacesService(provider or OverpassProvider(settings), settings),
        geocoder=geocoder or NominatimGeocoder(settings),
        quests=quest_service or QuestService(Database(settings.db_path)),
        places_limiter=SlidingWindowLimiter(settings.places_rate_per_minute),
        geocode_limiter=SlidingWindowLimiter(settings.geocode_rate_per_minute),
    )


def get_container(request: Request) -> Container:
    container = getattr(request.app.state, "part3", None)
    if container is None:
        raise RuntimeError("Part 3 is not mounted. Call mount_part3(app) first.")
    return container


def get_owner() -> str:
    """Single-user by default (Part 1 has no accounts). Override with `app.dependency_overrides[get_owner]`
    to return the authenticated user's id once the host app has auth."""
    return "local"


def _client_key(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def _raise_provider(exc: ProviderError) -> HTTPException:
    headers = {"Retry-After": str(exc.retry_after)} if exc.retry_after else None
    return HTTPException(status_code=exc.status_code, detail=exc.message, headers=headers)


def _limit(limiter: SlidingWindowLimiter, request: Request) -> None:
    allowed, retry_after = limiter.check(_client_key(request))
    if not allowed:
        raise HTTPException(
            status_code=429,
            detail="Too many searches in a short time. Please wait a moment and try again.",
            headers={"Retry-After": str(retry_after)},
        )


# ================================================================ places
places_router = APIRouter(prefix="/api", tags=["places"])


@places_router.get("/places", response_model=list[Place], response_model_exclude_none=True)
async def get_places(
    request: Request,
    lat: float = Query(..., ge=-90, le=90),
    lon: float = Query(..., ge=-180, le=180),
    radius: Optional[int] = Query(None, ge=1, le=100_000, description="Metres. Clamped to the server maximum."),
    categories: Optional[str] = Query(None, description="Comma separated category ids. Default: all default categories."),
    limit: Optional[int] = Query(None, ge=1, le=500),
    include_unnamed: bool = Query(False),
    c: Container = Depends(get_container),
):
    _limit(c.places_limiter, request)
    ids = [part for part in (categories or "").split(",") if part]
    try:
        return await c.places.search(lat, lon, radius, ids, limit, include_unnamed)
    except ProviderError as exc:
        raise _raise_provider(exc) from exc


@places_router.get("/places/categories", tags=["places"])
def get_place_categories():
    """Categories the places search understands (additive Part 3 endpoint)."""
    return [{"id": cat.id, "label": cat.label, "defaultOn": cat.default_on} for cat in CATEGORIES]


@places_router.get("/geocode", response_model=list[GeocodeResult], response_model_by_alias=True)
async def geocode(
    request: Request,
    q: str = Query(..., min_length=2, max_length=100),
    c: Container = Depends(get_container),
):
    """Additive Part 3 endpoint. Turns a typed place name into candidate coordinates (OpenStreetMap Nominatim)."""
    _limit(c.geocode_limiter, request)
    query = " ".join(q.split())
    if len(query) < 2:
        raise HTTPException(status_code=422, detail="Type at least two characters.")
    try:
        return await c.geocoder.search(query)
    except ProviderError as exc:
        raise _raise_provider(exc) from exc


# ================================================================ quests + progress
quests_router = APIRouter(prefix="/api", tags=["quests"])

QuestId = Annotated[str, Path(pattern=r"^[a-z0-9][a-z0-9-]{1,63}$", description="Quest id such as 'name-three-birds'.")]


def _guard(call):
    try:
        return call()
    except NotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Invalid as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@quests_router.get("/quests", response_model=list[Quest], response_model_exclude_none=True)
def list_quests(
    category: Optional[QuestCategory] = Query(None),
    difficulty: Optional[Difficulty] = Query(None),
    c: Container = Depends(get_container),
    owner: str = Depends(get_owner),
):
    quests = c.quests.list_quests(owner)
    return [q for q in quests if (not category or q.category == category) and (not difficulty or q.difficulty == difficulty)]


@quests_router.post("/quests/{quest_id}/start", response_model=Quest, response_model_exclude_none=True)
def start_quest(quest_id: QuestId, c: Container = Depends(get_container), owner: str = Depends(get_owner)):
    return _guard(lambda: c.quests.start(owner, quest_id))


@quests_router.delete("/quests/{quest_id}/start", response_model=Quest, response_model_exclude_none=True)
def cancel_quest_start(quest_id: QuestId, c: Container = Depends(get_container), owner: str = Depends(get_owner)):
    return _guard(lambda: c.quests.cancel_start(owner, quest_id))


@quests_router.post(
    "/quests/{quest_id}/complete", response_model=CompleteQuestResponse, response_model_exclude_none=True
)
def complete_quest(
    quest_id: QuestId,
    body: Optional[CompleteRequest] = None,
    today: Optional[str] = Query(None, pattern=r"^\d{4}-\d{2}-\d{2}$"),
    c: Container = Depends(get_container),
    owner: str = Depends(get_owner),
):
    """Existing Part 1 contract. The JSON body is optional and additive: minutesSpent, reflection, repeat, localDate."""
    return _guard(lambda: c.quests.complete(owner, quest_id, body, today))


@quests_router.get("/progress", response_model=Progress, response_model_exclude_none=True)
def get_progress(
    today: Optional[str] = Query(None, pattern=r"^\d{4}-\d{2}-\d{2}$", description="Client's local date, for streaks."),
    c: Container = Depends(get_container),
    owner: str = Depends(get_owner),
):
    return c.quests.progress(owner, today)


@quests_router.post("/outdoor-sessions", response_model=Progress, response_model_exclude_none=True, status_code=201)
def log_session(
    body: SessionRequest,
    today: Optional[str] = Query(None, pattern=r"^\d{4}-\d{2}-\d{2}$"),
    c: Container = Depends(get_container),
    owner: str = Depends(get_owner),
):
    return _guard(lambda: c.quests.log_session(owner, body, today))


@quests_router.patch("/progress/entries/{entry_id}", response_model=Progress, response_model_exclude_none=True)
def update_entry_note(
    entry_id: int,
    body: NoteRequest,
    today: Optional[str] = Query(None, pattern=r"^\d{4}-\d{2}-\d{2}$"),
    c: Container = Depends(get_container),
    owner: str = Depends(get_owner),
):
    return _guard(lambda: c.quests.update_note(owner, entry_id, body.note, today))


@quests_router.delete("/progress/entries/{entry_id}", response_model=Progress, response_model_exclude_none=True)
def delete_entry(
    entry_id: int,
    today: Optional[str] = Query(None, pattern=r"^\d{4}-\d{2}-\d{2}$"),
    c: Container = Depends(get_container),
    owner: str = Depends(get_owner),
):
    return _guard(lambda: c.quests.delete_entry(owner, entry_id, today))


def mount_part3(
    app,
    settings: Optional[Settings] = None,
    *,
    include_places: bool = True,
    include_quests: bool = True,
    container: Optional[Container] = None,
) -> Container:
    """Attach Part 3 to an existing FastAPI app. Returns the container (useful in tests)."""
    c = container or build_container(settings)
    app.state.part3 = c
    if include_places:
        app.include_router(places_router)
    if include_quests:
        app.include_router(quests_router)
    return c
