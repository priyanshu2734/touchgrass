"""Deterministic, non-AI plan builder. Used whenever the model cannot be used.

The result is built from the built-in catalogue and templates. It is always labelled
`generated_by = "fallback"` by the caller and never presented as AI output.
"""

from __future__ import annotations

from typing import Any, Sequence

from app.data.activities import ACTIVITIES_BY_ID
from app.models.domain import CatalogActivity, PlanInput
from app.models.vocab import DEFAULT_CURRENCY

COMPANY_PHRASE = {"solo": "on your own", "friends": "with friends", "family": "with family", "group": "in a group"}
BUDGET_PHRASE = {"free": "a free budget", "low": "a low-cost budget", "flexible": "a flexible budget"}

ACCESSIBILITY_ADAPTATIONS = {
    "step-free": "Choose a level, paved route and check the entrance and surface before you go.",
    "seating": "Plan a rest every 10 to 15 minutes and bring a folding stool if benches are uncertain.",
    "shade": "Go when the sun is lower or pick a tree-lined spot, and bring a hat and water.",
    "low-sensory": "Pick a quieter time and place, bring ear protection if useful, and leave early if it gets overwhelming.",
    "short-distance": "Stay close to your starting point and shorten any step that feels like too much.",
}

BASE_SAFETY = (
    "Tell someone where you are going and when you expect to be back.",
    "Check the weather and daylight before you leave, and head back if conditions change.",
    "Bring water and keep your phone charged for emergencies, even if it stays in your pocket.",
)
CATEGORY_SAFETY = {
    "fitness": "Warm up first and stop if you feel pain, dizziness or unusual breathlessness.",
    "walking": "Stay aware of traffic and avoid looking at a screen while you walk.",
    "photography": "Watch your footing and traffic while you look through the camera.",
    "gardening": "Wear gloves if you have them and wash your hands after handling soil.",
    "nature": "Do not touch or eat plants or fungi you cannot identify.",
    "birdwatching": "Keep a respectful distance from wildlife and nests.",
    "social": "Agree a meeting point in case anyone gets separated.",
    "creativity": "Choose a safe spot away from traffic and uneven ground.",
}
DEFAULT_CHALLENGE = {
    "nature": "Find five different shades of green.",
    "walking": "Notice three things on your route you have never seen before.",
    "photography": "Take one photo where the light is the subject.",
    "gardening": "Find the newest leaf or bud you can and look at it closely.",
    "fitness": "Notice how your breathing changes as you move.",
    "birdwatching": "Count how many different bird sounds you can pick out.",
    "creativity": "Describe one thing you see using three colours.",
    "social": "Ask one person one question you do not already know the answer to.",
}
WINDOW_BACKUP = {
    "title": "Window or doorway sky watch",
    "description": "Open a window or stand in a doorway for five minutes and watch the sky, the street or the trees.",
    "duration_minutes": 5,
    "when_to_use": "Use this if it is raining, the place is closed, or your energy drops.",
}


def _split_minutes(total: int, n: int) -> list[int]:
    base = max(1, total // n)
    parts = [base] * n
    parts[-1] = max(1, total - base * (n - 1))
    return parts


def _split_step(text: str) -> tuple[str, str]:
    title, sep, description = text.partition(":")
    if not sep:
        return text.strip(), text.strip()
    return title.strip(), description.strip()


def build_fallback_plan(inp: PlanInput, ranked: Sequence[CatalogActivity]) -> dict[str, Any]:
    primary = ranked[0] if ranked else ACTIVITIES_BY_ID["five-minute-pause"]

    durations = _split_minutes(primary.duration_minutes, len(primary.steps))
    steps = []
    for i, (text, minutes) in enumerate(zip(primary.steps, durations)):
        title, description = _split_step(text)
        steps.append({"order": i + 1, "title": title, "description": description, "duration_minutes": minutes})

    overlap = [i for i in inp.interests if i in primary.interests]
    why = (
        f"It fits your {inp.available_minutes} minutes, {BUDGET_PHRASE[inp.budget]}, {inp.energy} energy "
        f"and going {COMPANY_PHRASE[inp.company]}."
    )
    if overlap:
        why += f" It draws on your interest in {', '.join(overlap)}."
    else:
        why += " It is the closest match available for your limits, though it does not directly cover your listed interests."
    if inp.accessibility_needs:
        why += f" It is tagged as suitable for: {', '.join(inp.accessibility_needs)}."

    if primary.cost_max <= 0:
        assumptions = "Assumes you use things you already own and travel on foot."
    else:
        assumptions = primary.cost_note or "Assumes small purchases only; prices vary by place."

    backup_source = next(
        (a for a in ranked if a.id != primary.id and a.duration_minutes <= primary.duration_minutes), None
    )
    if backup_source is not None:
        backup = {
            "title": backup_source.title,
            "description": backup_source.description,
            "duration_minutes": backup_source.duration_minutes,
            "when_to_use": "Use this if it is raining, the place is closed, or your energy drops.",
        }
    else:
        backup = dict(WINDOW_BACKUP)
        backup["duration_minutes"] = min(5, primary.duration_minutes)

    safety = list(BASE_SAFETY)
    categories = [primary.category] + [i for i in inp.interests if i != primary.category]
    for category in categories:
        extra = CATEGORY_SAFETY.get(category)
        if extra and extra not in safety and len(safety) < 5:
            safety.append(extra)
    if inp.company == "family" and len(safety) < 6:
        safety.append("Keep children within sight and agree a clear boundary before you start.")

    checklist = list(primary.checklist)
    if inp.company != "solo":
        checklist.append("Tell everyone the plan and a meeting point")
    checklist.append("Check the forecast and switch to the backup if needed")

    if primary.category == "photography":
        phone = (
            f"Turn off notifications first and use your phone only as a camera for the {primary.duration_minutes} minutes."
        )
    else:
        phone = (
            f"Put your phone on silent and keep it in a bag or pocket for all {primary.duration_minutes} minutes; "
            "use it only for safety."
        )

    return {
        "title": primary.title,
        "summary": primary.description,
        "why_it_matches": why,
        "total_minutes": sum(durations),
        "steps": steps,
        "estimated_cost": {
            "min": primary.cost_min,
            "max": primary.cost_max,
            "currency": DEFAULT_CURRENCY,
            "assumptions": assumptions,
        },
        "difficulty": primary.difficulty,
        "energy_required": primary.energy_required,
        "checklist": checklist,
        "challenge": primary.challenge or DEFAULT_CHALLENGE.get(primary.category),
        "accessibility_adaptations": [ACCESSIBILITY_ADAPTATIONS[n] for n in inp.accessibility_needs],
        "backup_plan": backup,
        "safety_reminders": safety,
        "phone_away_suggestion": phone,
    }
