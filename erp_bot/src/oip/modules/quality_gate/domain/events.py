"""Quality Gate domain events — outbox only."""

from __future__ import annotations

from typing import Any

from ....domain.events import DomainEvent, make_partition_key
from ....shared.ids import CorrelationId, TenantId


class QualityEvaluationStartedEvent(DomainEvent):
    event_type: str = "oip.quality_gate.quality_evaluation.started.v1"


class QualityGatePassedEvent(DomainEvent):
    event_type: str = "oip.quality_gate.quality_gate.passed.v1"


class QualityGateFailedEvent(DomainEvent):
    event_type: str = "oip.quality_gate.quality_gate.failed.v1"


class QualityWarningRaisedEvent(DomainEvent):
    event_type: str = "oip.quality_gate.quality_finding.warning_raised.v1"


class QualityRuleTriggeredEvent(DomainEvent):
    event_type: str = "oip.quality_gate.quality_rule.triggered.v1"


class QualityEscalatedEvent(DomainEvent):
    event_type: str = "oip.quality_gate.quality_risk.escalated.v1"


class QualityApprovedEvent(DomainEvent):
    event_type: str = "oip.quality_gate.quality_evaluation.approved.v1"


class QualityRejectedEvent(DomainEvent):
    event_type: str = "oip.quality_gate.quality_evaluation.rejected.v1"


class QualityArchivedEvent(DomainEvent):
    event_type: str = "oip.quality_gate.quality_evaluation.archived.v1"


def build_quality_event(
    event_cls: type[DomainEvent],
    *,
    tenant_id: str,
    correlation_id: str,
    company_id: str | None,
    evaluation_id: str,
    payload: dict[str, Any],
) -> DomainEvent:
    return event_cls(
        tenant_id=TenantId(tenant_id),
        correlation_id=CorrelationId(correlation_id),
        partition_key=make_partition_key(tenant_id, company_id, evaluation_id),
        payload={"evaluation_id": evaluation_id, **payload},
    )
