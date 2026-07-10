"""Object metadata building and S3 user-metadata sanitization."""

from __future__ import annotations

import re
from collections.abc import Mapping

from backend.storage.internal.protocols import ObjectMetadata

_METADATA_KEY_PATTERN = re.compile(r"^[A-Za-z0-9._\-]+$")


def sanitize_user_metadata(metadata: Mapping[str, str] | None) -> dict[str, str]:
    """Normalize user metadata keys for S3 compatibility.

    S3 stores metadata keys as ``x-amz-meta-*``; values must be ASCII-safe.
    """
    if not metadata:
        return {}
    cleaned: dict[str, str] = {}
    for raw_key, raw_value in metadata.items():
        key = raw_key.strip().lower().replace(" ", "-")
        if not _METADATA_KEY_PATTERN.match(key):
            raise ValueError(f"Invalid metadata key: {raw_key!r}")
        value = str(raw_value)
        if len(value) > 2048:
            raise ValueError(f"Metadata value too long for key {raw_key!r}")
        cleaned[key] = value
    return cleaned


def build_upload_extra_args(
    *,
    content_type: str | None,
    metadata: Mapping[str, str] | None,
    version_id: str | None = None,
    cache_control: str | None = None,
) -> dict:
    """Build boto3 ``ExtraArgs`` for uploads with CDN-friendly headers."""
    extra: dict = {}
    if content_type:
        extra["ContentType"] = content_type
    if cache_control:
        extra["CacheControl"] = cache_control
    if metadata:
        extra["Metadata"] = sanitize_user_metadata(metadata)
    if version_id:
        extra["Metadata"] = {
            **extra.get("Metadata", {}),
            "x-version-id": version_id,
        }
    return extra


def parse_head_object_response(response: dict) -> ObjectMetadata:
    """Parse a HeadObject response into ``ObjectMetadata``."""
    etag = response.get("ETag")
    return ObjectMetadata(
        content_length=response.get("ContentLength"),
        content_type=response.get("ContentType"),
        etag=str(etag).strip('"') if etag else None,
        last_modified=response.get("LastModified"),
        user_metadata=dict(response.get("Metadata") or {}),
        version_id=response.get("VersionId"),
    )
