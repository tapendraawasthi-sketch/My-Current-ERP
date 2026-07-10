"""Multipart transfer configuration and caching."""

from __future__ import annotations

import threading
from functools import lru_cache
from typing import Any

from backend.config.r2 import R2Config


class TransferManager:
    """Caches ``TransferConfig`` per config fingerprint for upload/download."""

    def __init__(self) -> None:
        self._lock = threading.Lock()

    def get_config(self, config: R2Config) -> Any:
        return _build_transfer_config(
            config.multipart_threshold_mb,
            config.multipart_chunk_size_mb,
            config.upload_max_concurrency,
        )

    @staticmethod
    def multipart_threshold_bytes(config: R2Config) -> int:
        """Return the byte threshold above which multipart upload is used."""
        return config.multipart_threshold_mb * 1024 * 1024

    def clear_cache(self) -> None:
        _build_transfer_config.cache_clear()


@lru_cache(maxsize=32)
def _build_transfer_config(
    threshold_mb: int,
    chunk_mb: int,
    max_concurrency: int,
) -> Any:
    from boto3.s3.transfer import TransferConfig

    threshold = threshold_mb * 1024 * 1024
    chunk = chunk_mb * 1024 * 1024
    return TransferConfig(
        multipart_threshold=threshold,
        multipart_chunksize=chunk,
        max_concurrency=max(1, max_concurrency),
        use_threads=True,
        max_io_queue=1000,
        io_chunksize=chunk,
    )
