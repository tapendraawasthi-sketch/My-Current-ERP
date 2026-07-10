"""Download helpers for Cloudflare R2."""

from __future__ import annotations

from pathlib import Path
from typing import BinaryIO

from backend.config.r2 import R2Config
from backend.storage._common import run_sync_in_executor, with_storage_error_handling
from backend.storage.internal.container import get_storage_service


@with_storage_error_handling("download_file")
def download_file(
    key: str,
    local_path: str | Path,
    *,
    bucket: str | None = None,
    config: R2Config | None = None,
    version_id: str | None = None,
) -> Path:
    """Download an object to a local file using streamed transfer."""
    return get_storage_service(config).download_file(
        key,
        local_path,
        bucket=bucket,
        config=config,
        version_id=version_id,
    )


@with_storage_error_handling("download_bytes")
def download_bytes(
    key: str,
    *,
    bucket: str | None = None,
    config: R2Config | None = None,
    version_id: str | None = None,
) -> bytes:
    """Download an object fully into memory."""
    return get_storage_service(config).download_bytes(
        key,
        bucket=bucket,
        config=config,
        version_id=version_id,
    )


@with_storage_error_handling("download_fileobj")
def download_fileobj(
    key: str,
    fileobj: BinaryIO,
    *,
    bucket: str | None = None,
    config: R2Config | None = None,
    version_id: str | None = None,
) -> None:
    """Stream an object into a writable binary file-like object."""
    get_storage_service(config).download_fileobj(
        key,
        fileobj,
        bucket=bucket,
        config=config,
        version_id=version_id,
    )


async def download_file_async(
    key: str,
    local_path: str | Path,
    **kwargs,
) -> Path:
    """Async wrapper around ``download_file``."""
    return await run_sync_in_executor(
        None, download_file, key, local_path, **kwargs
    )


async def download_bytes_async(key: str, **kwargs) -> bytes:
    """Async wrapper around ``download_bytes``."""
    return await run_sync_in_executor(None, download_bytes, key, **kwargs)
