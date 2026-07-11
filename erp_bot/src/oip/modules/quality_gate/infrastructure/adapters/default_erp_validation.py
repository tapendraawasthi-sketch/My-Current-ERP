"""Default ERP L0 validation adapter."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from ....provider_runtime.domain.value_objects import ExecutionResult
from ...application.ports.quality_gate_ports import ERPValidationPort
from ...domain.value_objects import FindingSeverity, QualityFinding, QualityLevel, ViolationKind


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _finding(
    *,
    evaluation_hint: str,
    rule_id: str,
    code: str,
    message: str,
    severity: FindingSeverity,
    field_path: str | None = None,
) -> QualityFinding:
    return QualityFinding(
        finding_id=str(uuid.uuid4()),
        evaluation_id=evaluation_hint,
        rule_id=rule_id,
        level=QualityLevel.L0,
        severity=severity,
        code=code,
        message=message,
        field_path=field_path,
        violation_kind=ViolationKind.SCHEMA,
        created_at=_utc_now_iso(),
    )


class DefaultERPValidationAdapter(ERPValidationPort):
    async def validate_l0(
        self,
        *,
        tenant_id: str,
        company_id: str | None,
        branch_id: str | None,
        execution_result: ExecutionResult,
        context: dict[str, Any],
    ) -> tuple[QualityFinding, ...]:
        findings: list[QualityFinding] = []
        eval_hint = context.get("evaluation_id", "pending")

        if not tenant_id:
            findings.append(
                _finding(
                    evaluation_hint=eval_hint,
                    rule_id="l0.tenant_exists",
                    code="TENANT_MISSING",
                    message="Tenant does not exist",
                    severity=FindingSeverity.CRITICAL,
                )
            )
        if context.get("company_missing"):
            findings.append(
                _finding(
                    evaluation_hint=eval_hint,
                    rule_id="l0.company_exists",
                    code="COMPANY_MISSING",
                    message="Company does not exist",
                    severity=FindingSeverity.CRITICAL,
                )
            )
        elif company_id is None and context.get("require_company"):
            findings.append(
                _finding(
                    evaluation_hint=eval_hint,
                    rule_id="l0.company_exists",
                    code="COMPANY_REQUIRED",
                    message="Company reference is required",
                    severity=FindingSeverity.ERROR,
                )
            )
        if context.get("branch_missing"):
            findings.append(
                _finding(
                    evaluation_hint=eval_hint,
                    rule_id="l0.branch_exists",
                    code="BRANCH_MISSING",
                    message="Branch does not exist",
                    severity=FindingSeverity.CRITICAL,
                )
            )
        elif branch_id is None and context.get("require_branch"):
            findings.append(
                _finding(
                    evaluation_hint=eval_hint,
                    rule_id="l0.branch_exists",
                    code="BRANCH_REQUIRED",
                    message="Branch reference is required",
                    severity=FindingSeverity.ERROR,
                )
            )
        if context.get("currency_missing"):
            findings.append(
                _finding(
                    evaluation_hint=eval_hint,
                    rule_id="l0.currency_exists",
                    code="CURRENCY_MISSING",
                    message="Currency does not exist",
                    severity=FindingSeverity.CRITICAL,
                )
            )
        if context.get("fiscal_period_closed"):
            findings.append(
                _finding(
                    evaluation_hint=eval_hint,
                    rule_id="l0.fiscal_period_open",
                    code="FISCAL_PERIOD_CLOSED",
                    message="Fiscal period is closed",
                    severity=FindingSeverity.CRITICAL,
                )
            )
        if context.get("missing_required_fields"):
            for field in context["missing_required_fields"]:
                findings.append(
                    _finding(
                        evaluation_hint=eval_hint,
                        rule_id="l0.required_fields",
                        code="REQUIRED_FIELD_MISSING",
                        message=f"Required field missing: {field}",
                        severity=FindingSeverity.ERROR,
                        field_path=field,
                    )
                )
        payload = execution_result.output_json or {}
        if context.get("schema_invalid"):
            findings.append(
                _finding(
                    evaluation_hint=eval_hint,
                    rule_id="l0.schema_validation",
                    code="SCHEMA_INVALID",
                    message=context.get("schema_error", "Schema validation failed"),
                    severity=FindingSeverity.ERROR,
                )
            )
        elif payload.get("_schema_invalid"):
            findings.append(
                _finding(
                    evaluation_hint=eval_hint,
                    rule_id="l0.schema_validation",
                    code="SCHEMA_INVALID",
                    message=str(payload.get("_schema_error", "Schema validation failed")),
                    severity=FindingSeverity.ERROR,
                )
            )
        return tuple(findings)
