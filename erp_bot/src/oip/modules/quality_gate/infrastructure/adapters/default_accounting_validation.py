"""Default accounting validation adapter."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from ....provider_runtime.domain.value_objects import ExecutionResult
from ...application.ports.quality_gate_ports import AccountingValidationPort
from ...domain.value_objects import FindingSeverity, QualityFinding, QualityLevel, ViolationKind


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class DefaultAccountingValidationAdapter(AccountingValidationPort):
    async def validate_accounting(
        self,
        *,
        tenant_id: str,
        company_id: str | None,
        execution_result: ExecutionResult,
        context: dict[str, Any],
    ) -> tuple[QualityFinding, ...]:
        findings: list[QualityFinding] = []
        eval_hint = context.get("evaluation_id", "pending")
        payload = execution_result.output_json or {}

        if context.get("account_missing") or payload.get("_account_missing"):
            account = context.get("account_missing") or payload.get("_account_missing")
            findings.append(
                QualityFinding(
                    finding_id=str(uuid.uuid4()),
                    evaluation_id=eval_hint,
                    rule_id="l0.account_exists",
                    level=QualityLevel.L0,
                    severity=FindingSeverity.CRITICAL,
                    code="ACCOUNT_NOT_FOUND",
                    message=f"Account does not exist: {account}",
                    field_path="account_id",
                    violation_kind=ViolationKind.ACCOUNTING,
                    created_at=_utc_now_iso(),
                )
            )

        journal_unbalanced = context.get("journal_unbalanced") or payload.get("_journal_unbalanced")
        if journal_unbalanced:
            findings.append(
                QualityFinding(
                    finding_id=str(uuid.uuid4()),
                    evaluation_id=eval_hint,
                    rule_id="l0.journal_balance",
                    level=QualityLevel.L0,
                    severity=FindingSeverity.CRITICAL,
                    code="JOURNAL_UNBALANCED",
                    message="Double-entry journal is not balanced",
                    violation_kind=ViolationKind.ACCOUNTING,
                    metadata={"delta": context.get("balance_delta", payload.get("_balance_delta", 0))},
                    created_at=_utc_now_iso(),
                )
            )

        if context.get("accounting_policy_violation"):
            findings.append(
                QualityFinding(
                    finding_id=str(uuid.uuid4()),
                    evaluation_id=eval_hint,
                    rule_id="l0.accounting_policy",
                    level=QualityLevel.L0,
                    severity=FindingSeverity.ERROR,
                    code="ACCOUNTING_POLICY_VIOLATION",
                    message=str(context.get("accounting_policy_violation")),
                    violation_kind=ViolationKind.ACCOUNTING,
                    created_at=_utc_now_iso(),
                )
            )
        return tuple(findings)
