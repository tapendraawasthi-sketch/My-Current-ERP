"""Structured JSON logging for R2 storage operations."""

from __future__ import annotations

import json
import logging
import time
import uuid
from contextvars import ContextVar
from typing import Any

_request_id: ContextVar[str | None] = ContextVar("r2_request_id", default=None)

logger = logging.getLogger("backend.storage.r2")


def set_request_id(request_id: str | None = None) -> str:
    """Set correlation ID for the current context; generates one if omitted."""
    rid = request_id or str(uuid.uuid4())
    _request_id.set(rid)
    return rid


def get_request_id() -> str | None:
    """Return the current request correlation ID."""
    return _request_id.get()


def log_storage_event(
    *,
    operation: str,
    status: str,
    bucket: str | None = None,
    key: str | None = None,
    latency_ms: float | None = None,
    error_type: str | None = None,
    extra: dict[str, Any] | None = None,
) -> None:
    """Emit a structured JSON log line for a storage operation.

    Never includes secrets or credential values.
    """
    payload: dict[str, Any] = {
        "component": "r2_storage",
        "operation": operation,
        "status": status,
        "request_id": get_request_id(),
    }
    if bucket:
        payload["bucket"] = bucket
    if key:
        payload["object_key"] = key
    if latency_ms is not None:
        payload["latency_ms"] = round(latency_ms, 2)
    if error_type:
        payload["error_type"] = error_type
    if extra:
        payload.update(extra)

    line = json.dumps(payload, default=str)
    if status == "error":
        logger.error(line)
    elif status == "warning":
        logger.warning(line)
    else:
        logger.info(line)


class OperationTimer:
    """Context manager that records operation latency for structured logs."""

    def __init__(
        self,
        operation: str,
        *,
        bucket: str | None = None,
        key: str | None = None,
    ) -> None:
        self.operation = operation
        self.bucket = bucket
        self.key = key
        self._start = 0.0

    def __enter__(self) -> OperationTimer:
        self._start = time.perf_counter()
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        latency_ms = (time.perf_counter() - self._start) * 1000
        if exc_type is None:
            log_storage_event(
                operation=self.operation,
                status="success",
                bucket=self.bucket,
                key=self.key,
                latency_ms=latency_ms,
            )
        else:
            log_storage_event(
                operation=self.operation,
                status="error",
                bucket=self.bucket,
                key=self.key,
                latency_ms=latency_ms,
                error_type=exc_type.__name__ if exc_type else None,
            )
