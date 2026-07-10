"""Governance layer — audit, approvals, retention, versioning."""

from __future__ import annotations

from typing import Any

from .approvals import approval_engine
from .audit import audit_log
from .retention import retention_engine

PLATFORM_VERSION = "3.5.0"
CONTRACT_VERSION = "1.0"


class GovernanceEngine:
    def __init__(self) -> None:
        self.audit = audit_log
        self.approvals = approval_engine
        self.retention = retention_engine

    def gate_action(
        self,
        action_type: str,
        *,
        confidence: float = 1.0,
        actor_id: str | None = None,
        tenant_id: str | None = None,
        company_id: str | None = None,
        payload: dict | None = None,
    ) -> dict[str, Any]:
        """Check if action requires approval; always audit."""
        self.audit.record(
            f"action.{action_type}",
            actor_id=actor_id,
            tenant_id=tenant_id,
            company_id=company_id,
            resource_type=action_type,
            payload=payload,
            version=PLATFORM_VERSION,
        )
        if self.approvals.requires_approval(action_type, confidence=confidence):
            req = self.approvals.request(
                action_type,
                f"Approval required: {action_type}",
                requested_by=actor_id,
                tenant_id=tenant_id,
                company_id=company_id,
                payload=payload,
            )
            return {"allowed": False, "approval_id": req.id, "status": req.status.value}
        return {"allowed": True}

    def status(self) -> dict[str, Any]:
        return {
            "platform_version": PLATFORM_VERSION,
            "contract_version": CONTRACT_VERSION,
            "retention_policies": self.retention.list_policies(),
            "pending_approvals": len(self.approvals.list_pending()),
        }


governance_engine = GovernanceEngine()
