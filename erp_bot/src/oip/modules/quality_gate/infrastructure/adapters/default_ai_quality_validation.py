"""Default AI quality validation adapter — provider-independent, optional L3."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from ....provider_runtime.domain.value_objects import ExecutionResult
from ...application.ports.quality_gate_ports import AIQualityValidationPort
from ...domain.value_objects import FindingSeverity, QualityFinding, QualityLevel, ViolationKind


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class DefaultAIQualityValidationAdapter(AIQualityValidationPort):
    async def validate_ai_quality(
        self,
        *,
        tenant_id: str,
        execution_result: ExecutionResult,
        context: dict[str, Any],
    ) -> tuple[QualityFinding, ...]:
        findings: list[QualityFinding] = []
        eval_hint = context.get("evaluation_id", "pending")
        checks = (
            ("ai_hallucination", "l3.hallucination_detection", "HALLUCINATION_DETECTED", FindingSeverity.ERROR),
            ("ai_inconsistent", "l3.consistency", "INCONSISTENT_RESPONSE", FindingSeverity.WARNING),
            ("ai_incomplete_reasoning", "l3.reasoning_completeness", "INCOMPLETE_REASONING", FindingSeverity.WARNING),
            ("ai_tool_disagreement", "l3.tool_result_agreement", "TOOL_RESULT_DISAGREEMENT", FindingSeverity.ERROR),
            ("ai_low_confidence", "l3.response_confidence", "LOW_CONFIDENCE", FindingSeverity.WARNING),
        )
        for ctx_key, rule_id, code, severity in checks:
            if context.get(ctx_key):
                findings.append(
                    QualityFinding(
                        finding_id=str(uuid.uuid4()),
                        evaluation_id=eval_hint,
                        rule_id=rule_id,
                        level=QualityLevel.L3,
                        severity=severity,
                        code=code,
                        message=str(context[ctx_key]) if not isinstance(context[ctx_key], bool) else code.replace("_", " ").title(),
                        violation_kind=ViolationKind.AI_QUALITY,
                        created_at=_utc_now_iso(),
                    )
                )
        if not execution_result.success and not context.get("skip_ai_on_failure"):
            findings.append(
                QualityFinding(
                    finding_id=str(uuid.uuid4()),
                    evaluation_id=eval_hint,
                    rule_id="l3.execution_success",
                    level=QualityLevel.L3,
                    severity=FindingSeverity.WARNING,
                    code="EXECUTION_NOT_SUCCESSFUL",
                    message="Execution result was not successful",
                    violation_kind=ViolationKind.AI_QUALITY,
                    created_at=_utc_now_iso(),
                )
            )
        return tuple(findings)
