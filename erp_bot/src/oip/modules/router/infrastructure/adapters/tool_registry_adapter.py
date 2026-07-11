"""Tool registry port adapter."""

from __future__ import annotations

from typing import Any

from ...application.ports.routing_ports import ToolRegistryPort
from .execution_tool_registry import ExecutionToolRegistry


class ExecutionToolRegistryAdapter(ToolRegistryPort):
    def __init__(self, registry: ExecutionToolRegistry) -> None:
        self._registry = registry

    def resolve_tools(self, *, tool_ids: tuple[str, ...]) -> tuple[dict[str, Any], ...]:
        resolved: list[dict[str, Any]] = []
        for tool_id in tool_ids:
            meta = self._registry.get(tool_id)
            if meta is None:
                continue
            resolved.append(
                {
                    "tool_id": meta.tool_id,
                    "category": meta.category,
                    "offline_capable": meta.offline_capable,
                    "requires_provider": meta.requires_provider,
                }
            )
        return tuple(resolved)
