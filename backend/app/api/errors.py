"""Consistent error bodies: {"error": {"code", "message", "details"?}}. Never leaks internals."""

import logging
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.errors import AppError

logger = logging.getLogger(__name__)

_STATUS_CODES = {
    400: "bad_request",
    404: "not_found",
    405: "method_not_allowed",
    422: "validation_error",
    429: "rate_limited",
    501: "not_configured",
    502: "upstream_error",
    503: "upstream_unavailable",
    504: "upstream_timeout",
}


def error_body(code: str, message: str, details: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    body: dict[str, Any] = {"code": code, "message": message}
    if details:
        body["details"] = details
    return {"error": body}


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _app_error(_: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(status_code=exc.status_code, content=error_body(exc.code, exc.message, exc.details))

    @app.exception_handler(StarletteHTTPException)
    async def _http_error(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        code = _STATUS_CODES.get(exc.status_code, "http_error")
        message = exc.detail if isinstance(exc.detail, str) else "The request could not be completed."
        return JSONResponse(
            status_code=exc.status_code,
            content=error_body(code, message),
            headers=dict(exc.headers) if exc.headers else None,  # keeps Retry-After on 429s
        )

    @app.exception_handler(RequestValidationError)
    async def _validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
        details = []
        for err in exc.errors():
            location = [str(part) for part in err.get("loc", ()) if part not in ("body", "query", "path", "header")]
            details.append({"field": ".".join(location) or None, "message": str(err.get("msg", "Invalid value."))})
        return JSONResponse(
            status_code=422,
            content=error_body("validation_error", "The request was not valid.", details),
        )

    @app.exception_handler(Exception)
    async def _unexpected(_: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled error", exc_info=exc)
        return JSONResponse(
            status_code=500,
            content=error_body("internal_error", "Something went wrong on the server. Please try again."),
        )
