"""Shared test helpers. Nothing here needs a running Ollama server."""

from __future__ import annotations

import copy
import json
from typing import Any

from app.models.domain import PlanInput
from app.services.ai_provider import ProviderStatus


def make_input(**overrides: Any) -> PlanInput:
    data: dict[str, Any] = dict(
        available_minutes=60,
        budget="low",
        energy="medium",
        interests=("nature", "photography"),
        company="solo",
        accessibility_needs=(),
        area=None,
        notes=None,
    )
    data.update(overrides)
    return PlanInput(**data)


def valid_ai_payload(**overrides: Any) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "title": "Golden-hour park loop",
        "summary": "A slow loop through the nearest park, stopping to photograph light and shadow.",
        "why_it_matches": "It fits an hour, a small budget and medium energy, and covers photography and nature.",
        "steps": [
            {"title": "Walk to the park", "description": "Leave the phone in your pocket and walk calmly.", "duration_minutes": 10},
            {"title": "Photograph light", "description": "Take five photos of shadows and glowing leaves.", "duration_minutes": 20},
            {"title": "Bench pause", "description": "Sit on a bench and name three birds or sounds.", "duration_minutes": 15},
        ],
        "estimated_cost": {"min": 0, "max": 3, "assumptions": "Assumes you walk and bring water from home."},
        "difficulty": "easy",
        "energy_required": "low",
        "checklist": ["Water bottle", "Charged phone or camera", "Comfortable shoes"],
        "challenge": "Find five different shades of green.",
        "accessibility_adaptations": [],
        "backup_plan": {
            "title": "Window sky watch",
            "description": "Watch the sky from a window for ten minutes and sketch the clouds.",
            "duration_minutes": 10,
            "when_to_use": "Use this if it rains or your energy drops.",
        },
        "safety_reminders": ["Tell someone where you are going.", "Head home if the weather turns."],
        "phone_away_suggestion": "Keep your phone on silent in a pocket except for photos.",
    }
    payload.update(overrides)
    return copy.deepcopy(payload)


class FakeProvider:
    """Stands in for Ollama. Configure a reply, an error to raise, or a status."""

    name = "fake"
    model = "fake-model:1b"

    def __init__(
        self,
        reply: Any = None,
        error: Exception | None = None,
        status: ProviderStatus | None = None,
    ) -> None:
        self.reply = valid_ai_payload() if reply is None and error is None else reply
        self.error = error
        self.status = status or ProviderStatus(reachable=True, model_available=True, installed_models=("fake-model:1b",))
        self.calls: list[dict[str, Any]] = []

    async def check(self) -> ProviderStatus:
        return self.status

    async def generate_json(self, *, system: str, user: str, schema: dict[str, Any]) -> str:
        self.calls.append({"system": system, "user": user, "schema": schema})
        if self.error is not None:
            raise self.error
        return self.reply if isinstance(self.reply, str) else json.dumps(self.reply)


class FakePlaces:
    """Stands in for Overpass. Returns the given places (or none) and records calls; coordinates are never real."""

    name = "fake-places"

    def __init__(self, places=None, error: Exception | None = None) -> None:
        self.places = list(places or [])
        self.error = error
        self.calls: list[tuple[float, float, int]] = []

    async def search(self, lat, lon, radius_m, categories):
        self.calls.append((lat, lon, radius_m))
        if self.error is not None:
            raise self.error
        return list(self.places)


class FakeGeocoder:
    def __init__(self, error: Exception | None = None) -> None:
        self.error = error

    async def search(self, query, limit=5):
        from part3.models import GeocodeResult

        if self.error is not None:
            raise self.error
        return [GeocodeResult(label=f"{query}, Testland", lat=12.5, lon=45.5)]


def raw_place(name="Test Park", lat=20.3, lon=85.8, category_id="park", **extra):
    from part3.overpass import RawPlace

    return RawPlace(
        id="osm:way/1", name=name, named=True, category_id=category_id, category=category_id.title(),
        lat=lat, lon=lon, osm_url="https://www.openstreetmap.org/way/1", **extra,
    )
