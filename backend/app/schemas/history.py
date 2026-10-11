from datetime import datetime
from typing import Literal

from pydantic import BaseModel

from app.models.vocab import Budget, Energy, Interest


class PlanHistoryItem(BaseModel):
    plan_id: str
    created_at: datetime
    generated_by: Literal["ai", "fallback"]
    model: str | None
    title: str
    total_minutes: int
    budget: Budget
    energy: Energy
    interests: list[Interest]


class PlanHistory(BaseModel):
    items: list[PlanHistoryItem]
    count: int
