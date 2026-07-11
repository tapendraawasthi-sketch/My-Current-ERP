"""Action Runtime projectors."""

from __future__ import annotations

from ...domain.entities import ActionExecution
from ..read_models.action_runtime_read_models import ActionExecutionReadModel, ActionMetricsReadModel


class ActionExecutionProjector:
    def project(self, action: ActionExecution | None) -> ActionExecutionReadModel | None:
        if action is None:
            return None
        pending = any(a.status.value == "pending" for a in action.approvals)
        return ActionExecutionReadModel(
            action_id=action.action_id,
            execution_id=action.execution_id,
            evaluation_id=action.evaluation_id,
            route_id=action.route_id,
            plan_id=action.plan_id,
            request_id=action.request_id,
            tenant_id=action.tenant_id,
            company_id=action.company_id,
            branch_id=action.branch_id,
            conversation_id=action.conversation_id,
            correlation_id=action.correlation_id,
            user_id=action.user_id,
            status=action.status.value,
            action_type=action.action_type.value,
            quality_decision=action.quality_decision,
            idempotency_key=action.idempotency_key,
            erp_reference=action.confirmation.erp_reference if action.confirmation else None,
            success=action.result.success if action.result else None,
            failure_kind=action.failure.kind.value if action.failure else None,
            approval_pending=pending,
            compensated=action.compensation is not None,
            created_at=action.created_at.isoformat(),
            updated_at=action.updated_at.isoformat(),
            executed_at=action.executed_at.isoformat() if action.executed_at else None,
        )


class ActionMetricsProjector:
    def project(self, metrics: ActionMetricsReadModel) -> ActionMetricsReadModel:
        return metrics
