"""SQLite action runtime repository."""

from __future__ import annotations

import json
from datetime import datetime, timezone

import aiosqlite

from ...application.ports.action_repository_port import ActionRepositoryPort
from ...application.read_models.action_runtime_read_models import ActionMetricsReadModel
from ...domain.entities import ActionExecution
from ...domain.value_objects import (
    ActionApproval,
    ActionCapability,
    ActionCompensation,
    ActionConfirmation,
    ActionEvidence,
    ActionExecutionBudget,
    ActionExecutionStatus,
    ActionFailure,
    ActionMaterialization,
    ActionPermission,
    ActionProposal,
    ActionResult,
    ActionRisk,
    ActionRuntimeType,
    ActionSnapshot,
    ApprovalRole,
    ApprovalStatus,
    ErpContextSnapshot,
    FailureKind,
)


def _utc_today() -> str:
    return datetime.now(timezone.utc).date().isoformat()


def _parse_dt(value: str | None):
    if not value:
        return None
    return datetime.fromisoformat(value)


class SqliteActionRepositoryAdapter(ActionRepositoryPort):
    def __init__(self, conn: aiosqlite.Connection) -> None:
        self._conn = conn

    async def save(self, action: ActionExecution) -> None:
        await self._conn.execute(
            """
            INSERT INTO oip_action_executions (
                action_id, execution_id, evaluation_id, route_id, plan_id, request_id,
                tenant_id, company_id, branch_id, conversation_id, correlation_id, user_id,
                status, action_type, quality_decision, idempotency_key, proposal_json,
                materialization_json, approvals_json, snapshot_json, evidence_json,
                permission_json, capability_json, budget_json, risk_json, confirmation_json,
                result_json, failure_json, compensation_json, payload_json, metadata_json,
                created_at, updated_at, approved_at, executed_at, cancelled_at, archived_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(action_id) DO UPDATE SET
                status = excluded.status,
                proposal_json = excluded.proposal_json,
                materialization_json = excluded.materialization_json,
                approvals_json = excluded.approvals_json,
                snapshot_json = excluded.snapshot_json,
                permission_json = excluded.permission_json,
                capability_json = excluded.capability_json,
                confirmation_json = excluded.confirmation_json,
                result_json = excluded.result_json,
                failure_json = excluded.failure_json,
                compensation_json = excluded.compensation_json,
                metadata_json = excluded.metadata_json,
                updated_at = excluded.updated_at,
                approved_at = excluded.approved_at,
                executed_at = excluded.executed_at,
                cancelled_at = excluded.cancelled_at,
                archived_at = excluded.archived_at
            """,
            (
                action.action_id,
                action.execution_id,
                action.evaluation_id,
                action.route_id,
                action.plan_id,
                action.request_id,
                action.tenant_id,
                action.company_id,
                action.branch_id,
                action.conversation_id,
                action.correlation_id,
                action.user_id,
                action.status.value,
                action.action_type.value,
                action.quality_decision,
                action.idempotency_key,
                json.dumps(action.proposal.model_dump(mode="json")) if action.proposal else None,
                json.dumps(action.materialization.model_dump(mode="json")) if action.materialization else None,
                json.dumps([a.model_dump(mode="json") for a in action.approvals]),
                json.dumps(action.snapshot.model_dump(mode="json")) if action.snapshot else None,
                json.dumps([e.model_dump(mode="json") for e in action.evidence]),
                json.dumps(action.permission.model_dump(mode="json")) if action.permission else None,
                json.dumps(action.capability.model_dump(mode="json")) if action.capability else None,
                json.dumps(action.budget.model_dump(mode="json")) if action.budget else None,
                json.dumps(action.risk.model_dump(mode="json")) if action.risk else None,
                json.dumps(action.confirmation.model_dump(mode="json")) if action.confirmation else None,
                json.dumps(action.result.model_dump(mode="json")) if action.result else None,
                json.dumps(action.failure.model_dump(mode="json")) if action.failure else None,
                json.dumps(action.compensation.model_dump(mode="json")) if action.compensation else None,
                json.dumps(action.payload),
                json.dumps(action.metadata),
                action.created_at.isoformat(),
                action.updated_at.isoformat(),
                action.approved_at.isoformat() if action.approved_at else None,
                action.executed_at.isoformat() if action.executed_at else None,
                action.cancelled_at.isoformat() if action.cancelled_at else None,
                action.archived_at.isoformat() if action.archived_at else None,
            ),
        )
        if action.proposal:
            p = action.proposal
            await self._conn.execute(
                """
                INSERT INTO oip_action_proposals (
                    proposal_id, action_id, tenant_id, execution_id, evaluation_id,
                    action_type, quality_decision, idempotency_key, payload_json, proposed_at, metadata_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(action_id) DO UPDATE SET payload_json = excluded.payload_json
                """,
                (
                    p.proposal_id, action.action_id, action.tenant_id, p.execution_id, p.evaluation_id,
                    p.action_type.value, p.quality_decision, p.idempotency_key,
                    json.dumps(p.payload), p.proposed_at, json.dumps(p.metadata),
                ),
            )
        await self._conn.execute("DELETE FROM oip_action_approvals WHERE action_id = ?", (action.action_id,))
        for approval in action.approvals:
            await self._conn.execute(
                """
                INSERT INTO oip_action_approvals (
                    approval_id, action_id, tenant_id, role, status, approver_id, reason, stage, decided_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    approval.approval_id, action.action_id, action.tenant_id, approval.role.value,
                    approval.status.value, approval.approver_id, approval.reason, approval.stage, approval.decided_at,
                ),
            )
        if action.confirmation:
            c = action.confirmation
            await self._conn.execute(
                """
                INSERT INTO oip_action_confirmations (
                    confirmation_id, action_id, tenant_id, erp_reference, erp_command_id, confirmed_at, payload_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(action_id) DO UPDATE SET erp_reference = excluded.erp_reference, payload_json = excluded.payload_json
                """,
                (
                    c.confirmation_id, action.action_id, action.tenant_id, c.erp_reference,
                    c.erp_command_id, c.confirmed_at, json.dumps(c.payload),
                ),
            )
        if action.snapshot:
            s = action.snapshot
            es = s.erp_snapshot
            await self._conn.execute(
                """
                INSERT INTO oip_action_snapshots (
                    action_snapshot_id, action_id, tenant_id, snapshot_id, version, content_hash,
                    captured_at, ttl_seconds, company_id, branch_id, fiscal_period_id, validated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    s.action_snapshot_id, action.action_id, action.tenant_id, es.snapshot_id, es.version,
                    es.content_hash, es.captured_at, es.ttl_seconds, es.company_id, es.branch_id,
                    es.fiscal_period_id, s.validated_at,
                ),
            )
        if action.compensation:
            comp = action.compensation
            await self._conn.execute(
                """
                INSERT INTO oip_action_compensations (
                    compensation_id, action_id, tenant_id, reversal_action_id, reversal_type, reason, erp_reference, compensated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    comp.compensation_id, action.action_id, action.tenant_id, comp.reversal_action_id,
                    comp.reversal_type.value, comp.reason, comp.erp_reference, comp.compensated_at,
                ),
            )
        await self._conn.commit()

    async def get_by_id(self, *, tenant_id: str, action_id: str) -> ActionExecution | None:
        cursor = await self._conn.execute(
            "SELECT * FROM oip_action_executions WHERE tenant_id = ? AND action_id = ?",
            (tenant_id, action_id),
        )
        row = await cursor.fetchone()
        return self._row_to_action(row) if row else None

    async def get_by_idempotency_key(self, *, tenant_id: str, idempotency_key: str) -> ActionExecution | None:
        cursor = await self._conn.execute(
            "SELECT * FROM oip_action_executions WHERE tenant_id = ? AND idempotency_key = ? ORDER BY created_at DESC LIMIT 1",
            (tenant_id, idempotency_key),
        )
        row = await cursor.fetchone()
        return self._row_to_action(row) if row else None

    async def search(
        self,
        *,
        tenant_id: str,
        execution_id: str | None = None,
        evaluation_id: str | None = None,
        request_id: str | None = None,
        status: str | None = None,
        limit: int = 50,
    ) -> tuple[ActionExecution, ...]:
        clauses = ["tenant_id = ?"]
        params: list = [tenant_id]
        if execution_id:
            clauses.append("execution_id = ?")
            params.append(execution_id)
        if evaluation_id:
            clauses.append("evaluation_id = ?")
            params.append(evaluation_id)
        if request_id:
            clauses.append("request_id = ?")
            params.append(request_id)
        if status:
            clauses.append("status = ?")
            params.append(status)
        params.append(limit)
        cursor = await self._conn.execute(
            f"SELECT * FROM oip_action_executions WHERE {' AND '.join(clauses)} ORDER BY created_at DESC LIMIT ?",
            params,
        )
        rows = await cursor.fetchall()
        return tuple(self._row_to_action(row) for row in rows)

    async def increment_metrics(self, *, tenant_id: str, metric: str) -> None:
        column_map = {
            "proposed": "actions_proposed",
            "executed": "actions_executed",
            "failed": "actions_failed",
            "rejected": "actions_rejected",
            "cancelled": "actions_cancelled",
            "compensated": "actions_compensated",
            "blocked": "actions_blocked",
            "idempotency_hit": "idempotency_hits",
        }
        column = column_map.get(metric, metric)
        await self._conn.execute(
            f"""
            INSERT INTO oip_action_metrics (tenant_id, metric_date, {column}) VALUES (?, ?, 1)
            ON CONFLICT(tenant_id, metric_date) DO UPDATE SET {column} = {column} + 1
            """,
            (tenant_id, _utc_today()),
        )
        await self._conn.commit()

    async def get_metrics(self, *, tenant_id: str, metric_date: str | None = None) -> ActionMetricsReadModel:
        date = metric_date or _utc_today()
        cursor = await self._conn.execute(
            "SELECT * FROM oip_action_metrics WHERE tenant_id = ? AND metric_date = ?",
            (tenant_id, date),
        )
        row = await cursor.fetchone()
        if row is None:
            return ActionMetricsReadModel(tenant_id=tenant_id, metric_date=date)
        return ActionMetricsReadModel(
            tenant_id=row[0], metric_date=row[1], actions_proposed=row[2], actions_executed=row[3],
            actions_failed=row[4], actions_rejected=row[5], actions_cancelled=row[6],
            actions_compensated=row[7], actions_blocked=row[8], idempotency_hits=row[9],
        )

    def _row_to_action(self, row) -> ActionExecution:
        cols = [
            "action_id", "execution_id", "evaluation_id", "route_id", "plan_id", "request_id",
            "tenant_id", "company_id", "branch_id", "conversation_id", "correlation_id", "user_id",
            "status", "action_type", "quality_decision", "idempotency_key", "proposal_json",
            "materialization_json", "approvals_json", "snapshot_json", "evidence_json",
            "permission_json", "capability_json", "budget_json", "risk_json", "confirmation_json",
            "result_json", "failure_json", "compensation_json", "payload_json", "metadata_json",
            "created_at", "updated_at", "approved_at", "executed_at", "cancelled_at", "archived_at",
        ]
        data = dict(zip(cols, row))
        proposal = None
        if data["proposal_json"]:
            p = json.loads(data["proposal_json"])
            proposal = ActionProposal(**{**p, "action_type": ActionRuntimeType(p["action_type"])})
        materialization = None
        if data["materialization_json"]:
            m = json.loads(data["materialization_json"])
            materialization = ActionMaterialization(**{**m, "action_type": ActionRuntimeType(m["action_type"])})
        approvals = tuple(
            ActionApproval(**{**a, "role": ApprovalRole(a["role"]), "status": ApprovalStatus(a["status"])})
            for a in json.loads(data["approvals_json"])
        )
        snapshot = None
        if data["snapshot_json"]:
            s = json.loads(data["snapshot_json"])
            es = ErpContextSnapshot(**s["erp_snapshot"])
            snapshot = ActionSnapshot(action_snapshot_id=s["action_snapshot_id"], action_id=s["action_id"], erp_snapshot=es, validated_at=s["validated_at"])
        return ActionExecution(
            action_id=data["action_id"],
            execution_id=data["execution_id"],
            evaluation_id=data["evaluation_id"],
            route_id=data["route_id"],
            plan_id=data["plan_id"],
            request_id=data["request_id"],
            tenant_id=data["tenant_id"],
            company_id=data["company_id"],
            branch_id=data["branch_id"],
            conversation_id=data["conversation_id"],
            correlation_id=data["correlation_id"],
            user_id=data["user_id"],
            status=ActionExecutionStatus(data["status"]),
            action_type=ActionRuntimeType(data["action_type"]),
            quality_decision=data["quality_decision"],
            idempotency_key=data["idempotency_key"],
            proposal=proposal,
            materialization=materialization,
            approvals=approvals,
            snapshot=snapshot,
            evidence=tuple(ActionEvidence(**e) for e in json.loads(data["evidence_json"])),
            permission=ActionPermission(**json.loads(data["permission_json"])) if data["permission_json"] else None,
            capability=ActionCapability(**json.loads(data["capability_json"])) if data["capability_json"] else None,
            budget=ActionExecutionBudget(**json.loads(data["budget_json"])) if data["budget_json"] else None,
            risk=ActionRisk(**json.loads(data["risk_json"])) if data["risk_json"] else None,
            confirmation=ActionConfirmation(**json.loads(data["confirmation_json"])) if data["confirmation_json"] else None,
            result=ActionResult(**json.loads(data["result_json"])) if data["result_json"] else None,
            failure=ActionFailure(**{**json.loads(data["failure_json"]), "kind": FailureKind(json.loads(data["failure_json"])["kind"])}) if data["failure_json"] else None,
            compensation=ActionCompensation(**{**json.loads(data["compensation_json"]), "reversal_type": ActionRuntimeType(json.loads(data["compensation_json"])["reversal_type"])}) if data["compensation_json"] else None,
            payload=json.loads(data["payload_json"] or "{}"),
            metadata=json.loads(data["metadata_json"] or "{}"),
            created_at=datetime.fromisoformat(data["created_at"]),
            updated_at=datetime.fromisoformat(data["updated_at"]),
            approved_at=_parse_dt(data["approved_at"]),
            executed_at=_parse_dt(data["executed_at"]),
            cancelled_at=_parse_dt(data["cancelled_at"]),
            archived_at=_parse_dt(data["archived_at"]),
        )
