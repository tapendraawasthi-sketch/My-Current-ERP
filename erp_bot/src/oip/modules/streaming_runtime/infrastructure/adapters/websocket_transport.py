"""WebSocket streaming transport adapter."""

from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timezone
from typing import Any, AsyncIterator

from ...application.ports.streaming_runtime_ports import StreamingTransportPort
from ...domain.value_objects import StreamEventRecord, StreamProtocol


class WebSocketTransportAdapter(StreamingTransportPort):
    protocol = StreamProtocol.WEBSOCKET

    def __init__(self) -> None:
        self._connections: dict[str, asyncio.Queue[dict[str, Any] | None]] = {}
        self._meta: dict[str, tuple[str, str]] = {}

    async def connect(
        self, *, stream_id: str, client_id: str, protocol: StreamProtocol
    ) -> str:
        connection_id = str(uuid.uuid4())
        self._connections[connection_id] = asyncio.Queue(maxsize=500)
        self._meta[connection_id] = (stream_id, client_id)
        return connection_id

    async def publish(self, *, connection_id: str, event: StreamEventRecord) -> bool:
        queue = self._connections.get(connection_id)
        if queue is None:
            return False
        data = event.model_dump(mode="json")
        try:
            queue.put_nowait(data)
            return True
        except asyncio.QueueFull:
            return False

    async def disconnect(self, *, connection_id: str) -> None:
        queue = self._connections.pop(connection_id, None)
        self._meta.pop(connection_id, None)
        if queue is not None:
            try:
                queue.put_nowait(None)
            except asyncio.QueueFull:
                pass

    async def stream_events(
        self, *, connection_id: str
    ) -> AsyncIterator[dict[str, Any]]:
        queue = self._connections.get(connection_id)
        if queue is None:
            return
        while True:
            item = await queue.get()
            if item is None:
                break
            yield item

    async def heartbeat(self, *, connection_id: str) -> bool:
        queue = self._connections.get(connection_id)
        if queue is None:
            return False
        payload = {
            "event_type": "heartbeat",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        try:
            queue.put_nowait(payload)
            return True
        except asyncio.QueueFull:
            return False
