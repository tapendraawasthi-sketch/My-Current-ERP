"""Composite replay buffer — memory front, persistent back."""

from __future__ import annotations

from ...application.ports.replay_buffer_port import ReplayBufferPort
from ...domain.value_objects import StreamEventRecord
from .memory_replay_buffer import MemoryReplayBufferAdapter
from .persistent_replay_buffer import PersistentReplayBufferAdapter


class CompositeReplayBufferAdapter(ReplayBufferPort):
    def __init__(
        self,
        memory: MemoryReplayBufferAdapter,
        persistent: PersistentReplayBufferAdapter,
    ) -> None:
        self._memory = memory
        self._persistent = persistent

    async def append(self, *, workflow_id: str, event: StreamEventRecord) -> None:
        await self._memory.append(workflow_id=workflow_id, event=event)
        await self._persistent.append(workflow_id=workflow_id, event=event)

    async def get_after_sequence(
        self, *, workflow_id: str, after_sequence: int, limit: int = 1000
    ) -> tuple[StreamEventRecord, ...]:
        mem = await self._memory.get_after_sequence(
            workflow_id=workflow_id, after_sequence=after_sequence, limit=limit
        )
        if mem:
            return mem
        return await self._persistent.get_after_sequence(
            workflow_id=workflow_id, after_sequence=after_sequence, limit=limit
        )

    async def trim(self, *, workflow_id: str, keep: int) -> int:
        m = await self._memory.trim(workflow_id=workflow_id, keep=keep)
        p = await self._persistent.trim(workflow_id=workflow_id, keep=keep)
        return m + p
