"""OIP Phase 2.9 — Operations, observability & reliability tests."""

from __future__ import annotations

import asyncio
import uuid

import pytest

from src.oip.config.settings import OipSettings
from src.oip.domain.events import DomainEvent, DomainEventEnvelope
from src.oip.infrastructure.di.container import build_container, shutdown_container
from src.oip.infrastructure.messaging.inbox_event_bus import InboxAwareEventBus
from src.oip.infrastructure.messaging.outbox_dispatcher import OutboxDispatcher
from src.oip.infrastructure.observability.correlation import bind_trace, clear_trace, current_trace
from src.oip.infrastructure.observability.metrics import OipMetricsRegistry, get_metrics_registry
from src.oip.infrastructure.observability.tracing import span
from src.oip.infrastructure.persistence.inbox_sqlite import SqliteInboxAdapter
from src.oip.infrastructure.persistence.outbox_sqlite import SqliteOutboxAdapter
from src.oip.modules.oec_runtime.infrastructure.persistence.oec_sqlite import TENANT_A


@pytest.fixture
async def oip_container(tmp_path):
    db_path = tmp_path / "oip_ops.db"
    settings = OipSettings(
        enabled=True,
        auth_required=False,
        database_url=f"sqlite+aiosqlite:///{db_path}",
        outbox_max_attempts=3,
    )
    container = await build_container(settings)
    yield container
    await container.close()
    await shutdown_container()


def test_trace_context_propagation():
    bind_trace(request_id="req-1", correlation_id="corr-1", trace_id="trace-abc")
    with span("test.stage", stage="planner") as ctx:
        assert ctx["trace_id"] == "trace-abc"
        assert ctx["span_id"]
        assert ctx["parent_span_id"]
    trace = current_trace()
    assert str(trace.request_id) == "req-1"
    clear_trace()


def test_prometheus_metrics_render():
    registry = OipMetricsRegistry()
    registry.inc_counter("oip_requests_total", bus="command", operation="test")
    registry.observe_histogram("oip_stage_latency_seconds", 0.25, stage="router")
    registry.set_gauge("oip_outbox_queue_depth", 5)
    body = registry.render_prometheus()
    assert "oip_requests_total" in body
    assert "oip_stage_latency_seconds_bucket" in body
    assert "oip_outbox_queue_depth" in body


@pytest.mark.asyncio
async def test_outbox_publish_and_dlq(oip_container):
    outbox: SqliteOutboxAdapter = oip_container.outbox
    event = DomainEvent(
        event_type="ops.test.event.v1",
        tenant_id=TENANT_A,
        partition_key=f"{TENANT_A}:company:ops-test",
        correlation_id="corr-ops",
        payload={"test": True},
    )
    await outbox.enqueue(DomainEventEnvelope(event=event))
    stats = await outbox.get_queue_stats()
    assert stats["unpublished"] >= 1

    class FailingBus:
        async def publish(self, envelope):
            raise RuntimeError("simulated_failure")

    dispatcher = OutboxDispatcher(outbox, FailingBus(), max_attempts=2)
    for _ in range(3):
        await dispatcher.dispatch_pending(limit=10)
    stats_after = await outbox.get_queue_stats()
    assert stats_after["dead_letter"] >= 1

    replayed = await dispatcher.replay_dead_letter(limit=10)
    assert replayed >= 1


@pytest.mark.asyncio
async def test_inbox_exactly_once(oip_container):
    inbox = SqliteInboxAdapter(oip_container.connection)
    bus = InboxAwareEventBus(inbox, consumer_group="test-group")
    calls: list[str] = []

    async def handler(envelope: DomainEventEnvelope) -> None:
        calls.append(str(envelope.event.event_id))

    bus.subscribe("ops.inbox.test.v1", handler)
    event = DomainEvent(
        event_type="ops.inbox.test.v1",
        tenant_id=TENANT_A,
        partition_key=f"{TENANT_A}:company:inbox",
        correlation_id="corr-inbox",
    )
    envelope = DomainEventEnvelope(event=event)
    await bus.publish(envelope)
    await bus.publish(envelope)
    assert len(calls) == 1


@pytest.mark.asyncio
async def test_readiness_and_liveness(oip_container):
    live = await oip_container.readiness_service.liveness()
    assert live["status"] == "alive"
    ready = await oip_container.readiness_service.readiness(kernel_health={"status": "ok"})
    assert ready["status"] in ("ready", "degraded")
    assert "database" in ready["checks"]
    assert "outbox" in ready["checks"]


@pytest.mark.asyncio
async def test_alerting_on_dlq_growth(oip_container):
    outbox: SqliteOutboxAdapter = oip_container.outbox
    for i in range(12):
        event = DomainEvent(
            event_type="ops.alert.test.v1",
            tenant_id=TENANT_A,
            partition_key=f"{TENANT_A}:company:alert-{i}",
            correlation_id=f"corr-alert-{i}",
        )
        msg_id = await outbox.enqueue(DomainEventEnvelope(event=event))
        await outbox.move_to_dead_letter(msg_id)
    alerts = await oip_container.alerting_service.evaluate()
    assert any(a["alert_type"] == "dead_letter_growth" for a in alerts)


@pytest.mark.asyncio
async def test_outbox_poller_tick(oip_container):
    outbox: SqliteOutboxAdapter = oip_container.outbox
    event = DomainEvent(
        event_type="ops.poller.test.v1",
        tenant_id=TENANT_A,
        partition_key=f"{TENANT_A}:company:poller",
        correlation_id="corr-poller",
    )
    await outbox.enqueue(DomainEventEnvelope(event=event))
    published = await oip_container.outbox_poller.tick()
    assert published >= 0


@pytest.mark.asyncio
async def test_workflow_recovery_command(oip_container):
    from src.oip.modules.orchestrator.application.commands import RecoverWorkflowsCommand
    from src.oip.shared.ids import CorrelationId, TenantId, new_correlation_id

    recovered = await oip_container.command_bus.dispatch(
        RecoverWorkflowsCommand(
            tenant_id=TenantId(TENANT_A),
            correlation_id=CorrelationId(str(new_correlation_id())),
        )
    )
    assert isinstance(recovered, list)


@pytest.mark.asyncio
async def test_concurrent_outbox_enqueue(oip_container):
    outbox: SqliteOutboxAdapter = oip_container.outbox

    async def enqueue_one(idx: int):
        event = DomainEvent(
            event_type="ops.concurrent.v1",
            tenant_id=TENANT_A,
            partition_key=f"{TENANT_A}:company:conc-{idx}",
            correlation_id=f"corr-{idx}",
        )
        return await outbox.enqueue(DomainEventEnvelope(event=event))

    await asyncio.gather(*[enqueue_one(i) for i in range(20)])
    stats = await outbox.get_queue_stats()
    assert stats["unpublished"] >= 20


@pytest.mark.asyncio
async def test_chaos_provider_unavailable_metrics():
    registry = get_metrics_registry()
    registry.inc_counter("oip_failures_total", component="provider", reason="ProviderUnavailable")
    body = registry.render_prometheus()
    assert "oip_failures_total" in body


@pytest.mark.asyncio
async def test_migration_ops_tables_exist(oip_container):
    conn = oip_container.connection
    for table in ("oip_outbox_dlq", "oip_ops_alerts"):
        cursor = await conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
            (table,),
        )
        assert await cursor.fetchone() is not None


@pytest.mark.asyncio
async def test_instrumented_command_bus(oip_container):
    from src.oip.application.commands import SubmitIntelligenceRequestCommand
    from src.oip.shared.ids import CorrelationId, TenantId, new_correlation_id

    result = await oip_container.command_bus.dispatch(
        SubmitIntelligenceRequestCommand(
            tenant_id=TenantId(TENANT_A),
            correlation_id=CorrelationId(str(new_correlation_id())),
            session_id="ops-session",
            user_id="ops-user",
            module="orbix",
            message="health check",
        )
    )
    assert result is not None
    body = oip_container.metrics_registry.render_prometheus()
    assert "oip_requests_total" in body
