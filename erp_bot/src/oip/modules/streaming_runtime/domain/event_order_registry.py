"""Registry-based workflow event ordering — no switch statements."""

from __future__ import annotations

from dataclasses import dataclass

from .value_objects import WorkflowEventType


@dataclass(frozen=True)
class EventOrderRule:
    event_type: WorkflowEventType
    rank: int
    requires: tuple[WorkflowEventType, ...] = ()


class EventOrderRegistry:
    def __init__(self) -> None:
        self._rules: dict[str, EventOrderRule] = {}

    def register(self, rule: EventOrderRule) -> None:
        self._rules[rule.event_type.value] = rule

    def get(self, event_type: WorkflowEventType | str) -> EventOrderRule | None:
        key = event_type.value if isinstance(event_type, WorkflowEventType) else event_type
        return self._rules.get(key)

    def rank(self, event_type: WorkflowEventType) -> int:
        rule = self.get(event_type)
        return rule.rank if rule else 999

    def prerequisites_met(
        self,
        event_type: WorkflowEventType,
        seen: set[str],
    ) -> tuple[bool, tuple[str, ...]]:
        rule = self.get(event_type)
        if rule is None:
            return True, ()
        missing = tuple(req.value for req in rule.requires if req.value not in seen)
        return len(missing) == 0, missing


def create_default_event_order_registry() -> EventOrderRegistry:
    registry = EventOrderRegistry()
    rules = (
        EventOrderRule(WorkflowEventType.WORKFLOW_STARTED, 10, ()),
        EventOrderRule(WorkflowEventType.WORKFLOW_PROGRESS, 20, (WorkflowEventType.WORKFLOW_STARTED,)),
        EventOrderRule(WorkflowEventType.PROVIDER_CHUNK, 30, (WorkflowEventType.WORKFLOW_STARTED,)),
        EventOrderRule(WorkflowEventType.PROVIDER_COMPLETED, 40, (WorkflowEventType.WORKFLOW_STARTED,)),
        EventOrderRule(WorkflowEventType.QUALITY_STARTED, 50, (WorkflowEventType.PROVIDER_COMPLETED,)),
        EventOrderRule(WorkflowEventType.QUALITY_COMPLETED, 60, (WorkflowEventType.QUALITY_STARTED,)),
        EventOrderRule(WorkflowEventType.ACTION_PROPOSED, 70, (WorkflowEventType.QUALITY_COMPLETED,)),
        EventOrderRule(WorkflowEventType.ACTION_APPROVED, 75, (WorkflowEventType.ACTION_PROPOSED,)),
        EventOrderRule(WorkflowEventType.ACTION_REJECTED, 75, (WorkflowEventType.ACTION_PROPOSED,)),
        EventOrderRule(WorkflowEventType.ACTION_EXECUTED, 80, (WorkflowEventType.QUALITY_COMPLETED,)),
        EventOrderRule(WorkflowEventType.WORKFLOW_COMPLETED, 100, (WorkflowEventType.PROVIDER_COMPLETED,)),
        EventOrderRule(WorkflowEventType.WORKFLOW_FAILED, 100, (WorkflowEventType.WORKFLOW_STARTED,)),
        EventOrderRule(WorkflowEventType.HEARTBEAT, 5, ()),
    )
    for rule in rules:
        registry.register(rule)
    return registry
