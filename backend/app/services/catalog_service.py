from __future__ import annotations

from app.data.activities import ACTIVITIES, ACTIVITIES_BY_ID
from app.models.domain import CatalogActivity
from app.models.vocab import BUDGET_RANK


class CatalogService:
    def list_activities(
        self,
        *,
        category: str | None = None,
        min_minutes: int | None = None,
        max_minutes: int | None = None,
        budget: str | None = None,
        difficulty: str | None = None,
        query: str | None = None,
    ) -> list[CatalogActivity]:
        """`budget` means "affordable within this budget level" (free < low < flexible)."""
        needle = query.strip().lower() if query else ""
        out: list[CatalogActivity] = []
        for a in ACTIVITIES:
            if category and a.category != category:
                continue
            if min_minutes is not None and a.duration_minutes < min_minutes:
                continue
            if max_minutes is not None and a.duration_minutes > max_minutes:
                continue
            if budget and BUDGET_RANK[a.budget] > BUDGET_RANK[budget]:
                continue
            if difficulty and a.difficulty != difficulty:
                continue
            if needle and needle not in f"{a.title} {a.description}".lower():
                continue
            out.append(a)
        return out

    def all_activities(self) -> tuple[CatalogActivity, ...]:
        return ACTIVITIES

    def get_activity(self, activity_id: str) -> CatalogActivity | None:
        return ACTIVITIES_BY_ID.get(activity_id)
