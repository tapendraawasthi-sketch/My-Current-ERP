"""In-memory replay buffer adapter."""

from __future__ import annotations

from collections import defaultdict
from typing import DefaultDict

from ...application.ports.replay_buffer_port import ReplayBufferPort
from ...domain.value_objects import StreamEventRecord


class MemoryReplayBufferAdapter(ReplayBufferPort):
    def __init__(self) -> None:
        self._buffers: DefaultDict[str, list[StreamEventRecord]] = defaultdict(list)

    async def append(self, *, workflow_id: str, event: StreamEventRecord) -> None:
        buf = self._buffers[workflow_id]
        buf.append(event)
        buf.sort(key=lambda e: e.sequence)

    async def get_after_sequence(
        self, *, workflow_id: str, after_sequence: int, limit: int = 1000
    ) -> tuple[StreamEventRecord, ...]:
        events = [e for e in self._buffers.get(workflow_id, []) if e.sequence > after_sequence]
        return tuple(events[:limit])

    async def trim(self, *, workflow_id: str, keep: int) -> int:
        buf = self._buffers.get(workflow_id, [])
        if len(buf) <= keep:
            return 0
        removed = len(buf) - keep
        self._buffers[workflow_id] = buf[-keep:]
        return removed
