"""Rule-based activity matching shared by the fallback planner and AI prompt grounding."""

from __future__ import annotations

from typing import Iterable

from app.models.domain import CatalogActivity, PlanInput
from app.models.vocab import BUDGET_RANK, ENERGY_RANK


def meets_hard_limits(activity: CatalogActivity, inp: PlanInput) -> bool:
    return (
        activity.duration_minutes <= inp.available_minutes
        and BUDGET_RANK[activity.budget] <= BUDGET_RANK[inp.budget]
        and ENERGY_RANK[activity.energy_required] <= ENERGY_RANK[inp.energy]
        and all(need in activity.accessibility for need in inp.accessibility_needs)
    )


def score(activity: CatalogActivity, inp: PlanInput) -> float:
    overlap = len(set(activity.interests) & set(inp.interests))
    company_bonus = 2.0 if inp.company in activity.suitable_for else 0.0
    time_fit = activity.duration_minutes / max(inp.available_minutes, 1)
    return overlap * 3.0 + company_bonus + time_fit * 2.0


def rank_activities(inp: PlanInput, catalogue: Iterable[CatalogActivity]) -> list[CatalogActivity]:
    """Activities that satisfy every hard limit, best match first (ties keep catalogue order)."""
    eligible = [a for a in catalogue if meets_hard_limits(a, inp)]
    return sorted(eligible, key=lambda a: -score(a, inp))
