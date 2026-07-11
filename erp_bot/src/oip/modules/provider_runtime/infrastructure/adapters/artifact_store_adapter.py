"""Artifact store — encrypted blob + SHA256 hash pointer."""

from __future__ import annotations

import base64
import hashlib
import uuid
from datetime import datetime, timezone

from ...application.ports.execution_ports import ArtifactStorePort
from ...domain.value_objects import ExecutionArtifact


def _encrypt_blob(content: bytes, tenant_id: str) -> bytes:
    key = hashlib.sha256(f"oip-artifact:{tenant_id}".encode()).digest()
    return bytes(b ^ key[i % len(key)] for i, b in enumerate(content))


class LocalArtifactStoreAdapter(ArtifactStorePort):
    def __init__(self) -> None:
        self._blobs: dict[str, bytes] = {}

    async def store(
        self,
        *,
        tenant_id: str,
        execution_id: str,
        content: bytes,
        provider_id: str,
        model: str,
        ttl_seconds: int = 86_400,
        metadata: dict | None = None,
    ) -> ExecutionArtifact:
        content_hash = hashlib.sha256(content).hexdigest()
        encrypted = _encrypt_blob(content, tenant_id)
        blob_pointer = f"artifact://{tenant_id}/{execution_id}/{content_hash[:16]}"
        self._blobs[blob_pointer] = encrypted
        return ExecutionArtifact(
            artifact_id=str(uuid.uuid4()),
            execution_id=execution_id,
            tenant_id=tenant_id,
            blob_pointer=blob_pointer,
            content_hash=content_hash,
            encrypted=True,
            ttl_seconds=ttl_seconds,
            provider_id=provider_id,
            model=model,
            metadata=metadata or {},
            created_at=datetime.now(timezone.utc).isoformat(),
        )

    def retrieve_encrypted(self, blob_pointer: str) -> bytes | None:
        return self._blobs.get(blob_pointer)

    def verify_hash(self, blob_pointer: str, expected_hash: str, tenant_id: str) -> bool:
        encrypted = self._blobs.get(blob_pointer)
        if encrypted is None:
            return False
        key = hashlib.sha256(f"oip-artifact:{tenant_id}".encode()).digest()
        decrypted = bytes(b ^ key[i % len(key)] for i, b in enumerate(encrypted))
        return hashlib.sha256(decrypted).hexdigest() == expected_hash
