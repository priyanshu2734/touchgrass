"""Wires settings, repositories and services together. Built once per app instance."""

from dataclasses import dataclass

from app.core.config import Settings
from app.repositories.database import Database
from app.repositories.history import HistoryRepository
from app.services.ai_provider import AIProvider
from app.services.ai_service import AIService
from app.services.catalog_service import CatalogService
from app.services.ollama_provider import OllamaProvider
from app.services.planner_service import PlannerService


@dataclass
class Container:
    settings: Settings
    database: Database
    history: HistoryRepository
    catalog: CatalogService
    ai_service: AIService
    planner: PlannerService


def build_container(settings: Settings, *, ai_provider: AIProvider | None = None) -> Container:
    database = Database(settings.database_path)
    database.init_schema()

    provider: AIProvider | None = None
    if settings.ai_enabled:
        provider = ai_provider or OllamaProvider(
            settings.ollama_base_url,
            settings.ollama_model,
            timeout_seconds=settings.ollama_timeout_seconds,
            connect_timeout_seconds=settings.ollama_connect_timeout_seconds,
            temperature=settings.ollama_temperature,
            num_predict=settings.ollama_num_predict,
            keep_alive=settings.ollama_keep_alive,
        )

    catalog = CatalogService()
    history = HistoryRepository(database)
    ai_service = AIService(provider, enabled=settings.ai_enabled)
    return Container(
        settings=settings,
        database=database,
        history=history,
        catalog=catalog,
        ai_service=ai_service,
        planner=PlannerService(ai_service, catalog, history),
    )
