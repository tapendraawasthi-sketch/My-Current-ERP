"""MAI-03 central redaction — allowlist-first, fail-closed, REDACTION_VERSION."""

from __future__ import annotations

import re
from typing import Any

from .mai03_identity import REDACTION_VERSION

REDACTED = "[REDACTED]"
DROPPED = "[DROPPED]"
MAX_DEPTH = 8
MAX_STRING = 256
MAX_COLLECTION = 50

# Explicitly forbidden keys (case-insensitive match on key name).
_FORBIDDEN_KEYS = frozenset(
    {
        "authorization",
        "proxy-authorization",
        "cookie",
        "set-cookie",
        "password",
        "passwd",
        "secret",
        "api_key",
        "apikey",
        "access_token",
        "refresh_token",
        "id_token",
        "jwt",
        "bearer",
        "raw_text",
        "message",
        "question",
        "prompt",
        "system_prompt",
        "messages",
        "content",
        "answer",
        "completion",
        "model_input",
        "model_output",
        "thinking",
        "chain_of_thought",
        "tool_arguments",
        "typed_arguments",
        "tool_result",
        "typed_result",
        "retrieved_text",
        "extracted_text_or_fact",
        "narration",
        "email",
        "phone",
        "pan",
        "vat_number",
        "bank_account",
        "card_number",
        "customer_name",
        "supplier_name",
        "connection_string",
        "database_url",
        "encryption_key",
        "private_key",
        "session_secret",
        "sql",
        "stack_trace",
        "traceback",
        "exc_info",
    }
)

_ALLOWED_KEYS = frozenset(
    {
        "schema_version",
        "trace_id",
        "request_id",
        "event_id",
        "parent_event_id",
        "stage",
        "status",
        "started_at",
        "completed_at",
        "duration_ms",
        "route",
        "component",
        "operation",
        "outcome_code",
        "safe_error_code",
        "tenant_scope_reference",
        "company_scope_reference",
        "principal_reference",
        "conversation_reference",
        "component_versions",
        "metrics",
        "safe_attributes",
        "redaction_version",
        "correlation_id",
        "trace_reference",
        "correlation_source",
        "contract_schema_version",
        "constitution_policy_version",
        "response_type",
        "message_char_length",
        "item_count",
        "evidence_count",
        "model_provider",
        "model_name",
        "model_revision",
        "prompt_id",
        "prompt_version",
        "tool_name",
        "tool_schema_version",
        "policy_decision_code",
        "orbix_mode",
        "event",
        "ts",
        "latency_ms",
        "success",
        "http_status",
        "path",
        "method",
        "sample_count",
        "span_count",
        "protected_count",
        "code_mix_pattern",
        "quality_flag_count",
        "normalization_status",
        "normalization_edit_count",
        "normalization_view_count",
        "normalization_candidate_count",
        "applied_edit_count",
        "transliteration_status",
        "transliteration_eligible_span_count",
        "transliteration_candidate_count",
        "transliteration_abstention_count",
        "transliteration_truncated_count",
        "quality_flag_count",
        "code_mix_pattern",
        "protected_count",
        "span_count",
    }
)

_BEARER_RE = re.compile(r"(?i)\bbearer\s+[A-Za-z0-9\-._~+/]+=*")
_JWT_RE = re.compile(r"\beyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_+/=]*\b")
_API_KEY_RE = re.compile(r"(?i)\b(sk|rk|key|api)[_-][A-Za-z0-9]{8,}\b")
_EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
_PHONE_RE = re.compile(r"(?<!\d)(?:\+?\d[\d\-\s]{8,}\d)(?!\d)")
_THINK_RE = re.compile(r"<think>[\s\S]*?</think>", re.IGNORECASE)
_CONN_RE = re.compile(r"(?i)(postgres|mysql|mongodb|redis)://[^\s]+")


class RedactionFailed(Exception):
    pass


def redact_string(value: str) -> str:
    text = value
    text = _THINK_RE.sub(REDACTED, text)
    text = _BEARER_RE.sub(REDACTED, text)
    text = _JWT_RE.sub(REDACTED, text)
    text = _API_KEY_RE.sub(REDACTED, text)
    text = _CONN_RE.sub(REDACTED, text)
    text = _EMAIL_RE.sub(REDACTED, text)
    text = _PHONE_RE.sub(REDACTED, text)
    if len(text) > MAX_STRING:
        text = text[:MAX_STRING] + "…"
    return text


def _key_forbidden(key: str) -> bool:
    k = key.lower().replace("-", "_")
    if k in _FORBIDDEN_KEYS:
        return True
    if any(part in k for part in ("password", "token", "secret", "authorization", "cookie")):
        return True
    return False


def redact_for_trace(value: Any, *, classification: str = "unknown", _depth: int = 0) -> Any:
    try:
        if _depth > MAX_DEPTH:
            return DROPPED
        if value is None or isinstance(value, (bool, int, float)):
            if isinstance(value, float) and (value != value or value in (float("inf"), float("-inf"))):
                return None
            return value
        if isinstance(value, bytes):
            return "[BINARY]"
        if isinstance(value, str):
            if classification in {"user_text", "prompt", "model_output", "tool_payload"}:
                return REDACTED
            return redact_string(value)
        if isinstance(value, dict):
            return redact_mapping(value, _depth=_depth + 1)
        if isinstance(value, (list, tuple, set)):
            items = list(value)[:MAX_COLLECTION]
            out = [redact_for_trace(v, _depth=_depth + 1) for v in items]
            return out if not isinstance(value, tuple) else tuple(out)
        if hasattr(value, "model_dump"):
            return redact_mapping(value.model_dump(mode="json"), _depth=_depth + 1)
        if hasattr(value, "__dict__") and not isinstance(value, type):
            return redact_mapping(vars(value), _depth=_depth + 1)
        return redact_string(str(value))
    except Exception as exc:  # noqa: BLE001
        raise RedactionFailed("TRACE_REDACTION_FAILED") from exc


def redact_mapping(mapping: dict[str, Any], *, _depth: int = 0) -> dict[str, Any]:
    if _depth > MAX_DEPTH:
        return {"_": DROPPED}
    out: dict[str, Any] = {}
    for raw_key, raw_val in list(mapping.items())[:MAX_COLLECTION]:
        key = str(raw_key)
        if _key_forbidden(key):
            out[key] = REDACTED
            continue
        # Allowlist-first for top-level and nested free-form: prefer allow, else redact stringy.
        if key not in _ALLOWED_KEYS and not key.endswith("_ms") and not key.endswith("_count"):
            # Safe numeric/bool short keys may pass; others drop.
            if isinstance(raw_val, (bool, int, float)) and key.isidentifier():
                out[key] = raw_val
                continue
            if isinstance(raw_val, dict):
                out[key] = redact_mapping(raw_val, _depth=_depth + 1)
                continue
            out[key] = REDACTED
            continue
        out[key] = redact_for_trace(raw_val, _depth=_depth + 1)
    return out


def redact_exception(exc: BaseException) -> dict[str, str]:
    return {
        "safe_error_code": type(exc).__name__[:64],
        "safe_message": "An internal error occurred",
        "redaction_version": REDACTION_VERSION,
    }


def validate_safe_event(event: dict[str, Any]) -> dict[str, Any]:
    """Fail closed: re-redact and reject if forbidden residual content detected."""
    try:
        safe = redact_mapping(event)
    except RedactionFailed:
        return {
            "stage": str(event.get("stage") or "UNKNOWN"),
            "status": "FAILED",
            "safe_error_code": "TRACE_REDACTION_FAILED",
            "redaction_version": REDACTION_VERSION,
        }
    blob = str(safe).lower()
    for needle in ("bearer ", "eyj", "password=", "<think>", "sk-", "authorization:"):
        if needle in blob:
            return {
                "stage": str(event.get("stage") or "UNKNOWN"),
                "status": "FAILED",
                "safe_error_code": "TRACE_REDACTION_FAILED",
                "redaction_version": REDACTION_VERSION,
            }
    safe["redaction_version"] = REDACTION_VERSION
    return safe
