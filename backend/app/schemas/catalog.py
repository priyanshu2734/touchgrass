from typing import Literal

from pydantic import BaseModel

from app.models.vocab import AccessibilityNeed, Budget, Company, Difficulty, Interest


class CostRange(BaseModel):
    min: float
    max: float
    currency: str


class Activity(BaseModel):
    id: str
    title: str
    description: str
    category: Interest
    interests: list[Interest]
    duration_minutes: int
    budget: Budget
    estimated_cost: CostRange
    difficulty: Difficulty
    energy_required: Literal["low", "medium", "high"]
    accessibility: list[AccessibilityNeed]
    suitable_for: list[Company]
    steps: list[str]
    checklist: list[str]
    tips: list[str]
    challenge: str | None


class ActivityList(BaseModel):
    items: list[Activity]
    count: int
