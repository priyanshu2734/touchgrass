"""Provider error taxonomy. Routes map these to HTTP status codes with a human-readable `detail`."""
from __future__ import annotations


class ProviderError(Exception):
    status_code = 502
    default_message = "The map data service returned something unexpected. Please try again."

    def __init__(self, message: str | None = None, retry_after: int | None = None):
        super().__init__(message or self.default_message)
        self.message = message or self.default_message
        self.retry_after = retry_after


class ProviderRateLimited(ProviderError):
    status_code = 429
    default_message = "The map data service is busy right now. Please wait a minute and try again."


class ProviderUnavailable(ProviderError):
    status_code = 503
    default_message = "The map data service is unavailable at the moment. Please try again later."


class ProviderTimeout(ProviderError):
    status_code = 504
    default_message = "The map data service took too long to respond. Try a smaller search radius."


class ProviderBadResponse(ProviderError):
    status_code = 502
    default_message = "The map data service returned data we could not read. Please try again."
