"""TTL LRU cache for HeadObject metadata."""

from __future__ import annotations

import threading
import time
from collections import OrderedDict

from backend.storage.internal.protocols import MetadataCache


class TtlLruMetadataCache(MetadataCache):
    """Bounded TTL cache reducing HeadObject calls at billion-object scale."""

    def __init__(self, *, max_entries: int = 10_000, ttl_seconds: float = 60.0) -> None:
        self._max_entries = max(1, max_entries)
        self._ttl = max(0.0, ttl_seconds)
        self._lock = threading.Lock()
        self._data: OrderedDict[str, tuple[float, dict]] = OrderedDict()

    def _cache_key(self, bucket: str, key: str, version_id: str | None) -> str:
        vid = version_id or ""
        return f"{bucket}:{key}:{vid}"

    def get(self, bucket: str, key: str, version_id: str | None) -> dict | None:
        cache_key = self._cache_key(bucket, key, version_id)
        now = time.monotonic()
        with self._lock:
            entry = self._data.get(cache_key)
            if entry is None:
                return None
            expires_at, metadata = entry
            if expires_at < now:
                del self._data[cache_key]
                return None
            self._data.move_to_end(cache_key)
            return dict(metadata)

    def set(
        self, bucket: str, key: str, version_id: str | None, metadata: dict
    ) -> None:
        if self._ttl <= 0:
            return
        cache_key = self._cache_key(bucket, key, version_id)
        expires_at = time.monotonic() + self._ttl
        with self._lock:
            self._data[cache_key] = (expires_at, dict(metadata))
            self._data.move_to_end(cache_key)
            while len(self._data) > self._max_entries:
                self._data.popitem(last=False)

    def invalidate(self, bucket: str, key: str) -> None:
        prefix = f"{bucket}:{key}:"
        with self._lock:
            to_delete = [k for k in self._data if k.startswith(prefix)]
            for k in to_delete:
                del self._data[k]

    def invalidate_prefix(self, bucket: str, prefix: str) -> None:
        needle = f"{bucket}:{prefix}"
        with self._lock:
            to_delete = [k for k in self._data if k.startswith(needle)]
            for k in to_delete:
                del self._data[k]

    def clear(self) -> None:
        with self._lock:
            self._data.clear()
