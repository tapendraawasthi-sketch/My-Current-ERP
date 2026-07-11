"""SQLite execution plan repository."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Sequence

import aiosqlite

from .....integration.contracts.execution_intent import ExecutionIntent
from ...application.ports.execution_plan_repository_port import ExecutionPlanRepositoryPort
from ...application.read_models.execution_plan_read_model import PlannerMetricsReadModel
from ...domain.entities import (
    ExecutionBudget,
    ExecutionConstraint,
    ExecutionGoal,
    ExecutionPlan,
    ExecutionStep,
)
from ...domain.value_objects import (
    ContextBudget,
    ExecutionMode,
    ExecutionPriority,
    ExecutionStepType,
    FallbackPolicy,
    PlanStatus,
    PlanningPolicyName,
    SkillRequirement,
    TaskProfile,
    ToolRequirement,
)


def _utc_today() -> str:
    return datetime.now(timezone.utc).date().isoformat()


def _serialize_goal(plan: ExecutionPlan) -> str:
    goal_data = plan.goal.model_dump(mode="json") if plan.goal else {}
    if plan.execution_intent:
        metadata = dict(goal_data.get("metadata") or {})
        metadata["execution_intent"] = plan.execution_intent.model_dump(mode="json")
        goal_data["metadata"] = metadata
    return json.dumps(goal_data)


def _load_execution_intent(goal_data: dict) -> ExecutionIntent | None:
    metadata = goal_data.get("metadata") or {}
    return ExecutionIntent.from_dict(metadata.get("execution_intent"))


class SqliteExecutionPlanRepositoryAdapter(ExecutionPlanRepositoryPort):
    def __init__(self, conn: aiosqlite.Connection) -> None:
        self._conn = conn

    async def save(self, plan: ExecutionPlan) -> None:
        await self._conn.execute(
            """
            INSERT INTO oip_execution_plans (
                plan_id, request_id, tenant_id, company_id, conversation_id, correlation_id,
                module, intent, execution_mode, priority, status, policy_name,
                estimated_tokens, estimated_latency_ms, estimated_cost_micros,
                knowledge_required, memory_required, tool_requirements_json, skills_json,
                stop_conditions_json, fallback_policy_json, goal_json, context_budget_json,
                created_at, updated_at, validated_at, expired_at, cancelled_at, archived_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(plan_id) DO UPDATE SET
                status = excluded.status,
                estimated_tokens = excluded.estimated_tokens,
                estimated_latency_ms = excluded.estimated_latency_ms,
                estimated_cost_micros = excluded.estimated_cost_micros,
                updated_at = excluded.updated_at,
                validated_at = excluded.validated_at,
                expired_at = excluded.expired_at,
                cancelled_at = excluded.cancelled_at,
                archived_at = excluded.archived_at
            """,
            (
                plan.plan_id,
                plan.request_id,
                plan.tenant_id,
                plan.company_id,
                plan.conversation_id,
                plan.correlation_id,
                plan.module,
                plan.intent,
                plan.execution_mode.value,
                plan.priority.value,
                plan.status.value,
                plan.policy_name.value,
                plan.estimated_tokens,
                plan.estimated_latency_ms,
                plan.estimated_cost_micros,
                int(plan.knowledge_required),
                int(plan.memory_required),
                json.dumps([t.model_dump(mode="json") for t in plan.tool_requirements]),
                json.dumps([s.model_dump(mode="json") for s in plan.skills]),
                json.dumps(list(plan.stop_conditions)),
                json.dumps(plan.fallback_policy.model_dump(mode="json")),
                _serialize_goal(plan),
                json.dumps(plan.context_budget.model_dump(mode="json")),
                plan.created_at.isoformat(),
                plan.updated_at.isoformat(),
                plan.validated_at.isoformat() if plan.validated_at else None,
                plan.expired_at.isoformat() if plan.expired_at else None,
                plan.cancelled_at.isoformat() if plan.cancelled_at else None,
                plan.archived_at.isoformat() if plan.archived_at else None,
            ),
        )

        await self._conn.execute("DELETE FROM oip_execution_steps WHERE plan_id = ?", (plan.plan_id,))
        for step in plan.steps:
            await self._conn.execute(
                """
                INSERT INTO oip_execution_steps (
                    step_id, plan_id, tenant_id, sequence_no, step_type, name,
                    payload_json, depends_on_json, estimated_tokens, estimated_latency_ms, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    step.step_id,
                    step.plan_id,
                    step.tenant_id,
                    step.sequence_no,
                    step.step_type.value,
                    step.name,
                    json.dumps(step.payload),
                    json.dumps(list(step.depends_on)),
                    step.estimated_tokens,
                    step.estimated_latency_ms,
                    step.created_at.isoformat(),
                ),
            )

        if plan.constraints:
            await self._conn.execute(
                "DELETE FROM oip_planning_constraints WHERE plan_id = ?",
                (plan.plan_id,),
            )
            c = plan.constraints
            await self._conn.execute(
                """
                INSERT INTO oip_planning_constraints (
                    constraint_id, plan_id, tenant_id, max_latency_ms, max_tokens, max_cost_micros,
                    offline_only, provider_restrictions_json, tool_restrictions_json,
                    knowledge_restrictions_json, fiscal_restrictions_json, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    c.constraint_id,
                    c.plan_id,
                    c.tenant_id,
                    c.max_latency_ms,
                    c.max_tokens,
                    c.max_cost_micros,
                    int(c.offline_only),
                    json.dumps(list(c.provider_restrictions)),
                    json.dumps(list(c.tool_restrictions)),
                    json.dumps(list(c.knowledge_restrictions)),
                    json.dumps(c.fiscal_restrictions),
                    c.created_at.isoformat(),
                ),
            )

        if plan.budget:
            await self._conn.execute(
                "DELETE FROM oip_execution_budgets WHERE plan_id = ?",
                (plan.plan_id,),
            )
            b = plan.budget
            cb = b.context_budget
            await self._conn.execute(
                """
                INSERT INTO oip_execution_budgets (
                    budget_id, plan_id, tenant_id, total_tokens, total_latency_ms, total_cost_micros,
                    erp_snapshot_tokens, knowledge_tokens, conversation_tokens, memory_tokens,
                    attachment_tokens, user_input_tokens, allocations_json, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    b.budget_id,
                    b.plan_id,
                    b.tenant_id,
                    b.total_tokens,
                    b.total_latency_ms,
                    b.total_cost_micros,
                    cb.erp_snapshot_tokens,
                    cb.knowledge_tokens,
                    cb.conversation_tokens,
                    cb.memory_tokens,
                    cb.attachment_tokens,
                    cb.user_input_tokens,
                    json.dumps(cb.allocations),
                    b.created_at.isoformat(),
                ),
            )

        await self._conn.commit()

    async def get_by_id(self, *, tenant_id: str, plan_id: str) -> ExecutionPlan | None:
        cursor = await self._conn.execute(
            "SELECT * FROM oip_execution_plans WHERE tenant_id = ? AND plan_id = ?",
            (tenant_id, plan_id),
        )
        row = await cursor.fetchone()
        if not row:
            return None
        steps = await self._load_steps(plan_id)
        constraints = await self._load_constraints(plan_id)
        budget = await self._load_budget(plan_id)
        return self._row_to_plan(row, steps, constraints, budget)

    async def search(
        self,
        *,
        tenant_id: str,
        company_id: str | None = None,
        conversation_id: str | None = None,
        request_id: str | None = None,
        status: PlanStatus | None = None,
        limit: int = 50,
    ) -> Sequence[ExecutionPlan]:
        clauses = ["tenant_id = ?"]
        params: list = [tenant_id]
        if company_id:
            clauses.append("company_id = ?")
            params.append(company_id)
        if conversation_id:
            clauses.append("conversation_id = ?")
            params.append(conversation_id)
        if request_id:
            clauses.append("request_id = ?")
            params.append(request_id)
        if status:
            clauses.append("status = ?")
            params.append(status.value)
        params.append(limit)
        sql = f"""
            SELECT * FROM oip_execution_plans
            WHERE {' AND '.join(clauses)}
            ORDER BY created_at DESC
            LIMIT ?
        """
        cursor = await self._conn.execute(sql, tuple(params))
        rows = await cursor.fetchall()
        plans: list[ExecutionPlan] = []
        for row in rows:
            plan_id = row["plan_id"]
            steps = await self._load_steps(plan_id)
            constraints = await self._load_constraints(plan_id)
            budget = await self._load_budget(plan_id)
            plans.append(self._row_to_plan(row, steps, constraints, budget))
        return plans

    async def increment_metrics(
        self,
        *,
        tenant_id: str,
        metric: str,
        estimated_latency_ms: int = 0,
        estimated_tokens: int = 0,
    ) -> None:
        metric_date = _utc_today()
        column_map = {
            "plans_created": "plans_created",
            "plans_validated": "plans_validated",
            "plans_cancelled": "plans_cancelled",
            "plans_expired": "plans_expired",
            "plans_archived": "plans_archived",
        }
        column = column_map.get(metric)
        if column is None:
            return
        await self._conn.execute(
            f"""
            INSERT INTO oip_planner_metrics (tenant_id, metric_date, {column})
            VALUES (?, ?, 1)
            ON CONFLICT(tenant_id, metric_date) DO UPDATE SET
                {column} = {column} + 1
            """,
            (tenant_id, metric_date),
        )
        if metric == "plans_created":
            await self._conn.execute(
                """
                UPDATE oip_planner_metrics
                SET avg_estimated_latency_ms = (
                        (avg_estimated_latency_ms * MAX(plans_created - 1, 0) + ?) /
                        MAX(plans_created, 1)
                    ),
                    avg_estimated_tokens = (
                        (avg_estimated_tokens * MAX(plans_created - 1, 0) + ?) /
                        MAX(plans_created, 1)
                    )
                WHERE tenant_id = ? AND metric_date = ?
                """,
                (float(estimated_latency_ms), float(estimated_tokens), tenant_id, metric_date),
            )
        await self._conn.commit()

    async def get_metrics(
        self,
        *,
        tenant_id: str,
        metric_date: str | None = None,
    ) -> PlannerMetricsReadModel:
        date = metric_date or _utc_today()
        cursor = await self._conn.execute(
            "SELECT * FROM oip_planner_metrics WHERE tenant_id = ? AND metric_date = ?",
            (tenant_id, date),
        )
        row = await cursor.fetchone()
        if not row:
            return PlannerMetricsReadModel(tenant_id=tenant_id, metric_date=date)
        return PlannerMetricsReadModel(
            tenant_id=row["tenant_id"],
            metric_date=row["metric_date"],
            plans_created=int(row["plans_created"]),
            plans_validated=int(row["plans_validated"]),
            plans_cancelled=int(row["plans_cancelled"]),
            plans_expired=int(row["plans_expired"]),
            plans_archived=int(row["plans_archived"]),
            avg_estimated_latency_ms=float(row["avg_estimated_latency_ms"]),
            avg_estimated_tokens=float(row["avg_estimated_tokens"]),
        )

    async def _load_steps(self, plan_id: str) -> tuple[ExecutionStep, ...]:
        cursor = await self._conn.execute(
            "SELECT * FROM oip_execution_steps WHERE plan_id = ? ORDER BY sequence_no ASC",
            (plan_id,),
        )
        rows = await cursor.fetchall()
        steps = []
        for row in rows:
            steps.append(
                ExecutionStep(
                    step_id=row["step_id"],
                    plan_id=row["plan_id"],
                    tenant_id=row["tenant_id"],
                    sequence_no=int(row["sequence_no"]),
                    step_type=ExecutionStepType(row["step_type"]),
                    name=row["name"],
                    payload=json.loads(row["payload_json"]),
                    depends_on=tuple(json.loads(row["depends_on_json"])),
                    estimated_tokens=int(row["estimated_tokens"]),
                    estimated_latency_ms=int(row["estimated_latency_ms"]),
                    created_at=datetime.fromisoformat(row["created_at"]),
                )
            )
        return tuple(steps)

    async def _load_constraints(self, plan_id: str) -> ExecutionConstraint | None:
        cursor = await self._conn.execute(
            "SELECT * FROM oip_planning_constraints WHERE plan_id = ? LIMIT 1",
            (plan_id,),
        )
        row = await cursor.fetchone()
        if not row:
            return None
        return ExecutionConstraint(
            constraint_id=row["constraint_id"],
            plan_id=row["plan_id"],
            tenant_id=row["tenant_id"],
            max_latency_ms=row["max_latency_ms"],
            max_tokens=row["max_tokens"],
            max_cost_micros=row["max_cost_micros"],
            offline_only=bool(row["offline_only"]),
            provider_restrictions=tuple(json.loads(row["provider_restrictions_json"])),
            tool_restrictions=tuple(json.loads(row["tool_restrictions_json"])),
            knowledge_restrictions=tuple(json.loads(row["knowledge_restrictions_json"])),
            fiscal_restrictions=json.loads(row["fiscal_restrictions_json"]),
            created_at=datetime.fromisoformat(row["created_at"]),
        )

    async def _load_budget(self, plan_id: str) -> ExecutionBudget | None:
        cursor = await self._conn.execute(
            "SELECT * FROM oip_execution_budgets WHERE plan_id = ? LIMIT 1",
            (plan_id,),
        )
        row = await cursor.fetchone()
        if not row:
            return None
        context_budget = ContextBudget(
            erp_snapshot_tokens=int(row["erp_snapshot_tokens"]),
            knowledge_tokens=int(row["knowledge_tokens"]),
            conversation_tokens=int(row["conversation_tokens"]),
            memory_tokens=int(row["memory_tokens"]),
            attachment_tokens=int(row["attachment_tokens"]),
            user_input_tokens=int(row["user_input_tokens"]),
            total_tokens=int(row["total_tokens"]),
            allocations=json.loads(row["allocations_json"]),
        )
        return ExecutionBudget(
            budget_id=row["budget_id"],
            plan_id=row["plan_id"],
            tenant_id=row["tenant_id"],
            total_tokens=int(row["total_tokens"]),
            total_latency_ms=int(row["total_latency_ms"]),
            total_cost_micros=int(row["total_cost_micros"]),
            context_budget=context_budget,
            created_at=datetime.fromisoformat(row["created_at"]),
        )

    @staticmethod
    def _row_to_plan(
        row: aiosqlite.Row,
        steps: tuple[ExecutionStep, ...],
        constraints: ExecutionConstraint | None,
        budget: ExecutionBudget | None,
    ) -> ExecutionPlan:
        goal_data = json.loads(row["goal_json"])
        goal = ExecutionGoal(**goal_data) if goal_data else ExecutionGoal(objective="unknown")
        task_profile = TaskProfile(intent=row["intent"], module=row["module"])
        return ExecutionPlan(
            plan_id=row["plan_id"],
            request_id=row["request_id"],
            tenant_id=row["tenant_id"],
            company_id=row["company_id"],
            conversation_id=row["conversation_id"],
            correlation_id=row["correlation_id"],
            module=row["module"],
            intent=row["intent"],
            execution_mode=ExecutionMode(row["execution_mode"]),
            priority=ExecutionPriority(row["priority"]),
            status=PlanStatus(row["status"]),
            policy_name=PlanningPolicyName(row["policy_name"]),
            task_profile=task_profile,
            goal=goal,
            estimated_tokens=int(row["estimated_tokens"]),
            estimated_latency_ms=int(row["estimated_latency_ms"]),
            estimated_cost_micros=int(row["estimated_cost_micros"]),
            knowledge_required=bool(row["knowledge_required"]),
            memory_required=bool(row["memory_required"]),
            tool_requirements=tuple(
                ToolRequirement(**item) for item in json.loads(row["tool_requirements_json"])
            ),
            skills=tuple(SkillRequirement(**item) for item in json.loads(row["skills_json"])),
            steps=steps,
            constraints=constraints,
            budget=budget,
            stop_conditions=tuple(json.loads(row["stop_conditions_json"])),
            fallback_policy=FallbackPolicy(**json.loads(row["fallback_policy_json"])),
            context_budget=ContextBudget(**json.loads(row["context_budget_json"])),
            execution_intent=_load_execution_intent(goal_data),
            created_at=datetime.fromisoformat(row["created_at"]),
            updated_at=datetime.fromisoformat(row["updated_at"]),
            validated_at=datetime.fromisoformat(row["validated_at"]) if row["validated_at"] else None,
            expired_at=datetime.fromisoformat(row["expired_at"]) if row["expired_at"] else None,
            cancelled_at=datetime.fromisoformat(row["cancelled_at"]) if row["cancelled_at"] else None,
            archived_at=datetime.fromisoformat(row["archived_at"]) if row["archived_at"] else None,
        )
