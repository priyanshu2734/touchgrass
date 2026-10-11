import asyncio

import httpx
import pytest

from part3.config import Settings
from part3.errors import ProviderBadResponse, ProviderRateLimited, ProviderTimeout, ProviderUnavailable
from part3.geocode import NominatimGeocoder, parse_nominatim

S = Settings(contact="test", geocode_min_interval_s=1.1)


def run(coro):
    return asyncio.run(coro)


def test_parse_nominatim_validates_each_item():
    payload = [
        {"display_name": "Bhubaneswar, Odisha, India", "lat": "20.2644", "lon": "85.8281"},
        {"display_name": "Bad lat", "lat": "999", "lon": "1"},
        {"display_name": "", "lat": "1", "lon": "1"},
        {"display_name": "No coords"},
        "junk",
    ]
    results = parse_nominatim(payload)
    assert [(r.label, r.lat, r.lon) for r in results] == [("Bhubaneswar, Odisha, India", 20.2644, 85.8281)]


def test_parse_nominatim_rejects_non_list():
    with pytest.raises(ProviderBadResponse):
        parse_nominatim({"error": "x"})


def make(handler, **kw):
    return NominatimGeocoder(S, transport=httpx.MockTransport(handler), **kw)


def test_search_sends_query_and_user_agent():
    seen = {}

    def handler(request):
        seen["q"] = request.url.params["q"]
        seen["ua"] = request.headers["user-agent"]
        return httpx.Response(200, json=[{"display_name": "Puri", "lat": "19.8", "lon": "85.8"}])

    out = run(make(handler).search("Puri"))
    assert out[0].label == "Puri"
    assert seen == {"q": "Puri", "ua": "TouchGrass/1.0 (test)"}


def test_second_identical_search_is_cached():
    calls = []

    def handler(request):
        calls.append(1)
        return httpx.Response(200, json=[])

    geo = make(handler)
    run(geo.search("Puri"))
    run(geo.search("  puri "))
    assert len(calls) == 1


def test_requests_are_throttled_to_one_per_interval():
    now = [100.0]
    slept = []

    async def fake_sleep(seconds):
        slept.append(seconds)
        now[0] += seconds

    geo = make(lambda r: httpx.Response(200, json=[]), clock=lambda: now[0], sleep=fake_sleep)
    run(geo.search("a1"))
    run(geo.search("b2"))
    assert len(slept) == 1 and slept[0] == pytest.approx(1.1)


@pytest.mark.parametrize(
    "response,expected",
    [(httpx.Response(429), ProviderRateLimited), (httpx.Response(503), ProviderUnavailable),
     (httpx.Response(200, content=b"nope"), ProviderBadResponse)],
)
def test_error_mapping(response, expected):
    with pytest.raises(expected):
        run(make(lambda r: response).search("x1"))


def test_timeout_mapping():
    def handler(request):
        raise httpx.ConnectTimeout("t", request=request)

    with pytest.raises(ProviderTimeout):
        run(make(handler).search("x1"))
