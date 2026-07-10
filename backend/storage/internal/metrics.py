"""In-process metrics for observability and health reporting."""

from __future__ import annotations

import threading
import time
from collections import defaultdict
from collections.abc import Mapping
from contextlib import contextmanager
from typing import Any, Iterator

from backend.storage.internal.protocols import MetricsCollector


class InMemoryMetrics(MetricsCollector):
    """Thread-safe counters and timing histograms.

    Suitable for single-process deployments; swap for Prometheus/OpenTelemetry
    via dependency injection without changing call sites.
    """

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._counters: dict[str, int] = defaultdict(int)
        self._timings: dict[str, list[float]] = defaultdict(list)
        self._max_timing_samples = 10_000

    def increment(self, name: str, *, tags: Mapping[str, str] | None = None) -> None:
        key = self._metric_key(name, tags)
        with self._lock:
            self._counters[key] += 1

    def timing(
        self, name: str, duration_ms: float, *, tags: Mapping[str, str] | None = None
    ) -> None:
        key = self._metric_key(name, tags)
        with self._lock:
            bucket = self._timings[key]
            bucket.append(duration_ms)
            if len(bucket) > self._max_timing_samples:
                del bucket[: len(bucket) - self._max_timing_samples]

    def snapshot(self) -> dict[str, Any]:
        with self._lock:
            timings_summary = {}
            for key, values in self._timings.items():
                if not values:
                    continue
                sorted_v = sorted(values)
                n = len(sorted_v)
                timings_summary[key] = {
                    "count": n,
                    "avg_ms": round(sum(sorted_v) / n, 2),
                    "p50_ms": round(sorted_v[n // 2], 2),
                    "p99_ms": round(sorted_v[int(n * 0.99)], 2),
                    "max_ms": round(sorted_v[-1], 2),
                }
            return {
                "counters": dict(self._counters),
                "timings": timings_summary,
            }

    def reset(self) -> None:
        with self._lock:
            self._counters.clear()
            self._timings.clear()

    @staticmethod
    def _metric_key(name: str, tags: Mapping[str, str] | None) -> str:
        if not tags:
            return name
        tag_str = ",".join(f"{k}={v}" for k, v in sorted(tags.items()))
        return f"{name}|{tag_str}"


@contextmanager
def record_operation(
    metrics: MetricsCollector,
    operation: str,
    *,
    tags: Mapping[str, str] | None = None,
) -> Iterator[None]:
    """Context manager that records duration and success/error counters."""
    start = time.perf_counter()
    merged = dict(tags or {})
    merged["operation"] = operation
    try:
        yield
        metrics.increment("storage.requests.success", tags=merged)
    except Exception:
        metrics.increment("storage.requests.error", tags=merged)
        raise
    finally:
        elapsed_ms = (time.perf_counter() - start) * 1000
        metrics.timing("storage.request.duration_ms", elapsed_ms, tags=merged)
