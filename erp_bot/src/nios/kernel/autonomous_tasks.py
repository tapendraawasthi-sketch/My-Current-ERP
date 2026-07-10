"""Autonomous Task Engine — monitor, schedule, notify, escalate."""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Any, Callable

from ..representations.world_state.engine import world_state_engine


class TaskStatus(str, Enum):
    PENDING = "pending"
    SCHEDULED = "scheduled"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    ESCALATED = "escalated"


@dataclass
class AutonomousTask:
    id: str
    task_type: str
    title: str
    status: TaskStatus
    priority: int = 5
    due_at: str | None = None
    payload: dict[str, Any] = field(default_factory=dict)
    result: dict[str, Any] = field(default_factory=dict)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class AutonomousTaskEngine:
    def __init__(self) -> None:
        self._tasks: dict[str, AutonomousTask] = {}
        self._monitors: list[Callable[[dict], list[AutonomousTask]]] = [
            self._monitor_vat_deadline,
            self._monitor_low_liquidity,
        ]

    def on_event(self, event_type: str, payload: dict) -> list[AutonomousTask]:
        spawned: list[AutonomousTask] = []
        if event_type == "invoice.created":
            task = self.schedule(
                "notify",
                "Review VAT impact of new invoice",
                payload={
                    "invoice_id": payload.get("invoiceId"),
                    "party": payload.get("partyName"),
                },
                priority=6,
            )
            spawned.append(task)
        return spawned

    def run_monitors(self, context: dict | None = None) -> list[AutonomousTask]:
        ctx = context or {}
        spawned: list[AutonomousTask] = []
        for monitor in self._monitors:
            spawned.extend(monitor(ctx))
        return spawned

    def schedule(
        self,
        task_type: str,
        title: str,
        *,
        payload: dict | None = None,
        priority: int = 5,
        due_in_days: int | None = None,
    ) -> AutonomousTask:
        task_id = str(uuid.uuid4())
        due_at = None
        if due_in_days is not None:
            due_at = (datetime.now(timezone.utc) + timedelta(days=due_in_days)).isoformat()
        task = AutonomousTask(
            id=task_id,
            task_type=task_type,
            title=title,
            status=TaskStatus.SCHEDULED if due_at else TaskStatus.PENDING,
            priority=priority,
            due_at=due_at,
            payload=payload or {},
        )
        self._tasks[task_id] = task
        return task

    def list_tasks(self, status: TaskStatus | None = None) -> list[AutonomousTask]:
        tasks = list(self._tasks.values())
        if status:
            tasks = [t for t in tasks if t.status == status]
        return sorted(tasks, key=lambda t: (-t.priority, t.due_at or ""))

    def escalate(self, task_id: str, reason: str) -> AutonomousTask | None:
        task = self._tasks.get(task_id)
        if not task:
            return None
        task.status = TaskStatus.ESCALATED
        task.result = {"reason": reason, "escalated_at": _now()}
        return task

    def _monitor_vat_deadline(self, context: dict) -> list[AutonomousTask]:
        ws = world_state_engine.query(
            intent="tax_query",
            balance=context.get("balance"),
            tenant_id=context.get("tenant_id"),
            company_id=context.get("company_id"),
        )
        if ws.summary.get("filing_status") != "pending_review":
            return []
        return [
            self.schedule(
                "compliance",
                "VAT filing deadline approaching — review pending return",
                payload={"filing_status": "pending_review"},
                priority=8,
                due_in_days=7,
            )
        ]

    def _monitor_low_liquidity(self, context: dict) -> list[AutonomousTask]:
        ws = world_state_engine.query(intent="ledger_query", balance=context.get("balance"))
        liquidity = ws.summary.get("liquidity")
        if liquidity is None or liquidity >= 50_000:
            return []
        return [
            self.schedule(
                "alert",
                f"Low liquidity alert: Rs. {liquidity:,.0f}",
                payload={"liquidity": liquidity},
                priority=9,
            )
        ]


autonomous_task_engine = AutonomousTaskEngine()
