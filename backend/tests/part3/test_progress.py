from datetime import date

import pytest

from part3.progress import build_milestones, compute_streaks

TODAY = date(2026, 10, 10)


def test_no_entries():
    assert compute_streaks([], TODAY) == (0, 0)


def test_single_day_today_and_yesterday_keep_streak_alive():
    assert compute_streaks(["2026-10-10"], TODAY) == (1, 1)
    assert compute_streaks(["2026-10-09"], TODAY) == (1, 1)


def test_older_entry_means_no_current_streak_but_keeps_longest():
    assert compute_streaks(["2026-10-07", "2026-10-08"], TODAY) == (0, 2)


def test_consecutive_run_ending_today():
    assert compute_streaks(["2026-10-08", "2026-10-09", "2026-10-10"], TODAY) == (3, 3)


def test_gap_resets_current_but_not_longest():
    days = ["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04", "2026-10-09", "2026-10-10"]
    assert compute_streaks(days, TODAY) == (2, 4)


def test_duplicates_and_unsorted_and_invalid_input():
    days = ["2026-10-10", "2026-10-09", "2026-10-10", "not-a-date", "2026-10-08"]
    assert compute_streaks(days, TODAY) == (3, 3)


def test_month_boundary():
    assert compute_streaks(["2026-09-30", "2026-10-01"], date(2026, 10, 1)) == (2, 2)


def test_milestones_start_at_zero_and_never_exceed_target():
    ms = {m.id: m for m in build_milestones(0, 0, 0, 0, 0)}
    assert all(not m.achieved and m.current == 0 for m in ms.values())
    ms = {m.id: m for m in build_milestones(12, 400, 5, 4, 2)}
    assert ms["ten-quests"].achieved and ms["ten-quests"].current == 10
    assert ms["five-hours"].achieved and ms["five-hours"].current == 300
    assert ms["variety-3"].achieved and ms["first-reflection"].achieved


def test_milestone_partial_progress():
    ms = {m.id: m for m in build_milestones(2, 45, 2, 1, 0)}
    assert (ms["three-quests"].current, ms["three-quests"].achieved) == (2, False)
    assert (ms["hour-outside"].current, ms["hour-outside"].achieved) == (45, False)
