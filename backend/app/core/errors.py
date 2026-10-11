"""Application errors that map cleanly to HTTP responses."""

from __future__ import annotations

from typing import Any


class AppError(Exception):
    status_code = 400
    code = "bad_request"

    def __init__(self, message: str, *, details: list[dict[str, Any]] | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.details = details


class NotFoundError(AppError):
    status_code = 404
    code = "not_found"


class NotConfiguredError(AppError):
    status_code = 501
    code = "not_configured"


class InvalidProfileError(AppError):
    status_code = 400
    code = "invalid_profile_id"
