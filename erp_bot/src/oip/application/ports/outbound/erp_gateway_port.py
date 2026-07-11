"""ERP gateway port — ACL boundary to Orbix ERP Core (OEC)."""

from __future__ import annotations

from abc import ABC, abstractmethod

from ....integration.contracts.erp_commands import ErpCommandEnvelope
from ....integration.contracts.erp_events import ErpDomainEventEnvelope
from ....integration.contracts.snapshots import ErpContextSnapshot, FiscalPeriodStatus


class ErpGatewayPort(ABC):
    """Constitution: OIP never imports OEC internals — only integration contracts."""

    @abstractmethod
    async def get_context_snapshot(
        self,
        *,
        tenant_id: str,
        company_id: str,
        branch_id: str | None,
        user_id: str,
    ) -> ErpContextSnapshot:
        """Fetch point-in-time ERP context for grounding."""

    @abstractmethod
    async def is_period_open(
        self,
        *,
        tenant_id: str,
        company_id: str,
        branch_id: str | None,
        fiscal_period_id: str | None = None,
    ) -> FiscalPeriodStatus:
        """Synchronous fiscal guard before mutation actions (Constitution P0)."""

    @abstractmethod
    async def dispatch_command(self, command: ErpCommandEnvelope) -> dict:
        """Send idempotent command to OEC."""

    @abstractmethod
    async def publish_domain_event(self, event: ErpDomainEventEnvelope) -> None:
        """Optional: OIP → OEC event (rare)."""
