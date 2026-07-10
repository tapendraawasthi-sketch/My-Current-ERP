"""Folder-style prefix helpers for Cloudflare R2."""

from __future__ import annotations

from typing import Iterator

from backend.config.r2 import R2Config
from backend.storage._common import normalize_key, normalize_prefix, with_storage_error_handling
from backend.storage.internal.container import get_storage_service
from backend.storage.list_files import iter_objects, list_objects


def folder_key(folder: str, filename: str) -> str:
    """Join a folder prefix and filename into a valid object key."""
    prefix = normalize_prefix(folder).rstrip("/")
    name = normalize_key(filename)
    if prefix:
        return f"{prefix}/{name}"
    return name


@with_storage_error_handling("list_folder")
def list_folder(
    folder: str,
    *,
    bucket: str | None = None,
    config: R2Config | None = None,
    recursive: bool = False,
    page_size: int = 1000,
    continuation_token: str | None = None,
):
    """List contents of a logical folder."""
    prefix = normalize_prefix(folder)
    delimiter = None if recursive else "/"
    return list_objects(
        prefix=prefix,
        delimiter=delimiter,
        bucket=bucket,
        config=config,
        page_size=page_size,
        continuation_token=continuation_token,
    )


def iter_folder(
    folder: str,
    *,
    bucket: str | None = None,
    config: R2Config | None = None,
    recursive: bool = True,
    max_keys: int | None = None,
) -> Iterator:
    """Iterate all objects under a folder prefix."""
    prefix = normalize_prefix(folder)
    delimiter = None if recursive else "/"
    yield from iter_objects(
        prefix=prefix,
        delimiter=delimiter,
        bucket=bucket,
        config=config,
        max_keys=max_keys,
    )


@with_storage_error_handling("delete_folder")
def delete_folder(
    folder: str,
    *,
    bucket: str | None = None,
    config: R2Config | None = None,
) -> int:
    """Delete all objects under a folder prefix."""
    prefix = normalize_prefix(folder)
    keys = [obj.key for obj in iter_objects(prefix=prefix, bucket=bucket, config=config)]
    if not keys:
        return 0
    get_storage_service(config).delete_files(keys, bucket=bucket, config=config)
    return len(keys)


@with_storage_error_handling("ensure_folder_placeholder")
def ensure_folder_placeholder(
    folder: str,
    *,
    bucket: str | None = None,
    config: R2Config | None = None,
) -> str:
    """Create a zero-byte placeholder object marking a folder prefix."""
    from backend.storage.upload import upload_bytes

    prefix = normalize_prefix(folder)
    placeholder_key = f"{prefix}.keep"
    upload_bytes(b"", placeholder_key, bucket=bucket, config=config)
    return placeholder_key
