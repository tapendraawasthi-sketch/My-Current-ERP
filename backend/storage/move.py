"""Move (copy + delete) helpers for Cloudflare R2."""

from __future__ import annotations

from backend.config.r2 import R2Config
from backend.storage._common import run_sync_in_executor, with_storage_error_handling
from backend.storage.internal.container import get_storage_service


@with_storage_error_handling("move_file")
def move_file(
    source_key: str,
    dest_key: str,
    *,
    source_bucket: str | None = None,
    dest_bucket: str | None = None,
    config: R2Config | None = None,
    source_version_id: str | None = None,
    dest_version_id: str | None = None,
) -> str:
    """Move an object by server-side copy followed by delete."""
    return get_storage_service(config).move_file(
        source_key,
        dest_key,
        source_bucket=source_bucket,
        dest_bucket=dest_bucket,
        config=config,
        source_version_id=source_version_id,
        dest_version_id=dest_version_id,
    )


@with_storage_error_handling("copy_file")
def copy_file(
    source_key: str,
    dest_key: str,
    *,
    source_bucket: str | None = None,
    dest_bucket: str | None = None,
    config: R2Config | None = None,
    source_version_id: str | None = None,
) -> str:
    """Copy an object without deleting the source."""
    return get_storage_service(config).copy_file(
        source_key,
        dest_key,
        source_bucket=source_bucket,
        dest_bucket=dest_bucket,
        config=config,
        source_version_id=source_version_id,
    )


async def move_file_async(
    source_key: str,
    dest_key: str,
    **kwargs,
) -> str:
    """Async wrapper around ``move_file``."""
    return await run_sync_in_executor(
        None, move_file, source_key, dest_key, **kwargs
    )
