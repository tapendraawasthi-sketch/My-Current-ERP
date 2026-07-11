"""Registry-based streaming transport selection — no switch statements."""

from __future__ import annotations

from typing import Protocol

from .value_objects import StreamProtocol


class StreamingTransport(Protocol):
    protocol: StreamProtocol

    async def connect(self, *, stream_id: str, client_id: str) -> str: ...

    async def publish(self, *, connection_id: str, event_data: dict) -> bool: ...

    async def disconnect(self, *, connection_id: str) -> None: ...

    async def heartbeat(self, *, connection_id: str) -> bool: ...


class StreamingTransportRegistry:
    def __init__(self) -> None:
        self._transports: dict[str, StreamingTransport] = {}

    def register(self, transport: StreamingTransport) -> None:
        self._transports[transport.protocol.value] = transport

    def get(self, protocol: StreamProtocol | str) -> StreamingTransport | None:
        key = protocol.value if isinstance(protocol, StreamProtocol) else protocol
        return self._transports.get(key)

    def resolve(self, preference: str) -> StreamingTransport | None:
        if preference == "auto":
            return self._transports.get(StreamProtocol.SSE.value) or next(iter(self._transports.values()), None)
        return self.get(preference)

    def list_protocols(self) -> tuple[str, ...]:
        return tuple(sorted(self._transports.keys()))
