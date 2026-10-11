from fastapi import APIRouter

from app.api.routes import activities, health, plan

# Quests, progress, places and geocoding are served by the `part3` package, mounted in app.main.create_app.
api_router = APIRouter(prefix="/api")
for module in (health, plan, activities):
    api_router.include_router(module.router)
