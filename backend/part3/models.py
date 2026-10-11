"""Pydantic models. Field names serialise as camelCase to match the Part 1 TypeScript types."""
from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

Budget = Literal["free", "low", "flexible"]
Energy = Literal["low", "medium", "high"]
Difficulty = Literal["easy", "moderate", "challenging"]
Company = Literal["solo", "friends", "family", "group"]
Travel = Literal["doorstep", "nearby", "short-trip"]
QuestCategory = Literal["nature-observation", "photography", "gardening", "walking", "kindness", "social"]
QuestStatus = Literal["available", "in-progress", "completed"]
Accessibility = Literal["step-free", "seating", "shade", "low-sensory", "short-distance"]
Interest = Literal[
    "walking", "nature", "photography", "gardening", "fitness", "birdwatching", "creativity", "social"
]


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


# ---------------------------------------------------------------- places
class Place(CamelModel):
    """Part 1 contract: id, name, category, lat, lon, distanceMeters?. Everything after is optional and additive."""

    id: str
    name: str
    category: str
    lat: float
    lon: float
    distance_meters: Optional[float] = None
    category_id: Optional[str] = None
    osm_url: Optional[str] = None
    opening_hours: Optional[str] = None  # raw OSM `opening_hours` tag, unverified
    wheelchair: Optional[str] = None  # raw OSM `wheelchair` tag: yes | limited | no
    website: Optional[str] = None
    named: bool = True


class GeocodeResult(CamelModel):
    label: str
    lat: float
    lon: float


# ---------------------------------------------------------------- quests
class IndoorFallback(CamelModel):
    title: str
    summary: str
    minutes: int


class QuestSeed(CamelModel):
    """A curated quest as stored in data/quests.json."""

    id: str
    title: str
    summary: str
    objective: str
    category: QuestCategory
    difficulty: Difficulty
    minutes: int
    steps: list[str]
    equipment: list[str]
    completion_criteria: list[str]
    tip: Optional[str] = None
    budget: Budget
    energy: Energy
    accessibility: list[Accessibility]
    company: list[Company]
    interests: list[Interest]
    travel: Travel
    weather_sensitive: bool
    indoor_fallback: IndoorFallback


class Quest(QuestSeed):
    status: QuestStatus
    origin: Literal["curated"] = "curated"
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    completion_count: int = 0


class CompleteRequest(CamelModel):
    minutes_spent: Optional[int] = Field(default=None, ge=1, le=600)
    reflection: Optional[str] = Field(default=None, max_length=500)
    repeat: bool = False
    local_date: Optional[str] = Field(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$")


class SessionRequest(CamelModel):
    minutes: int = Field(ge=1, le=600)
    note: Optional[str] = Field(default=None, max_length=500)
    local_date: Optional[str] = Field(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$")


class NoteRequest(CamelModel):
    note: Optional[str] = Field(default=None, max_length=500)


class Milestone(CamelModel):
    id: str
    title: str
    description: str
    target: int
    current: int
    unit: Literal["quests", "days", "minutes"]
    achieved: bool


class ProgressEntry(CamelModel):
    id: str
    kind: Literal["quest", "session"]
    quest_id: str
    title: str
    completed_at: str
    local_date: str
    minutes: int
    note: Optional[str] = None


class Progress(CamelModel):
    completed_activities: int
    outdoor_minutes: int
    current_streak: int
    longest_streak: int
    milestones: list[Milestone]
    recent: list[ProgressEntry]
    active_days: int = 0
    sessions_logged: int = 0
    active_dates: list[str] = []
    plans_generated: Optional[int] = None  # filled in by the host app when it keeps plan history


class CompleteQuestResponse(CamelModel):
    quest: Quest
    progress: Progress
