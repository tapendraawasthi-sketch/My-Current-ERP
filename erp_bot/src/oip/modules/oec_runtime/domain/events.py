"""OEC Runtime domain events."""

from __future__ import annotations

from typing import Any

from ....domain.events import DomainEvent, make_partition_key
from ....shared.ids import CorrelationId, TenantId


class ConnectorRegisteredEvent(DomainEvent):
    event_type: str = "oip.oec.connector.registered.v1"


class ConnectorArchivedEvent(DomainEvent):
    event_type: str = "oip.oec.connector.archived.v1"


class ConnectorUnregisteredEvent(DomainEvent):
    event_type: str = "oip.oec.connector.unregistered.v1"


class ERPCommandStartedEvent(DomainEvent):
    event_type: str = "oip.oec.command.started.v1"


class ERPCommandConfirmedEvent(DomainEvent):
    event_type: str = "oip.oec.command.confirmed.v1"


class ERPCommandFailedEvent(DomainEvent):
    event_type: str = "oip.oec.command.failed.v1"


class ERPQueryCompletedEvent(DomainEvent):
    event_type: str = "oip.oec.query.completed.v1"


class ConnectorTransactionCommittedEvent(DomainEvent):
    event_type: str = "oip.oec.transaction.committed.v1"


class ConnectorTransactionRolledBackEvent(DomainEvent):
    event_type: str = "oip.oec.transaction.rolled_back.v1"


class CompensationExecutedEvent(DomainEvent):
    event_type: str = "oip.oec.compensation.executed.v1"


def build_oec_event(
    event_cls: type[DomainEvent],
    *,
    tenant_id: str,
    correlation_id: str,
    company_id: str | None,
    connector_id: str,
    payload: dict[str, Any],
) -> DomainEvent:
    return event_cls(
        tenant_id=TenantId(tenant_id),
        correlation_id=CorrelationId(correlation_id),
        partition_key=make_partition_key(tenant_id, company_id, connector_id),
        payload={"connector_id": connector_id, **payload},
    )
