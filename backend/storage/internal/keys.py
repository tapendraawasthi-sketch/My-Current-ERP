"""Object key and prefix normalization."""

from __future__ import annotations

import re

from backend.storage.internal.errors import StorageError

_KEY_PATTERN = re.compile(r"^(?!/)(?!.*\.\.)[A-Za-z0-9._\-/]+$")


def normalize_key(key: str) -> str:
    """Normalize and validate an object key."""
    normalized = key.strip().lstrip("/").replace("\\", "/")
    while "//" in normalized:
        normalized = normalized.replace("//", "/")
    if not normalized:
        raise StorageError("Object key cannot be empty.")
    if normalized.endswith("/"):
        raise StorageError(
            f"Object key must not end with '/': {normalized!r}. "
            "Use folder helpers for prefix operations."
        )
    if ".." in normalized.split("/"):
        raise StorageError(f"Object key must not contain '..': {normalized!r}")
    if not _KEY_PATTERN.match(normalized):
        raise StorageError(
            f"Object key contains invalid characters: {normalized!r}"
        )
    return normalized


def normalize_prefix(prefix: str) -> str:
    """Normalize a folder prefix for list/delete operations."""
    if not prefix or not prefix.strip():
        return ""
    normalized = prefix.strip().lstrip("/").replace("\\", "/")
    while "//" in normalized:
        normalized = normalized.replace("//", "/")
    if ".." in normalized.split("/"):
        raise StorageError(f"Prefix must not contain '..': {normalized!r}")
    if not normalized.endswith("/"):
        normalized += "/"
    return normalized


def key_prefix_for_logs(key: str, *, depth: int = 2) -> str:
    """Return a log-safe key prefix (first N path segments) for scale."""
    parts = key.split("/")
    if len(parts) <= depth:
        return key
    return "/".join(parts[:depth]) + "/…"
