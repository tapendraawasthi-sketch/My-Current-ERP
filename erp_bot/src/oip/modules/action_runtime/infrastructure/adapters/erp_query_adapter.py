"""ERP query adapter — delegates reads to OEC Runtime."""

from __future__ import annotations

from .....integration.contracts.snapshots import ErpContextSnapshot, FiscalPeriodStatus
from ...application.ports.action_runtime_ports import ERPQueryPort
from ....oec_runtime.application.services.oec_runtime_service import OecRuntimeService


class ErpQueryAdapter(ERPQueryPort):
    def __init__(self, oec_runtime: OecRuntimeService) -> None:
        self._oec = oec_runtime
        self._forced_closed: set[str] = set()

    def force_period_closed(self, tenant_id: str, company_id: str) -> None:
        self._forced_closed.add(f"{tenant_id}:{company_id}")

    async def get_context_snapshot(
        self,
        *,
        tenant_id: str,
        company_id: str,
        branch_id: str | None,
        user_id: str,
    ) -> ErpContextSnapshot:
        return await self._oec.get_context_snapshot(
            tenant_id=tenant_id,
            company_id=company_id,
            branch_id=branch_id,
            user_id=user_id,
        )

    async def is_period_open(
        self,
        *,
        tenant_id: str,
        company_id: str,
        branch_id: str | None,
        fiscal_period_id: str | None = None,
    ) -> FiscalPeriodStatus:
        key = f"{tenant_id}:{company_id}"
        if key in self._forced_closed:
            return FiscalPeriodStatus(is_open=False, fiscal_period_id=fiscal_period_id, reason="forced_closed")
        return await self._oec.is_period_open(
            tenant_id=tenant_id,
            company_id=company_id,
            branch_id=branch_id,
            fiscal_period_id=fiscal_period_id,
        )
