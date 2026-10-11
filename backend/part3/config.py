"""Settings for the Part 3 package. In the integrated app they are derived from `app.core.config.Settings`
(see `app/core/part3.py`), so there is a single set of environment variables.

No secrets are required: the default providers (Overpass, Nominatim) are public and key-less.
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    # --- Places provider (Overpass-compatible). Tried in order; first success wins. ---
    overpass_urls: tuple[str, ...] = ("https://overpass-api.de/api/interpreter",)
    overpass_timeout_s: float = 20.0  # per HTTP attempt
    overpass_query_timeout_s: int = 15  # [timeout:N] passed to Overpass itself
    overpass_max_elements: int = 400  # `out ... N` cap per upstream query
    overpass_max_response_bytes: int = 5_000_000

    # --- Geocoder (Nominatim-compatible) ---
    nominatim_url: str = "https://nominatim.openstreetmap.org/search"
    geocode_timeout_s: float = 8.0
    geocode_min_interval_s: float = 1.1  # public Nominatim allows max 1 request/second
    geocode_cache_ttl_s: int = 3600

    # Public OSM services require an identifying User-Agent. Set OSM_CONTACT to a URL or email.
    contact: str = "contact-not-set"

    # --- Limits ---
    default_radius_m: int = 2000
    min_radius_m: int = 200
    max_radius_m: int = 15000
    default_limit: int = 40
    max_limit: int = 100
    cache_ttl_s: int = 600
    cache_max_entries: int = 256
    places_rate_per_minute: int = 20
    geocode_rate_per_minute: int = 10

    # --- Storage ---
    db_path: str = "touchgrass_part3.db"

    @property
    def user_agent(self) -> str:
        return f"TouchGrass/1.0 ({self.contact})"
