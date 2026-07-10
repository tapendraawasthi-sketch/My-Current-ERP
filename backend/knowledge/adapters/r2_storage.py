"""R2 object storage adapter for knowledge documents."""

from __future__ import annotations

from backend.storage import download_bytes, upload_bytes, upload_file


class R2ObjectStorage:
    """Thin adapter over the R2 storage public API."""

    def upload_bytes(
        self,
        data: bytes,
        key: str,
        *,
        content_type: str,
        metadata: dict | None = None,
    ) -> str:
        return upload_bytes(
            data,
            key,
            content_type=content_type,
            metadata=metadata,
        )

    def download_bytes(self, key: str) -> bytes:
        return download_bytes(key)

    def upload_file(self, local_path: str, key: str, *, content_type: str) -> str:
        return upload_file(local_path, key, content_type=content_type)
