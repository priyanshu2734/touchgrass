from __future__ import annotations

import json
import re
from typing import Any

from app.services.ai_errors import AIResponseError

_THINK = re.compile(r"<think>.*?</think>", re.DOTALL | re.IGNORECASE)


def extract_json_object(text: object) -> dict[str, Any]:
    """Parse a model reply into a JSON object, tolerating code fences and stray text."""
    if not isinstance(text, str) or not text.strip():
        raise AIResponseError("empty model reply")

    cleaned = _THINK.sub("", text).strip()
    cleaned = re.sub(r"^```(?:json|JSON)?\s*", "", cleaned)
    cleaned = re.sub(r"\s*```$", "", cleaned).strip()

    try:
        value = json.loads(cleaned)
    except json.JSONDecodeError:
        start = cleaned.find("{")
        if start == -1:
            raise AIResponseError("no JSON object in model reply") from None
        try:
            value, _ = json.JSONDecoder().raw_decode(cleaned[start:])
        except json.JSONDecodeError as exc:
            raise AIResponseError(f"malformed JSON: {exc.msg}") from exc

    if not isinstance(value, dict):
        raise AIResponseError("model reply was JSON but not an object")
    return value
