"""Plain-Python domain objects. No framework imports so the core logic stays testable."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class PlanInput:
    """The only user data that planning logic and the AI prompt ever see."""

    available_minutes: int
    budget: str
    energy: str
    interests: tuple[str, ...]
    company: str
    accessibility_needs: tuple[str, ...]
    area: str | None = None  # coarse place name only, never coordinates
    notes: str | None = None


@dataclass(frozen=True)
class CatalogActivity:
    id: str
    title: str
    description: str
    category: str
    interests: tuple[str, ...]
    duration_minutes: int
    budget: str
    cost_min: float
    cost_max: float
    difficulty: str
    energy_required: str
    accessibility: tuple[str, ...]
    suitable_for: tuple[str, ...]
    steps: tuple[str, ...]  # "Short title: what to do"
    checklist: tuple[str, ...]
    tips: tuple[str, ...]
    challenge: str | None = None
    cost_note: str = ""

    def to_public_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "category": self.category,
            "interests": list(self.interests),
            "duration_minutes": self.duration_minutes,
            "budget": self.budget,
            "estimated_cost": {"min": self.cost_min, "max": self.cost_max, "currency": "USD"},
            "difficulty": self.difficulty,
            "energy_required": self.energy_required,
            "accessibility": list(self.accessibility),
            "suitable_for": list(self.suitable_for),
            "steps": list(self.steps),
            "checklist": list(self.checklist),
            "tips": list(self.tips),
            "challenge": self.challenge,
        }


@dataclass(frozen=True)
class PlanHistoryRecord:
    plan_id: str
    profile_id: str
    created_at: str
    generated_by: str
    model: str | None
    title: str
    total_minutes: int
    budget: str
    energy: str
    interests: tuple[str, ...]
