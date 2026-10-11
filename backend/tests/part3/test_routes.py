import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from part3.config import Settings
from part3.errors import ProviderRateLimited, ProviderTimeout, ProviderUnavailable
from part3.models import GeocodeResult
from part3.overpass import RawPlace
from part3.routes import build_container, mount_part3


class FakeProvider:
    name = "fake"

    def __init__(self, result=None, error=None):
        self.result, self.error, self.calls = result or [], error, 0

    async def search(self, lat, lon, radius_m, categories):
        self.calls += 1
        if self.error:
            raise self.error
        return self.result


class FakeGeocoder:
    def __init__(self, error=None):
        self.error = error

    async def search(self, query, limit=5):
        if self.error:
            raise self.error
        return [GeocodeResult(label=f"{query}, Somewhere", lat=1.5, lon=2.5)]


def raw(name, lat, lon, **kw):
    return RawPlace(id="osm:way/1", name=name, named=True, category_id="park", category="Park", lat=lat, lon=lon,
                    osm_url="https://www.openstreetmap.org/way/1", **kw)


def make_client(tmp_path, provider=None, geocoder=None, **settings):
    s = Settings(db_path=str(tmp_path / "r.db"), contact="test", **settings)
    container = build_container(s, provider=provider or FakeProvider(), geocoder=geocoder or FakeGeocoder())
    app = FastAPI()
    mount_part3(app, s, container=container)
    return TestClient(app)


# ------------------------------------------------------------ places
def test_places_contract_shape(tmp_path):
    client = make_client(tmp_path, FakeProvider([raw("Test Park", 20.297, 85.825, opening_hours="Mo-Su 06:00-20:00")]))
    r = client.get("/api/places", params={"lat": 20.296, "lon": 85.824, "radius": 1000})
    assert r.status_code == 200
    [place] = r.json()
    assert {"id", "name", "category", "lat", "lon", "distanceMeters"} <= set(place)
    assert place["openingHours"] == "Mo-Su 06:00-20:00"
    assert "wheelchair" not in place and "website" not in place  # missing data is omitted, never invented


@pytest.mark.parametrize("params", [{"lat": 91, "lon": 0}, {"lat": 0, "lon": 181}, {"lat": "x", "lon": 0}, {"lon": 0}, {"lat": 0, "lon": 0, "radius": 0}])
def test_places_rejects_bad_input(tmp_path, params):
    assert make_client(tmp_path).get("/api/places", params=params).status_code == 422


@pytest.mark.parametrize(
    "error,status,fragment",
    [(ProviderRateLimited(), 429, "busy"), (ProviderTimeout(), 504, "too long"), (ProviderUnavailable(), 503, "unavailable")],
)
def test_places_maps_upstream_errors_to_clear_messages(tmp_path, error, status, fragment):
    r = make_client(tmp_path, FakeProvider(error=error)).get("/api/places", params={"lat": 1, "lon": 1})
    assert r.status_code == status
    assert fragment in r.json()["detail"]


def test_places_empty_result_is_an_empty_list(tmp_path):
    r = make_client(tmp_path).get("/api/places", params={"lat": 1, "lon": 1})
    assert r.status_code == 200 and r.json() == []


def test_places_rate_limited_per_client(tmp_path):
    client = make_client(tmp_path, places_rate_per_minute=2)
    codes = [client.get("/api/places", params={"lat": 1, "lon": 1}).status_code for _ in range(3)]
    assert codes == [200, 200, 429]
    r = client.get("/api/places", params={"lat": 1, "lon": 1})
    assert "Retry-After" in r.headers


def test_categories_endpoint(tmp_path):
    cats = make_client(tmp_path).get("/api/places/categories").json()
    assert {"id": "park", "label": "Park", "defaultOn": True} in cats
    assert next(c for c in cats if c["id"] == "trail")["defaultOn"] is False


# ------------------------------------------------------------ geocode
def test_geocode_ok_and_validation(tmp_path):
    client = make_client(tmp_path)
    assert client.get("/api/geocode", params={"q": "Puri"}).json() == [{"label": "Puri, Somewhere", "lat": 1.5, "lon": 2.5}]
    assert client.get("/api/geocode", params={"q": "a"}).status_code == 422
    assert client.get("/api/geocode", params={"q": "x" * 101}).status_code == 422


def test_geocode_error_has_detail(tmp_path):
    client = make_client(tmp_path, geocoder=FakeGeocoder(ProviderUnavailable("Place search is down.")))
    r = client.get("/api/geocode", params={"q": "Puri"})
    assert r.status_code == 503 and r.json()["detail"] == "Place search is down."


# ------------------------------------------------------------ quests + progress round trip
def test_quest_roundtrip_through_http(tmp_path):
    client = make_client(tmp_path)
    quests = client.get("/api/quests").json()
    quest = next(q for q in quests if q["id"] == "cloud-spotter")
    assert quest["status"] == "available" and quest["origin"] == "curated"
    assert quest["equipment"] is not None and quest["completionCriteria"] and quest["indoorFallback"]

    started = client.post("/api/quests/cloud-spotter/start").json()
    assert started["status"] == "in-progress"

    r = client.post(
        "/api/quests/cloud-spotter/complete",
        params={"today": "2026-10-10"},
        json={"minutesSpent": 14, "reflection": "Clouds moved fast", "localDate": "2026-10-10"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["quest"]["status"] == "completed"
    assert body["progress"]["completedActivities"] == 1 and body["progress"]["outdoorMinutes"] == 14
    assert body["progress"]["recent"][0]["note"] == "Clouds moved fast"

    again = client.post("/api/quests/cloud-spotter/complete")  # no body = original Part 1 call
    assert again.status_code == 200 and again.json()["progress"]["completedActivities"] == 1

    progress = client.get("/api/progress", params={"today": "2026-10-10"}).json()
    assert progress["currentStreak"] == 1


def test_complete_unknown_quest_is_404(tmp_path):
    r = make_client(tmp_path).post("/api/quests/nope/complete")
    assert r.status_code == 404 and r.json()["detail"] == "That quest could not be found."


def test_complete_validation_errors(tmp_path):
    client = make_client(tmp_path)
    assert client.post("/api/quests/cloud-spotter/complete", json={"minutesSpent": 0}).status_code == 422
    assert client.post("/api/quests/cloud-spotter/complete", json={"localDate": "2030-01-01"}).status_code == 422
    assert client.post("/api/quests/cloud-spotter/complete", params={"today": "bad"}).status_code == 422


def test_sessions_notes_and_delete_over_http(tmp_path):
    client = make_client(tmp_path)
    p = client.post("/api/outdoor-sessions", json={"minutes": 20, "note": "Market walk"}).json()
    entry = p["recent"][0]
    assert p["outdoorMinutes"] == 20 and entry["kind"] == "session"
    p = client.patch(f"/api/progress/entries/{entry['id']}", json={"note": "Market walk, sunny"}).json()
    assert p["recent"][0]["note"] == "Market walk, sunny"
    p = client.delete(f"/api/progress/entries/{entry['id']}").json()
    assert p["recent"] == [] and p["outdoorMinutes"] == 0
    assert client.delete(f"/api/progress/entries/{entry['id']}").status_code == 404
    assert client.post("/api/outdoor-sessions", json={"minutes": 0}).status_code == 422
