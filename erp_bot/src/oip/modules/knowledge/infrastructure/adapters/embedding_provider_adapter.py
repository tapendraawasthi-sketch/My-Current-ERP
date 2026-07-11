"""Hash-based pseudo-embedding provider — never calls an LLM."""

from __future__ import annotations

import hashlib
import json
import math
import uuid
from datetime import datetime, timezone

import aiosqlite

from ...application.ports.knowledge_ports import EmbeddingProviderPort

_VECTOR_DIM = 64


def hash_embed(text: str, *, dim: int = _VECTOR_DIM) -> tuple[float, ...]:
    """Deterministic pseudo-vector from text content."""
    normalized = text.strip().lower()
    vector: list[float] = []
    seed = normalized
    while len(vector) < dim:
        digest = hashlib.sha256(seed.encode()).hexdigest()
        for i in range(0, len(digest) - 1, 2):
            byte_val = int(digest[i : i + 2], 16)
            vector.append((byte_val / 255.0) * 2.0 - 1.0)
            if len(vector) >= dim:
                break
        seed = digest
    norm = math.sqrt(sum(v * v for v in vector)) or 1.0
    return tuple(v / norm for v in vector)


def cosine_similarity(a: tuple[float, ...], b: tuple[float, ...]) -> float:
    if len(a) != len(b) or not a:
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    return max(0.0, min(1.0, (dot + 1.0) / 2.0))


class HashEmbeddingProviderAdapter(EmbeddingProviderPort):
    def __init__(self, conn: aiosqlite.Connection, *, dim: int = _VECTOR_DIM) -> None:
        self._conn = conn
        self._dim = dim

    async def embed(self, *, texts: tuple[str, ...], model: str) -> tuple[tuple[float, ...], ...]:
        _ = model
        return tuple(hash_embed(text, dim=self._dim) for text in texts)

    async def store_vectors(
        self, *, tenant_id: str, document_id: str, chunk_id: str, vector: tuple[float, ...], version: str
    ) -> None:
        now = datetime.now(timezone.utc).isoformat()
        embedding_id = str(uuid.uuid4())
        await self._conn.execute(
            """
            INSERT INTO oip_knowledge_embeddings (
                embedding_id, tenant_id, document_id, chunk_id,
                model_name, model_version, vector_json, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(embedding_id) DO UPDATE SET
                vector_json = excluded.vector_json,
                model_version = excluded.model_version
            """,
            (
                embedding_id,
                tenant_id,
                document_id,
                chunk_id,
                version.split("-")[0] if "-" in version else version,
                version,
                json.dumps(list(vector)),
                now,
            ),
        )
        await self._conn.commit()
