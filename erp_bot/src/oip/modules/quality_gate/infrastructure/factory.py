"""Build quality gate pipeline."""

from __future__ import annotations

from ..application.pipeline.execution_intent_validation_stage import ExecutionIntentValidationStage
from ..application.pipeline.pipeline import QualityGatePipeline
from ..application.pipeline.stages import (
    AuditStage,
    DecisionAssemblyStage,
    InputValidationStage,
    L0ValidationStage,
    L1ValidationStage,
    L2ValidationStage,
    L3ValidationStage,
    LineageStage,
    OutboxStage,
    RiskScoringStage,
)
from ..application.ports.quality_gate_ports import (
    AccountingValidationPort,
    AIQualityValidationPort,
    BusinessRulePort,
    ERPValidationPort,
    EvidenceValidationPort,
    JurisdictionRulePort,
    KnowledgeAuthorityPort,
    RiskScoringPort,
)
from ..application.ports.quality_repository_port import QualityRuleRepositoryPort


def build_quality_gate_pipeline(
    *,
    erp_port: ERPValidationPort,
    accounting_port: AccountingValidationPort,
    business_port: BusinessRulePort,
    jurisdiction_port: JurisdictionRulePort,
    evidence_port: EvidenceValidationPort,
    authority_port: KnowledgeAuthorityPort,
    risk_port: RiskScoringPort,
    ai_port: AIQualityValidationPort,
    rule_repo: QualityRuleRepositoryPort,
) -> QualityGatePipeline:
    stages = (
        InputValidationStage(),
        ExecutionIntentValidationStage(),
        L0ValidationStage(erp_port, accounting_port, rule_repo),
        L1ValidationStage(business_port, jurisdiction_port, rule_repo),
        L2ValidationStage(evidence_port, authority_port, rule_repo),
        L3ValidationStage(ai_port, rule_repo),
        RiskScoringStage(risk_port),
        DecisionAssemblyStage(),
        AuditStage(),
        LineageStage(),
        OutboxStage(),
    )
    return QualityGatePipeline(stages=stages)
