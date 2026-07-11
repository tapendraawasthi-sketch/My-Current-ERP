"""SQLite knowledge repository with tenant-a seed documents."""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from typing import Any

import aiosqlite

from ...application.ports.knowledge_ports import KnowledgeRepositoryPort
from ...application.read_models.knowledge_read_models import KnowledgeMetricsReadModel
from ...domain.entities import (
    EmbeddingGeneration,
    EvidenceBundle,
    KnowledgeCollection,
    KnowledgeDocument,
    KnowledgeSnapshot,
    RetrievalExecution,
)
from ...domain.value_objects import (
    AuthorityLevel,
    DocumentStatus,
    EffectiveDateRange,
    EmbeddingGenerationStatus,
    EmbeddingVersion,
    EvidenceHash,
    HybridScore,
    KnowledgeHash,
    RetrievalMode,
    RetrievalScore,
    RetrievalStatus,
)
from ..adapters.embedding_provider_adapter import cosine_similarity, hash_embed


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _utc_today() -> str:
    return _utc_now().date().isoformat()


def _parse_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    return datetime.fromisoformat(value)


TENANT_A = "tenant-a"
COLLECTION_NEPAL_TAX = "col-nepal-tax-v1"
COLLECTION_IFRS = "col-ifrs-standards-v1"

SEED_DOCUMENTS: tuple[dict[str, Any], ...] = (
    {
        "document_id": "doc-nepal-vat-2052",
        "collection_id": COLLECTION_NEPAL_TAX,
        "title": "Nepal VAT Act 2052 — Standard Rate",
        "content": (
            "Nepal Value Added Tax Act 2052 imposes VAT at thirteen percent on taxable supplies. "
            "Registration is mandatory when annual turnover exceeds NPR 50 lakh. "
            "Input tax credit is available for business purchases supported by valid tax invoices."
        ),
        "authority_level": AuthorityLevel.GOVERNMENT,
        "jurisdiction": "nepal",
        "effective_from": "2019-07-17",
        "tags": ("vat", "nepal", "tax"),
    },
    {
        "document_id": "doc-nepal-tds-provisions",
        "collection_id": COLLECTION_NEPAL_TAX,
        "title": "Nepal TDS Withholding Provisions",
        "content": (
            "Tax Deducted at Source TDS applies to salary, rent, professional fees, and contract payments. "
            "Employers must withhold TDS on salary per the slab rates published by IRD Nepal. "
            "TDS deposits are due by the 25th of the following month."
        ),
        "authority_level": AuthorityLevel.GOVERNMENT,
        "jurisdiction": "nepal",
        "effective_from": "2020-01-01",
        "tags": ("tds", "withholding", "nepal"),
    },
    {
        "document_id": "doc-ifrs15-revenue",
        "collection_id": COLLECTION_IFRS,
        "title": "IFRS 15 Revenue from Contracts with Customers",
        "content": (
            "IFRS 15 establishes a five-step model for revenue recognition. "
            "Identify the contract, performance obligations, transaction price, allocation, and recognition. "
            "Revenue is recognized when control transfers to the customer."
        ),
        "authority_level": AuthorityLevel.ACCOUNTING_STANDARDS,
        "jurisdiction": "ifrs",
        "effective_from": "2018-01-01",
        "tags": ("ifrs", "revenue", "ifrs15"),
    },
)


class SqliteKnowledgeRepositoryAdapter(KnowledgeRepositoryPort):
    def __init__(
        self,
        conn: aiosqlite.Connection,
        *,
        embedding_version: str = "hash-v1",
    ) -> None:
        self._conn = conn
        self._embedding_version = embedding_version
        self._seeded = False
        self._seeding = False

    async def ensure_seeded(self) -> None:
        if self._seeded or self._seeding:
            return
        cursor = await self._conn.execute(
            "SELECT COUNT(*) FROM oip_knowledge_documents WHERE tenant_id = ?",
            (TENANT_A,),
        )
        row = await cursor.fetchone()
        if row and row[0] > 0:
            self._seeded = True
            return
        self._seeding = True
        try:
            await self._seed_tenant_a()
            self._seeded = True
        finally:
            self._seeding = False

    async def _seed_tenant_a(self) -> None:
        now = _utc_now()
        collections = (
            KnowledgeCollection(
                collection_id=COLLECTION_NEPAL_TAX,
                tenant_id=TENANT_A,
                name="Nepal Tax Knowledge Pack",
                description="VAT and TDS reference documents for Nepal jurisdiction",
                jurisdiction="nepal",
                authority_level=AuthorityLevel.GOVERNMENT,
                document_count=2,
                created_at=now,
                updated_at=now,
            ),
            KnowledgeCollection(
                collection_id=COLLECTION_IFRS,
                tenant_id=TENANT_A,
                name="IFRS Standards Pack",
                description="IFRS accounting standards reference",
                jurisdiction="ifrs",
                authority_level=AuthorityLevel.ACCOUNTING_STANDARDS,
                document_count=1,
                created_at=now,
                updated_at=now,
            ),
        )
        for collection in collections:
            await self.save_collection(collection)

        import hashlib

        for seed in SEED_DOCUMENTS:
            content_hash = hashlib.sha256(seed["content"].encode()).hexdigest()
            document = KnowledgeDocument(
                document_id=seed["document_id"],
                collection_id=seed["collection_id"],
                tenant_id=TENANT_A,
                title=seed["title"],
                content=seed["content"],
                authority_level=seed["authority_level"],
                authority_id=f"auth-{seed['authority_level'].value}",
                jurisdiction=seed["jurisdiction"],
                effective_range=EffectiveDateRange(effective_from=seed["effective_from"]),
                knowledge_hash=KnowledgeHash(hash_value=content_hash, content_version="1.0"),
                status=DocumentStatus.ACTIVE,
                tags=seed["tags"],
                created_at=now,
                updated_at=now,
            )
            await self.save_document(document)
            words = seed["content"].split()
            chunk = " ".join(words)
            chunk_id = f"{seed['document_id']}-chunk-0"
            await self.store_chunk(
                tenant_id=TENANT_A,
                document_id=seed["document_id"],
                chunk_id=chunk_id,
                content=chunk,
                metadata={"index": 0, "seed": True},
            )
            vector = hash_embed(chunk)
            await self._conn.execute(
                """
                INSERT INTO oip_knowledge_embeddings (
                    embedding_id, tenant_id, document_id, chunk_id,
                    model_name, model_version, vector_json, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    str(uuid.uuid4()),
                    TENANT_A,
                    seed["document_id"],
                    chunk_id,
                    self._embedding_version,
                    self._embedding_version,
                    json.dumps(list(vector)),
                    now.isoformat(),
                ),
            )
        await self._conn.commit()

    async def save_document(self, document: KnowledgeDocument) -> None:
        if not self._seeding:
            await self.ensure_seeded()
        await self._conn.execute(
            """
            INSERT INTO oip_knowledge_documents (
                document_id, collection_id, tenant_id, company_id, title, content,
                authority_level, authority_id, jurisdiction, effective_from, effective_to,
                supersedes, superseded_by, revision, content_hash, version, status,
                tags_json, metadata_json, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(document_id) DO UPDATE SET
                title = excluded.title,
                content = excluded.content,
                authority_level = excluded.authority_level,
                status = excluded.status,
                content_hash = excluded.content_hash,
                metadata_json = excluded.metadata_json,
                updated_at = excluded.updated_at
            """,
            (
                document.document_id,
                document.collection_id,
                document.tenant_id,
                document.company_id,
                document.title,
                document.content,
                document.authority_level.value,
                document.authority_id,
                document.jurisdiction,
                document.effective_range.effective_from,
                document.effective_range.effective_to,
                document.effective_range.supersedes,
                document.effective_range.superseded_by,
                document.effective_range.revision,
                document.knowledge_hash.hash_value,
                document.version,
                document.status.value,
                json.dumps(list(document.tags)),
                json.dumps(document.metadata),
                document.created_at.isoformat(),
                document.updated_at.isoformat(),
            ),
        )
        await self._conn.commit()

    async def get_document(self, *, tenant_id: str, document_id: str) -> KnowledgeDocument | None:
        await self.ensure_seeded()
        cursor = await self._conn.execute(
            "SELECT * FROM oip_knowledge_documents WHERE tenant_id = ? AND document_id = ?",
            (tenant_id, document_id),
        )
        row = await cursor.fetchone()
        return self._row_to_document(row) if row else None

    async def save_collection(self, collection: KnowledgeCollection) -> None:
        await self._conn.execute(
            """
            INSERT INTO oip_knowledge_collections (
                collection_id, tenant_id, name, description, jurisdiction,
                authority_level, document_count, metadata_json, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(collection_id) DO UPDATE SET
                name = excluded.name,
                document_count = excluded.document_count,
                updated_at = excluded.updated_at
            """,
            (
                collection.collection_id,
                collection.tenant_id,
                collection.name,
                collection.description,
                collection.jurisdiction,
                collection.authority_level.value,
                collection.document_count,
                json.dumps(collection.metadata),
                collection.created_at.isoformat(),
                collection.updated_at.isoformat(),
            ),
        )
        await self._conn.commit()

    async def save_retrieval(self, retrieval: RetrievalExecution) -> None:
        await self._conn.execute(
            """
            INSERT INTO oip_retrievals (
                retrieval_id, tenant_id, request_id, correlation_id, query, query_hash,
                mode, jurisdiction, as_of, status, snapshot_id, bundle_id, result_count,
                blocked_count, cache_hit, metadata_json, created_at, completed_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(retrieval_id) DO UPDATE SET
                status = excluded.status,
                snapshot_id = excluded.snapshot_id,
                bundle_id = excluded.bundle_id,
                result_count = excluded.result_count,
                blocked_count = excluded.blocked_count,
                cache_hit = excluded.cache_hit,
                completed_at = excluded.completed_at
            """,
            (
                retrieval.retrieval_id,
                retrieval.tenant_id,
                retrieval.request_id,
                retrieval.correlation_id,
                retrieval.query,
                retrieval.query_hash,
                retrieval.mode.value,
                retrieval.jurisdiction,
                retrieval.as_of,
                retrieval.status.value,
                retrieval.snapshot_id,
                retrieval.bundle_id,
                retrieval.result_count,
                retrieval.blocked_count,
                int(retrieval.cache_hit),
                json.dumps(retrieval.metadata),
                retrieval.created_at.isoformat(),
                retrieval.completed_at.isoformat() if retrieval.completed_at else None,
            ),
        )
        await self._conn.commit()

    async def get_retrieval(self, *, tenant_id: str, retrieval_id: str) -> RetrievalExecution | None:
        cursor = await self._conn.execute(
            "SELECT * FROM oip_retrievals WHERE tenant_id = ? AND retrieval_id = ?",
            (tenant_id, retrieval_id),
        )
        row = await cursor.fetchone()
        return self._row_to_retrieval(row) if row else None

    async def save_bundle(self, bundle: EvidenceBundle) -> None:
        scores_json = [
            {
                "combined": s.combined,
                "lexical": s.components.lexical,
                "semantic": s.components.semantic,
                "authority": s.components.authority,
                "freshness": s.components.freshness,
            }
            for s in bundle.scores
        ]
        await self._conn.execute(
            """
            INSERT INTO oip_evidence_bundles (
                bundle_id, retrieval_id, tenant_id, request_id, query, jurisdiction,
                authority_summary_json, document_ids_json, chunk_ids_json, evidence_hash,
                scores_json, blocked_document_ids_json, metadata_json, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(bundle_id) DO UPDATE SET
                document_ids_json = excluded.document_ids_json,
                evidence_hash = excluded.evidence_hash
            """,
            (
                bundle.bundle_id,
                bundle.retrieval_id,
                bundle.tenant_id,
                bundle.request_id,
                bundle.query,
                bundle.jurisdiction,
                json.dumps(bundle.authority_summary),
                json.dumps(list(bundle.document_ids)),
                json.dumps(list(bundle.chunk_ids)),
                bundle.evidence_hash.hash_value,
                json.dumps(scores_json),
                json.dumps(list(bundle.blocked_document_ids)),
                json.dumps(bundle.metadata),
                bundle.created_at.isoformat(),
            ),
        )
        await self._conn.commit()

    async def get_bundle(self, *, tenant_id: str, bundle_id: str) -> EvidenceBundle | None:
        cursor = await self._conn.execute(
            "SELECT * FROM oip_evidence_bundles WHERE tenant_id = ? AND bundle_id = ?",
            (tenant_id, bundle_id),
        )
        row = await cursor.fetchone()
        return self._row_to_bundle(row) if row else None

    async def save_snapshot(self, snapshot: KnowledgeSnapshot) -> None:
        await self._conn.execute(
            """
            INSERT INTO oip_knowledge_snapshots (
                snapshot_id, retrieval_id, tenant_id, request_id, query_hash, jurisdiction,
                as_of, authority_summary_json, evidence_hashes_json, embedding_versions_json,
                document_ids_json, bundle_id, immutable, metadata_json, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(snapshot_id) DO NOTHING
            """,
            (
                snapshot.snapshot_id,
                snapshot.retrieval_id,
                snapshot.tenant_id,
                snapshot.request_id,
                snapshot.query_hash,
                snapshot.jurisdiction,
                snapshot.as_of,
                json.dumps(snapshot.authority_summary),
                json.dumps(list(snapshot.evidence_hashes)),
                json.dumps(list(snapshot.embedding_versions)),
                json.dumps(list(snapshot.document_ids)),
                snapshot.bundle_id,
                int(snapshot.immutable),
                json.dumps(snapshot.metadata),
                snapshot.created_at.isoformat(),
            ),
        )
        await self._conn.commit()

    async def get_snapshot(self, *, tenant_id: str, snapshot_id: str) -> KnowledgeSnapshot | None:
        cursor = await self._conn.execute(
            "SELECT * FROM oip_knowledge_snapshots WHERE tenant_id = ? AND snapshot_id = ?",
            (tenant_id, snapshot_id),
        )
        row = await cursor.fetchone()
        return self._row_to_snapshot(row) if row else None

    async def save_embedding_generation(self, generation: EmbeddingGeneration) -> None:
        await self._conn.execute(
            """
            INSERT INTO oip_embedding_generations (
                generation_id, tenant_id, collection_id, embedding_model, model_version,
                chunk_strategy, document_count, chunk_count, status, campaign_name,
                metadata_json, created_at, completed_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(generation_id) DO UPDATE SET
                status = excluded.status,
                document_count = excluded.document_count,
                chunk_count = excluded.chunk_count,
                completed_at = excluded.completed_at
            """,
            (
                generation.generation_id,
                generation.tenant_id,
                generation.collection_id,
                generation.embedding_model,
                generation.embedding_version.model_version,
                generation.chunk_strategy,
                generation.document_count,
                generation.chunk_count,
                generation.status.value,
                generation.campaign_name,
                json.dumps(generation.metadata),
                generation.created_at.isoformat(),
                generation.completed_at.isoformat() if generation.completed_at else None,
            ),
        )
        await self._conn.commit()

    async def search_lexical(
        self, *, tenant_id: str, query: str, jurisdiction: str, as_of: str, limit: int = 50
    ) -> tuple[dict[str, Any], ...]:
        await self.ensure_seeded()
        tokens = [t for t in query.split() if len(t) > 2]
        if not tokens:
            tokens = query.split() or [query]

        cursor = await self._conn.execute(
            """
            SELECT c.chunk_id, c.document_id, c.content, d.authority_level, d.effective_from
            FROM oip_knowledge_chunks c
            JOIN oip_knowledge_documents d ON c.document_id = d.document_id
            WHERE c.tenant_id = ? AND d.jurisdiction = ? AND d.status = 'active'
              AND d.effective_from <= ?
              AND (d.effective_to IS NULL OR d.effective_to >= ?)
            """,
            (tenant_id, jurisdiction, as_of, as_of),
        )
        rows = await cursor.fetchall()
        scored: list[dict[str, Any]] = []
        for row in rows:
            content_lower = row["content"].lower()
            matches = sum(1 for token in tokens if token in content_lower)
            if matches == 0:
                continue
            score = matches / len(tokens)
            scored.append(
                {
                    "document_id": row["document_id"],
                    "chunk_id": row["chunk_id"],
                    "score": score,
                    "authority_level": row["authority_level"],
                    "effective_from": row["effective_from"],
                }
            )
        scored.sort(key=lambda h: h["score"], reverse=True)
        seen: set[str] = set()
        deduped: list[dict[str, Any]] = []
        for hit in scored:
            if hit["document_id"] in seen:
                continue
            seen.add(hit["document_id"])
            deduped.append(hit)
            if len(deduped) >= limit:
                break
        return tuple(deduped)

    async def search_semantic(
        self, *, tenant_id: str, query: str, jurisdiction: str, as_of: str, limit: int = 50
    ) -> tuple[dict[str, Any], ...]:
        await self.ensure_seeded()
        query_vector = hash_embed(query)
        cursor = await self._conn.execute(
            """
            SELECT e.chunk_id, e.document_id, e.vector_json, d.authority_level, d.effective_from
            FROM oip_knowledge_embeddings e
            JOIN oip_knowledge_documents d ON e.document_id = d.document_id
            WHERE e.tenant_id = ? AND d.jurisdiction = ? AND d.status = 'active'
              AND d.effective_from <= ?
              AND (d.effective_to IS NULL OR d.effective_to >= ?)
            """,
            (tenant_id, jurisdiction, as_of, as_of),
        )
        rows = await cursor.fetchall()
        scored: list[dict[str, Any]] = []
        for row in rows:
            stored = tuple(json.loads(row["vector_json"]))
            score = cosine_similarity(query_vector, stored)
            if score <= 0.01:
                continue
            scored.append(
                {
                    "document_id": row["document_id"],
                    "chunk_id": row["chunk_id"],
                    "score": score,
                    "authority_level": row["authority_level"],
                    "effective_from": row["effective_from"],
                }
            )
        scored.sort(key=lambda h: h["score"], reverse=True)
        seen: set[str] = set()
        deduped: list[dict[str, Any]] = []
        for hit in scored:
            if hit["document_id"] in seen:
                continue
            seen.add(hit["document_id"])
            deduped.append(hit)
            if len(deduped) >= limit:
                break
        return tuple(deduped)

    async def list_documents_by_jurisdiction(
        self, *, tenant_id: str, jurisdiction: str, as_of: str, authority_levels: tuple[str, ...] | None = None
    ) -> tuple[KnowledgeDocument, ...]:
        await self.ensure_seeded()
        sql = """
            SELECT * FROM oip_knowledge_documents
            WHERE tenant_id = ? AND jurisdiction = ? AND status = 'active'
              AND effective_from <= ?
              AND (effective_to IS NULL OR effective_to >= ?)
        """
        params: list[Any] = [tenant_id, jurisdiction, as_of, as_of]
        if authority_levels:
            placeholders = ",".join("?" for _ in authority_levels)
            sql += f" AND authority_level IN ({placeholders})"
            params.extend(authority_levels)
        sql += " ORDER BY effective_from DESC"
        cursor = await self._conn.execute(sql, params)
        rows = await cursor.fetchall()
        return tuple(self._row_to_document(row) for row in rows)

    async def get_cached_retrieval(
        self, *, tenant_id: str, query_hash: str, jurisdiction: str, as_of: str
    ) -> RetrievalExecution | None:
        cursor = await self._conn.execute(
            """
            SELECT * FROM oip_retrievals
            WHERE tenant_id = ? AND query_hash = ? AND jurisdiction = ? AND as_of = ?
              AND status = 'completed' AND snapshot_id IS NOT NULL AND bundle_id IS NOT NULL
            ORDER BY created_at DESC LIMIT 1
            """,
            (tenant_id, query_hash, jurisdiction, as_of),
        )
        row = await cursor.fetchone()
        return self._row_to_retrieval(row) if row else None

    async def increment_metrics(self, *, tenant_id: str, metric: str) -> None:
        metric_date = _utc_today()
        column_map = {
            "retrievals_started": "retrievals_started",
            "retrievals_completed": "retrievals_completed",
            "documents_indexed": "documents_indexed",
            "reembed_campaigns": "reembed_campaigns",
            "poison_blocked": "poison_blocked",
            "cache_hits": "cache_hits",
            "snapshots_created": "snapshots_created",
        }
        column = column_map.get(metric)
        if not column:
            return
        await self._conn.execute(
            f"""
            INSERT INTO oip_knowledge_metrics (tenant_id, metric_date, {column})
            VALUES (?, ?, 1)
            ON CONFLICT(tenant_id, metric_date) DO UPDATE SET
                {column} = {column} + 1
            """,
            (tenant_id, metric_date),
        )
        await self._conn.commit()

    async def get_metrics(self, *, tenant_id: str, metric_date: str | None = None) -> KnowledgeMetricsReadModel:
        date = metric_date or _utc_today()
        cursor = await self._conn.execute(
            "SELECT * FROM oip_knowledge_metrics WHERE tenant_id = ? AND metric_date = ?",
            (tenant_id, date),
        )
        row = await cursor.fetchone()
        if not row:
            return KnowledgeMetricsReadModel(tenant_id=tenant_id, metric_date=date)
        return KnowledgeMetricsReadModel(
            tenant_id=row["tenant_id"],
            metric_date=row["metric_date"],
            retrievals_started=row["retrievals_started"],
            retrievals_completed=row["retrievals_completed"],
            documents_indexed=row["documents_indexed"],
            reembed_campaigns=row["reembed_campaigns"],
            poison_blocked=row["poison_blocked"],
            cache_hits=row["cache_hits"],
            snapshots_created=row["snapshots_created"],
        )

    async def store_chunk(
        self, *, tenant_id: str, document_id: str, chunk_id: str, content: str, metadata: dict
    ) -> None:
        now = _utc_now().isoformat()
        await self._conn.execute(
            """
            INSERT INTO oip_knowledge_chunks (chunk_id, document_id, tenant_id, content, metadata_json, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(chunk_id) DO UPDATE SET content = excluded.content, metadata_json = excluded.metadata_json
            """,
            (chunk_id, document_id, tenant_id, content, json.dumps(metadata), now),
        )
        await self._conn.commit()

    def _row_to_document(self, row: aiosqlite.Row) -> KnowledgeDocument:
        tags = json.loads(row["tags_json"])
        return KnowledgeDocument(
            document_id=row["document_id"],
            collection_id=row["collection_id"],
            tenant_id=row["tenant_id"],
            company_id=row["company_id"],
            title=row["title"],
            content=row["content"],
            authority_level=AuthorityLevel(row["authority_level"]),
            authority_id=row["authority_id"],
            jurisdiction=row["jurisdiction"],
            effective_range=EffectiveDateRange(
                effective_from=row["effective_from"],
                effective_to=row["effective_to"],
                supersedes=row["supersedes"],
                superseded_by=row["superseded_by"],
                revision=row["revision"],
            ),
            knowledge_hash=KnowledgeHash(hash_value=row["content_hash"]),
            version=row["version"],
            status=DocumentStatus(row["status"]),
            tags=tuple(tags),
            metadata=json.loads(row["metadata_json"]),
            created_at=_parse_dt(row["created_at"]) or _utc_now(),
            updated_at=_parse_dt(row["updated_at"]) or _utc_now(),
        )

    def _row_to_retrieval(self, row: aiosqlite.Row) -> RetrievalExecution:
        return RetrievalExecution(
            retrieval_id=row["retrieval_id"],
            tenant_id=row["tenant_id"],
            request_id=row["request_id"],
            correlation_id=row["correlation_id"],
            query=row["query"],
            query_hash=row["query_hash"],
            mode=RetrievalMode(row["mode"]),
            jurisdiction=row["jurisdiction"],
            as_of=row["as_of"],
            status=RetrievalStatus(row["status"]),
            snapshot_id=row["snapshot_id"],
            bundle_id=row["bundle_id"],
            result_count=row["result_count"],
            blocked_count=row["blocked_count"],
            cache_hit=bool(row["cache_hit"]),
            metadata=json.loads(row["metadata_json"]),
            created_at=_parse_dt(row["created_at"]) or _utc_now(),
            completed_at=_parse_dt(row["completed_at"]),
        )

    def _row_to_bundle(self, row: aiosqlite.Row) -> EvidenceBundle:
        scores_raw = json.loads(row["scores_json"])
        scores = tuple(
            HybridScore(
                combined=s.get("combined", 0),
                components=RetrievalScore(
                    lexical=s.get("lexical", 0),
                    semantic=s.get("semantic", 0),
                    authority=s.get("authority", 0),
                    freshness=s.get("freshness", 0),
                ),
            )
            for s in scores_raw
        )
        return EvidenceBundle(
            bundle_id=row["bundle_id"],
            retrieval_id=row["retrieval_id"],
            tenant_id=row["tenant_id"],
            request_id=row["request_id"],
            query=row["query"],
            jurisdiction=row["jurisdiction"],
            authority_summary=json.loads(row["authority_summary_json"]),
            document_ids=tuple(json.loads(row["document_ids_json"])),
            chunk_ids=tuple(json.loads(row["chunk_ids_json"])),
            evidence_hash=EvidenceHash(hash_value=row["evidence_hash"]),
            scores=scores,
            blocked_document_ids=tuple(json.loads(row["blocked_document_ids_json"])),
            metadata=json.loads(row["metadata_json"]),
            created_at=_parse_dt(row["created_at"]) or _utc_now(),
        )

    def _row_to_snapshot(self, row: aiosqlite.Row) -> KnowledgeSnapshot:
        return KnowledgeSnapshot(
            snapshot_id=row["snapshot_id"],
            retrieval_id=row["retrieval_id"],
            tenant_id=row["tenant_id"],
            request_id=row["request_id"],
            query_hash=row["query_hash"],
            jurisdiction=row["jurisdiction"],
            as_of=row["as_of"],
            authority_summary=json.loads(row["authority_summary_json"]),
            evidence_hashes=tuple(json.loads(row["evidence_hashes_json"])),
            embedding_versions=tuple(json.loads(row["embedding_versions_json"])),
            document_ids=tuple(json.loads(row["document_ids_json"])),
            bundle_id=row["bundle_id"],
            immutable=bool(row["immutable"]),
            metadata=json.loads(row["metadata_json"]),
            created_at=_parse_dt(row["created_at"]) or _utc_now(),
        )
