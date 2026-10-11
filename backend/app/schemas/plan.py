import re
from datetime import datetime
from typing import Literal

from pydantic import AliasChoices, BaseModel, ConfigDict, Field, field_validator, model_validator

from app.models.domain import PlanInput
from app.models.vocab import AccessibilityNeed, Budget, Company, Difficulty, Energy, Interest

_CTRL = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")


def _clean(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = " ".join(_CTRL.sub("", value).split())
    return cleaned or None


class LocationInput(BaseModel):
    """Optional and coarse. Coordinates are rounded to 2 decimals (about 1 km) and are never sent to the AI model or stored."""

    label: str | None = Field(default=None, max_length=80, description="Area name such as a city or neighbourhood.")
    lat: float | None = Field(default=None, ge=-90, le=90)
    lon: float | None = Field(default=None, ge=-180, le=180)

    @field_validator("label")
    @classmethod
    def _clean_label(cls, value: str | None) -> str | None:
        return _clean(value)

    @field_validator("lat", "lon")
    @classmethod
    def _round(cls, value: float | None) -> float | None:
        return None if value is None else round(value, 2)

    @model_validator(mode="after")
    def _pair(self) -> "LocationInput":
        if (self.lat is None) != (self.lon is None):
            raise ValueError("lat and lon must be provided together")
        return self


class PlanRequest(BaseModel):
    """Preferences for one plan. `minutes` and `accessibility` are accepted as aliases because the frontend uses those names."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)

    available_minutes: int = Field(
        validation_alias=AliasChoices("available_minutes", "minutes"),
        ge=5,
        le=480,
        description="Minutes available, 5 to 480.",
    )
    budget: Budget
    energy: Energy
    interests: list[Interest] = Field(min_length=1, max_length=8)
    company: Company = "solo"
    accessibility_needs: list[AccessibilityNeed] = Field(
        default_factory=list,
        max_length=5,
        validation_alias=AliasChoices("accessibility_needs", "accessibility"),
    )
    notes: str | None = Field(default=None, max_length=300, description="Optional free text. It is sent to the AI model.")
    location: LocationInput | None = None

    @field_validator("interests", "accessibility_needs")
    @classmethod
    def _dedupe(cls, value: list[str]) -> list[str]:
        return list(dict.fromkeys(value))

    @field_validator("notes")
    @classmethod
    def _clean_notes(cls, value: str | None) -> str | None:
        return _clean(value)

    def to_input(self) -> PlanInput:
        """The only fields that reach planning logic and the model. Coordinates are deliberately excluded."""
        return PlanInput(
            available_minutes=self.available_minutes,
            budget=self.budget,
            energy=self.energy,
            interests=tuple(self.interests),
            company=self.company,
            accessibility_needs=tuple(self.accessibility_needs),
            area=self.location.label if self.location else None,
            notes=self.notes,
        )


class PlanStep(BaseModel):
    order: int = Field(ge=1)
    title: str
    description: str
    duration_minutes: int = Field(ge=1)


class CostEstimate(BaseModel):
    min: float = Field(ge=0)
    max: float = Field(ge=0)
    currency: str
    assumptions: str


class BackupPlan(BaseModel):
    title: str
    description: str
    duration_minutes: int = Field(ge=1)
    when_to_use: str


class ActivityPlan(BaseModel):
    id: str
    generated_by: Literal["ai", "fallback"]
    model: str | None = Field(description="Model name when generated_by is 'ai', otherwise null.")
    generated_at: datetime
    title: str
    summary: str
    why_it_matches: str
    total_minutes: int = Field(ge=1)
    steps: list[PlanStep] = Field(min_length=1)
    estimated_cost: CostEstimate
    difficulty: Difficulty
    energy_required: Energy
    checklist: list[str]
    challenge: str | None
    accessibility_adaptations: list[str]
    backup_plan: BackupPlan
    safety_reminders: list[str]
    phone_away_suggestion: str


class PlanResponse(BaseModel):
    generated_by: Literal["ai", "fallback"] = Field(description="'ai' only when the model produced this plan.")
    model: str | None
    fallback_reason: str | None = Field(description="Machine-readable reason when generated_by is 'fallback'.")
    message: str | None = Field(description="Human-readable note shown when the fallback was used.")
    plan: ActivityPlan
