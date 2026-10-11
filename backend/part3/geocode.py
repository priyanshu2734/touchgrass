"""Nominatim-compatible geocoder. Only used when the person explicitly submits a typed place name."""
from __future__ import annotations

import asyncio
import time
from typing import Callable, Optional, Protocol

import httpx

from .config import Settings
from .errors import ProviderBadResponse, ProviderError, ProviderRateLimited, ProviderTimeout, ProviderUnavailable
from .geo import valid_lat_lon
from .models import GeocodeResult
from .overpass import clean_text


class Geocoder(Protocol):
    async def search(self, query: str, limit: int = 5) -> list[GeocodeResult]: ...


def parse_nominatim(payload: object, limit: int = 5) -> list[GeocodeResult]:
    if not isinstance(payload, list):
        raise ProviderBadResponse()
    results: list[GeocodeResult] = []
    for item in payload:
        if not isinstance(item, dict):
            continue
        label = clean_text(item.get("display_name"), 160)
        try:
            lat, lon = float(item.get("lat")), float(item.get("lon"))  # Nominatim sends strings
        except (TypeError, ValueError):
            continue
        if not label or not valid_lat_lon(lat, lon):
            continue
        results.append(GeocodeResult(label=label, lat=lat, lon=lon))
        if len(results) >= limit:
            break
    return results


class NominatimGeocoder:
    def __init__(
        self,
        settings: Settings,
        transport: Optional[httpx.AsyncBaseTransport] = None,
        clock: Callable[[], float] = time.monotonic,
        sleep: Callable[[float], "asyncio.Future"] = asyncio.sleep,
    ):
        self._s = settings
        self._transport = transport
        self._clock = clock
        self._sleep = sleep
        self._lock = asyncio.Lock()
        self._last_call = -1e9
        self._cache: dict[str, tuple[float, list[GeocodeResult]]] = {}

    async def search(self, query: str, limit: int = 5) -> list[GeocodeResult]:
        key = " ".join(query.casefold().split())
        hit = self._cache.get(key)
        if hit and self._clock() - hit[0] < self._s.geocode_cache_ttl_s:
            return hit[1]

        async with self._lock:  # serialises calls so we never exceed 1 request/second upstream
            wait = self._s.geocode_min_interval_s - (self._clock() - self._last_call)
            if wait > 0:
                await self._sleep(wait)
            self._last_call = self._clock()
            results = await self._request(query, limit)

        if len(self._cache) > 500:
            self._cache.clear()
        self._cache[key] = (self._clock(), results)
        return results

    async def _request(self, query: str, limit: int) -> list[GeocodeResult]:
        params = {"q": query, "format": "jsonv2", "limit": str(limit), "addressdetails": "0"}
        headers = {"User-Agent": self._s.user_agent, "Accept": "application/json"}
        try:
            async with httpx.AsyncClient(
                timeout=self._s.geocode_timeout_s, transport=self._transport, headers=headers
            ) as client:
                response = await client.get(self._s.nominatim_url, params=params)
        except httpx.TimeoutException as exc:
            raise ProviderTimeout("The place search took too long. Try again or enter coordinates.") from exc
        except httpx.HTTPError as exc:
            raise ProviderUnavailable("The place search is unavailable. Try again later or enter coordinates.") from exc
        if response.status_code == 429:
            raise ProviderRateLimited("The place search is busy. Wait a minute and try again.")
        if response.status_code != 200:
            raise ProviderUnavailable("The place search is unavailable. Try again later or enter coordinates.")
        try:
            return parse_nominatim(response.json(), limit)
        except ValueError as exc:
            raise ProviderBadResponse() from exc
