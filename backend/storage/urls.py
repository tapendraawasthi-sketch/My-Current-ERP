"""Public URL generation for Cloudflare R2 objects."""

from __future__ import annotations

from backend.config.r2 import R2Config
from backend.storage.internal.container import get_storage_service


def generate_public_url(
    key: str,
    *,
    bucket: str | None = None,
    config: R2Config | None = None,
    version_id: str | None = None,
) -> str:
    """Build a public HTTPS URL for an object."""
    return get_storage_service(config).generate_public_url(
        key,
        bucket=bucket,
        config=config,
        version_id=version_id,
    )
