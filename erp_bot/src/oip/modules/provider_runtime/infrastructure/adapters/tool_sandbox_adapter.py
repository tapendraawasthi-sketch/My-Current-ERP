"""Tool sandbox adapter — capability token required."""

from __future__ import annotations

import uuid

from ...application.ports.execution_ports import ToolSandboxPort
from ...domain.value_objects import CapabilityToken, FailureKind


class DefaultToolSandboxAdapter(ToolSandboxPort):
    def __init__(self, token_port) -> None:
        self._tokens = token_port
        self._sandboxes: dict[str, tuple[str, ...]] = {}
        self._call_counts: dict[str, int] = {}

    async def create_sandbox(
        self,
        *,
        execution_id: str,
        token: CapabilityToken,
        allowed_tools: tuple[str, ...],
    ) -> str:
        if not await self._tokens.validate(token=token):
            raise PermissionError(FailureKind.CAPABILITY_INVALID.value)
        sandbox_id = str(uuid.uuid4())
        permitted = tuple(t for t in allowed_tools if t in token.allowed_tools or not token.allowed_tools)
        self._sandboxes[sandbox_id] = permitted
        self._call_counts[sandbox_id] = 0
        return sandbox_id

    async def invoke_tool(
        self,
        *,
        sandbox_id: str,
        token: CapabilityToken,
        tool_id: str,
        payload: dict,
    ) -> dict:
        if not await self._tokens.validate(token=token):
            raise PermissionError(FailureKind.CAPABILITY_INVALID.value)
        allowed = self._sandboxes.get(sandbox_id, ())
        if allowed and tool_id not in allowed:
            raise PermissionError(FailureKind.TOOL_DENIED.value)
        count = self._call_counts.get(sandbox_id, 0) + 1
        if count > token.maximum_calls:
            raise PermissionError(FailureKind.TOOL_DENIED.value)
        self._call_counts[sandbox_id] = count
        return {"tool_id": tool_id, "result": "ok", "payload": payload}
