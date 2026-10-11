import logging

from part3.privacy import RedactQueryFilter, redact


def test_redacts_coordinates_and_search_text():
    assert redact("GET /api/places?lat=20.29612&lon=85.8&radius=2000 HTTP/1.1") == "GET /api/places?lat=redacted&lon=redacted&radius=2000 HTTP/1.1"
    assert redact("/api/geocode?q=my%20street") == "/api/geocode?q=redacted"
    assert redact("/api/quests") == "/api/quests"


def test_filter_rewrites_uvicorn_access_args():
    record = logging.LogRecord("uvicorn.access", logging.INFO, "", 0, '%s - "%s %s HTTP/%s" %d',
                               ("127.0.0.1:1", "GET", "/api/places?lat=1.5&lon=2.5", "1.1", 200), None)
    assert RedactQueryFilter().filter(record) is True
    assert "1.5" not in record.getMessage() and "lat=redacted" in record.getMessage()
