"""Cached Ollama availability probe — enables offline regex fallback."""

from __future__ import annotations

import time

import httpx

from ..config import OLLAMA_BASE_URL

_CACHE_TTL_SEC = 60
_last_check: float = 0.0
_last_online: bool = False


def is_ollama_online(*, force: bool = False) -> bool:
    """Return True if Ollama responds at /api/tags. Result cached for 60 seconds."""
    global _last_check, _last_online

    now = time.monotonic()
    if not force and (now - _last_check) < _CACHE_TTL_SEC:
        return _last_online

    try:
        resp = httpx.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=3)
        resp.raise_for_status()
        _last_online = True
    except Exception:
        _last_online = False

    _last_check = now
    return _last_online


def invalidate_cache() -> None:
    global _last_check
    _last_check = 0.0
