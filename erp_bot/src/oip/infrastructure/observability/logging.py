"""Structured logging for OIP — MAI-03 redaction on all fields."""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any

from .correlation import current_trace
from .mai03_context import get_trace_context
from .mai03_redaction import validate_safe_event

logger = logging.getLogger("oip")


def log_event(event_name: str, **fields: Any) -> None:
    """Emit structured log. Sensitive fields are redacted (fail-closed)."""
    mai = get_trace_context()
    if mai is not None:
        base = {
            "ts": datetime.now(timezone.utc).isoformat(),
            "event": event_name,
            "request_id": mai.request_id,
            "correlation_id": mai.correlation_id,
            "trace_id": mai.trace_id,
            "trace_reference": mai.trace_reference,
        }
    else:
        trace = current_trace()
        base = {
            "ts": datetime.now(timezone.utc).isoformat(),
            "event": event_name,
            "request_id": str(trace.request_id),
            "correlation_id": str(trace.correlation_id),
        }
    payload = validate_safe_event({**base, **fields})
    logger.info(json.dumps(payload, default=str))
