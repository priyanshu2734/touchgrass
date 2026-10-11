import math

import pytest

from part3.geo import haversine_m, round_coord, valid_lat_lon


def test_zero_distance():
    assert haversine_m(20.2961, 85.8245, 20.2961, 85.8245) == pytest.approx(0, abs=1e-6)


def test_known_distance_london_paris():
    # Great-circle distance between the two city centres is about 343.5 km.
    d = haversine_m(51.5074, -0.1278, 48.8566, 2.3522)
    assert d == pytest.approx(343_500, rel=0.01)


def test_one_degree_of_latitude():
    assert haversine_m(0, 0, 1, 0) == pytest.approx(111_195, rel=0.001)


def test_symmetry_and_antipodes():
    a = haversine_m(10, 20, -30, 140)
    b = haversine_m(-30, 140, 10, 20)
    assert a == pytest.approx(b)
    assert haversine_m(0, 0, 0, 180) == pytest.approx(math.pi * 6_371_008.8, rel=1e-9)


def test_crossing_antimeridian_is_short():
    assert haversine_m(0, 179.9, 0, -179.9) < 25_000


@pytest.mark.parametrize(
    "lat,lon,ok",
    [(0, 0, True), (90, 180, True), (-90, -180, True), (91, 0, False), (0, 181, False),
     (float("nan"), 0, False), (float("inf"), 0, False), ("1", 2, False), (True, 0, False), (None, 0, False)],
)
def test_valid_lat_lon(lat, lon, ok):
    assert valid_lat_lon(lat, lon) is ok


def test_round_coord_reduces_precision():
    assert round_coord(20.296123456) == 20.296
