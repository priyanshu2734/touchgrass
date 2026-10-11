import asyncio

import httpx
import pytest

from part3.config import Settings
from part3.errors import ProviderBadResponse, ProviderRateLimited, ProviderTimeout, ProviderUnavailable
from part3.overpass import (
    CATEGORY_BY_ID,
    OverpassProvider,
    build_query,
    parse_overpass,
    resolve_categories,
    safe_url,
)

S = Settings(overpass_urls=("https://a.example/api", "https://b.example/api"), contact="test")
ALL = resolve_categories(None)


def el(type_="way", id_=1, tags=None, center=(20.3, 85.8), **extra):
    e = {"type": type_, "id": id_, "tags": tags if tags is not None else {"leisure": "park", "name": "Test Park"}}
    if type_ == "node":
        e["lat"], e["lon"] = center
    else:
        e["center"] = {"lat": center[0], "lon": center[1]}
    e.update(extra)
    return e


def test_build_query_has_only_constants_and_formatted_numbers():
    q = build_query(20.296, 85.8245, 2200, ALL, S)
    assert q.startswith("[out:json][timeout:15];(")
    assert "nwr(around:2200,20.29600,85.82450)[\"leisure\"=\"park\"];" in q
    assert q.endswith("out tags center 400;")
    assert "highway" not in q  # trails are opt-in


def test_build_query_rejects_bad_coordinates():
    with pytest.raises(ValueError):
        build_query(123, 0, 1000, ALL, S)


def test_resolve_categories_ignores_unknown_and_defaults():
    assert [c.id for c in resolve_categories(["nope"])] == [c.id for c in ALL]
    assert [c.id for c in resolve_categories(["trail", "trail", "park"])] == ["trail", "park"]


def test_parse_valid_elements():
    result = parse_overpass({"elements": [el(), el("node", 2, {"tourism": "viewpoint", "name": "Hill"})]}, ALL)
    assert [p.category_id for p in result.places] == ["park", "viewpoint"]
    assert result.places[0].id == "osm:way/1"
    assert result.places[0].osm_url == "https://www.openstreetmap.org/way/1"
    assert result.skipped == 0


@pytest.mark.parametrize("payload", [None, [], "x", {}, {"elements": "no"}, {"elements": None}])
def test_parse_rejects_non_overpass_documents(payload):
    with pytest.raises(ProviderBadResponse):
        parse_overpass(payload, ALL)


def test_parse_skips_malformed_elements_without_failing():
    bad = [
        "string",
        {"type": "way", "id": 1},  # no tags
        {"type": "alien", "id": 2, "tags": {"leisure": "park"}},
        el(id_=True),  # bool id
        el(id_=4, center=(999, 0)),  # invalid coordinate
        {"type": "way", "id": 5, "tags": {"leisure": "park", "name": "No coords"}},
        el(id_=6, tags={"shop": "bakery", "name": "Not outdoors"}),
        el(id_=7, tags={"leisure": "park", "name": "Private", "access": "private"}),
        el(id_=8),
    ]
    result = parse_overpass({"elements": bad}, ALL)
    assert [p.id for p in result.places] == ["osm:way/8"]
    assert result.skipped == 8


def test_unnamed_places_are_flagged_not_invented():
    result = parse_overpass({"elements": [el(tags={"leisure": "park"})]}, ALL)
    place = result.places[0]
    assert place.named is False
    assert place.name == "Unnamed park"
    assert place.opening_hours is None and place.wheelchair is None and place.website is None


def test_optional_tags_are_cleaned():
    tags = {
        "leisure": "park", "name": "  Big\x00  Park \n", "opening_hours": "Mo-Su 06:00-20:00",
        "wheelchair": "maybe", "website": "javascript:alert(1)",
    }
    p = parse_overpass({"elements": [el(tags=tags)]}, ALL).places[0]
    assert p.name == "Big Park"
    assert p.opening_hours == "Mo-Su 06:00-20:00"
    assert p.wheelchair is None  # unknown value is dropped
    assert p.website is None  # non-http scheme is dropped


def test_safe_url():
    assert safe_url("https://example.org/x") == "https://example.org/x"
    assert safe_url("ftp://example.org") is None
    assert safe_url("https://exa mple") is None


def test_runtime_remark_with_no_elements_is_a_timeout():
    with pytest.raises(ProviderTimeout):
        parse_overpass({"elements": [], "remark": "runtime error: Query timed out in \"query\""}, ALL)


def test_cap_flag():
    many = [el(id_=i) for i in range(1, 6)]
    assert parse_overpass({"elements": many}, ALL, max_elements=5).hit_cap is True
    assert parse_overpass({"elements": many}, ALL, max_elements=50).hit_cap is False


def test_garden_selector_excludes_private_access():
    assert "access" in CATEGORY_BY_ID["garden"].selectors[0]


# ----------------------------------------------------------- provider (HTTP)
def run(coro):
    return asyncio.run(coro)


def provider(handler):
    return OverpassProvider(S, transport=httpx.MockTransport(handler))


def test_provider_success_sends_user_agent_and_data():
    seen = {}

    def handler(request: httpx.Request):
        seen["ua"] = request.headers["user-agent"]
        seen["body"] = request.content.decode()
        return httpx.Response(200, json={"elements": [el()]})

    places = run(provider(handler).search(20.296, 85.824, 1000, ALL))
    assert len(places) == 1
    assert seen["ua"] == "TouchGrass/1.0 (test)"
    assert seen["body"].startswith("data=")


def test_provider_falls_back_to_second_endpoint():
    calls = []

    def handler(request: httpx.Request):
        calls.append(request.url.host)
        if request.url.host == "a.example":
            return httpx.Response(504)
        return httpx.Response(200, json={"elements": [el()]})

    assert len(run(provider(handler).search(1, 1, 500, ALL))) == 1
    assert calls == ["a.example", "b.example"]


@pytest.mark.parametrize(
    "response,expected",
    [
        (httpx.Response(429), ProviderRateLimited),
        (httpx.Response(504), ProviderTimeout),
        (httpx.Response(503), ProviderUnavailable),
        (httpx.Response(500), ProviderUnavailable),
        (httpx.Response(200, content=b"<html>not json</html>"), ProviderBadResponse),
        (httpx.Response(200, json={"unexpected": True}), ProviderBadResponse),
    ],
)
def test_provider_maps_errors(response, expected):
    with pytest.raises(expected):
        run(provider(lambda r: response).search(1, 1, 500, ALL))


def test_provider_timeout_and_network_errors():
    def timeout(request):
        raise httpx.ReadTimeout("slow", request=request)

    def refused(request):
        raise httpx.ConnectError("refused", request=request)

    with pytest.raises(ProviderTimeout):
        run(provider(timeout).search(1, 1, 500, ALL))
    with pytest.raises(ProviderUnavailable):
        run(provider(refused).search(1, 1, 500, ALL))


def test_rate_limit_error_wins_when_all_endpoints_fail():
    responses = iter([httpx.Response(429), httpx.Response(503)])
    with pytest.raises(ProviderRateLimited):
        run(provider(lambda r: next(responses)).search(1, 1, 500, ALL))


def test_oversized_response_is_rejected():
    big = OverpassProvider(
        Settings(overpass_urls=("https://a.example/x",), overpass_max_response_bytes=10, contact="t"),
        transport=httpx.MockTransport(lambda r: httpx.Response(200, json={"elements": [el()]})),
    )
    with pytest.raises(ProviderBadResponse):
        run(big.search(1, 1, 500, ALL))
