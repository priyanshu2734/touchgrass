from fastapi import APIRouter, Query

from app.api.deps import ContainerDep
from app.core.errors import AppError
from app.models.vocab import Budget, Difficulty, Interest
from app.schemas.catalog import Activity, ActivityList

router = APIRouter(tags=["catalogue"])


@router.get(
    "/activities",
    response_model=ActivityList,
    summary="Built-in activity catalogue",
    description="`budget` returns activities affordable within that level (free < low < flexible).",
)
def list_activities(
    container: ContainerDep,
    category: Interest | None = Query(default=None),
    min_minutes: int | None = Query(default=None, ge=1, le=480),
    max_minutes: int | None = Query(default=None, ge=1, le=480),
    budget: Budget | None = Query(default=None),
    difficulty: Difficulty | None = Query(default=None),
    q: str | None = Query(default=None, max_length=80, description="Search title and description."),
) -> ActivityList:
    if min_minutes is not None and max_minutes is not None and min_minutes > max_minutes:
        raise AppError("min_minutes cannot be greater than max_minutes.")
    found = container.catalog.list_activities(
        category=category,
        min_minutes=min_minutes,
        max_minutes=max_minutes,
        budget=budget,
        difficulty=difficulty,
        query=q,
    )
    items = [Activity.model_validate(a.to_public_dict()) for a in found]
    return ActivityList(items=items, count=len(items))
