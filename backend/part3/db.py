"""SQLite storage for Part 3. Tables are prefixed `tg3_` so they cannot collide with Part 2 tables."""
from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from typing import Iterator

SCHEMA = """
CREATE TABLE IF NOT EXISTS tg3_quest_starts (
    owner      TEXT NOT NULL,
    quest_id   TEXT NOT NULL,
    started_at TEXT NOT NULL,
    PRIMARY KEY (owner, quest_id)
);
CREATE TABLE IF NOT EXISTS tg3_entries (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    owner        TEXT NOT NULL,
    kind         TEXT NOT NULL CHECK (kind IN ('quest', 'session')),
    quest_id     TEXT,
    title        TEXT NOT NULL,
    category     TEXT,
    minutes      INTEGER NOT NULL CHECK (minutes BETWEEN 1 AND 600),
    note         TEXT,
    completed_at TEXT NOT NULL,
    local_date   TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS tg3_meta (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS tg3_entries_owner_date ON tg3_entries (owner, local_date);
CREATE INDEX IF NOT EXISTS tg3_entries_owner_quest ON tg3_entries (owner, quest_id);
"""


class Database:
    def __init__(self, path: str):
        self.path = path
        with self.connect() as conn:
            conn.executescript(SCHEMA)

    @contextmanager
    def connect(self) -> Iterator[sqlite3.Connection]:
        conn = sqlite3.connect(self.path, timeout=10)
        conn.row_factory = sqlite3.Row
        try:
            conn.execute("PRAGMA foreign_keys = ON")
            conn.execute("PRAGMA journal_mode = WAL")
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()
