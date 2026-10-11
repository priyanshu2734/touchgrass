"""Overpass (OpenStreetMap) provider: query building, response validation and HTTP client.

The module is deliberately split in three layers so each can be tested alone:
    build_query()  -> string, only constants and formatted floats are interpolated
    parse_overpass() -> validates untrusted JSON and returns clean RawPlace objects
    OverpassProvider -> HTTP, timeouts, endpoint fallback, error mapping
"""
from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field
from typing import Callable, Iterable, Optional, Protocol

import httpx

from .config import Settings
from .errors import (
    ProviderBadResponse,
    ProviderError,
    ProviderRateLimited,
    ProviderTimeout,
    ProviderUnavailable,
)
from .geo import valid_lat_lon

Tags = dict[str, str]


@dataclass(frozen=True)
class CategoryDef:
    id: str
    label: str
    selectors: tuple[str, ...]  # Overpass tag filters, constants only
    matches: Callable[[Tags], bool]
    default_on: bool = True


def _is(key: str, *values: str) -> Callable[[Tags], bool]:
    return lambda tags: tags.get(key) in values


CATEGORIES: tuple[CategoryDef, ...] = (
    CategoryDef("park", "Park", ('["leisure"="park"]',), _is("leisure", "park")),
    CategoryDef(
        "garden",
        "Garden",
        ('["leisure"="garden"]["access"!~"^(private|no|customers)$"]',),
        _is("leisure", "garden"),
    ),
    CategoryDef("nature_reserve", "Nature reserve", ('["leisure"="nature_reserve"]',), _is("leisure", "nature_reserve")),
    CategoryDef("woodland", "Woodland", ('["natural"="wood"]["name"]',), _is("natural", "wood")),
    CategoryDef("viewpoint", "Viewpoint", ('["tourism"="viewpoint"]',), _is("tourism", "viewpoint")),
    CategoryDef("beach", "Beach", ('["natural"="beach"]',), _is("natural", "beach")),
    CategoryDef(
        "lake",
        "Lake or pond",
        ('["natural"="water"]["water"~"^(lake|pond|reservoir)$"]["name"]',),
        lambda t: t.get("natural") == "water" and t.get("water") in ("lake", "pond", "reservoir"),
    ),
    CategoryDef(
        "trail",
        "Named path or trail",
        ('["highway"~"^(path|footway)$"]["name"]["access"!~"^(private|no)$"]["foot"!="no"]',),
        _is("highway", "path", "footway"),
        default_on=False,  # noisy in cities, so opt-in
    ),
)
CATEGORY_BY_ID = {c.id: c for c in CATEGORIES}
DEFAULT_CATEGORY_IDS = tuple(c.id for c in CATEGORIES if c.default_on)


def resolve_categories(ids: Optional[Iterable[str]]) -> tuple[CategoryDef, ...]:
    """Unknown ids are ignored. Empty or missing means the default set."""
    chosen = [CATEGORY_BY_ID[i] for i in (ids or ()) if i in CATEGORY_BY_ID]
    if not chosen:
        chosen = [CATEGORY_BY_ID[i] for i in DEFAULT_CATEGORY_IDS]
    seen: set[str] = set()
    unique = []
    for cat in chosen:
        if cat.id not in seen:
            seen.add(cat.id)
            unique.append(cat)
    return tuple(unique)


# ---------------------------------------------------------------- query
def build_query(lat: float, lon: float, radius_m: int, categories: tuple[CategoryDef, ...], settings: Settings) -> str:
    if not valid_lat_lon(lat, lon):
        raise ValueError("invalid coordinates")
    radius = int(radius_m)
    around = f"(around:{radius},{lat:.5f},{lon:.5f})"
    body = "".join(f"nwr{around}{selector};" for cat in categories for selector in cat.selectors)
    return f"[out:json][timeout:{int(settings.overpass_query_timeout_s)}];({body});out tags center {int(settings.overpass_max_elements)};"


# ---------------------------------------------------------------- parsing
@dataclass(frozen=True)
class RawPlace:
    id: str
    name: str
    named: bool
    category_id: str
    category: str
    lat: float
    lon: float
    osm_url: str
    opening_hours: Optional[str] = None
    wheelchair: Optional[str] = None
    website: Optional[str] = None


@dataclass
class ParseResult:
    places: list[RawPlace] = field(default_factory=list)
    skipped: int = 0
    hit_cap: bool = False


_CONTROL = re.compile(r"[\x00-\x1f\x7f]")
_ELEMENT_TYPES = ("node", "way", "relation")
_RUNTIME_REMARK = re.compile(r"runtime error|timed out|out of memory|too many requests", re.I)


def clean_text(value: object, max_len: int) -> Optional[str]:
    if not isinstance(value, str):
        return None
    text = unicodedata.normalize("NFC", _CONTROL.sub(" ", value)).strip()
    text = re.sub(r"\s+", " ", text)
    return text[:max_len] if text else None


def safe_url(value: object) -> Optional[str]:
    text = clean_text(value, 300)
    if not text:
        return None
    if not re.match(r"^https?://[^\s]+$", text, re.I):
        return None
    return text


def classify(tags: Tags, categories: tuple[CategoryDef, ...]) -> Optional[CategoryDef]:
    for cat in categories:
        if cat.matches(tags):
            return cat
    return None


def _coords(element: dict) -> Optional[tuple[float, float]]:
    if "lat" in element and "lon" in element:
        lat, lon = element["lat"], element["lon"]
    else:
        center = element.get("center")
        if not isinstance(center, dict):
            return None
        lat, lon = center.get("lat"), center.get("lon")
    if not valid_lat_lon(lat, lon):
        return None
    return float(lat), float(lon)


def parse_overpass(payload: object, categories: tuple[CategoryDef, ...], max_elements: int = 400) -> ParseResult:
    """Validate an Overpass JSON document. Raises ProviderBadResponse/Timeout when it is unusable.

    Individual malformed elements are skipped and counted, never trusted.
    """
    if not isinstance(payload, dict) or not isinstance(payload.get("elements"), list):
        raise ProviderBadResponse()
    elements: list = payload["elements"]
    remark = payload.get("remark")
    if isinstance(remark, str) and _RUNTIME_REMARK.search(remark) and not elements:
        # Overpass answers HTTP 200 with a remark when a query timed out server-side.
        raise ProviderTimeout()

    result = ParseResult(hit_cap=len(elements) >= max_elements)
    for element in elements:
        if not isinstance(element, dict) or element.get("type") not in _ELEMENT_TYPES:
            result.skipped += 1
            continue
        osm_id = element.get("id")
        tags_raw = element.get("tags")
        if isinstance(osm_id, bool) or not isinstance(osm_id, int) or not isinstance(tags_raw, dict):
            result.skipped += 1
            continue
        tags: Tags = {k: v for k, v in tags_raw.items() if isinstance(k, str) and isinstance(v, str)}
        if tags.get("access") in ("private", "no"):
            result.skipped += 1
            continue
        category = classify(tags, categories)
        coords = _coords(element)
        if category is None or coords is None:
            result.skipped += 1
            continue
        name = clean_text(tags.get("name") or tags.get("name:en"), 120)
        wheelchair = tags.get("wheelchair")
        result.places.append(
            RawPlace(
                id=f"osm:{element['type']}/{osm_id}",
                name=name or f"Unnamed {category.label.lower()}",
                named=name is not None,
                category_id=category.id,
                category=category.label,
                lat=coords[0],
                lon=coords[1],
                osm_url=f"https://www.openstreetmap.org/{element['type']}/{osm_id}",
                opening_hours=clean_text(tags.get("opening_hours"), 200),
                wheelchair=wheelchair if wheelchair in ("yes", "limited", "no") else None,
                website=safe_url(tags.get("website") or tags.get("contact:website")),
            )
        )
    return result


# ---------------------------------------------------------------- provider
class PlacesProvider(Protocol):
    """Anything that can return nearby candidates. Swap Overpass for another source by implementing this."""

    name: str

    async def search(
        self, lat: float, lon: float, radius_m: int, categories: tuple[CategoryDef, ...]
    ) -> list[RawPlace]: ...


class OverpassProvider:
    name = "overpass"

    def __init__(self, settings: Settings, transport: Optional[httpx.AsyncBaseTransport] = None):
        self._settings = settings
        self._transport = transport

    async def search(
        self, lat: float, lon: float, radius_m: int, categories: tuple[CategoryDef, ...]
    ) -> list[RawPlace]:
        query = build_query(lat, lon, radius_m, categories, self._settings)
        errors: list[ProviderError] = []
        headers = {"User-Agent": self._settings.user_agent, "Accept": "application/json"}
        async with httpx.AsyncClient(
            timeout=self._settings.overpass_timeout_s, transport=self._transport, headers=headers
        ) as client:
            for url in self._settings.overpass_urls:
                try:
                    return await self._one(client, url, query, categories)
                except ProviderError as exc:
                    errors.append(exc)
        raise _pick_error(errors)

    async def _one(
        self, client: httpx.AsyncClient, url: str, query: str, categories: tuple[CategoryDef, ...]
    ) -> list[RawPlace]:
        try:
            response = await client.post(url, data={"data": query})
        except httpx.TimeoutException as exc:
            raise ProviderTimeout() from exc
        except httpx.HTTPError as exc:
            raise ProviderUnavailable() from exc

        if response.status_code == 429:
            raise ProviderRateLimited()
        if response.status_code in (502, 503):
            raise ProviderUnavailable()
        if response.status_code == 504:
            raise ProviderTimeout()
        if response.status_code != 200:
            raise ProviderUnavailable()
        if len(response.content) > self._settings.overpass_max_response_bytes:
            raise ProviderBadResponse("The map data service sent too much data. Try a smaller search radius.")
        try:
            payload = response.json()
        except ValueError as exc:
            raise ProviderBadResponse() from exc
        return parse_overpass(payload, categories, self._settings.overpass_max_elements).places


def _pick_error(errors: list[ProviderError]) -> ProviderError:
    """When every endpoint failed, report the most actionable error to the user."""
    for kind in (ProviderRateLimited, ProviderTimeout, ProviderUnavailable, ProviderBadResponse):
        for err in errors:
            if isinstance(err, kind):
                return err
    return errors[-1] if errors else ProviderUnavailable()
