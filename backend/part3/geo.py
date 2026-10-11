"""Pure geographic helpers (no I/O)."""
from __future__ import annotations

import math

EARTH_RADIUS_M = 6_371_008.8  # IUGG mean Earth radius


def valid_lat_lon(lat: object, lon: object) -> bool:
    """True only for finite numbers inside the WGS84 range. Booleans are rejected."""
    for value in (lat, lon):
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            return False
        if not math.isfinite(value):
            return False
    return -90.0 <= lat <= 90.0 and -180.0 <= lon <= 180.0  # type: ignore[operator]


def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle ("straight line") distance in metres. Not a walking distance."""
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = phi2 - phi1
    d_lambda = math.radians(lon2 - lon1)
    a = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    return 2 * EARTH_RADIUS_M * math.asin(min(1.0, math.sqrt(a)))


def round_coord(value: float, decimals: int = 3) -> float:
    """3 decimals is roughly 110 m. Used to reduce precision before anything leaves this server."""
    return round(value, decimals)
