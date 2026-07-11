"""Registry-backed composite streaming transport port."""

from __future__ import annotations

from typing import Any, AsyncIterator

from ...application.ports.streaming_runtime_ports import StreamingTransportPort
from ...domain.transport_registry import StreamingTransportRegistry
from ...domain.value_objects import StreamEventRecord, StreamProtocol
from .sse_transport import SSETransportAdapter
from .websocket_transport import WebSocketTransportAdapter


class RegistryStreamingTransportPort(StreamingTransportPort):
    """Routes transport operations through registry-selected adapter."""

    def __init__(
        self,
        registry: StreamingTransportRegistry,
        *,
        default_protocol: str = "auto",
    ) -> None:
        self._registry = registry
        self._default = default_protocol
        self._connection_protocol: dict[str, StreamProtocol] = {}

    def _resolve(self, protocol: StreamProtocol) -> StreamingTransportPort | None:
        adapter = self._registry.get(protocol)
        return adapter  # type: ignore[return-value]

    async def connect(
        self, *, stream_id: str, client_id: str, protocol: StreamProtocol
    ) -> str:
        adapter = self._resolve(protocol)
        if adapter is None:
            adapter = self._registry.resolve(self._default)
        if adapter is None:
            raise ValueError("No streaming transport registered")
        connection_id = await adapter.connect(
            stream_id=stream_id, client_id=client_id, protocol=protocol
        )
        self._connection_protocol[connection_id] = protocol
        return connection_id

    def _adapter_for(self, connection_id: str) -> StreamingTransportPort | None:
        protocol = self._connection_protocol.get(connection_id, StreamProtocol.SSE)
        return self._resolve(protocol)

    async def publish(self, *, connection_id: str, event: StreamEventRecord) -> bool:
        adapter = self._adapter_for(connection_id)
        if adapter is None:
            return False
        return await adapter.publish(connection_id=connection_id, event=event)

    async def disconnect(self, *, connection_id: str) -> None:
        adapter = self._adapter_for(connection_id)
        if adapter:
            await adapter.disconnect(connection_id=connection_id)
        self._connection_protocol.pop(connection_id, None)

    async def stream_events(
        self, *, connection_id: str
    ) -> AsyncIterator[dict[str, Any]]:
        adapter = self._adapter_for(connection_id)
        if adapter is None:
            return
        async for item in adapter.stream_events(connection_id=connection_id):
            yield item


def create_default_transport_registry() -> StreamingTransportRegistry:
    registry = StreamingTransportRegistry()
    registry.register(SSETransportAdapter())  # type: ignore[arg-type]
    registry.register(WebSocketTransportAdapter())  # type: ignore[arg-type]
    return registry
