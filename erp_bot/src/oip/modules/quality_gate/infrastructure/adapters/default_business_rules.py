"""Default business rule validation adapter."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from ....provider_runtime.domain.value_objects import ExecutionResult
from ...application.ports.quality_gate_ports import BusinessRulePort
from ...domain.value_objects import FindingSeverity, QualityFinding, QualityLevel, ViolationKind


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class DefaultBusinessRuleAdapter(BusinessRulePort):
    async def validate_business_rules(
        self,
        *,
        tenant_id: str,
        company_id: str | None,
        execution_result: ExecutionResult,
        context: dict[str, Any],
    ) -> tuple[QualityFinding, ...]:
        findings: list[QualityFinding] = []
        eval_hint = context.get("evaluation_id", "pending")
        checks = (
            ("vat_violation", "l1.vat_rules", "VAT_RULE_VIOLATION", ViolationKind.BUSINESS_RULE),
            ("tds_violation", "l1.tds_rules", "TDS_RULE_VIOLATION", ViolationKind.BUSINESS_RULE),
            ("ssf_violation", "l1.ssf_rules", "SSF_RULE_VIOLATION", ViolationKind.BUSINESS_RULE),
            ("inventory_unavailable", "l1.inventory_availability", "INVENTORY_UNAVAILABLE", ViolationKind.BUSINESS_RULE),
            ("payroll_constraint", "l1.payroll_constraints", "PAYROLL_CONSTRAINT", ViolationKind.BUSINESS_RULE),
            ("approval_required", "l1.approval_matrix", "APPROVAL_REQUIRED", ViolationKind.POLICY),
            ("budget_exceeded", "l1.budget_limits", "BUDGET_EXCEEDED", ViolationKind.BUSINESS_RULE),
            ("accounting_policy_l1", "l1.accounting_policy", "ACCOUNTING_POLICY", ViolationKind.BUSINESS_RULE),
        )
        for ctx_key, rule_id, code, kind in checks:
            if context.get(ctx_key):
                severity = FindingSeverity.ERROR
                if ctx_key in ("approval_required",):
                    severity = FindingSeverity.WARNING
                findings.append(
                    QualityFinding(
                        finding_id=str(uuid.uuid4()),
                        evaluation_id=eval_hint,
                        rule_id=rule_id,
                        level=QualityLevel.L1,
                        severity=severity,
                        code=code,
                        message=str(context[ctx_key]) if not isinstance(context[ctx_key], bool) else code.replace("_", " ").title(),
                        violation_kind=kind,
                        created_at=_utc_now_iso(),
                    )
                )
        return tuple(findings)
