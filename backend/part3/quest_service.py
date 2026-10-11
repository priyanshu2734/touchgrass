"""Quest catalogue + persistence of starts and completions."""
from __future__ import annotations

import json
import re
import unicodedata
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Callable, Optional

from .db import Database
from .models import (
    CompleteQuestResponse,
    CompleteRequest,
    Progress,
    ProgressEntry,
    Quest,
    QuestSeed,
    SessionRequest,
)
from .progress import build_milestones, compute_streaks, parse_day, recent_window

CATALOG_PATH = Path(__file__).parent / "data" / "quests.json"
DUPLICATE_WINDOW_S = 30  # a repeat completion of the same quest within this window is treated as a double tap
MAX_RECENT = 30
_CONTROL = re.compile(r"[\x00-\x08\x0b-\x1f\x7f]")


class NotFound(Exception):
    pass


class Invalid(Exception):
    pass


def load_catalog(path: Path = CATALOG_PATH) -> dict[str, QuestSeed]:
    raw = json.loads(path.read_text(encoding="utf-8"))
    seeds = [QuestSeed.model_validate(item) for item in raw]
    catalog = {s.id: s for s in seeds}
    if len(catalog) != len(seeds):
        raise ValueError("Duplicate quest ids in catalogue")
    return catalog


def clean_note(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    text = unicodedata.normalize("NFC", _CONTROL.sub("", value)).strip()
    return text or None


def iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


class QuestService:
    def __init__(
        self,
        db: Database,
        catalog: Optional[dict[str, QuestSeed]] = None,
        clock: Callable[[], datetime] = lambda: datetime.now(timezone.utc),
        plans_counter: Optional[Callable[[str], int]] = None,
    ):
        self.db = db
        self._plans_counter = plans_counter
        self.catalog = catalog if catalog is not None else load_catalog()
        self._clock = clock

    # ------------------------------------------------------------ quests
    def list_quests(self, owner: str) -> list[Quest]:
        with self.db.connect() as conn:
            starts = {r["quest_id"]: r["started_at"] for r in conn.execute(
                "SELECT quest_id, started_at FROM tg3_quest_starts WHERE owner = ?", (owner,))}
            done = {r["quest_id"]: (r["n"], r["last"]) for r in conn.execute(
                "SELECT quest_id, COUNT(*) AS n, MAX(completed_at) AS last FROM tg3_entries "
                "WHERE owner = ? AND kind = 'quest' GROUP BY quest_id", (owner,))}
        return [self._compose(seed, starts.get(seed.id), done.get(seed.id)) for seed in self.catalog.values()]

    def get_quest(self, owner: str, quest_id: str) -> Quest:
        seed = self._seed(quest_id)
        with self.db.connect() as conn:
            start = conn.execute(
                "SELECT started_at FROM tg3_quest_starts WHERE owner = ? AND quest_id = ?", (owner, quest_id)).fetchone()
            done = conn.execute(
                "SELECT COUNT(*) AS n, MAX(completed_at) AS last FROM tg3_entries "
                "WHERE owner = ? AND kind = 'quest' AND quest_id = ?", (owner, quest_id)).fetchone()
        return self._compose(seed, start["started_at"] if start else None, (done["n"], done["last"]) if done["n"] else None)

    @staticmethod
    def _compose(seed: QuestSeed, started_at: Optional[str], done: Optional[tuple[int, str]]) -> Quest:
        count, last = done if done else (0, None)
        status = "in-progress" if started_at else ("completed" if count else "available")
        return Quest(**seed.model_dump(), status=status, started_at=started_at, completed_at=last, completion_count=count)

    def start(self, owner: str, quest_id: str) -> Quest:
        self._seed(quest_id)
        now = iso(self._clock())
        with self.db.connect() as conn:
            conn.execute(
                "INSERT OR IGNORE INTO tg3_quest_starts (owner, quest_id, started_at) VALUES (?, ?, ?)",
                (owner, quest_id, now),
            )
        return self.get_quest(owner, quest_id)

    def cancel_start(self, owner: str, quest_id: str) -> Quest:
        self._seed(quest_id)
        with self.db.connect() as conn:
            conn.execute("DELETE FROM tg3_quest_starts WHERE owner = ? AND quest_id = ?", (owner, quest_id))
        return self.get_quest(owner, quest_id)

    # ------------------------------------------------------------ completion
    def complete(
        self, owner: str, quest_id: str, body: Optional[CompleteRequest] = None, today: Optional[str] = None
    ) -> CompleteQuestResponse:
        """Record a completion.

        Idempotent by default: completing an already-completed quest changes nothing unless `repeat` is true,
        and even then a second call within DUPLICATE_WINDOW_S is ignored as an accidental double submit.
        """
        seed = self._seed(quest_id)
        body = body or CompleteRequest()
        now = self._clock()
        local_date = self._local_date(body.local_date, now)
        note = clean_note(body.reflection)
        minutes = body.minutes_spent if body.minutes_spent is not None else seed.minutes

        with self.db.connect() as conn:
            last = conn.execute(
                "SELECT completed_at FROM tg3_entries WHERE owner = ? AND kind = 'quest' AND quest_id = ? "
                "ORDER BY completed_at DESC LIMIT 1", (owner, quest_id)).fetchone()
            record = True
            if last is not None:
                if not body.repeat:
                    record = False
                else:
                    last_dt = datetime.fromisoformat(last["completed_at"].replace("Z", "+00:00"))
                    if (now - last_dt) < timedelta(seconds=DUPLICATE_WINDOW_S):
                        record = False
            if record:
                conn.execute(
                    "INSERT INTO tg3_entries (owner, kind, quest_id, title, category, minutes, note, completed_at, local_date) "
                    "VALUES (?, 'quest', ?, ?, ?, ?, ?, ?, ?)",
                    (owner, quest_id, seed.title, seed.category, minutes, note, iso(now), local_date),
                )
            conn.execute("DELETE FROM tg3_quest_starts WHERE owner = ? AND quest_id = ?", (owner, quest_id))
        return CompleteQuestResponse(quest=self.get_quest(owner, quest_id), progress=self.progress(owner, today))

    def log_session(self, owner: str, body: SessionRequest, today: Optional[str] = None) -> Progress:
        now = self._clock()
        with self.db.connect() as conn:
            conn.execute(
                "INSERT INTO tg3_entries (owner, kind, quest_id, title, category, minutes, note, completed_at, local_date) "
                "VALUES (?, 'session', NULL, 'Time outside', NULL, ?, ?, ?, ?)",
                (owner, body.minutes, clean_note(body.note), iso(now), self._local_date(body.local_date, now)),
            )
        return self.progress(owner, today)

    def update_note(self, owner: str, entry_id: int, note: Optional[str], today: Optional[str] = None) -> Progress:
        with self.db.connect() as conn:
            cur = conn.execute(
                "UPDATE tg3_entries SET note = ? WHERE id = ? AND owner = ?", (clean_note(note), entry_id, owner))
            if cur.rowcount == 0:
                raise NotFound("That entry could not be found.")
        return self.progress(owner, today)

    def delete_entry(self, owner: str, entry_id: int, today: Optional[str] = None) -> Progress:
        with self.db.connect() as conn:
            cur = conn.execute("DELETE FROM tg3_entries WHERE id = ? AND owner = ?", (entry_id, owner))
            if cur.rowcount == 0:
                raise NotFound("That entry could not be found.")
        return self.progress(owner, today)

    # ------------------------------------------------------------ progress
    def progress(self, owner: str, today: Optional[str] = None) -> Progress:
        today_d = self._today(today)
        with self.db.connect() as conn:
            rows = conn.execute(
                "SELECT id, kind, quest_id, title, category, minutes, note, completed_at, local_date "
                "FROM tg3_entries WHERE owner = ? ORDER BY completed_at DESC, id DESC", (owner,)).fetchall()

        quests = [r for r in rows if r["kind"] == "quest"]
        sessions = [r for r in rows if r["kind"] == "session"]
        minutes = sum(r["minutes"] for r in rows)
        dates = [r["local_date"] for r in rows]
        current, longest = compute_streaks(dates, today_d)
        categories = {r["category"] for r in quests if r["category"]}
        notes = sum(1 for r in rows if r["note"])
        start, end = recent_window(today_d)

        return Progress(
            completed_activities=len(quests),
            outdoor_minutes=minutes,
            current_streak=current,
            longest_streak=longest,
            milestones=build_milestones(len(quests), minutes, longest, len(categories), notes),
            recent=[
                ProgressEntry(
                    id=str(r["id"]),
                    kind=r["kind"],
                    quest_id=r["quest_id"] or f"session-{r['id']}",
                    title=r["title"],
                    completed_at=r["completed_at"],
                    local_date=r["local_date"],
                    minutes=r["minutes"],
                    note=r["note"],
                )
                for r in rows[:MAX_RECENT]
            ],
            active_days=len(set(dates)),
            sessions_logged=len(sessions),
            active_dates=sorted({d for d in dates if start <= d <= end}),
            plans_generated=self._plans_counter(owner) if self._plans_counter else None,
        )

    # ------------------------------------------------------------ helpers
    def _seed(self, quest_id: str) -> QuestSeed:
        seed = self.catalog.get(quest_id)
        if seed is None:
            raise NotFound("That quest could not be found.")
        return seed

    def _today(self, today: Optional[str]) -> date:
        parsed = parse_day(today) if today else None
        server_today = self._clock().date()
        if parsed is None or abs((parsed - server_today).days) > 2:
            return server_today
        return parsed

    def _local_date(self, supplied: Optional[str], now: datetime) -> str:
        if supplied is None:
            return now.date().isoformat()
        parsed = parse_day(supplied)
        if parsed is None or abs((parsed - now.date()).days) > 2:  # time zones span at most +/-1 day from UTC
            raise Invalid("The date for this entry is not valid.")
        return parsed.isoformat()
