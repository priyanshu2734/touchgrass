from fastapi import APIRouter, Query

from app.api.deps import ContainerDep, ProfileDep
from app.schemas.errors import ErrorResponse
from app.schemas.plan import ActivityPlan, PlanRequest, PlanResponse
from app.schemas.history import PlanHistory, PlanHistoryItem

router = APIRouter(tags=["plans"])


@router.post(
    "/plan",
    response_model=PlanResponse,
    summary="Generate an outdoor activity plan",
    description=(
        "Sends the structured preferences (never coordinates) to the local open-weight model, validates the reply "
        "and returns it with generated_by='ai'. If the model is unavailable, times out or returns an unusable reply, "
        "a plan built from the built-in catalogue is returned with generated_by='fallback', a fallback_reason and a "
        "message. A fallback plan is never labelled as AI. The first request after starting Ollama can be slow while "
        "the model loads."
    ),
    responses={422: {"model": ErrorResponse}},
)
async def create_plan(payload: PlanRequest, container: ContainerDep, profile_id: ProfileDep) -> PlanResponse:
    result = await container.planner.create_plan(payload.to_input(), profile_id)
    return PlanResponse(
        generated_by=result.generated_by,
        model=result.model,
        fallback_reason=result.fallback_reason,
        message=result.message,
        plan=ActivityPlan.model_validate(result.plan),
    )


@router.get(
    "/history",
    response_model=PlanHistory,
    summary="Recent plans generated for this anonymous profile",
    description="A privacy-safe summary only. Location and notes are never stored.",
)
def plan_history(
    container: ContainerDep, profile_id: ProfileDep, limit: int = Query(20, ge=1, le=100)
) -> PlanHistory:
    records = container.history.list_recent(profile_id, limit)
    items = [
        PlanHistoryItem(
            plan_id=r.plan_id,
            created_at=r.created_at,
            generated_by=r.generated_by,
            model=r.model,
            title=r.title,
            total_minutes=r.total_minutes,
            budget=r.budget,
            energy=r.energy,
            interests=list(r.interests),
        )
        for r in records
    ]
    return PlanHistory(items=items, count=len(items))
