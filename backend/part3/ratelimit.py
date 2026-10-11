"""Tiny in-memory sliding-window limiter. Per-process only: use a shared store (or a proxy) when running several workers."""
from __future__ import annotations

import time
from collections import deque
from typing import Callable


class SlidingWindowLimiter:
    def __init__(self, max_events: int, window_s: float = 60.0, clock: Callable[[], float] = time.monotonic):
        self.max_events = max_events
        self.window_s = window_s
        self._clock = clock
        self._events: dict[str, deque[float]] = {}

    def check(self, key: str) -> tuple[bool, int]:
        """Return (allowed, retry_after_seconds). Records the event only when allowed."""
        now = self._clock()
        queue = self._events.setdefault(key, deque())
        while queue and now - queue[0] >= self.window_s:
            queue.popleft()
        if len(queue) >= self.max_events:
            return False, max(1, int(self.window_s - (now - queue[0])) + 1)
        queue.append(now)
        if len(self._events) > 2048:  # bound memory: drop idle keys
            for k in [k for k, q in self._events.items() if not q or now - q[-1] >= self.window_s]:
                self._events.pop(k, None)
        return True, 0
