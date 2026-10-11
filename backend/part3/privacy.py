"""Keeps coordinates and typed place names out of server logs."""
from __future__ import annotations

import logging
import re

_SENSITIVE = re.compile(r"\b(lat|lon|q)=[^&\s\"]*", re.I)


def redact(text: str) -> str:
    return _SENSITIVE.sub(lambda m: f"{m.group(1)}=redacted", text)


class RedactQueryFilter(logging.Filter):
    """Attach to `uvicorn.access`. uvicorn logs the full request path including the query string."""

    def filter(self, record: logging.LogRecord) -> bool:
        if isinstance(record.args, tuple):
            record.args = tuple(redact(a) if isinstance(a, str) else a for a in record.args)
        if isinstance(record.msg, str):
            record.msg = redact(record.msg)
        return True


def install_access_log_redaction() -> None:
    logger = logging.getLogger("uvicorn.access")
    if not any(isinstance(f, RedactQueryFilter) for f in logger.filters):
        logger.addFilter(RedactQueryFilter())
