from app.models.domain import PlanHistoryRecord
from app.repositories.database import Database
from app.repositories.history import HistoryRepository


def make_db(tmp_path):
    db = Database(str(tmp_path / "nested" / "test.db"))
    db.init_schema()
    return db


def test_schema_creation_is_idempotent_and_ping_works(tmp_path):
    db = make_db(tmp_path)
    db.init_schema()
    assert db.ping() is True


def test_old_completions_table_is_not_created_for_new_databases(tmp_path):
    """Completions now live in the part3 `tg3_*` tables. Part 2's table is only read when it already exists."""
    db = make_db(tmp_path)
    with db.connect() as conn:
        tables = {row["name"] for row in conn.execute("SELECT name FROM sqlite_master WHERE type = 'table'")}
    assert "quest_completions" not in tables
    assert {"profiles", "plan_history"} <= tables


def test_history_stores_summary_only(tmp_path):
    db = make_db(tmp_path)
    repo = HistoryRepository(db)
    repo.add(PlanHistoryRecord("plan-1", "p", "2026-10-01T10:00:00+00:00", "fallback", None, "Doorstep reset", 10, "free", "low", ("nature",)))
    repo.add(PlanHistoryRecord("plan-2", "p", "2026-10-01T11:00:00+00:00", "ai", "gemma3:4b", "Park loop", 45, "low", "medium", ("nature", "photography")))
    recent = repo.list_recent("p")
    assert [r.plan_id for r in recent] == ["plan-2", "plan-1"]
    assert recent[0].interests == ("nature", "photography")
    assert repo.count("p") == 2 and repo.count("other") == 0
    with db.connect() as conn:
        columns = {row["name"] for row in conn.execute("PRAGMA table_info(plan_history)")}
    assert not columns & {"lat", "lon", "location", "notes", "area"}
