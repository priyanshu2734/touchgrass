"""SQLite connection handling. One short-lived connection per operation.

Quest completions, outdoor sessions and quest starts live in the `tg3_*` tables owned by the `part3` package.
The old Part 2 `quest_completions` table is no longer created; if it exists in an older database file it is
imported once by `part3.legacy` and then left untouched.
"""

from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

SCHEMA = """
CREATE TABLE IF NOT EXISTS profiles (
    id          TEXT PRIMARY KEY,
    created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS plan_history (
    plan_id        TEXT PRIMARY KEY,
    profile_id     TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at     TEXT NOT NULL,
    generated_by   TEXT NOT NULL CHECK (generated_by IN ('ai', 'fallback')),
    model          TEXT,
    title          TEXT NOT NULL,
    total_minutes  INTEGER NOT NULL,
    budget         TEXT NOT NULL,
    energy         TEXT NOT NULL,
    interests      TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_history_profile ON plan_history(profile_id, created_at);
"""


class Database:
    def __init__(self, path: str) -> None:
        self._path = path

    def init_schema(self) -> None:
        if self._path != ":memory:":
            Path(self._path).parent.mkdir(parents=True, exist_ok=True)
        with self.connect() as conn:
            conn.executescript(SCHEMA)

    @contextmanager
    def connect(self) -> Iterator[sqlite3.Connection]:
        conn = sqlite3.connect(self._path, timeout=10)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    def ping(self) -> bool:
        try:
            with self.connect() as conn:
                conn.execute("SELECT 1").fetchone()
            return True
        except sqlite3.Error:
            return False
