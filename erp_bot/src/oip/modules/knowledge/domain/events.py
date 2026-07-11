"""Knowledge Runtime domain events — outbox only."""

from __future__ import annotations

from typing import Any

from ....domain.events import DomainEvent, make_partition_key
from ....shared.ids import CorrelationId, TenantId


class KnowledgeRetrievalStartedEvent(DomainEvent):
    event_type: str = "oip.knowledge.retrieval.started.v1"


class KnowledgeRetrievalCompletedEvent(DomainEvent):
    event_type: str = "oip.knowledge.retrieval.completed.v1"


class KnowledgeIndexedEvent(DomainEvent):
    event_type: str = "oip.knowledge.document.indexed.v1"


class KnowledgeReembeddedEvent(DomainEvent):
    event_type: str = "oip.knowledge.embedding.reembedded.v1"


class EvidenceBundleAssembledEvent(DomainEvent):
    event_type: str = "oip.knowledge.evidence.assembled.v1"


class KnowledgeSnapshotCreatedEvent(DomainEvent):
    event_type: str = "oip.knowledge.snapshot.created.v1"


class KnowledgePoisonDetectedEvent(DomainEvent):
    event_type: str = "oip.knowledge.poison.detected.v1"


class KnowledgeAuthorityConflictEvent(DomainEvent):
    event_type: str = "oip.knowledge.authority.conflict.v1"


def build_knowledge_event(
    event_cls: type[DomainEvent],
    *,
    tenant_id: str,
    correlation_id: str,
    company_id: str | None,
    retrieval_id: str,
    payload: dict[str, Any],
) -> DomainEvent:
    return event_cls(
        tenant_id=TenantId(tenant_id),
        correlation_id=CorrelationId(correlation_id),
        partition_key=make_partition_key(tenant_id, company_id, retrieval_id),
        payload={"retrieval_id": retrieval_id, **payload},
    )
