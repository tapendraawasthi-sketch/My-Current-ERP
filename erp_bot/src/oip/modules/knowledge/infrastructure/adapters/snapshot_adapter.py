"""Knowledge snapshot adapter — immutable retrieval snapshots."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from ...application.ports.knowledge_ports import KnowledgeSnapshotPort
from ...domain.entities import EvidenceBundle, KnowledgeSnapshot, RetrievalExecution


class KnowledgeSnapshotAdapter(KnowledgeSnapshotPort):
    async def create_from_bundle(
        self, *, retrieval: RetrievalExecution, bundle: EvidenceBundle
    ) -> KnowledgeSnapshot:
        now = datetime.now(timezone.utc)
        return KnowledgeSnapshot(
            snapshot_id=str(uuid.uuid4()),
            retrieval_id=retrieval.retrieval_id,
            tenant_id=retrieval.tenant_id,
            request_id=retrieval.request_id,
            query_hash=retrieval.query_hash,
            jurisdiction=retrieval.jurisdiction,
            as_of=retrieval.as_of,
            authority_summary=bundle.authority_summary,
            evidence_hashes=(bundle.evidence_hash.hash_value,),
            embedding_versions=tuple(),
            document_ids=bundle.document_ids,
            bundle_id=bundle.bundle_id,
            immutable=True,
            metadata={"mode": retrieval.mode.value},
            created_at=now,
        )
