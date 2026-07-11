"""Quality Gate pipeline stages — independently testable."""

from __future__ import annotations

import hashlib
import time
import uuid
from datetime import datetime, timezone
from typing import Protocol

from ....provider_runtime.domain.value_objects import ExecutionResult
from ..ports.quality_gate_ports import (
    AccountingValidationPort,
    AIQualityValidationPort,
    BusinessRulePort,
    ERPValidationPort,
    EvidenceValidationPort,
    JurisdictionRulePort,
    KnowledgeAuthorityPort,
    RiskScoringPort,
)
from ..ports.quality_repository_port import QualityRuleRepositoryPort
from ...domain.value_objects import (
    FindingSeverity,
    GateRunStatus,
    QualityBudget,
    QualityDecision,
    QualityDecisionOutcome,
    QualityFinding,
    QualityLevel,
    QualityRecommendation,
    QualityScore,
    ViolationKind,
)
from .context import QualityPipelineContext


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class QualityStage(Protocol):
    @property
    def name(self) -> str: ...

    async def run(self, context: QualityPipelineContext) -> QualityPipelineContext: ...


class InputValidationStage:
    name = "input_validation"

    async def run(self, context: QualityPipelineContext) -> QualityPipelineContext:
        result = context.execution_result
        if result is None:
            context.blocked = True
            context.add_finding(
                QualityFinding(
                    finding_id=str(uuid.uuid4()),
                    evaluation_id=context.evaluation_id,
                    rule_id="input.required_result",
                    level=QualityLevel.L0,
                    severity=FindingSeverity.CRITICAL,
                    code="MISSING_EXECUTION_RESULT",
                    message="Execution result is required for quality evaluation",
                    violation_kind=ViolationKind.SCHEMA,
                    created_at=_utc_now_iso(),
                )
            )
            return context
        if not context.execution.tenant_id:
            context.blocked = True
            context.add_finding(
                QualityFinding(
                    finding_id=str(uuid.uuid4()),
                    evaluation_id=context.evaluation_id,
                    rule_id="input.required_tenant",
                    level=QualityLevel.L0,
                    severity=FindingSeverity.CRITICAL,
                    code="MISSING_TENANT",
                    message="Tenant id is required",
                    violation_kind=ViolationKind.SCHEMA,
                    created_at=_utc_now_iso(),
                )
            )
        context.audit_events.append({"stage": self.name, "valid": not context.blocked})
        return context


class L0ValidationStage:
    name = "l0_validation"

    def __init__(
        self,
        erp_port: ERPValidationPort,
        accounting_port: AccountingValidationPort,
        rule_repo: QualityRuleRepositoryPort,
    ) -> None:
        self._erp = erp_port
        self._accounting = accounting_port
        self._rules = rule_repo

    async def run(self, context: QualityPipelineContext) -> QualityPipelineContext:
        if context.blocked:
            return context
        started = time.perf_counter()
        rules = await self._rules.list_rules(level=QualityLevel.L0.value)
        context.rules = context.rules + rules
        ctx = context.validation_context
        erp_findings = await self._erp.validate_l0(
            tenant_id=context.execution.tenant_id,
            company_id=context.execution.company_id,
            branch_id=ctx.get("branch_id"),
            execution_result=context.execution_result,
            context=ctx,
        )
        accounting_findings = await self._accounting.validate_accounting(
            tenant_id=context.execution.tenant_id,
            company_id=context.execution.company_id,
            execution_result=context.execution_result,
            context=ctx,
        )
        for finding in erp_findings + accounting_findings:
            context.add_finding(finding)
            if finding.severity == FindingSeverity.CRITICAL:
                context.blocked = True
        duration = int((time.perf_counter() - started) * 1000)
        status = GateRunStatus.FAILED if context.blocked else GateRunStatus.PASSED
        context.record_gate_run(
            level=QualityLevel.L0,
            status=status.value,
            rule_count=len(rules),
            finding_count=len(erp_findings) + len(accounting_findings),
            duration_ms=duration,
        )
        if context.blocked:
            context.failed = True
        context.outbox_events.append("QualityGateFailed" if context.blocked else "QualityGatePassed")
        return context


class L1ValidationStage:
    name = "l1_validation"

    def __init__(
        self,
        business_port: BusinessRulePort,
        jurisdiction_port: JurisdictionRulePort,
        rule_repo: QualityRuleRepositoryPort,
    ) -> None:
        self._business = business_port
        self._jurisdiction = jurisdiction_port
        self._rules = rule_repo

    async def run(self, context: QualityPipelineContext) -> QualityPipelineContext:
        if context.blocked or context.failed:
            return context
        started = time.perf_counter()
        rules = await self._rules.list_rules(level=QualityLevel.L1.value)
        context.rules = context.rules + rules
        ctx = context.validation_context
        business_findings = await self._business.validate_business_rules(
            tenant_id=context.execution.tenant_id,
            company_id=context.execution.company_id,
            execution_result=context.execution_result,
            context=ctx,
        )
        jurisdiction_findings = await self._jurisdiction.validate_jurisdiction(
            tenant_id=context.execution.tenant_id,
            company_id=context.execution.company_id,
            jurisdiction=ctx.get("jurisdiction"),
            execution_result=context.execution_result,
            context=ctx,
        )
        for finding in business_findings + jurisdiction_findings:
            context.add_finding(finding)
            if finding.severity == FindingSeverity.CRITICAL:
                context.failed = True
            elif finding.severity == FindingSeverity.ERROR:
                context.failed = True
            elif finding.severity == FindingSeverity.WARNING:
                context.outbox_events.append("QualityWarningRaised")
        duration = int((time.perf_counter() - started) * 1000)
        status = GateRunStatus.FAILED if context.failed else GateRunStatus.PASSED
        context.record_gate_run(
            level=QualityLevel.L1,
            status=status.value,
            rule_count=len(rules),
            finding_count=len(business_findings) + len(jurisdiction_findings),
            duration_ms=duration,
        )
        if context.failed:
            context.outbox_events.append("QualityGateFailed")
        else:
            context.outbox_events.append("QualityGatePassed")
        return context


class L2ValidationStage:
    name = "l2_validation"

    def __init__(
        self,
        evidence_port: EvidenceValidationPort,
        authority_port: KnowledgeAuthorityPort,
        rule_repo: QualityRuleRepositoryPort,
    ) -> None:
        self._evidence = evidence_port
        self._authority = authority_port
        self._rules = rule_repo

    async def run(self, context: QualityPipelineContext) -> QualityPipelineContext:
        if context.blocked:
            return context
        started = time.perf_counter()
        rules = await self._rules.list_rules(level=QualityLevel.L2.value)
        context.rules = context.rules + rules
        ctx = context.validation_context
        evidence_items, evidence_findings = await self._evidence.validate_evidence(
            tenant_id=context.execution.tenant_id,
            execution_result=context.execution_result,
            context=ctx,
        )
        context.evidence.extend(evidence_items)
        authority_findings = await self._authority.validate_authority(
            tenant_id=context.execution.tenant_id,
            evidence=tuple(context.evidence),
            context=ctx,
        )
        for finding in evidence_findings + authority_findings:
            context.add_finding(finding)
            if finding.severity == FindingSeverity.CRITICAL:
                context.blocked = True
                context.failed = True
            elif finding.severity == FindingSeverity.ERROR:
                context.failed = True
            elif finding.severity == FindingSeverity.WARNING:
                context.outbox_events.append("QualityWarningRaised")
        duration = int((time.perf_counter() - started) * 1000)
        status = GateRunStatus.FAILED if context.failed or context.blocked else GateRunStatus.PASSED
        context.record_gate_run(
            level=QualityLevel.L2,
            status=status.value,
            rule_count=len(rules),
            finding_count=len(evidence_findings) + len(authority_findings),
            duration_ms=duration,
        )
        if context.blocked or context.failed:
            context.outbox_events.append("QualityGateFailed")
        else:
            context.outbox_events.append("QualityGatePassed")
        return context


class L3ValidationStage:
    name = "l3_validation"

    def __init__(self, ai_port: AIQualityValidationPort, rule_repo: QualityRuleRepositoryPort) -> None:
        self._ai = ai_port
        self._rules = rule_repo

    async def run(self, context: QualityPipelineContext) -> QualityPipelineContext:
        if context.blocked or not context.l3_enabled:
            if not context.l3_enabled:
                context.record_gate_run(
                    level=QualityLevel.L3,
                    status=GateRunStatus.SKIPPED.value,
                    rule_count=0,
                    finding_count=0,
                    duration_ms=0,
                )
            return context
        started = time.perf_counter()
        rules = await self._rules.list_rules(level=QualityLevel.L3.value)
        context.rules = context.rules + rules
        ai_findings = await self._ai.validate_ai_quality(
            tenant_id=context.execution.tenant_id,
            execution_result=context.execution_result,
            context=context.validation_context,
        )
        for finding in ai_findings:
            context.add_finding(finding)
            if finding.severity in (FindingSeverity.ERROR, FindingSeverity.CRITICAL):
                context.review_required = True
            elif finding.severity == FindingSeverity.WARNING:
                context.outbox_events.append("QualityWarningRaised")
        duration = int((time.perf_counter() - started) * 1000)
        context.record_gate_run(
            level=QualityLevel.L3,
            status=GateRunStatus.PASSED.value,
            rule_count=len(rules),
            finding_count=len(ai_findings),
            duration_ms=duration,
        )
        context.outbox_events.append("QualityGatePassed")
        return context


class RiskScoringStage:
    name = "risk_scoring"

    def __init__(self, risk_port: RiskScoringPort) -> None:
        self._risk = risk_port

    async def run(self, context: QualityPipelineContext) -> QualityPipelineContext:
        if context.blocked:
            return context
        context.risk = await self._risk.score_risk(
            tenant_id=context.execution.tenant_id,
            evaluation_id=context.evaluation_id,
            findings=tuple(context.findings),
            violations=tuple(context.violations),
            context=context.validation_context,
        )
        if context.risk.escalated:
            context.review_required = True
            context.outbox_events.append("QualityEscalated")
        context.audit_events.append({"stage": self.name, "risk_score": context.risk.score})
        return context


class DecisionAssemblyStage:
    name = "decision_assembly"

    async def run(self, context: QualityPipelineContext) -> QualityPipelineContext:
        l0_score = 1.0 if not any(f.level == QualityLevel.L0 and f.severity.value in ("error", "critical") for f in context.findings) else 0.0
        l1_score = 1.0 if not any(f.level == QualityLevel.L1 and f.severity.value in ("error", "critical") for f in context.findings) else 0.5
        l2_score = 1.0 if not any(f.level == QualityLevel.L2 and f.severity.value in ("error", "critical") for f in context.findings) else 0.5
        l3_findings = [f for f in context.findings if f.level == QualityLevel.L3]
        l3_score = None
        if context.l3_enabled:
            l3_score = 1.0 if not l3_findings else max(0.0, 1.0 - len(l3_findings) * 0.1)

        overall = (l0_score + l1_score + l2_score + (l3_score or 1.0)) / (4 if context.l3_enabled else 3)
        context.score = QualityScore(
            score_id=str(uuid.uuid4()),
            evaluation_id=context.evaluation_id,
            overall=overall,
            l0_score=l0_score,
            l1_score=l1_score,
            l2_score=l2_score,
            l3_score=l3_score,
            confidence=min(1.0, overall + 0.1),
        )

        outcome = QualityDecisionOutcome.PASS
        if context.blocked:
            outcome = QualityDecisionOutcome.BLOCK
        elif context.failed:
            outcome = QualityDecisionOutcome.FAIL
        elif context.review_required or (context.risk and context.risk.escalated):
            outcome = QualityDecisionOutcome.REVIEW_REQUIRED
        elif context.warning_count > 0:
            outcome = QualityDecisionOutcome.PASS_WITH_WARNING

        gate_order = (QualityLevel.L0, QualityLevel.L1, QualityLevel.L2, QualityLevel.L3)
        min_idx = gate_order.index(context.minimum_gate)
        reached_idx = gate_order.index(context.highest_gate_reached)
        if reached_idx < min_idx and not context.blocked:
            outcome = QualityDecisionOutcome.FAIL
            context.failed = True

        summary_parts = [f"outcome={outcome.value}", f"gates_reached={context.highest_gate_reached.value}"]
        if context.warning_count:
            summary_parts.append(f"warnings={context.warning_count}")
        if context.violations:
            summary_parts.append(f"violations={len(context.violations)}")

        context.decision = QualityDecision(
            decision_id=str(uuid.uuid4()),
            evaluation_id=context.evaluation_id,
            outcome=outcome,
            minimum_gate=context.minimum_gate,
            highest_gate_reached=context.highest_gate_reached,
            l3_enabled=context.l3_enabled,
            warning_count=context.warning_count,
            violation_count=len(context.violations),
            blocking=context.blocked,
            requires_review=context.review_required,
            score=context.score,
            risk=context.risk,
            summary=", ".join(summary_parts),
            decided_at=_utc_now_iso(),
        )

        if outcome == QualityDecisionOutcome.REVIEW_REQUIRED:
            context.recommendations.append(
                QualityRecommendation(
                    recommendation_id=str(uuid.uuid4()),
                    evaluation_id=context.evaluation_id,
                    action="manual_review",
                    reason="Quality gate requires human review before ERP mutation",
                    priority="high",
                )
            )
        return context


class AuditStage:
    name = "audit"

    async def run(self, context: QualityPipelineContext) -> QualityPipelineContext:
        payload = {
            "evaluation_id": context.evaluation_id,
            "decision": context.decision.outcome.value if context.decision else None,
            "findings": len(context.findings),
            "warnings": context.warning_count,
        }
        digest = hashlib.sha256(repr(payload).encode()).hexdigest()
        context.audit_events.append({"stage": self.name, "audit_hash": digest, **payload})
        return context


class LineageStage:
    name = "lineage"

    async def run(self, context: QualityPipelineContext) -> QualityPipelineContext:
        context.audit_events.append(
            {
                "stage": self.name,
                "execution_id": context.execution.execution_id,
                "evaluation_id": context.evaluation_id,
                "finding_count": len(context.findings),
            }
        )
        return context


class OutboxStage:
    name = "outbox"

    async def run(self, context: QualityPipelineContext) -> QualityPipelineContext:
        for finding in context.findings:
            context.outbox_events.append("QualityRuleTriggered")
        context.audit_events.append({"stage": self.name, "events": list(context.outbox_events)})
        return context
