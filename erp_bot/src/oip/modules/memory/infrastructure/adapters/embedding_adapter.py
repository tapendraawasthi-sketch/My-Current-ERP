"""Hash-based embedding adapter for memory vectors."""

from __future__ import annotations

import hashlib
import json
import uuid
from datetime import datetime, timezone

import aiosqlite

from ...application.ports.memory_ports import EmbeddingPort

_DIM = 64


def hash_embed(text: str) -> tuple[float, ...]:
    digest = hashlib.sha256(text.strip().lower().encode()).digest()
    values: list[float] = []
    for i in range(_DIM):
        byte_idx = i % len(digest)
        values.append((digest[byte_idx] / 255.0) * 2 - 1)
    norm = sum(v * v for v in values) ** 0.5 or 1.0
    return tuple(v / norm for v in values)


def cosine_similarity(a: tuple[float, ...], b: tuple[float, ...]) -> float:
    if len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    na = sum(x * x for x in a) ** 0.5
    nb = sum(x * x for x in b) ** 0.5
    if na == 0 or nb == 0:
        return 0.0
    return dot / (na * nb)


class HashEmbeddingAdapter(EmbeddingPort):
    def __init__(self, conn: aiosqlite.Connection | None = None) -> None:
        self._conn = conn

    async def embed(self, *, text: str) -> tuple[float, ...]:
        return hash_embed(text)

    async def store(self, *, tenant_id: str, memory_id: str, vector: tuple[float, ...]) -> str:
        embedding_id = str(uuid.uuid4())
        if self._conn is not None:
            await self._conn.execute(
                """
                INSERT OR IGNORE INTO oip_memory_embeddings (
                    embedding_id, tenant_id, memory_id, model_name, model_version, vector_json, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    embedding_id,
                    tenant_id,
                    memory_id,
                    "hash-v1",
                    "1.0",
                    json.dumps(list(vector)),
                    datetime.now(timezone.utc).isoformat(),
                ),
            )
            await self._conn.commit()
        return embedding_id
