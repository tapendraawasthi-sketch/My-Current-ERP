"""Existence checks for Cloudflare R2 objects."""

from __future__ import annotations

from backend.config.r2 import R2Config
from backend.storage._common import run_sync_in_executor, with_storage_error_handling
from backend.storage.internal.container import get_storage_service


@with_storage_error_handling("file_exists")
def file_exists(
    key: str,
    *,
    bucket: str | None = None,
    config: R2Config | None = None,
    version_id: str | None = None,
) -> bool:
    """Return whether an object exists in R2."""
    return get_storage_service(config).file_exists(
        key,
        bucket=bucket,
        config=config,
        version_id=version_id,
    )


@with_storage_error_handling("get_object_metadata")
def get_object_metadata(
    key: str,
    *,
    bucket: str | None = None,
    config: R2Config | None = None,
    version_id: str | None = None,
) -> dict:
    """Return object metadata via ``HeadObject``."""
    return get_storage_service(config).get_object_metadata(
        key,
        bucket=bucket,
        config=config,
        version_id=version_id,
    )


async def file_exists_async(key: str, **kwargs) -> bool:
    """Async wrapper around ``file_exists``."""
    return await run_sync_in_executor(None, file_exists, key, **kwargs)
