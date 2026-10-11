import asyncio

import pytest

from part3.config import Settings
from part3.geo import haversine_m
from part3.overpass import RawPlace
from part3.places_service import PlacesService

S = Settings(contact="test", cache_ttl_s=100)
CENTER = (20.2960, 85.8240)


def raw(id_, name, lat, lon, cat="park", named=True, **kw):
    return RawPlace(id=id_, name=name, named=named, category_id=cat, category=cat.title(), lat=lat, lon=lon,
                    osm_url=f"https://www.openstreetmap.org/{id_}", **kw)


class FakeProvider:
    name = "fake"

    def __init__(self, items):
        self.items = items
        self.calls = []

    async def search(self, lat, lon, radius_m, categories):
        self.calls.append((lat, lon, radius_m, tuple(c.id for c in categories)))
        return list(self.items)


def run(coro):
    return asyncio.run(coro)


def offset(metres_north):
    return CENTER[0] + metres_north / 111_195, CENTER[1]


def test_sorted_by_true_distance_and_filtered_by_radius():
    far = offset(1500)
    near = offset(300)
    mid = offset(900)
    outside = offset(2500)
    prov = FakeProvider([
        raw("n/far", "Far", *far), raw("n/near", "Near", *near), raw("n/mid", "Mid", *mid), raw("n/out", "Out", *outside),
    ])
    places = run(PlacesService(prov, S).search(*CENTER, radius_m=2000))
    assert [p.name for p in places] == ["Near", "Mid", "Far"]
    assert places[0].distance_meters == pytest.approx(300, abs=3)
    assert all(p.distance_meters <= 2000 for p in places)


def test_upstream_receives_rounded_coordinates_only():
    prov = FakeProvider([])
    run(PlacesService(prov, S).search(20.296123456, 85.824987654, radius_m=1000))
    lat, lon, radius, _ = prov.calls[0]
    assert (lat, lon) == (20.296, 85.825)
    assert radius == 1200  # radius + padding


def test_radius_is_clamped():
    prov = FakeProvider([])
    run(PlacesService(prov, S).search(*CENTER, radius_m=999_999))
    assert prov.calls[0][2] == S.max_radius_m + 200
    run(PlacesService(FakeProvider([]), S).search(*CENTER, radius_m=1))


def test_unnamed_hidden_by_default_and_shown_on_request():
    prov = FakeProvider([raw("w/1", "Unnamed park", *offset(100), named=False), raw("w/2", "Named", *offset(200))])
    svc = PlacesService(prov, S)
    assert [p.name for p in run(svc.search(*CENTER, 1000))] == ["Named"]
    shown = run(svc.search(*CENTER, 1000, include_unnamed=True))
    assert [p.name for p in shown] == ["Unnamed park", "Named"]
    assert shown[0].named is False


def test_limit_applies_after_sorting():
    prov = FakeProvider([raw(f"n/{i}", f"P{i}", *offset(100 * (i + 1))) for i in range(10)])
    places = run(PlacesService(prov, S).search(*CENTER, 5000, limit=3))
    assert [p.name for p in places] == ["P0", "P1", "P2"]


def test_duplicates_of_one_park_are_merged_keeping_closest():
    prov = FakeProvider([
        raw("relation/1", "Green Park", *offset(500)),
        raw("way/2", "green park", *offset(650)),
        raw("way/3", "Green Park", *offset(5000)),  # same name but far away: kept only if inside radius
    ])
    places = run(PlacesService(prov, S).search(*CENTER, 10000))
    assert [p.id for p in places] == ["relation/1", "way/3"]


def test_same_name_different_category_is_not_a_duplicate():
    prov = FakeProvider([raw("a", "Lakeside", *offset(100), cat="park"), raw("b", "Lakeside", *offset(120), cat="garden")])
    assert len(run(PlacesService(prov, S).search(*CENTER, 1000))) == 2


def test_results_are_cached_per_rounded_location():
    prov = FakeProvider([raw("n/1", "A", *offset(100))])
    svc = PlacesService(prov, S)
    run(svc.search(20.29601, 85.82401, 1000))
    run(svc.search(20.29604, 85.82398, 1000))  # same 3-decimal cell
    assert len(prov.calls) == 1
    run(svc.search(20.2961, 85.8240, 2000))  # different radius
    assert len(prov.calls) == 2


def test_cache_expires():
    now = [0.0]
    prov = FakeProvider([])
    svc = PlacesService(prov, S, clock=lambda: now[0])
    run(svc.search(*CENTER, 1000))
    now[0] = 50
    run(svc.search(*CENTER, 1000))
    assert len(prov.calls) == 1
    now[0] = 500
    run(svc.search(*CENTER, 1000))
    assert len(prov.calls) == 2


def test_invalid_coordinates_raise():
    with pytest.raises(ValueError):
        run(PlacesService(FakeProvider([]), S).search(95, 0))


def test_distance_uses_the_exact_input_point():
    prov = FakeProvider([raw("n/1", "A", 20.3, 85.83)])
    p = run(PlacesService(prov, S).search(*CENTER, 5000))[0]
    assert p.distance_meters == round(haversine_m(*CENTER, 20.3, 85.83))
