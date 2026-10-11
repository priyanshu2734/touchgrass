import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

from part3.db import Database
from part3.models import CompleteRequest, SessionRequest
from part3.quest_service import CATALOG_PATH, Invalid, NotFound, QuestService, load_catalog


class Clock:
    def __init__(self):
        self.now = datetime(2026, 10, 10, 9, 0, tzinfo=timezone.utc)

    def __call__(self):
        return self.now

    def advance(self, **kw):
        self.now += timedelta(**kw)


@pytest.fixture()
def clock():
    return Clock()


@pytest.fixture()
def svc(tmp_path, clock):
    return QuestService(Database(str(tmp_path / "t.db")), clock=clock)


OWNER = "local"


# ------------------------------------------------------------ catalogue integrity
def test_catalogue_is_valid_and_diverse():
    catalog = load_catalog()
    assert len(catalog) >= 20
    cats = {q.category for q in catalog.values()}
    assert cats == {"nature-observation", "photography", "gardening", "walking", "kindness", "social"}
    for q in catalog.values():
        assert q.steps and all(q.steps), q.id
        assert q.completion_criteria, q.id
        assert q.objective and q.summary, q.id
        assert 5 <= q.minutes <= 120, q.id
        assert q.indoor_fallback.title and q.indoor_fallback.minutes > 0, q.id
        assert q.company, q.id
        assert isinstance(q.equipment, list), q.id


def test_catalogue_includes_short_free_low_energy_options():
    catalog = load_catalog().values()
    assert any(q.minutes <= 10 and q.budget == "free" and q.energy == "low" and q.travel == "doorstep" for q in catalog)
    assert any(q.company == ["friends", "family", "group"] for q in catalog)


def test_part1_quest_ids_are_preserved():
    part1 = {"name-three-birds", "cloud-spotter", "light-and-shadow", "closer-than-usual", "seed-to-sprout",
             "tend-a-patch", "phone-away-walk", "two-stops-farther", "pick-up-ten", "say-hello-neighbour"}
    assert part1 <= set(load_catalog())


def test_frontend_catalogue_copy_is_in_sync():
    """The frontend bundles a copy for demo mode. Run scripts/sync_catalog.py if this fails."""
    copy = Path(__file__).resolve().parents[3] / "frontend" / "src" / "data" / "quests.curated.json"
    if not copy.exists():
        pytest.skip("frontend not present next to backend")
    assert json.loads(copy.read_text()) == json.loads(CATALOG_PATH.read_text())


# ------------------------------------------------------------ start / complete
def test_new_user_has_nothing_completed_and_empty_progress(svc):
    quests = svc.list_quests(OWNER)
    assert all(q.status == "available" and q.completion_count == 0 for q in quests)
    p = svc.progress(OWNER)
    assert (p.completed_activities, p.outdoor_minutes, p.current_streak, p.longest_streak) == (0, 0, 0, 0)
    assert p.recent == [] and p.active_days == 0
    assert all(not m.achieved for m in p.milestones)


def test_start_then_cancel(svc):
    q = svc.start(OWNER, "cloud-spotter")
    assert q.status == "in-progress" and q.started_at
    again = svc.start(OWNER, "cloud-spotter")
    assert again.started_at == q.started_at  # starting twice does not reset the timer
    assert svc.cancel_start(OWNER, "cloud-spotter").status == "available"


def test_complete_records_real_data(svc):
    svc.start(OWNER, "name-three-birds")
    r = svc.complete(OWNER, "name-three-birds", CompleteRequest(minutes_spent=22, reflection="  Saw a kingfisher  "))
    assert r.quest.status == "completed" and r.quest.completion_count == 1 and r.quest.started_at is None
    p = r.progress
    assert p.completed_activities == 1 and p.outdoor_minutes == 22
    assert p.recent[0].note == "Saw a kingfisher" and p.recent[0].minutes == 22
    assert p.current_streak == 1 and p.active_dates == ["2026-10-10"]
    assert {m.id for m in p.milestones if m.achieved} == {"first-quest", "first-reflection"}


def test_default_minutes_come_from_quest(svc):
    r = svc.complete(OWNER, "cloud-spotter")
    assert r.progress.outdoor_minutes == 10


def test_completion_is_idempotent_without_repeat(svc, clock):
    svc.complete(OWNER, "cloud-spotter")
    clock.advance(hours=1)
    r = svc.complete(OWNER, "cloud-spotter")
    assert r.progress.completed_activities == 1 and r.quest.completion_count == 1


def test_repeat_logs_another_time_but_ignores_double_submit(svc, clock):
    svc.complete(OWNER, "cloud-spotter")
    clock.advance(seconds=5)
    assert svc.complete(OWNER, "cloud-spotter", CompleteRequest(repeat=True)).quest.completion_count == 1
    clock.advance(minutes=10)
    r = svc.complete(OWNER, "cloud-spotter", CompleteRequest(repeat=True, minutes_spent=12))
    assert r.quest.completion_count == 2 and r.progress.outdoor_minutes == 22


def test_completing_after_restart_marks_in_progress_then_completed(svc, clock):
    svc.complete(OWNER, "cloud-spotter")
    clock.advance(days=1)
    assert svc.start(OWNER, "cloud-spotter").status == "in-progress"
    assert svc.complete(OWNER, "cloud-spotter", CompleteRequest(repeat=True)).quest.status == "completed"


def test_unknown_quest(svc):
    for call in (lambda: svc.start(OWNER, "nope"), lambda: svc.complete(OWNER, "nope"), lambda: svc.cancel_start(OWNER, "nope")):
        with pytest.raises(NotFound):
            call()


def test_local_date_validation(svc):
    with pytest.raises(Invalid):
        svc.complete(OWNER, "cloud-spotter", CompleteRequest(local_date="2026-12-31"))
    with pytest.raises(Invalid):
        svc.complete(OWNER, "cloud-spotter", CompleteRequest(local_date="2026-13-45"))
    ok = svc.complete(OWNER, "cloud-spotter", CompleteRequest(local_date="2026-10-11"))  # UTC+13 is still "tomorrow"
    assert ok.progress.recent[0].local_date == "2026-10-11"


def test_request_model_validation():
    with pytest.raises(ValueError):
        CompleteRequest(minutes_spent=0)
    with pytest.raises(ValueError):
        CompleteRequest(minutes_spent=601)
    with pytest.raises(ValueError):
        CompleteRequest(reflection="x" * 501)
    with pytest.raises(ValueError):
        SessionRequest(minutes=0)


# ------------------------------------------------------------ streaks from real dates
def test_streak_uses_client_local_dates(svc, clock):
    for day, qid in [("2026-10-08", "cloud-spotter"), ("2026-10-09", "name-three-birds"), ("2026-10-10", "listen-map")]:
        svc.complete(OWNER, qid, CompleteRequest(local_date=day))
    p = svc.progress(OWNER, today="2026-10-10")
    assert (p.current_streak, p.longest_streak, p.active_days) == (3, 3, 3)
    assert next(m for m in p.milestones if m.id == "streak-3").achieved


def test_streak_not_broken_before_today_ends(svc):
    svc.complete(OWNER, "cloud-spotter", CompleteRequest(local_date="2026-10-09"))
    assert svc.progress(OWNER, today="2026-10-10").current_streak == 1
    assert svc.progress(OWNER, today="2026-10-11").current_streak == 0


def test_implausible_today_param_falls_back_to_server_date(svc):
    svc.complete(OWNER, "cloud-spotter")
    assert svc.progress(OWNER, today="1999-01-01").current_streak == 1


# ------------------------------------------------------------ sessions, notes, deletion
def test_log_session_counts_minutes_and_days_but_not_quests(svc):
    p = svc.log_session(OWNER, SessionRequest(minutes=25, note="Sat by the river"))
    assert p.outdoor_minutes == 25 and p.completed_activities == 0 and p.sessions_logged == 1
    assert p.current_streak == 1
    assert p.recent[0].kind == "session" and p.recent[0].title == "Time outside"


def test_update_note_and_delete(svc):
    p = svc.log_session(OWNER, SessionRequest(minutes=10))
    entry_id = int(p.recent[0].id)
    assert svc.update_note(OWNER, entry_id, "Warm morning").recent[0].note == "Warm morning"
    assert svc.update_note(OWNER, entry_id, "   ").recent[0].note is None
    gone = svc.delete_entry(OWNER, entry_id)
    assert gone.recent == [] and gone.outdoor_minutes == 0 and gone.current_streak == 0


def test_cannot_touch_other_users_entries(svc):
    mine = svc.log_session("alice", SessionRequest(minutes=10)).recent[0].id
    with pytest.raises(NotFound):
        svc.delete_entry("bob", int(mine))
    with pytest.raises(NotFound):
        svc.update_note("bob", int(mine), "x")
    assert svc.progress("bob").outdoor_minutes == 0
    assert svc.progress("alice").outdoor_minutes == 10


def test_deleting_a_completion_makes_quest_available_again(svc):
    r = svc.complete(OWNER, "cloud-spotter")
    svc.delete_entry(OWNER, int(r.progress.recent[0].id))
    assert svc.get_quest(OWNER, "cloud-spotter").status == "available"


def test_control_characters_are_stripped_from_notes(svc):
    p = svc.log_session(OWNER, SessionRequest(minutes=5, note="hi\x00\x07 there"))
    assert p.recent[0].note == "hi there"


def test_progress_survives_catalogue_changes(svc, tmp_path, clock):
    svc.complete(OWNER, "cloud-spotter")
    reduced = QuestService(svc.db, catalog={k: v for k, v in svc.catalog.items() if k != "cloud-spotter"}, clock=clock)
    p = reduced.progress(OWNER)
    assert p.completed_activities == 1 and p.recent[0].title == "Cloud spotter"
