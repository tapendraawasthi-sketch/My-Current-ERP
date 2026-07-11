"""Default approval adapter — multi-stage support."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from ...application.ports.action_runtime_ports import ApprovalPort
from ...domain.entities import ActionExecution
from ...domain.value_objects import ActionApproval, ActionPolicy, ApprovalRole, ApprovalStatus


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class DefaultApprovalAdapter(ApprovalPort):
    async def determine_approvals(
        self,
        *,
        action: ActionExecution,
        policy: ActionPolicy,
        require_approval: bool,
    ) -> tuple[ActionApproval, ...]:
        if not require_approval:
            return (
                ActionApproval(
                    approval_id=str(uuid.uuid4()),
                    action_id=action.action_id,
                    role=ApprovalRole.AUTOMATIC,
                    status=ApprovalStatus.APPROVED,
                    approver_id="system",
                    decided_at=_utc_now_iso(),
                ),
            )
        roles = policy.approval_roles or ("manager",)
        return tuple(
            ActionApproval(
                approval_id=str(uuid.uuid4()),
                action_id=action.action_id,
                role=ApprovalRole(role) if role in ApprovalRole._value2member_map_ else ApprovalRole.MANAGER,
                status=ApprovalStatus.PENDING,
                stage=idx + 1,
            )
            for idx, role in enumerate(roles)
        )

    async def approve(
        self,
        *,
        action: ActionExecution,
        approver_id: str,
        role: str,
    ) -> tuple[ActionApproval, ...]:
        updated: list[ActionApproval] = []
        for approval in action.approvals:
            if approval.status == ApprovalStatus.PENDING and (
                approval.role.value == role or role == "administrator"
            ):
                updated.append(
                    approval.model_copy(
                        update={
                            "status": ApprovalStatus.APPROVED,
                            "approver_id": approver_id,
                            "decided_at": _utc_now_iso(),
                        }
                    )
                )
            else:
                updated.append(approval)
        if not updated:
            updated.append(
                ActionApproval(
                    approval_id=str(uuid.uuid4()),
                    action_id=action.action_id,
                    role=ApprovalRole.MANAGER,
                    status=ApprovalStatus.APPROVED,
                    approver_id=approver_id,
                    decided_at=_utc_now_iso(),
                )
            )
        return tuple(updated)

    async def reject(
        self,
        *,
        action: ActionExecution,
        approver_id: str,
        reason: str,
    ) -> tuple[ActionApproval, ...]:
        return tuple(
            approval.model_copy(
                update={
                    "status": ApprovalStatus.REJECTED,
                    "approver_id": approver_id,
                    "reason": reason,
                    "decided_at": _utc_now_iso(),
                }
            )
            for approval in (action.approvals or (
                ActionApproval(
                    approval_id=str(uuid.uuid4()),
                    action_id=action.action_id,
                    role=ApprovalRole.MANAGER,
                    status=ApprovalStatus.PENDING,
                ),
            ))
        )

    async def all_approved(self, approvals: tuple[ActionApproval, ...]) -> bool:
        if not approvals:
            return True
        return all(a.status == ApprovalStatus.APPROVED for a in approvals)
