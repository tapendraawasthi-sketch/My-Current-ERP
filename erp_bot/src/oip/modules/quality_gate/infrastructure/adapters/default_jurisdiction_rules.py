"""Default jurisdiction rule validation adapter."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from ....provider_runtime.domain.value_objects import ExecutionResult
from ...application.ports.quality_gate_ports import JurisdictionRulePort
from ...domain.value_objects import FindingSeverity, QualityFinding, QualityLevel, ViolationKind


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class DefaultJurisdictionRuleAdapter(JurisdictionRulePort):
    async def validate_jurisdiction(
        self,
        *,
        tenant_id: str,
        company_id: str | None,
        jurisdiction: str | None,
        execution_result: ExecutionResult,
        context: dict[str, Any],
    ) -> tuple[QualityFinding, ...]:
        findings: list[QualityFinding] = []
        eval_hint = context.get("evaluation_id", "pending")
        if context.get("jurisdiction_violation"):
            findings.append(
                QualityFinding(
                    finding_id=str(uuid.uuid4()),
                    evaluation_id=eval_hint,
                    rule_id="l1.jurisdiction_rules",
                    level=QualityLevel.L1,
                    severity=FindingSeverity.ERROR,
                    code="JURISDICTION_VIOLATION",
                    message=str(context["jurisdiction_violation"]),
                    violation_kind=ViolationKind.POLICY,
                    metadata={"jurisdiction": jurisdiction or "default"},
                    created_at=_utc_now_iso(),
                )
            )
        return tuple(findings)
