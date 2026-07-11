"""Structured logging for OIP — no PII in log bodies (Constitution)."""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any

from .correlation import current_trace

logger = logging.getLogger("oip")


def log_event(event_name: str, **fields: Any) -> None:
    trace = current_trace()
    payload = {
        "ts": datetime.now(timezone.utc).isoformat(),
        "event": event_name,
        "request_id": str(trace.request_id),
        "correlation_id": str(trace.correlation_id),
        **fields,
    }
    logger.info(json.dumps(payload, default=str))
