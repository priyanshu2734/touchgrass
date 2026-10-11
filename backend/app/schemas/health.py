from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class AppInfo(BaseModel):
    name: str
    version: str
    environment: str


class DatabaseHealth(BaseModel):
    status: Literal["ok", "error"]


class AIHealth(BaseModel):
    provider: str
    model: str
    status: Literal["ready", "model_missing", "unreachable", "disabled"]
    reachable: bool
    model_available: bool
    setup_hint: str | None = Field(description="What to do next when the AI is not ready.")


class HealthResponse(BaseModel):
    status: Literal["ok", "degraded", "error"] = Field(
        description="ok: everything ready. degraded: database fine but AI not ready (fallback plans still work). error: database failing."
    )
    app: AppInfo
    database: DatabaseHealth
    ai: AIHealth
    time: datetime
