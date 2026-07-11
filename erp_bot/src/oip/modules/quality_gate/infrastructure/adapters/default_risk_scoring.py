"""Default risk scoring adapter."""

from __future__ import annotations

import uuid
from typing import Any

from ...application.ports.quality_gate_ports import RiskScoringPort
from ...domain.value_objects import FindingSeverity, QualityFinding, QualityRisk, QualityViolation


class DefaultRiskScoringAdapter(RiskScoringPort):
    async def score_risk(
        self,
        *,
        tenant_id: str,
        evaluation_id: str,
        findings: tuple[QualityFinding, ...],
        violations: tuple[QualityViolation, ...],
        context: dict[str, Any],
    ) -> QualityRisk:
        score = 0.0
        factors: list[str] = []
        for finding in findings:
            if finding.severity == FindingSeverity.WARNING:
                score += 0.05
                factors.append(f"warning:{finding.code}")
            elif finding.severity == FindingSeverity.ERROR:
                score += 0.2
                factors.append(f"error:{finding.code}")
            elif finding.severity == FindingSeverity.CRITICAL:
                score += 0.4
                factors.append(f"critical:{finding.code}")
        for violation in violations:
            if violation.blocking:
                score += 0.3
                factors.append(f"blocking:{violation.code}")
        if context.get("force_risk_escalation"):
            score = max(score, 0.85)
            factors.append("forced_escalation")
        score = min(1.0, score)
        level = "low"
        if score >= 0.75:
            level = "critical"
        elif score >= 0.5:
            level = "high"
        elif score >= 0.25:
            level = "medium"
        return QualityRisk(
            risk_id=str(uuid.uuid4()),
            evaluation_id=evaluation_id,
            score=score,
            level=level,
            factors=tuple(factors),
            escalated=score >= 0.75 or bool(context.get("force_risk_escalation")),
            metadata={"tenant_id": tenant_id},
        )
