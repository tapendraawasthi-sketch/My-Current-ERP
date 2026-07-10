"""Governance approvals — human-in-the-loop for high-risk actions."""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any


class ApprovalStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    EXPIRED = "expired"


@dataclass
class ApprovalRequest:
    id: str
    action_type: str
    title: str
    status: ApprovalStatus
    requested_by: str | None
    tenant_id: str | None
    company_id: str | None
    payload: dict[str, Any] = field(default_factory=dict)
    created_at: str = ""
    decided_at: str | None = None
    decided_by: str | None = None
    reason: str | None = None


HIGH_RISK_ACTIONS = {
    "cap.knowledge.nepal.search",
    "workflow.tax.monthly_vat",
    "cap.autonomous.task",
    "invoice.post",
    "payroll.run",
}


class ApprovalEngine:
    def __init__(self) -> None:
        self._requests: dict[str, ApprovalRequest] = {}

    def requires_approval(self, action_type: str, *, confidence: float = 1.0) -> bool:
        if action_type in HIGH_RISK_ACTIONS:
            return True
        return confidence < 0.7

    def request(
        self,
        action_type: str,
        title: str,
        *,
        requested_by: str | None = None,
        tenant_id: str | None = None,
        company_id: str | None = None,
        payload: dict | None = None,
    ) -> ApprovalRequest:
        req_id = str(uuid.uuid4())
        req = ApprovalRequest(
            id=req_id,
            action_type=action_type,
            title=title,
            status=ApprovalStatus.PENDING,
            requested_by=requested_by,
            tenant_id=tenant_id,
            company_id=company_id,
            payload=payload or {},
            created_at=datetime.now(timezone.utc).isoformat(),
        )
        self._requests[req_id] = req
        return req

    def decide(
        self,
        request_id: str,
        *,
        approved: bool,
        decided_by: str,
        reason: str | None = None,
    ) -> ApprovalRequest | None:
        req = self._requests.get(request_id)
        if not req or req.status != ApprovalStatus.PENDING:
            return None
        req.status = ApprovalStatus.APPROVED if approved else ApprovalStatus.REJECTED
        req.decided_at = datetime.now(timezone.utc).isoformat()
        req.decided_by = decided_by
        req.reason = reason
        return req

    def list_pending(self, tenant_id: str | None = None) -> list[ApprovalRequest]:
        items = [r for r in self._requests.values() if r.status == ApprovalStatus.PENDING]
        if tenant_id:
            items = [r for r in items if r.tenant_id == tenant_id]
        return sorted(items, key=lambda r: r.created_at, reverse=True)


approval_engine = ApprovalEngine()
