"""Action Runtime outbound ports."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any

from .....integration.contracts.erp_commands import ErpCommandEnvelope
from .....integration.contracts.snapshots import ErpContextSnapshot as GatewaySnapshot, FiscalPeriodStatus
from ...domain.entities import ActionExecution
from ...domain.value_objects import (
    ActionApproval,
    ActionCapability,
    ActionCompensation,
    ActionPermission,
    ActionPolicy,
    ActionRuntimeType,
    ErpContextSnapshot,
)


class ERPCommandPort(ABC):
    @abstractmethod
    async def dispatch(self, command: ErpCommandEnvelope) -> dict[str, Any]: ...


class ERPQueryPort(ABC):
    @abstractmethod
    async def get_context_snapshot(
        self,
        *,
        tenant_id: str,
        company_id: str,
        branch_id: str | None,
        user_id: str,
    ) -> GatewaySnapshot: ...

    @abstractmethod
    async def is_period_open(
        self,
        *,
        tenant_id: str,
        company_id: str,
        branch_id: str | None,
        fiscal_period_id: str | None = None,
    ) -> FiscalPeriodStatus: ...


class ActionPolicyPort(ABC):
    @abstractmethod
    async def resolve_policy(
        self,
        *,
        tenant_id: str,
        action_type: ActionRuntimeType,
        payload: dict[str, Any],
    ) -> ActionPolicy: ...

    @abstractmethod
    async def validate(
        self,
        *,
        policy: ActionPolicy,
        action_type: ActionRuntimeType,
        payload: dict[str, Any],
        context: dict[str, Any],
    ) -> tuple[bool, str]: ...


class ApprovalPort(ABC):
    @abstractmethod
    async def determine_approvals(
        self,
        *,
        action: ActionExecution,
        policy: ActionPolicy,
        require_approval: bool,
    ) -> tuple[ActionApproval, ...]: ...

    @abstractmethod
    async def approve(
        self,
        *,
        action: ActionExecution,
        approver_id: str,
        role: str,
    ) -> tuple[ActionApproval, ...]: ...

    @abstractmethod
    async def reject(
        self,
        *,
        action: ActionExecution,
        approver_id: str,
        reason: str,
    ) -> tuple[ActionApproval, ...]: ...

    @abstractmethod
    async def all_approved(self, approvals: tuple[ActionApproval, ...]) -> bool: ...


class SnapshotPort(ABC):
    @abstractmethod
    async def capture(
        self,
        *,
        tenant_id: str,
        company_id: str,
        branch_id: str | None,
        user_id: str,
        ttl_seconds: int = 300,
    ) -> ErpContextSnapshot: ...

    @abstractmethod
    async def validate_snapshot(
        self,
        *,
        snapshot: ErpContextSnapshot,
        context: dict[str, Any],
    ) -> tuple[bool, str]: ...


class PermissionPort(ABC):
    @abstractmethod
    async def check_permission(
        self,
        *,
        tenant_id: str,
        user_id: str,
        action_type: ActionRuntimeType,
        company_id: str,
        branch_id: str | None,
        context: dict[str, Any],
    ) -> ActionPermission: ...


class ActionCapabilityTokenPort(ABC):
    @abstractmethod
    async def validate_capability(
        self,
        *,
        tenant_id: str,
        action_id: str,
        token_id: str | None,
        action_type: ActionRuntimeType,
        context: dict[str, Any],
    ) -> ActionCapability: ...


class CompensationPort(ABC):
    @abstractmethod
    async def create_reversal(
        self,
        *,
        action: ActionExecution,
        reason: str,
    ) -> ActionCompensation: ...

    @abstractmethod
    async def dispatch_reversal(
        self,
        *,
        compensation: ActionCompensation,
        original_action: ActionExecution,
        erp_command_port: ERPCommandPort,
    ) -> dict[str, Any]: ...
