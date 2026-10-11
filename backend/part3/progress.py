"""Progress maths. Pure functions: streaks come only from real entry dates, nothing is estimated or invented."""
from __future__ import annotations

from datetime import date, timedelta
from typing import Iterable, Optional

from .models import Milestone


def parse_day(value: str) -> Optional[date]:
    try:
        return date.fromisoformat(value)
    except ValueError:
        return None


def compute_streaks(local_dates: Iterable[str], today: date) -> tuple[int, int]:
    """Consecutive calendar days with at least one entry.

    The current streak is still alive when the latest day is today or yesterday, so nobody is
    told they lost a streak before the day is over.
    """
    days = sorted({d for d in (parse_day(v) for v in local_dates) if d is not None})
    if not days:
        return 0, 0
    longest = run = 1
    for prev, cur in zip(days, days[1:]):
        run = run + 1 if (cur - prev).days == 1 else 1
        longest = max(longest, run)
    current = 0
    if (today - days[-1]).days in (0, 1):
        current = 1
        for prev, cur in zip(reversed(days[:-1]), reversed(days[1:])):
            if (cur - prev).days == 1:
                current += 1
            else:
                break
    return current, longest


def _milestone(id: str, title: str, description: str, target: int, current: int, unit: str) -> Milestone:
    return Milestone(
        id=id,
        title=title,
        description=description,
        target=target,
        current=min(current, target),
        unit=unit,  # type: ignore[arg-type]
        achieved=current >= target,
    )


def build_milestones(
    quest_count: int, minutes: int, longest_streak: int, categories_tried: int, notes_written: int
) -> list[Milestone]:
    return [
        _milestone("first-quest", "First step", "Complete your first quest.", 1, quest_count, "quests"),
        _milestone("three-quests", "Three and counting", "Complete three quests.", 3, quest_count, "quests"),
        _milestone("ten-quests", "Ten quests", "Complete ten quests.", 10, quest_count, "quests"),
        _milestone("streak-3", "Three days running", "Be outside on three days in a row.", 3, longest_streak, "days"),
        _milestone("hour-outside", "An hour outside", "Record 60 outdoor minutes.", 60, minutes, "minutes"),
        _milestone("five-hours", "Five hours outdoors", "Record 300 outdoor minutes.", 300, minutes, "minutes"),
        _milestone("variety-3", "A bit of everything", "Complete quests from three different categories.", 3, categories_tried, "quests"),
        _milestone("first-reflection", "First reflection", "Write a short note about an outing.", 1, notes_written, "quests"),
    ]


def recent_window(today: date, days: int = 28) -> tuple[str, str]:
    return (today - timedelta(days=days - 1)).isoformat(), today.isoformat()
