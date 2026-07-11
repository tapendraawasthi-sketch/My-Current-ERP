"""Default evidence validation adapter."""

from __future__ import annotations

import hashlib
import uuid
from datetime import datetime, timezone
from typing import Any

from ....provider_runtime.domain.value_objects import ExecutionResult
from ...application.ports.quality_gate_ports import EvidenceValidationPort
from ...domain.value_objects import FindingSeverity, QualityEvidence, QualityFinding, QualityLevel, ViolationKind


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class DefaultEvidenceValidationAdapter(EvidenceValidationPort):
    async def validate_evidence(
        self,
        *,
        tenant_id: str,
        execution_result: ExecutionResult,
        context: dict[str, Any],
    ) -> tuple[QualityEvidence, ...]:
        findings: list[QualityFinding] = []
        eval_hint = context.get("evaluation_id", "pending")
        snapshot_version = str(context.get("snapshot_version", "1.0.0"))
        snapshot_age = float(context.get("snapshot_age_seconds", 0))
        ttl = int(context.get("snapshot_ttl_seconds", 300))
        content = execution_result.output_text or str(execution_result.output_json)
        content_hash = hashlib.sha256(content.encode()).hexdigest()
        expected_hash = context.get("expected_content_hash")
        evidence = QualityEvidence(
            evidence_id=str(uuid.uuid4()),
            evaluation_id=eval_hint,
            source=context.get("evidence_source", "erp_snapshot"),
            authority=context.get("evidence_authority", "erp"),
            content_hash=content_hash,
            snapshot_version=snapshot_version,
            effective_date=context.get("knowledge_effective_date"),
            ttl_seconds=ttl,
            age_seconds=snapshot_age,
            complete=not context.get("evidence_incomplete", False),
            verified=expected_hash is None or expected_hash == content_hash,
            metadata={"execution_id": execution_result.execution_id},
        )

        if context.get("snapshot_expired") or snapshot_age > ttl:
            findings.append(
                QualityFinding(
                    finding_id=str(uuid.uuid4()),
                    evaluation_id=eval_hint,
                    rule_id="l2.snapshot_ttl",
                    level=QualityLevel.L2,
                    severity=FindingSeverity.CRITICAL,
                    code="SNAPSHOT_EXPIRED",
                    message=f"ERP snapshot exceeded TTL ({snapshot_age}s > {ttl}s)",
                    violation_kind=ViolationKind.FRESHNESS,
                    metadata={"age_seconds": snapshot_age, "ttl_seconds": ttl},
                    created_at=_utc_now_iso(),
                )
            )
        if context.get("evidence_incomplete"):
            findings.append(
                QualityFinding(
                    finding_id=str(uuid.uuid4()),
                    evaluation_id=eval_hint,
                    rule_id="l2.evidence_completeness",
                    level=QualityLevel.L2,
                    severity=FindingSeverity.ERROR,
                    code="EVIDENCE_INCOMPLETE",
                    message="Evidence context is incomplete",
                    violation_kind=ViolationKind.EVIDENCE,
                    created_at=_utc_now_iso(),
                )
            )
        if expected_hash and expected_hash != content_hash:
            findings.append(
                QualityFinding(
                    finding_id=str(uuid.uuid4()),
                    evaluation_id=eval_hint,
                    rule_id="l2.hash_verification",
                    level=QualityLevel.L2,
                    severity=FindingSeverity.CRITICAL,
                    code="HASH_MISMATCH",
                    message="Evidence hash verification failed",
                    violation_kind=ViolationKind.HASH,
                    metadata={"expected": expected_hash, "actual": content_hash},
                    created_at=_utc_now_iso(),
                )
            )
        if context.get("knowledge_stale"):
            findings.append(
                QualityFinding(
                    finding_id=str(uuid.uuid4()),
                    evaluation_id=eval_hint,
                    rule_id="l2.knowledge_freshness",
                    level=QualityLevel.L2,
                    severity=FindingSeverity.WARNING,
                    code="KNOWLEDGE_STALE",
                    message="Knowledge base freshness below threshold",
                    violation_kind=ViolationKind.FRESHNESS,
                    created_at=_utc_now_iso(),
                )
            )
        return (evidence,), tuple(findings)
