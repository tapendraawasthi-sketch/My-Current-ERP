"""Object key prefixes for lifecycle policy separation.

Lifecycle rules in Cloudflare R2 can target prefixes without code changes.
Use ``_tmp/`` for short-lived uploads and the default prefix for permanent data.
"""

from __future__ import annotations

import os

from backend.storage.internal.keys import normalize_key

# Prefixes configurable via env for ops teams applying bucket lifecycle rules.
TEMP_PREFIX = os.getenv("R2_TEMP_PREFIX", "_tmp/").strip() or "_tmp/"
if not TEMP_PREFIX.endswith("/"):
    TEMP_PREFIX += "/"

PERMANENT_PREFIX = os.getenv("R2_PERMANENT_PREFIX", "").strip()
if PERMANENT_PREFIX and not PERMANENT_PREFIX.endswith("/"):
    PERMANENT_PREFIX += "/"


def temp_key(relative_key: str) -> str:
    """Build a temporary object key subject to short-lived lifecycle rules."""
    normalized = normalize_key(relative_key)
    if normalized.startswith(TEMP_PREFIX):
        return normalized
    return f"{TEMP_PREFIX}{normalized}"


def permanent_key(relative_key: str) -> str:
    """Build a permanent object key outside temporary lifecycle rules."""
    normalized = normalize_key(relative_key)
    if PERMANENT_PREFIX and not normalized.startswith(PERMANENT_PREFIX):
        return f"{PERMANENT_PREFIX}{normalized}"
    if normalized.startswith(TEMP_PREFIX):
        return normalized[len(TEMP_PREFIX) :]
    return normalized


def is_temp_key(key: str) -> bool:
    """Return whether a key is under the temporary lifecycle prefix."""
    return normalize_key(key).startswith(TEMP_PREFIX)
