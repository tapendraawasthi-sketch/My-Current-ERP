"""WorkflowDSL — event-driven workflow definitions."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any


@dataclass
class WorkflowStep:
    id: str
    action: str
    capability: str
    deps: list[str] = field(default_factory=list)


@dataclass
class WorkflowDefinition:
    id: str
    trigger: str
    steps: list[WorkflowStep]


WORKFLOW_PATTERN = re.compile(
    r"WORKFLOW\s+(\w+)\s+ON\s+(\w+\.\w+)\s+(.*?)(?=WORKFLOW|\Z)",
    re.I | re.S,
)

STEP_PATTERN = re.compile(
    r"STEP\s+(\w+)\s*:\s*(\w+)\s+USING\s+([\w.]+)(?:\s+AFTER\s+([\w,\s]+))?",
    re.I,
)


def parse_workflows(text: str) -> list[WorkflowDefinition]:
    workflows: list[WorkflowDefinition] = []
    for m in WORKFLOW_PATTERN.finditer(text):
        wf_id = m.group(1)
        trigger = m.group(2)
        body = m.group(3)
        steps: list[WorkflowStep] = []
        for sm in STEP_PATTERN.finditer(body):
            deps = [d.strip() for d in (sm.group(4) or "").split(",") if d.strip()]
            steps.append(
                WorkflowStep(
                    id=sm.group(1),
                    action=sm.group(2),
                    capability=sm.group(3),
                    deps=deps,
                )
            )
        workflows.append(WorkflowDefinition(id=wf_id, trigger=trigger, steps=steps))
    return workflows


BOOTSTRAP_WORKFLOWS = parse_workflows(
    """
WORKFLOW invoice_posted ON voucher.posted
  STEP accrue_vat: calculate USING cap.tax.vat.calculate
  STEP update_ledger: post USING cap.engine.journal AFTER accrue_vat
  STEP notify: alert USING cap.notification.send AFTER update_ledger

WORKFLOW invoice_created ON invoice.created
  STEP validate: check USING cap.engine.journal
  STEP accrue_vat: calculate USING cap.tax.vat.calculate AFTER validate
"""
)


class WorkflowEngine:
    def __init__(self) -> None:
        self._workflows = {w.trigger: w for w in BOOTSTRAP_WORKFLOWS}
        self._handlers: dict[str, list] = {}

    def register_handler(self, event_type: str, handler) -> None:
        self._handlers.setdefault(event_type, []).append(handler)

    def dispatch_sync(self, event_type: str, payload: dict) -> list[dict]:
        results: list[dict] = []
        wf = self._workflows.get(event_type)
        if wf:
            for step in wf.steps:
                results.append({
                    "workflow": wf.id,
                    "step": step.id,
                    "action": step.action,
                    "capability": step.capability,
                    "status": "logged",
                    "payload_keys": list(payload.keys()),
                })

        for handler in self._handlers.get(event_type, []):
            try:
                out = handler(payload)
                results.append({"handler": handler.__name__, "result": out})
            except Exception as exc:
                results.append({"handler": getattr(handler, "__name__", "?"), "error": str(exc)})

        return results


workflow_engine = WorkflowEngine()
