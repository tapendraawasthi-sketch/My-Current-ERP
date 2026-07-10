"""List objects in Cloudflare R2 with pagination for large buckets."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Iterator

from backend.config.r2 import R2Config
from backend.storage._common import run_sync_in_executor, with_storage_error_handling
from backend.storage.internal.container import get_storage_service


@dataclass(frozen=True, slots=True)
class StoredObject:
    """Metadata for a single stored object."""

    key: str
    size: int
    etag: str
    last_modified: datetime | None
    storage_class: str | None = None
    version_id: str | None = None


@dataclass(frozen=True, slots=True)
class ListObjectsResult:
    """Paginated listing result."""

    objects: tuple[StoredObject, ...]
    prefixes: tuple[str, ...]
    is_truncated: bool
    next_continuation_token: str | None = None


@with_storage_error_handling("list_objects")
def list_objects(
    *,
    prefix: str = "",
    delimiter: str | None = None,
    bucket: str | None = None,
    config: R2Config | None = None,
    page_size: int = 1000,
    max_keys: int | None = None,
    continuation_token: str | None = None,
) -> ListObjectsResult:
    """List objects under an optional prefix (single page)."""
    return get_storage_service(config).list_objects(
        prefix=prefix,
        delimiter=delimiter,
        bucket=bucket,
        config=config,
        page_size=page_size,
        max_keys=max_keys,
        continuation_token=continuation_token,
    )


def iter_objects(
    *,
    prefix: str = "",
    delimiter: str | None = None,
    bucket: str | None = None,
    config: R2Config | None = None,
    page_size: int = 1000,
    max_keys: int | None = None,
) -> Iterator[StoredObject]:
    """Yield objects across all pages (memory-efficient for large buckets)."""
    yield from get_storage_service(config).iter_objects(
        prefix=prefix,
        delimiter=delimiter,
        bucket=bucket,
        config=config,
        page_size=page_size,
        max_keys=max_keys,
    )


async def list_objects_async(**kwargs) -> ListObjectsResult:
    """Async wrapper around ``list_objects``."""
    return await run_sync_in_executor(None, lambda: list_objects(**kwargs))
