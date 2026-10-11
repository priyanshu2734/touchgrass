import asyncio
from datetime import datetime, timezone

from fastapi import APIRouter, Response

from app import __version__
from app.api.deps import ContainerDep
from app.schemas.health import AIHealth, AppInfo, DatabaseHealth, HealthResponse

router = APIRouter(tags=["health"])


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Application, database and AI availability",
    description=(
        "Returns 200 with status 'ok' or 'degraded'. 'degraded' means the AI model is not ready "
        "but plans still work through the clearly labelled non-AI fallback. Returns 503 if the database fails. "
        "No secrets, URLs or file paths are included."
    ),
)
async def health(container: ContainerDep, response: Response) -> HealthResponse:
    db_ok = await asyncio.to_thread(container.database.ping)
    ai = await container.ai_service.status()

    if not db_ok:
        status = "error"
        response.status_code = 503
    elif ai.status == "ready":
        status = "ok"
    else:
        status = "degraded"

    return HealthResponse(
        status=status,
        app=AppInfo(name="TouchGrass API", version=__version__, environment=container.settings.app_env),
        database=DatabaseHealth(status="ok" if db_ok else "error"),
        ai=AIHealth(
            provider=ai.provider,
            model=ai.model,
            status=ai.status,
            reachable=ai.reachable,
            model_available=ai.model_available,
            setup_hint=ai.setup_hint,
        ),
        time=datetime.now(timezone.utc),
    )
