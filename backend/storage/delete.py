"""Delete helpers for Cloudflare R2."""

from __future__ import annotations

from typing import Sequence

from backend.config.r2 import R2Config
from backend.storage._common import run_sync_in_executor, with_storage_error_handling
from backend.storage.internal.container import get_storage_service


@with_storage_error_handling("delete_file")
def delete_file(
    key: str,
    *,
    bucket: str | None = None,
    config: R2Config | None = None,
    version_id: str | None = None,
) -> None:
    """Delete a single object from R2."""
    get_storage_service(config).delete_file(
        key,
        bucket=bucket,
        config=config,
        version_id=version_id,
    )


@with_storage_error_handling("delete_files")
def delete_files(
    keys: Sequence[str],
    *,
    bucket: str | None = None,
    config: R2Config | None = None,
) -> int:
    """Delete multiple objects in batched requests (up to 1000 per call)."""
    return get_storage_service(config).delete_files(
        keys,
        bucket=bucket,
        config=config,
    )


async def delete_file_async(key: str, **kwargs) -> None:
    """Async wrapper around ``delete_file``."""
    await run_sync_in_executor(None, delete_file, key, **kwargs)
