"""Upload helpers for Cloudflare R2."""

from __future__ import annotations

from collections.abc import Mapping
from pathlib import Path
from typing import BinaryIO

from backend.config.r2 import R2Config
from backend.storage._common import run_sync_in_executor, with_storage_error_handling
from backend.storage.internal.container import get_storage_service


@with_storage_error_handling("upload_file")
def upload_file(
    local_path: str | Path,
    key: str,
    *,
    bucket: str | None = None,
    content_type: str | None = None,
    metadata: Mapping[str, str] | None = None,
    config: R2Config | None = None,
    version_id: str | None = None,
) -> str:
    """Upload a local file to R2 using streamed multipart transfer."""
    return get_storage_service(config).upload_file(
        local_path,
        key,
        bucket=bucket,
        content_type=content_type,
        metadata=metadata,
        config=config,
        version_id=version_id,
    )


@with_storage_error_handling("upload_bytes")
def upload_bytes(
    data: bytes,
    key: str,
    *,
    bucket: str | None = None,
    content_type: str | None = "application/octet-stream",
    metadata: Mapping[str, str] | None = None,
    config: R2Config | None = None,
    version_id: str | None = None,
) -> str:
    """Upload in-memory bytes to R2."""
    return get_storage_service(config).upload_bytes(
        data,
        key,
        bucket=bucket,
        content_type=content_type,
        metadata=metadata,
        config=config,
        version_id=version_id,
    )


@with_storage_error_handling("upload_fileobj")
def upload_fileobj(
    fileobj: BinaryIO,
    key: str,
    *,
    bucket: str | None = None,
    content_type: str | None = "application/octet-stream",
    metadata: Mapping[str, str] | None = None,
    config: R2Config | None = None,
    version_id: str | None = None,
) -> str:
    """Upload from a readable binary stream without buffering entire content."""
    return get_storage_service(config).upload_fileobj(
        fileobj,
        key,
        bucket=bucket,
        content_type=content_type,
        metadata=metadata,
        config=config,
        version_id=version_id,
    )


async def upload_file_async(
    local_path: str | Path,
    key: str,
    **kwargs,
) -> str:
    """Async wrapper around ``upload_file`` (runs in thread pool)."""
    return await run_sync_in_executor(None, upload_file, local_path, key, **kwargs)


async def upload_bytes_async(data: bytes, key: str, **kwargs) -> str:
    """Async wrapper around ``upload_bytes``."""
    return await run_sync_in_executor(None, upload_bytes, data, key, **kwargs)
