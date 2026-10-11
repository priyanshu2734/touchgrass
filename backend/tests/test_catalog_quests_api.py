def test_activities_returns_full_catalogue(client):
    body = client.get("/api/activities").json()
    assert body["count"] == len(body["items"]) >= 15
    first = body["items"][0]
    for key in ("id", "title", "description", "category", "duration_minutes", "estimated_cost", "difficulty", "energy_required", "steps"):
        assert key in first


def test_activity_filters(client):
    birds = client.get("/api/activities", params={"category": "birdwatching"}).json()["items"]
    assert birds and all(a["category"] == "birdwatching" for a in birds)

    short = client.get("/api/activities", params={"max_minutes": 10}).json()["items"]
    assert short and all(a["duration_minutes"] <= 10 for a in short)

    ranged = client.get("/api/activities", params={"min_minutes": 60, "max_minutes": 60}).json()["items"]
    assert ranged and all(a["duration_minutes"] == 60 for a in ranged)

    free = client.get("/api/activities", params={"budget": "free"}).json()["items"]
    assert free and all(a["budget"] == "free" and a["estimated_cost"]["max"] == 0 for a in free)

    hard = client.get("/api/activities", params={"difficulty": "challenging"}).json()["items"]
    assert hard and all(a["difficulty"] == "challenging" for a in hard)

    found = client.get("/api/activities", params={"q": "picnic"}).json()["items"]
    ids = [a["id"] for a in found]
    assert "park-picnic" in ids  # the craft activity also mentions a picnic table, so it matches too
    assert all("picnic" in f"{a['title']} {a['description']}".lower() for a in found)

    assert client.get("/api/activities", params={"category": "nature", "difficulty": "challenging"}).json()["count"] == 0


def test_activity_filter_validation(client):
    assert client.get("/api/activities", params={"category": "skydiving"}).status_code == 422
    assert client.get("/api/activities", params={"budget": "rich"}).status_code == 422
    assert client.get("/api/activities", params={"max_minutes": 0}).status_code == 422
    bad = client.get("/api/activities", params={"min_minutes": 60, "max_minutes": 10})
    assert bad.status_code == 400 and bad.json()["error"]["code"] == "bad_request"
