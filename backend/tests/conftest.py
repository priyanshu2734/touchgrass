import dataclasses

import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import create_app
from tests.helpers import FakeGeocoder, FakePlaces, FakeProvider


@pytest.fixture
def settings(tmp_path) -> Settings:
    return Settings(database_path=str(tmp_path / "api.db"), ai_enabled=True)


@pytest.fixture
def make_client(settings):
    """Build a TestClient around a fresh app. The AI provider is always a fake; Ollama is never contacted."""

    def _make(provider=None, places_provider=None, geocoder=None, **setting_overrides) -> TestClient:
        effective = dataclasses.replace(settings, **setting_overrides) if setting_overrides else settings
        app = create_app(
            effective,
            ai_provider=provider if provider is not None else FakeProvider(),
            # Never contact OpenStreetMap services from tests.
            places_provider=places_provider if places_provider is not None else FakePlaces(),
            geocoder=geocoder if geocoder is not None else FakeGeocoder(),
        )
        return TestClient(app, raise_server_exceptions=False)

    return _make


@pytest.fixture
def client(make_client) -> TestClient:
    return make_client()


PLAN_BODY = {
    "available_minutes": 60,
    "budget": "low",
    "energy": "medium",
    "interests": ["nature", "photography"],
    "company": "solo",
}
