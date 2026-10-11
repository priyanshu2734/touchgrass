from __future__ import annotations

import json

from app.models.domain import PlanHistoryRecord
from app.repositories.database import Database


class HistoryRepository:
    """Stores a privacy-safe summary of each generated plan. Never location or free-text notes."""

    def __init__(self, db: Database) -> None:
        self._db = db

    def add(self, record: PlanHistoryRecord) -> None:
        with self._db.connect() as conn:
            conn.execute(
                "INSERT OR IGNORE INTO profiles (id, created_at) VALUES (?, ?)",
                (record.profile_id, record.created_at),
            )
            conn.execute(
                "INSERT INTO plan_history (plan_id, profile_id, created_at, generated_by, model, title, "
                "total_minutes, budget, energy, interests) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    record.plan_id,
                    record.profile_id,
                    record.created_at,
                    record.generated_by,
                    record.model,
                    record.title,
                    record.total_minutes,
                    record.budget,
                    record.energy,
                    json.dumps(list(record.interests)),
                ),
            )

    def list_recent(self, profile_id: str, limit: int = 20) -> list[PlanHistoryRecord]:
        with self._db.connect() as conn:
            rows = conn.execute(
                "SELECT * FROM plan_history WHERE profile_id = ? ORDER BY created_at DESC, rowid DESC LIMIT ?",
                (profile_id, limit),
            ).fetchall()
        return [
            PlanHistoryRecord(
                plan_id=r["plan_id"],
                profile_id=r["profile_id"],
                created_at=r["created_at"],
                generated_by=r["generated_by"],
                model=r["model"],
                title=r["title"],
                total_minutes=r["total_minutes"],
                budget=r["budget"],
                energy=r["energy"],
                interests=tuple(json.loads(r["interests"])),
            )
            for r in rows
        ]

    def count(self, profile_id: str) -> int:
        with self._db.connect() as conn:
            row = conn.execute("SELECT COUNT(*) AS n FROM plan_history WHERE profile_id = ?", (profile_id,)).fetchone()
        return int(row["n"])
