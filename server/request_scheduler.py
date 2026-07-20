"""Cooperative priority scheduling for scarce third-party API capacity.

The regular campaign worker and the realtime onboarding worker live in the
same process.  A request already in flight cannot safely be interrupted, but
between requests the regular worker yields to waiting realtime work.  This
keeps the single-resource guarantee while avoiding a second, competing rate
limiter that would produce 429s.
"""

from __future__ import annotations

from collections import deque
from contextlib import contextmanager
import threading
import time
from typing import Deque, Iterator, Literal

RequestPriority = Literal["normal", "realtime"]


class PriorityRequestGate:
    """Serialize requests and optionally enforce a rolling-window quota."""

    def __init__(self, *, max_requests: int | None = None, window_seconds: float = 0) -> None:
        self._condition = threading.Condition()
        self._active = False
        self._realtime_waiters = 0
        self._timestamps: Deque[float] = deque()
        self._max_requests = max_requests
        self._window_seconds = window_seconds

    def _prune(self, now: float) -> None:
        if not self._max_requests:
            return
        while self._timestamps and now - self._timestamps[0] >= self._window_seconds:
            self._timestamps.popleft()

    def _quota_wait(self, now: float) -> float:
        self._prune(now)
        if not self._max_requests or len(self._timestamps) < self._max_requests:
            return 0
        return max(0.01, self._window_seconds - (now - self._timestamps[0]))

    @contextmanager
    def slot(self, priority: RequestPriority = "normal") -> Iterator[None]:
        realtime = priority == "realtime"
        with self._condition:
            if realtime:
                self._realtime_waiters += 1
            try:
                while True:
                    now = time.monotonic()
                    quota_wait = self._quota_wait(now)
                    may_run = not self._active and (realtime or self._realtime_waiters == 0)
                    if may_run and quota_wait <= 0:
                        self._active = True
                        if self._max_requests:
                            self._timestamps.append(now)
                        break
                    self._condition.wait(timeout=quota_wait if quota_wait > 0 else 0.25)
            finally:
                if realtime:
                    self._realtime_waiters -= 1

        try:
            yield
        finally:
            with self._condition:
                self._active = False
                self._condition.notify_all()


# PDL allows ten person-search calls per minute.  A small safety margin matches
# the existing implementation and accounts for clock/network jitter.
pdl_person_search_gate = PriorityRequestGate(max_requests=10, window_seconds=65)

# Only one model call is allowed at a time on the small production host.  A
# realtime call gets the next slot after the current HTTP request completes.
ai_request_gate = PriorityRequestGate()

