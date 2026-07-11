"""Simple in-memory rate limiter for API protection."""

from __future__ import annotations

import time
from collections import defaultdict, deque
from dataclasses import dataclass


@dataclass(frozen=True)
class RateLimitResult:
    allowed: bool
    remaining: int
    retry_after_seconds: float


class RateLimiter:
    def __init__(self, *, max_requests: int = 120, window_seconds: float = 60.0) -> None:
        self._max_requests = max_requests
        self._window_seconds = window_seconds
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    def check(self, key: str) -> RateLimitResult:
        now = time.monotonic()
        bucket = self._hits[key]
        cutoff = now - self._window_seconds
        while bucket and bucket[0] < cutoff:
            bucket.popleft()
        if len(bucket) >= self._max_requests:
            retry_after = max(0.0, self._window_seconds - (now - bucket[0]))
            return RateLimitResult(allowed=False, remaining=0, retry_after_seconds=retry_after)
        bucket.append(now)
        return RateLimitResult(
            allowed=True,
            remaining=self._max_requests - len(bucket),
            retry_after_seconds=0.0,
        )
