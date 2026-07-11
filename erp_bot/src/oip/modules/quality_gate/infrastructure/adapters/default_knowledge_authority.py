"""Default knowledge authority validation adapter."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from ...application.ports.quality_gate_ports import KnowledgeAuthorityPort
from ...domain.value_objects import FindingSeverity, QualityEvidence, QualityFinding, QualityLevel, ViolationKind


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class DefaultKnowledgeAuthorityAdapter(KnowledgeAuthorityPort):
    async def validate_authority(
        self,
        *,
        tenant_id: str,
        evidence: tuple[QualityEvidence, ...],
        context: dict[str, Any],
    ) -> tuple[QualityFinding, ...]:
        findings: list[QualityFinding] = []
        eval_hint = context.get("evaluation_id", "pending")
        allowed_authorities = set(context.get("allowed_authorities", ("erp", "government", "internal")))
        for item in evidence:
            if item.authority not in allowed_authorities:
                findings.append(
                    QualityFinding(
                        finding_id=str(uuid.uuid4()),
                        evaluation_id=eval_hint,
                        rule_id="l2.knowledge_authority",
                        level=QualityLevel.L2,
                        severity=FindingSeverity.CRITICAL,
                        code="AUTHORITY_DENIED",
                        message=f"Knowledge authority not permitted: {item.authority}",
                        violation_kind=ViolationKind.AUTHORITY,
                        metadata={"authority": item.authority},
                        created_at=_utc_now_iso(),
                    )
                )
        if context.get("authority_violation"):
            findings.append(
                QualityFinding(
                    finding_id=str(uuid.uuid4()),
                    evaluation_id=eval_hint,
                    rule_id="l2.knowledge_authority",
                    level=QualityLevel.L2,
                    severity=FindingSeverity.CRITICAL,
                    code="AUTHORITY_VIOLATION",
                    message=str(context["authority_violation"]),
                    violation_kind=ViolationKind.AUTHORITY,
                    created_at=_utc_now_iso(),
                )
            )
        if context.get("knowledge_effective_date_invalid"):
            findings.append(
                QualityFinding(
                    finding_id=str(uuid.uuid4()),
                    evaluation_id=eval_hint,
                    rule_id="l2.knowledge_effective_date",
                    level=QualityLevel.L2,
                    severity=FindingSeverity.ERROR,
                    code="EFFECTIVE_DATE_INVALID",
                    message="Knowledge effective date is invalid or in the future",
                    violation_kind=ViolationKind.EVIDENCE,
                    created_at=_utc_now_iso(),
                )
            )
        return tuple(findings)
