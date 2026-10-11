"""Validate and normalise a model-produced plan into the exact shape the API returns.

The model is never trusted: durations are rescaled to fit the available time, costs are checked
against the budget, unsuitable energy levels are rejected, and anything missing raises
AIResponseError so the caller can use the clearly-labelled non-AI fallback instead.
"""

from __future__ import annotations

import math
import re
from typing import Any

from app.models.domain import PlanInput
from app.models.vocab import BUDGET_CAP_USD, DEFAULT_CURRENCY, DIFFICULTIES, ENERGIES, ENERGY_RANK
from app.services.ai_errors import AIResponseError

MAX_STEPS = 12
MAX_LIST_ITEMS = 12

_DIFFICULTY_ALIASES = {
    "beginner": "easy", "simple": "easy", "light": "easy",
    "medium": "moderate", "intermediate": "moderate",
    "hard": "challenging", "difficult": "challenging", "advanced": "challenging",
}
_ENERGY_ALIASES = {"moderate": "medium", "mid": "medium", "easy": "low", "hard": "high", "intense": "high"}
_CTRL = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
_WS = re.compile(r"\s+")


def clean_text(value: Any, max_len: int) -> str:
    if not isinstance(value, str):
        return ""
    text = _WS.sub(" ", _CTRL.sub("", value)).strip()
    if len(text) > max_len:
        text = text[: max_len - 1].rstrip() + "\u2026"
    return text


def _clean_list(value: Any, max_items: int, max_len: int) -> list[str]:
    if isinstance(value, str):
        value = [value]
    if not isinstance(value, list):
        return []
    out: list[str] = []
    for item in value:
        text = clean_text(item, max_len)
        if text:
            out.append(text)
        if len(out) >= max_items:
            break
    return out


def _number(value: Any) -> float | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        number = float(value)
    elif isinstance(value, str):
        match = re.search(r"-?\d+(?:\.\d+)?", value.replace(",", ""))
        if not match:
            return None
        number = float(match.group())
    else:
        return None
    return number if math.isfinite(number) else None


def _enum(value: Any, allowed: tuple[str, ...], aliases: dict[str, str]) -> str | None:
    if not isinstance(value, str):
        return None
    key = value.strip().lower()
    key = aliases.get(key, key)
    return key if key in allowed else None


def _fit_durations(raw: list[int], available: int) -> list[int]:
    """Make step durations positive and their sum at most `available`."""
    n = len(raw)
    if n > available:
        raise AIResponseError("more steps than minutes available")
    durations = [d if d >= 1 else 0 for d in raw]
    if sum(durations) == 0:
        base = max(1, available // n)
        durations = [base] * n
    total = sum(durations)
    if total > available:
        durations = [max(1, round(d * available / total)) for d in durations]
        while sum(durations) > available:
            idx = max(range(n), key=lambda i: durations[i])
            if durations[idx] <= 1:
                raise AIResponseError("could not fit steps into the available time")
            durations[idx] -= 1
    durations = [d if d >= 1 else 1 for d in durations]
    if sum(durations) > available:
        raise AIResponseError("could not fit steps into the available time")
    return durations


def _int_minutes(value: Any) -> int:
    number = _number(value)
    return int(round(number)) if number is not None and number > 0 else 0


def normalize_ai_plan(raw: dict[str, Any], inp: PlanInput) -> dict[str, Any]:
    title = clean_text(raw.get("title"), 120)
    summary = clean_text(raw.get("summary"), 500)
    why = clean_text(raw.get("why_it_matches"), 600)
    phone = clean_text(raw.get("phone_away_suggestion"), 300)
    if not (title and summary and why and phone):
        raise AIResponseError("missing title, summary, why_it_matches or phone_away_suggestion")

    # Steps
    steps_raw = raw.get("steps")
    if not isinstance(steps_raw, list):
        raise AIResponseError("steps missing")
    parsed: list[tuple[str, str, int]] = []
    for item in steps_raw[:MAX_STEPS]:
        if isinstance(item, str):
            item = {"description": item}
        if not isinstance(item, dict):
            continue
        description = clean_text(item.get("description") or item.get("details"), 400)
        step_title = clean_text(item.get("title") or item.get("name"), 80)
        if not description and not step_title:
            continue
        if not step_title:
            step_title = " ".join(description.split()[:5])
        if not description:
            description = step_title
        minutes = _int_minutes(item.get("duration_minutes", item.get("minutes")))
        parsed.append((step_title, description, minutes))
    if len(parsed) < 2:
        raise AIResponseError("fewer than two usable steps")
    durations = _fit_durations([p[2] for p in parsed], inp.available_minutes)
    steps = [
        {"order": i + 1, "title": t, "description": d, "duration_minutes": durations[i]}
        for i, ((t, d, _), _dur) in enumerate(zip(parsed, durations))
    ]
    total_minutes = sum(durations)

    # Difficulty and energy
    difficulty = _enum(raw.get("difficulty"), DIFFICULTIES, _DIFFICULTY_ALIASES)
    energy = _enum(raw.get("energy_required"), ENERGIES, _ENERGY_ALIASES)
    if difficulty is None or energy is None:
        raise AIResponseError("difficulty or energy_required missing or invalid")
    if ENERGY_RANK[energy] > ENERGY_RANK[inp.energy]:
        raise AIResponseError("plan needs more energy than the user has")

    # Cost
    cost_raw = raw.get("estimated_cost")
    if isinstance(cost_raw, (int, float, str)) and not isinstance(cost_raw, bool):
        cost_raw = {"min": 0, "max": cost_raw}
    if not isinstance(cost_raw, dict):
        raise AIResponseError("estimated_cost missing")
    low = _number(cost_raw.get("min"))
    high = _number(cost_raw.get("max", cost_raw.get("amount")))
    if high is None and low is not None:
        high = low
    if low is None and high is not None:
        low = 0.0
    if low is None or high is None:
        raise AIResponseError("estimated_cost has no usable numbers")
    low, high = max(low, 0.0), max(high, 0.0)
    if high < low:
        low, high = high, low
    assumptions = clean_text(cost_raw.get("assumptions"), 400)
    if not assumptions:
        raise AIResponseError("cost assumptions missing")
    cap = BUDGET_CAP_USD[inp.budget]
    if high > cap:
        low, high = min(low, cap), cap
        assumptions = (
            f"{assumptions} Adjusted to fit your {inp.budget} budget; skip or substitute any item that costs more."
        )[:500]

    # Lists
    checklist = _clean_list(raw.get("checklist"), MAX_LIST_ITEMS, 160)
    safety = _clean_list(raw.get("safety_reminders"), 6, 240)
    adaptations = _clean_list(raw.get("accessibility_adaptations"), 8, 300)
    if not checklist:
        raise AIResponseError("checklist missing")
    if not safety:
        raise AIResponseError("safety_reminders missing")
    if inp.accessibility_needs and not adaptations:
        raise AIResponseError("accessibility adaptations missing")

    # Backup
    backup_raw = raw.get("backup_plan")
    if not isinstance(backup_raw, dict):
        raise AIResponseError("backup_plan missing")
    backup_title = clean_text(backup_raw.get("title"), 120)
    backup_desc = clean_text(backup_raw.get("description"), 400)
    if not (backup_title and backup_desc):
        raise AIResponseError("backup_plan incomplete")
    backup_minutes = _int_minutes(backup_raw.get("duration_minutes", backup_raw.get("minutes")))
    backup_minutes = min(max(backup_minutes, 1), inp.available_minutes) if backup_minutes else min(10, inp.available_minutes)
    when = clean_text(backup_raw.get("when_to_use"), 200) or (
        "Use this if the weather turns, the place is closed, or your energy drops."
    )

    challenge = clean_text(raw.get("challenge"), 300) or None

    return {
        "title": title,
        "summary": summary,
        "why_it_matches": why,
        "total_minutes": total_minutes,
        "steps": steps,
        "estimated_cost": {
            "min": round(low, 2),
            "max": round(high, 2),
            "currency": DEFAULT_CURRENCY,
            "assumptions": assumptions,
        },
        "difficulty": difficulty,
        "energy_required": energy,
        "checklist": checklist,
        "challenge": challenge,
        "accessibility_adaptations": adaptations,
        "backup_plan": {
            "title": backup_title,
            "description": backup_desc,
            "duration_minutes": backup_minutes,
            "when_to_use": when,
        },
        "safety_reminders": safety,
        "phone_away_suggestion": phone,
    }
