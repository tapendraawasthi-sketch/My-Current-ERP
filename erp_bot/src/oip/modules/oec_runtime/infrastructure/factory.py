"""Build OEC execution pipeline and connector registry."""

from __future__ import annotations

import aiosqlite

from ....config.settings import OipSettings
from ..application.pipeline.pipeline import OecExecutionPipeline
from ..application.pipeline.stages import (
    AuditStage,
    CapabilityCheckStage,
    CommitStage,
    CompensationStage,
    ConfirmationStage,
    ExecuteStage,
    LineageStage,
    OpenTransactionStage,
    PublishStage,
    ResolveConnectorStage,
    SnapshotVerifyStage,
    ValidateStage,
)
from ..application.ports.oec_ports import OecRepositoryPort
from ..domain.capability_registry import create_default_capability_registry
from ..domain.compensation_registry import create_default_compensation_registry
from ..domain.connector_registry import ConnectorRegistry, create_default_connector_registry
from ..domain.events import ERPCommandConfirmedEvent, ERPCommandFailedEvent
from ..domain.execution_intent_registry import create_default_execution_intent_connector_registry
from ..domain.snapshot_registry import create_default_snapshot_registry
from ..domain.transaction_registry import create_default_transaction_registry
from .adapters.circuit_breaker_adapter import CircuitBreakerAdapter
from .adapters.connectors import (
    GraphQLConnectorDriver,
    MockConnectorDriver,
    MySQLConnectorDriver,
    OfflineConnectorDriver,
    PostgreSQLConnectorDriver,
    ReplayConnectorDriver,
    RestConnectorDriver,
    SQLServerConnectorDriver,
    SQLiteConnectorDriver,
    SutraConnectorDriver,
)
from .adapters.idempotency_adapter import IdempotencyAdapter


def build_connector_registry(*, conn: aiosqlite.Connection, repository: OecRepositoryPort) -> ConnectorRegistry:
    registry = create_default_connector_registry()
    registry.register_driver(MockConnectorDriver())
    registry.register_driver(SQLiteConnectorDriver(conn))
    registry.register_driver(ReplayConnectorDriver(repository))
    registry.register_driver(OfflineConnectorDriver(repository))
    registry.register_driver(RestConnectorDriver())
    registry.register_driver(GraphQLConnectorDriver())
    registry.register_driver(PostgreSQLConnectorDriver())
    registry.register_driver(MySQLConnectorDriver())
    registry.register_driver(SQLServerConnectorDriver())
    registry.register_driver(SutraConnectorDriver(conn))
    return registry


def build_oec_pipeline(
    *,
    repository: OecRepositoryPort,
    connector_registry: ConnectorRegistry,
    audit_service,
    lineage_service,
    outbox,
    settings: OipSettings,
) -> OecExecutionPipeline:
    capability_registry = create_default_capability_registry()
    intent_registry = create_default_execution_intent_connector_registry()
    snapshot_registry = create_default_snapshot_registry()
    transaction_registry = create_default_transaction_registry()
    compensation_registry = create_default_compensation_registry()
    circuit_breaker = CircuitBreakerAdapter(repository, failure_threshold=settings.oec_circuit_threshold)
    idempotency = IdempotencyAdapter(repository)

    async def audit_cb(**kwargs) -> None:
        await audit_service.record(
            tenant_id=kwargs["tenant_id"],
            request_id=kwargs["request_id"],
            correlation_id=kwargs["correlation_id"],
            event_name=kwargs["event_name"],
            payload_redacted=kwargs["payload"],
        )

    async def lineage_cb(**kwargs) -> None:
        await lineage_service.append_node(
            tenant_id=kwargs["tenant_id"],
            request_id=kwargs["request_id"],
            node_type=kwargs["node_type"],
            payload=kwargs["payload"],
        )

    async def publish_cb(context) -> None:
        from ....domain.events import DomainEventEnvelope
        from ..domain.events import ERPCommandConfirmedEvent, build_oec_event

        if context.blocked or context.execution is None:
            return
        event = build_oec_event(
            ERPCommandConfirmedEvent,
            tenant_id=context.tenant_id,
            correlation_id=context.correlation_id,
            company_id=context.company_id,
            connector_id=context.execution.connector_id,
            payload={"execution_id": context.execution.execution_id},
        )
        await outbox.enqueue(DomainEventEnvelope(event=event, request_id=context.request_id))

    stages = (
        ValidateStage(),
        ResolveConnectorStage(repository),
        CapabilityCheckStage(capability_registry, intent_registry),
        SnapshotVerifyStage(snapshot_registry),
        OpenTransactionStage(repository, transaction_registry, idempotency),
        ExecuteStage(connector_registry, circuit_breaker, idempotency),
        ConfirmationStage(),
        CompensationStage(compensation_registry, repository),
        CommitStage(repository, idempotency),
        AuditStage(audit_cb),
        LineageStage(lineage_cb),
        PublishStage(publish_cb),
    )
    return OecExecutionPipeline(stages=stages)
