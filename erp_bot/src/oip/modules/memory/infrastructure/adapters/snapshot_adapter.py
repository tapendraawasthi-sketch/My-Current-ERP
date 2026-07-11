"""Snapshot pointer adapter."""

from __future__ import annotations

from ...application.ports.memory_ports import SnapshotPort


class MemorySnapshotAdapter(SnapshotPort):
    def create_pointer(self, *, memory_id: str, sequence: int, payload_hash: str) -> str:
        return f"memory://{memory_id}/v{sequence}/{payload_hash[:16]}"
