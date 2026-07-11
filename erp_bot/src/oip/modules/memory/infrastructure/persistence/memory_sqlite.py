"""SQLite memory repository adapter."""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from typing import Any

import aiosqlite

from ...application.ports.memory_ports import MemoryRepositoryPort
from ...application.read_models.memory_read_models import MemoryMetricsReadModel, MemoryStatisticsReadModel
from ...domain.entities import MemoryAggregate, MemoryCollection, MemoryLink, MemoryRecallExecution, MemoryRecord
from ...domain.value_objects import (
    CollectionScope,
    EntityRef,
    Freshness,
    Importance,
    MemoryCategory,
    MemoryHash,
    MemoryLineage,
    MemoryStatus,
    MemoryType,
    PayloadHash,
    RetentionPolicy,
)
from ..adapters.embedding_adapter import cosine_similarity, hash_embed


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _utc_today() -> str:
    return _utc_now().date().isoformat()


def _parse_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    return datetime.fromisoformat(value)


TENANT_A = "tenant-a"


class SqliteMemoryRepositoryAdapter(MemoryRepositoryPort):
    def __init__(self, conn: aiosqlite.Connection) -> None:
        self._conn = conn

    async def save_memory(self, memory: MemoryAggregate) -> None:
        await self._conn.execute(
            """
            INSERT OR REPLACE INTO oip_memories (
                memory_id, tenant_id, company_id, conversation_id, workflow_id, request_id,
                memory_type, category, summary, content, embedding_id, importance, confidence,
                freshness, authority, tags_json, entities_json, collection_scope, retention_policy,
                content_hash, status, lineage_json, metadata_json, created_at, updated_at,
                expires_at, archived
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                memory.memory_id,
                memory.tenant_id,
                memory.company_id,
                memory.conversation_id,
                memory.workflow_id,
                memory.request_id,
                memory.memory_type.value,
                memory.category.value,
                memory.summary,
                memory.content,
                memory.embedding_id,
                memory.importance.value,
                memory.confidence,
                memory.freshness.value,
                memory.authority,
                json.dumps(list(memory.tags)),
                json.dumps([e.model_dump() for e in memory.entities]),
                memory.collection_scope.value,
                memory.retention_policy.value,
                memory.memory_hash.hash_value if memory.memory_hash else None,
                memory.status.value,
                json.dumps(memory.lineage.model_dump()),
                json.dumps(memory.metadata),
                memory.created_at.isoformat(),
                memory.updated_at.isoformat(),
                memory.expires_at.isoformat() if memory.expires_at else None,
                1 if memory.archived else 0,
            ),
        )
        await self._conn.commit()
        await self.increment_metrics(tenant_id=memory.tenant_id, metric="memory_growth")

    def _row_to_memory(self, row: aiosqlite.Row) -> MemoryAggregate:
        tags = tuple(json.loads(row["tags_json"]))
        entities_raw = json.loads(row["entities_json"])
        entities = tuple(EntityRef(**e) for e in entities_raw)
        lineage_raw = json.loads(row["lineage_json"])
        content_hash = row["content_hash"]
        return MemoryAggregate(
            memory_id=row["memory_id"],
            tenant_id=row["tenant_id"],
            company_id=row["company_id"],
            conversation_id=row["conversation_id"],
            workflow_id=row["workflow_id"],
            request_id=row["request_id"],
            memory_type=MemoryType(row["memory_type"]),
            category=MemoryCategory(row["category"]),
            summary=row["summary"],
            content=row["content"],
            embedding_id=row["embedding_id"],
            importance=Importance(row["importance"]),
            confidence=row["confidence"],
            freshness=Freshness(row["freshness"]),
            authority=row["authority"],
            tags=tags,
            entities=entities,
            collection_scope=CollectionScope(row["collection_scope"]),
            retention_policy=RetentionPolicy(row["retention_policy"]),
            memory_hash=MemoryHash(hash_value=content_hash) if content_hash else None,
            status=MemoryStatus(row["status"]),
            lineage=MemoryLineage(**lineage_raw) if lineage_raw else MemoryLineage(),
            metadata=json.loads(row["metadata_json"]),
            created_at=_parse_dt(row["created_at"]) or _utc_now(),
            updated_at=_parse_dt(row["updated_at"]) or _utc_now(),
            expires_at=_parse_dt(row["expires_at"]),
            archived=bool(row["archived"]),
        )

    async def get_memory(self, *, tenant_id: str, memory_id: str) -> MemoryAggregate | None:
        cursor = await self._conn.execute(
            "SELECT * FROM oip_memories WHERE tenant_id = ? AND memory_id = ?",
            (tenant_id, memory_id),
        )
        row = await cursor.fetchone()
        return self._row_to_memory(row) if row else None

    async def save_record(self, record: MemoryRecord) -> None:
        await self._conn.execute(
            """
            INSERT INTO oip_memory_records (
                record_id, memory_id, tenant_id, source_module, payload_hash,
                snapshot_pointer, evidence_json, lineage_json, sequence, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                record.record_id,
                record.memory_id,
                record.tenant_id,
                record.source_module,
                record.payload_hash.hash_value,
                record.snapshot_pointer,
                json.dumps(record.evidence),
                json.dumps(record.lineage.model_dump()),
                record.sequence,
                record.created_at.isoformat(),
            ),
        )
        await self._conn.commit()

    async def get_records(self, *, tenant_id: str, memory_id: str) -> tuple[MemoryRecord, ...]:
        cursor = await self._conn.execute(
            """
            SELECT * FROM oip_memory_records
            WHERE tenant_id = ? AND memory_id = ?
            ORDER BY sequence ASC
            """,
            (tenant_id, memory_id),
        )
        rows = await cursor.fetchall()
        records: list[MemoryRecord] = []
        for row in rows:
            lineage_raw = json.loads(row["lineage_json"])
            records.append(
                MemoryRecord(
                    record_id=row["record_id"],
                    memory_id=row["memory_id"],
                    tenant_id=row["tenant_id"],
                    source_module=row["source_module"],
                    payload_hash=PayloadHash(hash_value=row["payload_hash"]),
                    snapshot_pointer=row["snapshot_pointer"],
                    evidence=json.loads(row["evidence_json"]),
                    lineage=MemoryLineage(**lineage_raw) if lineage_raw else MemoryLineage(),
                    sequence=row["sequence"],
                    created_at=_parse_dt(row["created_at"]) or _utc_now(),
                )
            )
        return tuple(records)

    async def save_collection(self, collection: MemoryCollection) -> None:
        await self._conn.execute(
            """
            INSERT OR REPLACE INTO oip_memory_collections (
                collection_id, tenant_id, name, scope, company_id, conversation_id,
                workflow_id, memory_count, metadata_json, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                collection.collection_id,
                collection.tenant_id,
                collection.name,
                collection.scope.value,
                collection.company_id,
                collection.conversation_id,
                collection.workflow_id,
                collection.memory_count,
                json.dumps(collection.metadata),
                collection.created_at.isoformat(),
                collection.updated_at.isoformat(),
            ),
        )
        await self._conn.commit()

    async def list_collections(
        self, *, tenant_id: str, scope: str | None = None
    ) -> tuple[MemoryCollection, ...]:
        if scope:
            cursor = await self._conn.execute(
                "SELECT * FROM oip_memory_collections WHERE tenant_id = ? AND scope = ?",
                (tenant_id, scope),
            )
        else:
            cursor = await self._conn.execute(
                "SELECT * FROM oip_memory_collections WHERE tenant_id = ?",
                (tenant_id,),
            )
        rows = await cursor.fetchall()
        return tuple(
            MemoryCollection(
                collection_id=row["collection_id"],
                tenant_id=row["tenant_id"],
                name=row["name"],
                scope=CollectionScope(row["scope"]),
                company_id=row["company_id"],
                conversation_id=row["conversation_id"],
                workflow_id=row["workflow_id"],
                memory_count=row["memory_count"],
                metadata=json.loads(row["metadata_json"]),
                created_at=_parse_dt(row["created_at"]) or _utc_now(),
                updated_at=_parse_dt(row["updated_at"]) or _utc_now(),
            )
            for row in rows
        )

    async def save_link(self, link: MemoryLink) -> None:
        await self._conn.execute(
            """
            INSERT OR REPLACE INTO oip_memory_links (
                link_id, tenant_id, source_memory_id, target_memory_id,
                link_type, weight, metadata_json, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                link.link_id,
                link.tenant_id,
                link.source_memory_id,
                link.target_memory_id,
                link.link_type,
                link.weight,
                json.dumps(link.metadata),
                link.created_at.isoformat(),
            ),
        )
        await self._conn.commit()

    async def get_links(self, *, tenant_id: str, memory_id: str) -> tuple[MemoryLink, ...]:
        cursor = await self._conn.execute(
            """
            SELECT * FROM oip_memory_links
            WHERE tenant_id = ? AND (source_memory_id = ? OR target_memory_id = ?)
            """,
            (tenant_id, memory_id, memory_id),
        )
        rows = await cursor.fetchall()
        return tuple(
            MemoryLink(
                link_id=row["link_id"],
                tenant_id=row["tenant_id"],
                source_memory_id=row["source_memory_id"],
                target_memory_id=row["target_memory_id"],
                link_type=row["link_type"],
                weight=row["weight"],
                metadata=json.loads(row["metadata_json"]),
                created_at=_parse_dt(row["created_at"]) or _utc_now(),
            )
            for row in rows
        )

    async def store_embedding(
        self, *, tenant_id: str, memory_id: str, embedding_id: str, vector: tuple[float, ...], model: str
    ) -> None:
        await self._conn.execute(
            """
            INSERT OR REPLACE INTO oip_memory_embeddings (
                embedding_id, tenant_id, memory_id, model_name, model_version, vector_json, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                embedding_id,
                tenant_id,
                memory_id,
                model,
                "1.0",
                json.dumps(list(vector)),
                _utc_now().isoformat(),
            ),
        )
        await self._conn.execute(
            "UPDATE oip_memories SET embedding_id = ? WHERE memory_id = ?",
            (embedding_id, memory_id),
        )
        await self._conn.commit()

    def _build_filter_sql(self, filters: dict[str, Any]) -> tuple[str, list[Any]]:
        clauses: list[str] = []
        params: list[Any] = []
        mapping = {
            "company_id": "company_id = ?",
            "conversation_id": "conversation_id = ?",
            "workflow_id": "workflow_id = ?",
            "memory_type": "memory_type = ?",
        }
        for key, sql in mapping.items():
            if filters.get(key):
                clauses.append(sql)
                params.append(filters[key])
        if not filters.get("include_archived"):
            clauses.append("archived = 0")
            clauses.append("status = 'active'")
        suffix = (" AND " + " AND ".join(clauses)) if clauses else ""
        return suffix, params

    async def search_lexical(
        self, *, tenant_id: str, query: str, limit: int = 20, **filters: Any
    ) -> tuple[dict[str, Any], ...]:
        suffix, params = self._build_filter_sql(filters)
        tokens = [t for t in query.lower().split() if len(t) > 2]
        if not tokens:
            return ()
        like_clauses = " OR ".join(["(summary LIKE ? OR content LIKE ?)"] * len(tokens))
        like_params: list[Any] = []
        for token in tokens:
            pattern = f"%{token}%"
            like_params.extend([pattern, pattern])
        sql = f"""
            SELECT * FROM oip_memories
            WHERE tenant_id = ? {suffix} AND ({like_clauses})
            ORDER BY created_at DESC LIMIT ?
        """
        cursor = await self._conn.execute(sql, (tenant_id, *params, *like_params, limit))
        rows = await cursor.fetchall()
        return tuple({"memory": self._row_to_memory(row), "lexical_score": 1.0} for row in rows)

    async def search_semantic(
        self, *, tenant_id: str, query: str, limit: int = 20, **filters: Any
    ) -> tuple[dict[str, Any], ...]:
        suffix, params = self._build_filter_sql(filters)
        query_vector = hash_embed(query)
        cursor = await self._conn.execute(
            f"""
            SELECT m.*, e.vector_json FROM oip_memories m
            JOIN oip_memory_embeddings e ON m.memory_id = e.memory_id
            WHERE m.tenant_id = ? {suffix}
            """,
            (tenant_id, *params),
        )
        rows = await cursor.fetchall()
        scored: list[tuple[float, dict[str, Any]]] = []
        for row in rows:
            vector = tuple(json.loads(row["vector_json"]))
            score = cosine_similarity(query_vector, vector)
            scored.append((score, {"memory": self._row_to_memory(row), "semantic_score": score}))
        scored.sort(key=lambda x: x[0], reverse=True)
        return tuple(item for _, item in scored[:limit])

    async def search_timeline(
        self, *, tenant_id: str, limit: int = 50, **filters: Any
    ) -> tuple[MemoryAggregate, ...]:
        suffix, params = self._build_filter_sql(filters)
        cursor = await self._conn.execute(
            f"""
            SELECT * FROM oip_memories
            WHERE tenant_id = ? {suffix}
            ORDER BY created_at ASC LIMIT ?
            """,
            (tenant_id, *params, limit),
        )
        rows = await cursor.fetchall()
        return tuple(self._row_to_memory(row) for row in rows)

    async def find_duplicate(
        self, *, tenant_id: str, payload_hash: str, memory_type: str
    ) -> MemoryAggregate | None:
        cursor = await self._conn.execute(
            """
            SELECT * FROM oip_memories
            WHERE tenant_id = ? AND content_hash = ? AND memory_type = ? AND status = 'active'
            LIMIT 1
            """,
            (tenant_id, payload_hash, memory_type),
        )
        row = await cursor.fetchone()
        return self._row_to_memory(row) if row else None

    async def save_recall(self, recall: MemoryRecallExecution) -> None:
        await self._conn.execute(
            """
            INSERT INTO oip_memory_recalls (
                recall_id, tenant_id, request_id, correlation_id, query, query_hash,
                mode, result_count, cache_hit, latency_ms, metadata_json, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                recall.recall_id,
                recall.tenant_id,
                recall.request_id,
                recall.correlation_id,
                recall.query,
                recall.query_hash,
                recall.mode,
                recall.result_count,
                1 if recall.cache_hit else 0,
                recall.latency_ms,
                json.dumps(recall.metadata),
                recall.created_at.isoformat(),
            ),
        )
        await self._conn.commit()

    async def increment_metrics(self, *, tenant_id: str, metric: str, value: float = 1.0) -> None:
        metric_date = _utc_today()
        cursor = await self._conn.execute(
            "SELECT metadata_json FROM oip_memory_metrics WHERE tenant_id = ? AND metric_date = ?",
            (tenant_id, metric_date),
        )
        row = await cursor.fetchone()
        if row:
            meta = json.loads(row["metadata_json"])
            meta[metric] = meta.get(metric, 0) + value
            await self._conn.execute(
                "UPDATE oip_memory_metrics SET metadata_json = ? WHERE tenant_id = ? AND metric_date = ?",
                (json.dumps(meta), tenant_id, metric_date),
            )
        else:
            await self._conn.execute(
                """
                INSERT INTO oip_memory_metrics (tenant_id, metric_date, metadata_json)
                VALUES (?, ?, ?)
                """,
                (tenant_id, metric_date, json.dumps({metric: value})),
            )
        await self._conn.commit()

    async def get_metrics(self, *, tenant_id: str, metric_date: str | None = None) -> MemoryMetricsReadModel:
        date = metric_date or _utc_today()
        cursor = await self._conn.execute(
            "SELECT * FROM oip_memory_metrics WHERE tenant_id = ? AND metric_date = ?",
            (tenant_id, date),
        )
        row = await cursor.fetchone()
        cursor2 = await self._conn.execute(
            "SELECT COUNT(*) FROM oip_memories WHERE tenant_id = ?",
            (tenant_id,),
        )
        total_row = await cursor2.fetchone()
        total = total_row[0] if total_row else 0
        meta = json.loads(row["metadata_json"]) if row else {}
        recalls = meta.get("recall_count", 0)
        hits = meta.get("recall_hits", 0)
        cache_hits = meta.get("cache_hits", 0)
        duplicates = meta.get("duplicate_hits", 0)
        merges = meta.get("merge_count", 0)
        stores = meta.get("memory_growth", 0)
        return MemoryMetricsReadModel(
            tenant_id=tenant_id,
            metric_date=date,
            recall_latency_ms_avg=meta.get("recall_latency_ms_total", 0) / recalls if recalls else 0,
            hit_ratio=hits / recalls if recalls else 0,
            cache_ratio=cache_hits / recalls if recalls else 0,
            merge_ratio=merges / stores if stores else 0,
            duplicate_ratio=duplicates / stores if stores else 0,
            compression_ratio=meta.get("compression_ratio_avg", 0),
            retention_expiry_count=int(meta.get("retention_expiry_count", 0)),
            memory_growth=int(stores),
            total_memories=total,
            metadata=meta,
        )

    async def get_statistics(self, *, tenant_id: str) -> MemoryStatisticsReadModel:
        cursor = await self._conn.execute(
            "SELECT memory_type, importance, freshness, status, archived FROM oip_memories WHERE tenant_id = ?",
            (tenant_id,),
        )
        rows = await cursor.fetchall()
        by_type: dict[str, int] = {}
        by_importance: dict[str, int] = {}
        by_freshness: dict[str, int] = {}
        active = archived = 0
        for row in rows:
            by_type[row["memory_type"]] = by_type.get(row["memory_type"], 0) + 1
            by_importance[row["importance"]] = by_importance.get(row["importance"], 0) + 1
            by_freshness[row["freshness"]] = by_freshness.get(row["freshness"], 0) + 1
            if row["archived"]:
                archived += 1
            elif row["status"] == "active":
                active += 1
        return MemoryStatisticsReadModel(
            tenant_id=tenant_id,
            total_memories=len(rows),
            active_memories=active,
            archived_memories=archived,
            by_type=by_type,
            by_importance=by_importance,
            by_freshness=by_freshness,
        )

    async def list_patterns(
        self, *, tenant_id: str, pattern_type: str, limit: int
    ) -> tuple[MemoryAggregate, ...]:
        cursor = await self._conn.execute(
            """
            SELECT m.* FROM oip_memories m
            JOIN oip_memory_patterns p ON m.memory_id = p.memory_id
            WHERE p.tenant_id = ? AND p.pattern_type = ?
            ORDER BY p.success_count DESC LIMIT ?
            """,
            (tenant_id, pattern_type, limit),
        )
        rows = await cursor.fetchall()
        if rows:
            return tuple(self._row_to_memory(row) for row in rows)
        cursor2 = await self._conn.execute(
            """
            SELECT * FROM oip_memories
            WHERE tenant_id = ? AND memory_type = 'PatternMemory' AND status = 'active'
            ORDER BY confidence DESC LIMIT ?
            """,
            (tenant_id, limit),
        )
        rows2 = await cursor2.fetchall()
        return tuple(self._row_to_memory(row) for row in rows2)

    async def list_failures(self, *, tenant_id: str, limit: int) -> tuple[MemoryAggregate, ...]:
        cursor = await self._conn.execute(
            """
            SELECT m.* FROM oip_memories m
            JOIN oip_memory_failures f ON m.memory_id = f.memory_id
            WHERE f.tenant_id = ?
            ORDER BY f.created_at DESC LIMIT ?
            """,
            (tenant_id, limit),
        )
        rows = await cursor.fetchall()
        if rows:
            return tuple(self._row_to_memory(row) for row in rows)
        cursor2 = await self._conn.execute(
            """
            SELECT * FROM oip_memories
            WHERE tenant_id = ? AND memory_type = 'FailureMemory' AND status = 'active'
            ORDER BY created_at DESC LIMIT ?
            """,
            (tenant_id, limit),
        )
        rows2 = await cursor2.fetchall()
        return tuple(self._row_to_memory(row) for row in rows2)

    async def expire_due_memories(self, *, tenant_id: str, now: datetime) -> int:
        cursor = await self._conn.execute(
            """
            UPDATE oip_memories SET status = 'expired', updated_at = ?
            WHERE tenant_id = ? AND expires_at IS NOT NULL AND expires_at <= ? AND status = 'active'
            """,
            (now.isoformat(), tenant_id, now.isoformat()),
        )
        await self._conn.commit()
        await self.increment_metrics(tenant_id=tenant_id, metric="retention_expiry_count", value=cursor.rowcount)
        return cursor.rowcount
