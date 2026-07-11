"""ERP command adapter — delegates to OEC Runtime (sole mutation path)."""

from __future__ import annotations

from typing import Any

from .....integration.contracts.erp_commands import ErpCommandEnvelope
from ...application.ports.action_runtime_ports import ERPCommandPort
from ....oec_runtime.application.services.oec_runtime_service import OecRuntimeService


class ErpCommandAdapter(ERPCommandPort):
    def __init__(self, oec_runtime: OecRuntimeService) -> None:
        self._oec = oec_runtime

    async def dispatch(self, command: ErpCommandEnvelope) -> dict[str, Any]:
        response = await self._oec.dispatch_envelope(command)
        return {
            **response,
            "erp_reference": response.get("erp_reference") or f"erp-{command.command_id[:8]}",
            "command_id": response.get("command_id", command.command_id),
        }
