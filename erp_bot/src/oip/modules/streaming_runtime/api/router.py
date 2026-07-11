"""Streaming Runtime HTTP API."""

from __future__ import annotations

import json
from typing import Any

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from ....infrastructure.di.container import get_container
from ....shared.ids import CorrelationId, RequestId, TenantId, new_correlation_id, new_request_id
from ..application.commands import CloseStreamCommand, IngestWorkflowEventCommand, OpenStreamCommand, ReconnectStreamCommand
from ..application.queries import GetStreamQuery, ReplayStreamQuery, StreamingMetricsQuery
from ..domain.value_objects import StreamProtocol

router = APIRouter(prefix="/stream", tags=["streaming-runtime"])


class OpenStreamRequest(BaseModel):
    tenant_id: str = Field(default="default")
    client_id: str = Field(default="browser")
    protocol: str = Field(default="sse")
    conversation_id: str | None = None
    company_id: str | None = None
    execution_id: str | None = None


class ReconnectRequest(BaseModel):
    tenant_id: str = Field(default="default")
    stream_id: str
    client_id: str = Field(default="browser")
    last_sequence: int = 0


@router.get("/metrics")
async def stream_metrics(tenant_id: str = "default") -> dict[str, Any]:
    container = await get_container()
    return await container.query_bus.dispatch(
        StreamingMetricsQuery(tenant_id=TenantId(tenant_id))
    )


@router.get("/replay/{workflow_id}")
async def replay_stream(
    workflow_id: str,
    tenant_id: str = "default",
    last_sequence: int = 0,
    client_id: str = "replay-client",
) -> dict[str, Any]:
    container = await get_container()
    return await container.query_bus.dispatch(
        ReplayStreamQuery(
            tenant_id=TenantId(tenant_id),
            workflow_id=workflow_id,
            last_sequence=last_sequence,
            client_id=client_id,
        )
    )


@router.get("/{workflow_id}")
async def stream_sse(
    workflow_id: str,
    tenant_id: str = "default",
    client_id: str = "browser",
    last_sequence: int = 0,
    protocol: str = "sse",
) -> StreamingResponse:
    container = await get_container()
    request_id = str(new_request_id())
    correlation_id = str(new_correlation_id())

    session = await container.command_bus.dispatch(
        OpenStreamCommand(
            tenant_id=TenantId(tenant_id),
            correlation_id=CorrelationId(correlation_id),
            request_id=RequestId(request_id),
            workflow_id=workflow_id,
            client_id=client_id,
            protocol=protocol,
        )
    )
    connection_id = session.get("connection_id")
    if not connection_id:
        raise HTTPException(status_code=500, detail="Failed to open stream connection")

    transport = container.streaming_transport
    sse = container.sse_transport

    async def event_generator():
        if last_sequence > 0:
            replay = await container.streaming_runtime_service.replay(
                tenant_id=tenant_id,
                workflow_id=workflow_id,
                last_sequence=last_sequence,
                client_id=client_id,
            )
            for event in replay:
                yield sse.format_sse(event.model_dump(mode="json"))

        async for item in transport.stream_events(connection_id=connection_id):
            yield sse.format_sse(item)

    return StreamingResponse(event_generator(), media_type="text/event-stream")


ws_router = APIRouter(tags=["streaming-runtime-ws"])


@ws_router.websocket("/ws")
async def stream_websocket(websocket: WebSocket) -> None:
    await websocket.accept()
    container = await get_container()
    params = dict(websocket.query_params)
    workflow_id = params.get("workflow_id", "")
    tenant_id = params.get("tenant_id", "default")
    client_id = params.get("client_id", "ws-client")
    last_sequence = int(params.get("last_sequence", "0"))

    if not workflow_id:
        await websocket.close(code=4400)
        return

    request_id = str(new_request_id())
    session = await container.command_bus.dispatch(
        OpenStreamCommand(
            tenant_id=TenantId(tenant_id),
            correlation_id=CorrelationId(str(new_correlation_id())),
            request_id=RequestId(request_id),
            workflow_id=workflow_id,
            client_id=client_id,
            protocol="websocket",
        )
    )
    connection_id = session.get("connection_id")
    if not connection_id:
        await websocket.close(code=4500)
        return

    try:
        if last_sequence > 0:
            replay = await container.streaming_runtime_service.replay(
                tenant_id=tenant_id,
                workflow_id=workflow_id,
                last_sequence=last_sequence,
                client_id=client_id,
            )
            for event in replay:
                await websocket.send_text(json.dumps(event.model_dump(mode="json")))

        transport = container.streaming_transport
        async for item in transport.stream_events(connection_id=connection_id):
            await websocket.send_text(json.dumps(item))
    except WebSocketDisconnect:
        stream_id = session.get("stream_id")
        if stream_id:
            await container.streaming_runtime_service.handle_disconnect(
                tenant_id=tenant_id, stream_id=stream_id
            )
    finally:
        stream_id = session.get("stream_id")
        if stream_id:
            await container.command_bus.dispatch(
                CloseStreamCommand(
                    tenant_id=TenantId(tenant_id),
                    correlation_id=CorrelationId(str(new_correlation_id())),
                    stream_id=stream_id,
                )
            )
