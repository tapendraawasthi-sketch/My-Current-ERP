"""CDN URL resolution (future presigned URL / cache purge hooks)."""

from __future__ import annotations

import logging
from urllib.parse import quote, urljoin

from backend.config.r2 import R2Config
from backend.storage.internal.errors import StorageConfigError
from backend.storage.internal.keys import normalize_key
from backend.storage.internal.protocols import CdnUrlResolver

logger = logging.getLogger(__name__)


class ConfigCdnUrlResolver(CdnUrlResolver):
    """Builds public URLs from ``R2_PUBLIC_BASE_URL``."""

    def __init__(self, config: R2Config) -> None:
        self._config = config

    def public_url(
        self,
        key: str,
        *,
        bucket: str,
        version_id: str | None = None,
    ) -> str:
        normalized_key = normalize_key(key)
        base = (self._config.public_base_url or "").rstrip("/")
        if not base:
            raise StorageConfigError(
                "R2_PUBLIC_BASE_URL is not set. Configure a custom domain or "
                f"public bucket URL to generate links for bucket '{bucket}'."
            )
        encoded_key = "/".join(
            quote(part, safe="") for part in normalized_key.split("/")
        )
        url = urljoin(f"{base}/", encoded_key)
        if version_id:
            url = f"{url}?versionId={quote(version_id, safe='')}"
        logger.debug("Generated public URL prefix=%s", normalized_key.split("/")[0])
        return url

    def invalidate_cdn_paths(self, paths: list[str]) -> None:
        """Hook for future Cloudflare cache purge API integration."""
        logger.info(
            "CDN purge requested for %d path(s) (no-op until CDN API wired)",
            len(paths),
        )
