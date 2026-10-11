"""Orchestrates a places search: input rounding, caching, true-distance filtering, de-duplication, ordering."""
from __future__ import annotations

import time
from collections import OrderedDict
from typing import Callable, Optional, Sequence

from .config import Settings
from .geo import haversine_m, round_coord, valid_lat_lon
from .models import Place
from .overpass import PlacesProvider, RawPlace, resolve_categories

DEDUPE_DISTANCE_M = 800.0
UPSTREAM_PADDING_M = 200  # we query from a rounded centre, so pad and re-filter by the true distance


def dedupe(places: Sequence[RawPlace], distance_of: Callable[[RawPlace], float]) -> list[RawPlace]:
    """OSM often maps one park as several ways/relations. Keep the closest of near-identical same-name entries."""
    kept: list[RawPlace] = []
    for place in sorted(places, key=distance_of):
        if place.named:
            twin = next(
                (
                    k
                    for k in kept
                    if k.named
                    and k.category_id == place.category_id
                    and k.name.casefold() == place.name.casefold()
                    and haversine_m(k.lat, k.lon, place.lat, place.lon) <= DEDUPE_DISTANCE_M
                ),
                None,
            )
            if twin is not None:
                continue
        kept.append(place)
    return kept


class PlacesService:
    def __init__(self, provider: PlacesProvider, settings: Settings, clock: Callable[[], float] = time.monotonic):
        self._provider = provider
        self._settings = settings
        self._clock = clock
        self._cache: "OrderedDict[tuple, tuple[float, list[RawPlace]]]" = OrderedDict()

    async def search(
        self,
        lat: float,
        lon: float,
        radius_m: Optional[int] = None,
        categories: Optional[Sequence[str]] = None,
        limit: Optional[int] = None,
        include_unnamed: bool = False,
    ) -> list[Place]:
        if not valid_lat_lon(lat, lon):
            raise ValueError("Coordinates are outside the valid range.")
        s = self._settings
        radius = max(s.min_radius_m, min(int(radius_m or s.default_radius_m), s.max_radius_m))
        cap = max(1, min(int(limit or s.default_limit), s.max_limit))
        cats = resolve_categories(categories)

        # Privacy: only a ~110 m precision centre is ever sent to the upstream provider or used as a cache key.
        qlat, qlon = round_coord(lat), round_coord(lon)
        key = (qlat, qlon, radius, tuple(c.id for c in cats))
        raw = self._cache_get(key)
        if raw is None:
            raw = await self._provider.search(qlat, qlon, radius + UPSTREAM_PADDING_M, cats)
            self._cache_put(key, raw)

        def dist(p: RawPlace) -> float:
            return haversine_m(lat, lon, p.lat, p.lon)

        within = [p for p in raw if dist(p) <= radius and (include_unnamed or p.named)]
        unique = dedupe(within, dist)
        unique.sort(key=lambda p: (dist(p), p.name.casefold()))
        return [self._to_place(p, dist(p)) for p in unique[:cap]]

    @staticmethod
    def _to_place(p: RawPlace, distance: float) -> Place:
        return Place(
            id=p.id,
            name=p.name,
            category=p.category,
            lat=p.lat,
            lon=p.lon,
            distance_meters=round(distance),
            category_id=p.category_id,
            osm_url=p.osm_url,
            opening_hours=p.opening_hours,
            wheelchair=p.wheelchair,
            website=p.website,
            named=p.named,
        )

    # ---- tiny TTL + LRU cache (memory only; nothing is written to disk)
    def _cache_get(self, key: tuple) -> Optional[list[RawPlace]]:
        hit = self._cache.get(key)
        if hit is None:
            return None
        stored_at, value = hit
        if self._clock() - stored_at > self._settings.cache_ttl_s:
            self._cache.pop(key, None)
            return None
        self._cache.move_to_end(key)
        return value

    def _cache_put(self, key: tuple, value: list[RawPlace]) -> None:
        self._cache[key] = (self._clock(), value)
        self._cache.move_to_end(key)
        while len(self._cache) > self._settings.cache_max_entries:
            self._cache.popitem(last=False)
