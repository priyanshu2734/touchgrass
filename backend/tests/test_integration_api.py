"""Part 2 (AI planner, catalogue) and Part 3 (places, quests, progress) working as ONE application."""
import sqlite3

import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from part3.errors import ProviderRateLimited, ProviderTimeout, ProviderUnavailable
from tests.conftest import PLAN_BODY
from tests.helpers import FakeGeocoder, FakePlaces, FakeProvider, raw_place

A = {"X-Profile-Id": "profile-aaaa-1111"}
B = {"X-Profile-Id": "profile-bbbb-2222"}


# ---------------------------------------------------------------- one app, no duplicate or missing routes
def test_every_documented_route_exists_exactly_once(client):
    paths = client.get("/openapi.json").json()["paths"]
    expected = {
        "/api/health": {"get"},
        "/api/plan": {"post"},
        "/api/history": {"get"},
        "/api/activities": {"get"},
        "/api/quests": {"get"},
        "/api/quests/{quest_id}/start": {"post", "delete"},
        "/api/quests/{quest_id}/complete": {"post"},
        "/api/progress": {"get"},
        "/api/outdoor-sessions": {"post"},
        "/api/progress/entries/{entry_id}": {"patch", "delete"},
        "/api/places": {"get"},
        "/api/places/categories": {"get"},
        "/api/geocode": {"get"},
    }
    for path, methods in expected.items():
        assert path in paths, path
        assert methods <= set(paths[path]), path


def test_planner_and_catalogue_still_use_the_part2_contract(client):
    plan = client.post("/api/plan", json=PLAN_BODY, headers=A).json()
    assert plan["generated_by"] == "ai" and plan["model"] == "fake-model:1b"
    assert "items" in client.get("/api/activities").json()


# ---------------------------------------------------------------- quests and progress (Part 3 logic, Part 2 profiles)
def test_quest_list_is_the_curated_catalogue_with_part1_ids_preserved(client):
    quests = client.get("/api/quests", headers=A).json()
    assert isinstance(quests, list) and len(quests) >= 20
    ids = {q["id"] for q in quests}
    assert {"name-three-birds", "cloud-spotter", "light-and-shadow", "closer-than-usual", "seed-to-sprout",
            "tend-a-patch", "phone-away-walk", "two-stops-farther", "pick-up-ten", "say-hello-neighbour"} <= ids
    assert all(q["status"] == "available" and q["origin"] == "curated" for q in quests)
    assert all(q["steps"] and q["completionCriteria"] and q["indoorFallback"] for q in quests)


def test_quest_filters_are_kept_from_part2(client):
    walking = client.get("/api/quests", params={"category": "walking"}).json()
    assert walking and all(q["category"] == "walking" for q in walking)
    hard = client.get("/api/quests", params={"difficulty": "moderate"}).json()
    assert hard and all(q["difficulty"] == "moderate" for q in hard)
    assert client.get("/api/quests", params={"category": "bogus"}).status_code == 422


def test_new_profile_starts_at_zero_with_nothing_achieved(client):
    p = client.get("/api/progress", headers=A).json()
    assert (p["completedActivities"], p["outdoorMinutes"], p["currentStreak"], p["longestStreak"]) == (0, 0, 0, 0)
    assert p["recent"] == [] and all(not m["achieved"] for m in p["milestones"])


def test_start_then_complete_persists_and_updates_progress(client):
    started = client.post("/api/quests/cloud-spotter/start", headers=A).json()
    assert started["status"] == "in-progress"
    res = client.post(
        "/api/quests/cloud-spotter/complete",
        headers=A,
        json={"minutesSpent": 12, "reflection": "Fast clouds", "localDate": "2026-10-10"},
        params={"today": "2026-10-10"},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["quest"]["status"] == "completed" and body["quest"]["completionCount"] == 1
    assert body["progress"]["completedActivities"] == 1 and body["progress"]["outdoorMinutes"] == 12
    assert body["progress"]["recent"][0]["note"] == "Fast clouds"
    assert body["progress"]["currentStreak"] == 1


def test_completing_twice_without_repeat_does_not_double_count(client):
    client.post("/api/quests/cloud-spotter/complete", headers=A)
    again = client.post("/api/quests/cloud-spotter/complete", headers=A)
    assert again.status_code == 200 and again.json()["progress"]["completedActivities"] == 1


def test_sessions_notes_and_removal_work_through_the_app(client):
    p = client.post("/api/outdoor-sessions", headers=A, json={"minutes": 20, "note": "Market walk"}).json()
    entry = p["recent"][0]
    assert p["outdoorMinutes"] == 20 and p["sessionsLogged"] == 1
    p = client.patch(f"/api/progress/entries/{entry['id']}", headers=A, json={"note": "Market walk, sunny"}).json()
    assert p["recent"][0]["note"] == "Market walk, sunny"
    p = client.delete(f"/api/progress/entries/{entry['id']}", headers=A).json()
    assert p["recent"] == [] and p["outdoorMinutes"] == 0


def test_progress_survives_an_app_restart(make_client):
    make_client().post("/api/quests/name-three-birds/complete", headers=A, json={"minutesSpent": 15})
    progress = make_client().get("/api/progress", headers=A).json()  # new app, same database file
    assert progress["completedActivities"] == 1 and progress["outdoorMinutes"] == 15


def test_profiles_do_not_share_progress_or_entries(client):
    client.post("/api/quests/cloud-spotter/complete", headers=A)
    assert client.get("/api/progress", headers=B).json()["completedActivities"] == 0
    assert client.get("/api/progress").json()["completedActivities"] == 0  # shared "anonymous" profile
    entry_id = client.post("/api/outdoor-sessions", headers=A, json={"minutes": 5}).json()["recent"][0]["id"]
    assert client.delete(f"/api/progress/entries/{entry_id}", headers=B).status_code == 404
    started = client.post("/api/quests/pick-up-ten/start", headers=A).json()
    assert started["status"] == "in-progress"
    assert next(q for q in client.get("/api/quests", headers=B).json() if q["id"] == "pick-up-ten")["status"] == "available"


def test_plans_generated_counts_saved_history(client):
    client.post("/api/plan", json=PLAN_BODY, headers=A)
    assert client.get("/api/progress", headers=A).json()["plansGenerated"] == 1
    assert client.get("/api/progress", headers=B).json()["plansGenerated"] == 0


@pytest.mark.parametrize("quest_id", ["Not_Valid", "x", "has space", "UPPER-case", "-leading-dash", "a" * 80])
def test_malformed_quest_ids_are_rejected_and_save_nothing(client, quest_id):
    assert client.post(f"/api/quests/{quest_id}/complete", headers=A).status_code in (404, 422)
    assert client.get("/api/progress", headers=A).json()["completedActivities"] == 0


def test_unknown_quest_is_404_in_the_shared_error_format(client):
    res = client.post("/api/quests/no-such-quest/complete", headers=A)
    assert res.status_code == 404
    assert res.json() == {"error": {"code": "not_found", "message": "That quest could not be found."}}


def test_invalid_profile_header_is_rejected_everywhere(client):
    for call in (lambda: client.get("/api/progress", headers={"X-Profile-Id": "short"}),
                 lambda: client.get("/api/quests", headers={"X-Profile-Id": "short"}),
                 lambda: client.post("/api/outdoor-sessions", headers={"X-Profile-Id": "short"}, json={"minutes": 5})):
        res = call()
        assert res.status_code == 400 and res.json()["error"]["code"] == "invalid_profile_id"


def test_validation_errors_use_the_part2_error_shape(client):
    res = client.post("/api/outdoor-sessions", headers=A, json={"minutes": 0})
    assert res.status_code == 422 and res.json()["error"]["code"] == "validation_error"
    assert res.json()["error"]["details"][0]["field"] == "minutes"


# ---------------------------------------------------------------- places and geocoding (live provider replaced by fakes)
def test_places_returns_the_frontend_contract_and_omits_missing_data(make_client):
    fake = FakePlaces([raw_place("Lakeside Park", 20.301, 85.801, opening_hours="Mo-Su 06:00-20:00")])
    client = make_client(places_provider=fake)
    res = client.get("/api/places", params={"lat": 20.3, "lon": 85.8, "radius": 2000})
    assert res.status_code == 200
    [place] = res.json()
    assert {"id", "name", "category", "lat", "lon", "distanceMeters", "osmUrl"} <= set(place)
    assert place["openingHours"] == "Mo-Su 06:00-20:00"
    assert "wheelchair" not in place and "website" not in place


def test_places_only_sends_rounded_coordinates_upstream(make_client):
    fake = FakePlaces()
    make_client(places_provider=fake).get("/api/places", params={"lat": 20.296123456, "lon": 85.824987654})
    assert fake.calls[0][:2] == (20.296, 85.825)


@pytest.mark.parametrize("params", [{"lat": 91, "lon": 0}, {"lat": 0, "lon": 181}, {"lat": 0}, {"lon": 0}, {"lat": "abc", "lon": 0}])
def test_places_validates_query(client, params):
    assert client.get("/api/places", params=params).status_code == 422


@pytest.mark.parametrize(
    "error,status,code",
    [(ProviderRateLimited(), 429, "rate_limited"), (ProviderTimeout(), 504, "upstream_timeout"),
     (ProviderUnavailable(), 503, "upstream_unavailable")],
)
def test_places_upstream_failures_are_clean_and_leak_nothing(make_client, error, status, code):
    res = make_client(places_provider=FakePlaces(error=error)).get("/api/places", params={"lat": 1, "lon": 1})
    assert res.status_code == status and res.json()["error"]["code"] == code
    assert "http" not in res.text.lower().replace("https://www.openstreetmap", "")


def test_places_rate_limit_keeps_retry_after_header(make_client):
    client = make_client(places_rate_per_minute=1)
    assert client.get("/api/places", params={"lat": 1, "lon": 1}).status_code == 200
    limited = client.get("/api/places", params={"lat": 1, "lon": 1})
    assert limited.status_code == 429 and int(limited.headers["Retry-After"]) >= 1
    assert limited.json()["error"]["code"] == "rate_limited"


def test_places_can_be_turned_off_with_an_honest_501(settings):
    import dataclasses

    app = create_app(dataclasses.replace(settings, places_provider="none"), ai_provider=FakeProvider())
    client = TestClient(app, raise_server_exceptions=False)
    for path, params in (("/api/places", {"lat": 1, "lon": 1}), ("/api/geocode", {"q": "Puri"})):
        res = client.get(path, params=params)
        assert res.status_code == 501 and res.json()["error"]["code"] == "not_configured"
    assert client.get("/api/quests").status_code == 200  # everything else keeps working


def test_geocode_through_the_app(make_client):
    ok = make_client().get("/api/geocode", params={"q": "Puri"})
    assert ok.json() == [{"label": "Puri, Testland", "lat": 12.5, "lon": 45.5}]
    down = make_client(geocoder=FakeGeocoder(ProviderUnavailable("Search is down."))).get("/api/geocode", params={"q": "Puri"})
    assert down.status_code == 503 and down.json()["error"]["message"] == "Search is down."
    assert make_client().get("/api/geocode", params={"q": "a"}).status_code == 422


# ---------------------------------------------------------------- CORS
@pytest.mark.parametrize("method", ["GET", "POST", "PATCH", "DELETE"])
def test_cors_preflight_allows_every_method_the_frontend_uses(client, method):
    res = client.options(
        "/api/progress/entries/1",
        headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": method,
                 "Access-Control-Request-Headers": "content-type,x-profile-id"},
    )
    assert res.status_code == 200
    assert res.headers["access-control-allow-origin"] == "http://localhost:5173"
    assert method in res.headers["access-control-allow-methods"]
    assert "x-profile-id" in res.headers["access-control-allow-headers"].lower()


def test_cors_rejects_unknown_origins(client):
    res = client.get("/api/quests", headers={"Origin": "http://evil.example"})
    assert "access-control-allow-origin" not in res.headers


# ---------------------------------------------------------------- data created by the Part 2 backend is not lost
def _legacy_db(path, rows):
    conn = sqlite3.connect(path)
    conn.executescript(
        """
        CREATE TABLE profiles (id TEXT PRIMARY KEY, created_at TEXT NOT NULL);
        CREATE TABLE quest_completions (
            id INTEGER PRIMARY KEY AUTOINCREMENT, profile_id TEXT NOT NULL, quest_id TEXT NOT NULL,
            completed_at TEXT NOT NULL, minutes INTEGER NOT NULL, UNIQUE (profile_id, quest_id));
        """
    )
    conn.executemany("INSERT INTO quest_completions (profile_id, quest_id, completed_at, minutes) VALUES (?,?,?,?)", rows)
    conn.commit()
    conn.close()


def test_part2_completions_are_imported_once_and_the_old_table_is_untouched(settings, make_client):
    _legacy_db(settings.database_path, [
        ("profile-aaaa-1111", "cloud-spotter", "2026-10-08T09:00:00+00:00", 10),
        ("profile-aaaa-1111", "name-three-birds", "2026-10-09T09:00:00+00:00", 15),
        ("profile-aaaa-1111", "quest-that-was-removed", "2026-10-09T10:00:00+00:00", 5),
        ("profile-bbbb-2222", "cloud-spotter", "2026-10-09T09:00:00+00:00", 10),
    ])
    client = make_client()
    p = client.get("/api/progress", headers=A, params={"today": "2026-10-09"}).json()
    assert p["completedActivities"] == 2 and p["outdoorMinutes"] == 25
    assert p["currentStreak"] == 2  # 8th and 9th of October
    assert {q["id"]: q["status"] for q in client.get("/api/quests", headers=A).json()}["cloud-spotter"] == "completed"
    assert client.get("/api/progress", headers=B).json()["completedActivities"] == 1

    again = make_client()  # restart: must not import twice
    assert again.get("/api/progress", headers=A).json()["completedActivities"] == 2
    conn = sqlite3.connect(settings.database_path)
    assert conn.execute("SELECT COUNT(*) FROM quest_completions").fetchone()[0] == 4
    conn.close()


def test_fresh_database_needs_no_legacy_table(client):
    assert client.get("/api/progress", headers=A).status_code == 200
