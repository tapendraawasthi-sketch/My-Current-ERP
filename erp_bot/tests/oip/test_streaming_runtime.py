"""OIP Phase 1.8 — Streaming Runtime module tests."""

from __future__ import annotations

import asyncio
import json

import pytest

from src.oip.application.queries import GetAuditChainQuery, GetLineageTraceQuery
from src.oip.config.settings import OipSettings
from src.oip.infrastructure.di.container import build_container, shutdown_container
from src.oip.modules.streaming_runtime.application.commands import (
    CloseStreamCommand,
    IngestWorkflowEventCommand,
    OpenStreamCommand,
    ReconnectStreamCommand,
)
from src.oip.modules.streaming_runtime.application.queries import (
    GetStreamQuery,
    ListStreamsQuery,
    ReplayStreamQuery,
    StreamingMetricsQuery,
)
from src.oip.modules.streaming_runtime.domain.event_order_registry import create_default_event_order_registry
from src.oip.modules.streaming_runtime.domain.transport_registry import StreamingTransportRegistry
from src.oip.modules.streaming_runtime.infrastructure.adapters.registry_transport_port import create_default_transport_registry
from src.oip.modules.streaming_runtime.domain.value_objects import StreamFeatureMode, WorkflowEventType
from src.oip.modules.streaming_runtime.infrastructure.adapters.memory_replay_buffer import MemoryReplayBufferAdapter
from src.oip.modules.streaming_runtime.infrastructure.adapters.sse_transport import SSETransportAdapter
from src.oip.modules.streaming_runtime.infrastructure.adapters.websocket_transport import WebSocketTransportAdapter
from src.oip.shared.ids import CorrelationId, RequestId, TenantId, new_correlation_id, new_request_id


@pytest.fixture
async def oip_container(tmp_path):
    db_path = tmp_path / "oip_streaming_test.db"
    settings = OipSettings(
        enabled=True,
        stream_runtime_mode="native",
        stream_protocol="sse",
        stream_heartbeat=30,
        stream_replay_buffer=1000,
        stream_transport="auto",
        planner_enabled=True,
        router_enabled=True,
        provider_runtime_enabled=True,
        quality_enabled=True,
        action_runtime_enabled=True,
        database_url=f"sqlite+aiosqlite:///{db_path}",
    )
    container = await build_container(settings)
    yield container
    await container.close()
    await shutdown_container()


@pytest.fixture
async def shadow_container(tmp_path):
    db_path = tmp_path / "oip_streaming_shadow.db"
    settings = OipSettings(
        enabled=True,
        stream_runtime_mode="shadow",
        database_url=f"sqlite+aiosqlite:///{db_path}",
    )
    container = await build_container(settings)
    yield container
    await container.close()
    await shutdown_container()


def _open_cmd(workflow_id: str, **kwargs) -> OpenStreamCommand:
    return OpenStreamCommand(
        tenant_id=TenantId(kwargs.get("tenant_id", "tenant-a")),
        correlation_id=CorrelationId(str(new_correlation_id())),
        request_id=RequestId(str(new_request_id())),
        workflow_id=workflow_id,
        client_id=kwargs.get("client_id", "test-client"),
        protocol=kwargs.get("protocol", "sse"),
        conversation_id=kwargs.get("conversation_id"),
        company_id=kwargs.get("company_id"),
        execution_id=kwargs.get("execution_id"),
    )


def _ingest_cmd(workflow_id: str, event_type: str, **kwargs) -> IngestWorkflowEventCommand:
    return IngestWorkflowEventCommand(
        tenant_id=TenantId(kwargs.get("tenant_id", "tenant-a")),
        correlation_id=CorrelationId(str(new_correlation_id())),
        request_id=RequestId(str(new_request_id())),
        workflow_id=workflow_id,
        event_type=event_type,
        payload=kwargs.get("payload", {}),
    )


@pytest.mark.asyncio
async def test_event_order_registry_ranks():
    registry = create_default_event_order_registry()
    assert registry.rank(WorkflowEventType.WORKFLOW_STARTED) < registry.rank(WorkflowEventType.PROVIDER_COMPLETED)
    assert registry.rank(WorkflowEventType.PROVIDER_COMPLETED) < registry.rank(WorkflowEventType.QUALITY_STARTED)


@pytest.mark.asyncio
async def test_event_order_prerequisites():
    registry = create_default_event_order_registry()
    ok, missing = registry.prerequisites_met(WorkflowEventType.ACTION_EXECUTED, {"quality_completed"})
    assert ok is True
    ok2, missing2 = registry.prerequisites_met(WorkflowEventType.ACTION_EXECUTED, set())
    assert ok2 is False
    assert "quality_completed" in missing2


@pytest.mark.asyncio
async def test_transport_registry_lists_protocols():
    registry = create_default_transport_registry()
    protocols = registry.list_protocols()
    assert "sse" in protocols
    assert "websocket" in protocols


@pytest.mark.asyncio
async def test_sse_transport_connect_publish():
    sse = SSETransportAdapter()
    conn = await sse.connect(stream_id="s1", client_id="c1", protocol=sse.protocol)
    from src.oip.modules.streaming_runtime.domain.value_objects import StreamEventRecord

    event = StreamEventRecord(
        event_id="e1",
        stream_id="s1",
        workflow_id="w1",
        request_id="r1",
        tenant_id="t1",
        sequence=1,
        event_type=WorkflowEventType.PROVIDER_CHUNK,
        timestamp="2026-01-01T00:00:00+00:00",
        payload={"text": "hello"},
        checksum="abc",
    )
    assert await sse.publish(connection_id=conn, event=event) is True
    items = []
    async for item in sse.stream_events(connection_id=conn):
        items.append(item)
        break
    assert items[0]["sequence"] == 1


@pytest.mark.asyncio
async def test_websocket_transport_connect_publish():
    ws = WebSocketTransportAdapter()
    conn = await ws.connect(stream_id="s1", client_id="c1", protocol=ws.protocol)
    from src.oip.modules.streaming_runtime.domain.value_objects import StreamEventRecord

    event = StreamEventRecord(
        event_id="e1",
        stream_id="s1",
        workflow_id="w1",
        request_id="r1",
        tenant_id="t1",
        sequence=1,
        event_type=WorkflowEventType.HEARTBEAT,
        timestamp="2026-01-01T00:00:00+00:00",
        payload={},
        checksum="abc",
    )
    assert await ws.publish(connection_id=conn, event=event) is True


@pytest.mark.asyncio
async def test_memory_replay_buffer_append_and_replay():
    buf = MemoryReplayBufferAdapter()
    from src.oip.modules.streaming_runtime.domain.value_objects import StreamEventRecord

    for seq in range(1, 4):
        event = StreamEventRecord(
            event_id=f"e{seq}",
            stream_id="s1",
            workflow_id="wf1",
            request_id="r1",
            tenant_id="t1",
            sequence=seq,
            event_type=WorkflowEventType.WORKFLOW_PROGRESS,
            timestamp="2026-01-01T00:00:00+00:00",
            payload={"step": seq},
            checksum=f"cs{seq}",
        )
        await buf.append(workflow_id="wf1", event=event)
    replay = await buf.get_after_sequence(workflow_id="wf1", after_sequence=1)
    assert len(replay) == 2
    assert replay[0].sequence == 2


@pytest.mark.asyncio
async def test_memory_replay_buffer_trim():
    buf = MemoryReplayBufferAdapter()
    from src.oip.modules.streaming_runtime.domain.value_objects import StreamEventRecord

    for seq in range(1, 6):
        event = StreamEventRecord(
            event_id=f"e{seq}",
            stream_id="s1",
            workflow_id="wf1",
            request_id="r1",
            tenant_id="t1",
            sequence=seq,
            event_type=WorkflowEventType.HEARTBEAT,
            timestamp="2026-01-01T00:00:00+00:00",
            payload={},
            checksum="x",
        )
        await buf.append(workflow_id="wf1", event=event)
    removed = await buf.trim(workflow_id="wf1", keep=2)
    assert removed == 3
    remaining = await buf.get_after_sequence(workflow_id="wf1", after_sequence=0)
    assert len(remaining) == 2
    assert remaining[-1].sequence == 5


@pytest.mark.asyncio
async def test_pipeline_stage_names(oip_container):
    pipeline = oip_container.streaming_runtime_service._pipeline
    names = pipeline.stage_names
    assert names == ("receive", "validate", "sequence", "persist", "publish", "ack", "cleanup")


@pytest.mark.asyncio
async def test_open_stream(oip_container):
    session = await oip_container.command_bus.dispatch(_open_cmd("wf-open-1"))
    assert session["workflow_id"] == "wf-open-1"
    assert session["status"] == "connected"
    assert session["protocol"] == "sse"


@pytest.mark.asyncio
async def test_open_stream_idempotent(oip_container):
    cmd = _open_cmd("wf-idem-1")
    s1 = await oip_container.command_bus.dispatch(cmd)
    s2 = await oip_container.command_bus.dispatch(_open_cmd("wf-idem-1"))
    assert s1["stream_id"] == s2["stream_id"]


@pytest.mark.asyncio
async def test_close_stream(oip_container):
    opened = await oip_container.command_bus.dispatch(_open_cmd("wf-close-1"))
    closed = await oip_container.command_bus.dispatch(
        CloseStreamCommand(
            tenant_id=TenantId("tenant-a"),
            correlation_id=CorrelationId(str(new_correlation_id())),
            stream_id=opened["stream_id"],
        )
    )
    assert closed["status"] == "closed"


@pytest.mark.asyncio
async def test_ingest_workflow_started(oip_container):
    await oip_container.command_bus.dispatch(_open_cmd("wf-ingest-1"))
    record = await oip_container.command_bus.dispatch(
        _ingest_cmd("wf-ingest-1", "workflow_started", payload={"step": "init"})
    )
    assert record is not None
    assert record["sequence"] == 1
    assert record["event_type"] == "workflow_started"


@pytest.mark.asyncio
async def test_ingest_provider_chunk(oip_container):
    await oip_container.command_bus.dispatch(_open_cmd("wf-chunk-1"))
    await oip_container.command_bus.dispatch(_ingest_cmd("wf-chunk-1", "workflow_started"))
    record = await oip_container.command_bus.dispatch(
        _ingest_cmd("wf-chunk-1", "provider_chunk", payload={"token": "Hi"})
    )
    assert record["event_type"] == "provider_chunk"
    assert record["payload"]["token"] == "Hi"


@pytest.mark.asyncio
async def test_ordering_blocks_premature_action_executed(oip_container):
    await oip_container.command_bus.dispatch(_open_cmd("wf-order-1"))
    blocked = await oip_container.command_bus.dispatch(
        _ingest_cmd("wf-order-1", "action_executed", payload={"action_id": "a1"})
    )
    assert blocked is None


@pytest.mark.asyncio
async def test_ordering_allows_full_pipeline(oip_container):
    wf = "wf-pipeline-1"
    await oip_container.command_bus.dispatch(_open_cmd(wf))
    sequence = (
        "workflow_started",
        "provider_chunk",
        "provider_completed",
        "quality_started",
        "quality_completed",
        "action_proposed",
        "action_executed",
        "workflow_completed",
    )
    last_seq = 0
    for et in sequence:
        record = await oip_container.command_bus.dispatch(_ingest_cmd(wf, et))
        assert record is not None, et
        last_seq = record["sequence"]
    assert last_seq == len(sequence)


@pytest.mark.asyncio
async def test_replay_missed_events(oip_container):
    wf = "wf-replay-1"
    await oip_container.command_bus.dispatch(_open_cmd(wf))
    await oip_container.command_bus.dispatch(_ingest_cmd(wf, "workflow_started"))
    await oip_container.command_bus.dispatch(_ingest_cmd(wf, "provider_chunk", payload={"n": 1}))
    await oip_container.command_bus.dispatch(_ingest_cmd(wf, "provider_chunk", payload={"n": 2}))
    replay = await oip_container.query_bus.dispatch(
        ReplayStreamQuery(tenant_id=TenantId("tenant-a"), workflow_id=wf, last_sequence=1)
    )
    assert replay["event_count"] == 2
    assert replay["events"][0]["sequence"] == 2


@pytest.mark.asyncio
async def test_reconnect_replays_and_restores(oip_container):
    opened = await oip_container.command_bus.dispatch(_open_cmd("wf-reconn-1"))
    await oip_container.command_bus.dispatch(_ingest_cmd("wf-reconn-1", "workflow_started"))
    disconnected = await oip_container.streaming_runtime_service.handle_disconnect(
        tenant_id="tenant-a", stream_id=opened["stream_id"]
    )
    assert disconnected.status.value == "disconnected"
    reconnected = await oip_container.command_bus.dispatch(
        ReconnectStreamCommand(
            tenant_id=TenantId("tenant-a"),
            correlation_id=CorrelationId(str(new_correlation_id())),
            stream_id=opened["stream_id"],
            client_id="reconnect-client",
            last_sequence=0,
        )
    )
    assert reconnected["status"] == "connected"


@pytest.mark.asyncio
async def test_get_stream_query(oip_container):
    opened = await oip_container.command_bus.dispatch(_open_cmd("wf-get-1"))
    fetched = await oip_container.query_bus.dispatch(
        GetStreamQuery(tenant_id=TenantId("tenant-a"), stream_id=opened["stream_id"])
    )
    assert fetched["stream_id"] == opened["stream_id"]


@pytest.mark.asyncio
async def test_list_streams(oip_container):
    await oip_container.command_bus.dispatch(_open_cmd("wf-list-1"))
    await oip_container.command_bus.dispatch(_open_cmd("wf-list-2"))
    streams = await oip_container.query_bus.dispatch(
        ListStreamsQuery(tenant_id=TenantId("tenant-a"), limit=10)
    )
    assert len(streams) >= 2


@pytest.mark.asyncio
async def test_streaming_metrics(oip_container):
    await oip_container.command_bus.dispatch(_open_cmd("wf-metrics-1"))
    await oip_container.command_bus.dispatch(_ingest_cmd("wf-metrics-1", "workflow_started"))
    metrics = await oip_container.query_bus.dispatch(
        StreamingMetricsQuery(tenant_id=TenantId("tenant-a"))
    )
    assert metrics["streams_opened"] >= 1
    assert metrics["events_published"] >= 1


@pytest.mark.asyncio
async def test_audit_on_stream_open(oip_container):
    cmd = _open_cmd("wf-audit-1")
    await oip_container.command_bus.dispatch(cmd)
    chain = await oip_container.query_bus.dispatch(
        GetAuditChainQuery(tenant_id=TenantId("tenant-a"), request_id=RequestId(cmd.request_id))
    )
    names = [entry["event_name"] for entry in chain]
    assert any("streaming_runtime.stream.opened" in n for n in names)


@pytest.mark.asyncio
async def test_lineage_on_stream_events(oip_container):
    cmd = _open_cmd("wf-lineage-1")
    await oip_container.command_bus.dispatch(cmd)
    await oip_container.command_bus.dispatch(_ingest_cmd("wf-lineage-1", "workflow_started"))
    trace = await oip_container.query_bus.dispatch(
        GetLineageTraceQuery(tenant_id=TenantId("tenant-a"), request_id=RequestId(cmd.request_id))
    )
    node_types = [n["node_type"] for n in trace]
    assert "StreamingSession" in node_types
    assert "Workflow" in node_types


@pytest.mark.asyncio
async def test_outbox_on_stream_open(oip_container):
    cmd = _open_cmd("wf-outbox-1")
    await oip_container.command_bus.dispatch(cmd)
    cursor = await oip_container.connection.execute(
        "SELECT event_type FROM oip_outbox ORDER BY created_at DESC LIMIT 10"
    )
    rows = await cursor.fetchall()
    event_types = [r["event_type"] for r in rows]
    assert "oip.streaming_runtime.stream.opened.v1" in event_types


@pytest.mark.asyncio
async def test_migration_tables_exist(oip_container):
    for table in (
        "oip_stream_sessions",
        "oip_stream_events",
        "oip_stream_offsets",
        "oip_stream_replays",
        "oip_stream_metrics",
        "oip_stream_replay_buffer",
    ):
        cursor = await oip_container.connection.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name=?", (table,)
        )
        row = await cursor.fetchone()
        assert row is not None, table


@pytest.mark.asyncio
async def test_shadow_mode_persists_without_transport(oip_container, shadow_container):
    opened = await shadow_container.command_bus.dispatch(_open_cmd("wf-shadow-1"))
    record = await shadow_container.command_bus.dispatch(
        _ingest_cmd("wf-shadow-1", "workflow_started")
    )
    assert record is not None
    assert opened["stream_id"]


@pytest.mark.asyncio
async def test_disabled_mode_raises(oip_container, tmp_path):
    settings = OipSettings(
        stream_runtime_mode="disabled",
        database_url=f"sqlite+aiosqlite:///{tmp_path / 'disabled.db'}",
    )
    container = await build_container(settings)
    try:
        with pytest.raises(ValueError, match="disabled"):
            await container.command_bus.dispatch(_open_cmd("wf-disabled"))
    finally:
        await container.close()
        await shutdown_container()


@pytest.mark.asyncio
async def test_transport_failure_does_not_block_ingest(oip_container):
    wf = "wf-transport-fail"
    opened = await oip_container.command_bus.dispatch(_open_cmd(wf))
    await oip_container.streaming_runtime_service.handle_disconnect(
        tenant_id="tenant-a", stream_id=opened["stream_id"]
    )
    record = await oip_container.command_bus.dispatch(_ingest_cmd(wf, "workflow_started"))
    assert record is not None


@pytest.mark.asyncio
async def test_heartbeat_event_ingest(oip_container):
    await oip_container.command_bus.dispatch(_open_cmd("wf-heartbeat-1"))
    record = await oip_container.command_bus.dispatch(
        _ingest_cmd("wf-heartbeat-1", "heartbeat", payload={"ping": True})
    )
    assert record["event_type"] == "heartbeat"


@pytest.mark.asyncio
async def test_sse_format_helper():
    sse = SSETransportAdapter()
    formatted = sse.format_sse({"event_type": "test", "sequence": 1})
    assert formatted.startswith("data: ")
    assert formatted.endswith("\n\n")
    parsed = json.loads(formatted.replace("data: ", "").strip())
    assert parsed["sequence"] == 1


@pytest.mark.asyncio
async def test_concurrent_sessions(oip_container):
    workflows = [f"wf-concurrent-{i}" for i in range(5)]
    sessions = await asyncio.gather(
        *[oip_container.command_bus.dispatch(_open_cmd(wf)) for wf in workflows]
    )
    assert len({s["stream_id"] for s in sessions}) == 5


@pytest.mark.asyncio
async def test_backpressure_on_full_queue():
    sse = SSETransportAdapter()
    conn = await sse.connect(stream_id="s1", client_id="c1", protocol=sse.protocol)
    from src.oip.modules.streaming_runtime.domain.value_objects import StreamEventRecord

    event = StreamEventRecord(
        event_id="e1",
        stream_id="s1",
        workflow_id="w1",
        request_id="r1",
        tenant_id="t1",
        sequence=1,
        event_type=WorkflowEventType.HEARTBEAT,
        timestamp="2026-01-01T00:00:00+00:00",
        payload={},
        checksum="x",
    )
    queue = sse._connections[conn]
    for i in range(500):
        queue.put_nowait({"n": i})
    result = await sse.publish(connection_id=conn, event=event)
    assert result is False


@pytest.mark.asyncio
async def test_workflow_subscriber_maps_provider_event(oip_container):
    from src.oip.domain.events import DomainEventEnvelope
    from src.oip.modules.provider_runtime.domain.events import ExecutionStartedEvent
    from src.oip.shared.ids import TenantId as TId, CorrelationId as CId

    subscriber = oip_container.event_bus._handlers.get("oip.provider_runtime.execution.started.v1")
    assert subscriber
    event = ExecutionStartedEvent(
        tenant_id=TId("tenant-a"),
        correlation_id=CId(str(new_correlation_id())),
        partition_key="tenant-a:default:exec-1",
        payload={
            "execution_id": "exec-sub-1",
            "request_id": str(new_request_id()),
            "tenant_id": "tenant-a",
        },
    )
    await subscriber[0](DomainEventEnvelope(event=event))
    replay = await oip_container.query_bus.dispatch(
        ReplayStreamQuery(tenant_id=TenantId("tenant-a"), workflow_id="exec-sub-1", last_sequence=0)
    )
    assert replay["event_count"] >= 1


@pytest.mark.asyncio
async def test_stream_feature_mode_enum():
    assert StreamFeatureMode.NATIVE.value == "native"
    assert StreamFeatureMode.SHADOW.value == "shadow"
    assert StreamFeatureMode.DISABLED.value == "disabled"


@pytest.mark.asyncio
async def test_checksum_on_events(oip_container):
    await oip_container.command_bus.dispatch(_open_cmd("wf-checksum-1"))
    record = await oip_container.command_bus.dispatch(
        _ingest_cmd("wf-checksum-1", "workflow_started", payload={"a": 1})
    )
    assert record["checksum"]
    assert len(record["checksum"]) == 64


@pytest.mark.asyncio
async def test_replay_records_persisted(oip_container):
    wf = "wf-replay-rec-1"
    opened = await oip_container.command_bus.dispatch(_open_cmd(wf))
    await oip_container.command_bus.dispatch(_ingest_cmd(wf, "workflow_started"))
    await oip_container.query_bus.dispatch(
        ReplayStreamQuery(tenant_id=TenantId("tenant-a"), workflow_id=wf, last_sequence=0)
    )
    cursor = await oip_container.connection.execute(
        "SELECT COUNT(*) AS cnt FROM oip_stream_replays WHERE stream_id = ?",
        (opened["stream_id"],),
    )
    row = await cursor.fetchone()
    assert row["cnt"] >= 1


@pytest.mark.asyncio
async def test_offsets_saved_on_replay(oip_container):
    wf = "wf-offset-1"
    await oip_container.command_bus.dispatch(_open_cmd(wf))
    await oip_container.command_bus.dispatch(_ingest_cmd(wf, "workflow_started"))
    await oip_container.query_bus.dispatch(
        ReplayStreamQuery(
            tenant_id=TenantId("tenant-a"),
            workflow_id=wf,
            last_sequence=0,
            client_id="offset-client",
        )
    )
    cursor = await oip_container.connection.execute(
        "SELECT last_sequence FROM oip_stream_offsets WHERE client_id = ?",
        ("offset-client",),
    )
    row = await cursor.fetchone()
    assert row is not None
    assert row["last_sequence"] >= 1
