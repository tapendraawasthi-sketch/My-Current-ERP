"""MAI-03 trace identity — validated opaque IDs (extends existing OIP UUID conventions)."""

from __future__ import annotations

import re
import uuid
from enum import Enum

REDACTION_VERSION = "mai-03.1.0"
TRACE_SCHEMA_VERSION = "1.0.0"
MAX_CORRELATION_HEADER_LENGTH = 128

_UUID_RE = re.compile(
    r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"
)
_HEX32_RE = re.compile(r"^[0-9a-fA-F]{32}$")


class CorrelationSource(str, Enum):
    GENERATED = "GENERATED"
    VALIDATED_UPSTREAM = "VALIDATED_UPSTREAM"
    INTERNAL_CONTINUATION = "INTERNAL_CONTINUATION"


def new_opaque_id() -> str:
    return str(uuid.uuid4())


def new_span_hex() -> str:
    return uuid.uuid4().hex[:16]


def new_trace_hex() -> str:
    return uuid.uuid4().hex


def is_valid_correlation_id(value: str | None) -> bool:
    if value is None:
        return False
    text = str(value).strip()
    if not text or len(text) > MAX_CORRELATION_HEADER_LENGTH:
        return False
    # Strict: UUID or 32-char hex only — no emails, path segments, or free text.
    return bool(_UUID_RE.match(text) or _HEX32_RE.match(text))


def sanitize_or_generate_correlation_id(inbound: str | None) -> tuple[str, CorrelationSource]:
    if is_valid_correlation_id(inbound):
        return str(inbound).strip(), CorrelationSource.VALIDATED_UPSTREAM
    return new_opaque_id(), CorrelationSource.GENERATED


def sanitize_or_generate_request_id(inbound: str | None = None) -> str:
    if is_valid_correlation_id(inbound):
        return str(inbound).strip()
    return new_opaque_id()


def _short_hex(value: str) -> str:
    cleaned = value.replace("-", "")
    return cleaned[:8]


def make_trace_reference(*, trace_id: str, request_id: str) -> str:
    """Opaque user-facing support reference — not a credential."""
    return f"tr_{_short_hex(trace_id)}_{_short_hex(request_id)}"


def is_valid_trace_reference(value: str | None) -> bool:
    if not value:
        return False
    text = str(value).strip()
    return bool(re.match(r"^tr_[0-9a-fA-F]{8}_[0-9a-fA-F]{8}$", text)) and len(text) <= 64
