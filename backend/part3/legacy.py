"""One-time import of quest completions saved by the Part 2 backend.

Part 2 stored one completion per profile and quest in `quest_completions`. Part 3 stores richer entries in
`tg3_entries`. On first start against an older database file this copies the old rows across, so nobody loses
progress. It is idempotent (a marker row in `tg3_meta`), never modifies or deletes the old table, and skips
rows whose quest no longer exists in the catalogue.
"""
from __future__ import annotations

from dataclasses import dataclass

from .db import Database
from .models import QuestSeed

MARKER = "legacy_completions_imported"


@dataclass(frozen=True)
class ImportResult:
    imported: int
    skipped: int
    already_done: bool = False
    no_legacy_table: bool = False


def import_part2_completions(db: Database, catalog: dict[str, QuestSeed]) -> ImportResult:
    with db.connect() as conn:
        if conn.execute("SELECT 1 FROM tg3_meta WHERE key = ?", (MARKER,)).fetchone():
            return ImportResult(0, 0, already_done=True)
        has_table = conn.execute(
            "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'quest_completions'"
        ).fetchone()
        if not has_table:
            conn.execute("INSERT INTO tg3_meta (key, value) VALUES (?, ?)", (MARKER, "no-legacy-table"))
            return ImportResult(0, 0, no_legacy_table=True)

        imported = skipped = 0
        rows = conn.execute(
            "SELECT profile_id, quest_id, completed_at, minutes FROM quest_completions ORDER BY id"
        ).fetchall()
        for row in rows:
            seed = catalog.get(row["quest_id"])
            if seed is None:
                skipped += 1
                continue
            minutes = min(600, max(1, int(row["minutes"] or seed.minutes)))
            conn.execute(
                "INSERT INTO tg3_entries (owner, kind, quest_id, title, category, minutes, note, completed_at, local_date) "
                "VALUES (?, 'quest', ?, ?, ?, ?, NULL, ?, ?)",
                (row["profile_id"], seed.id, seed.title, seed.category, minutes, row["completed_at"], row["completed_at"][:10]),
            )
            imported += 1
        conn.execute("INSERT INTO tg3_meta (key, value) VALUES (?, ?)", (MARKER, f"{imported} imported, {skipped} skipped"))
    return ImportResult(imported, skipped)
