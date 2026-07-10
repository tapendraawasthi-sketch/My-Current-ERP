"""Self-improvement loop — connects learning to platform evolution."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from .hierarchy import LearningHierarchy, learning_hierarchy
from ..intelligence.evaluator import EvalReport


@dataclass
class ImprovementAction:
    action_type: str
    target: str
    detail: str
    priority: int = 5


@dataclass
class SelfImprovementReport:
    session_id: str | None
    observations_recorded: int = 0
    patterns_detected: int = 0
    actions: list[ImprovementAction] = field(default_factory=list)


class SelfImprovementLoop:
    def __init__(self, hierarchy: LearningHierarchy | None = None) -> None:
        self.hierarchy = hierarchy or learning_hierarchy

    def record_chat_outcome(
        self,
        *,
        session_id: str,
        intent: str,
        confidence: float,
        engine: str,
        user_feedback: dict | None = None,
        eval_report: EvalReport | None = None,
    ) -> SelfImprovementReport:
        report = SelfImprovementReport(session_id=session_id)

        record = self.hierarchy.observe(
            "chat_outcome",
            {
                "intent": intent,
                "confidence": confidence,
                "engine": engine,
                "feedback": user_feedback or {},
                "eval_min_score": eval_report.min_score if eval_report else None,
            },
            session_id=session_id,
        )
        report.observations_recorded = 1
        if record.promoted_to:
            report.patterns_detected = 1
            if record.cluster_key:
                suggestion = self.hierarchy.suggest_capability_upgrade(record.cluster_key)
                if suggestion:
                    report.actions.append(
                        ImprovementAction(
                            action_type="capability_tune",
                            target=suggestion.get("cluster_key", ""),
                            detail=suggestion.get("recommended_action", ""),
                            priority=4,
                        )
                    )

        if confidence < 0.6:
            report.actions.append(
                ImprovementAction(
                    action_type="research_escalation",
                    target=intent,
                    detail="Low confidence answer — increase research iterations",
                    priority=7,
                )
            )

        if user_feedback and user_feedback.get("correction"):
            report.actions.append(
                ImprovementAction(
                    action_type="knowledge_ingest",
                    target=intent,
                    detail="User correction available for ontology ingest",
                    priority=8,
                )
            )
            self.hierarchy.promote_to_knowledge(
                f"correction:{intent}",
                {"correction": user_feedback["correction"], "intent": intent},
            )

        return report

    def to_dict(self, report: SelfImprovementReport) -> dict[str, Any]:
        return {
            "session_id": report.session_id,
            "observations_recorded": report.observations_recorded,
            "patterns_detected": report.patterns_detected,
            "actions": [
                {
                    "action_type": a.action_type,
                    "target": a.target,
                    "detail": a.detail,
                    "priority": a.priority,
                }
                for a in report.actions
            ],
        }


self_improvement_loop = SelfImprovementLoop()
