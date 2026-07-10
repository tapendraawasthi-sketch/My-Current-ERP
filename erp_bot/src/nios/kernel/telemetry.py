"""NIOS Telemetry — pipeline trace spans."""

from __future__ import annotations

import logging
import time
from contextlib import contextmanager
from typing import Any, Generator

logger = logging.getLogger(__name__)


class Telemetry:
    def __init__(self) -> None:
        self._spans: list[dict[str, Any]] = []

    @contextmanager
    def span(self, name: str, **attrs: Any) -> Generator[None, None, None]:
        start = time.perf_counter()
        try:
            yield
            elapsed_ms = (time.perf_counter() - start) * 1000
            self._spans.append({"name": name, "ms": round(elapsed_ms, 2), "ok": True, **attrs})
        except Exception as exc:
            elapsed_ms = (time.perf_counter() - start) * 1000
            self._spans.append(
                {"name": name, "ms": round(elapsed_ms, 2), "ok": False, "error": str(exc), **attrs}
            )
            raise

    def flush(self) -> list[dict[str, Any]]:
        spans, self._spans = self._spans, []
        return spans

    def log_event(self, name: str, **attrs: Any) -> None:
        logger.info("[NIOS Telemetry] %s %s", name, attrs)
