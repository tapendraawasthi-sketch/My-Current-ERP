"""Quality Gate outbound ports."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any

from ....provider_runtime.domain.value_objects import ExecutionResult
from ...domain.value_objects import (
    QualityEvidence,
    QualityFinding,
    QualityLevel,
    QualityRisk,
    QualityRule,
    QualityViolation,
)


class ERPValidationPort(ABC):
    @abstractmethod
    async def validate_l0(
        self,
        *,
        tenant_id: str,
        company_id: str | None,
        branch_id: str | None,
        execution_result: ExecutionResult,
        context: dict[str, Any],
    ) -> tuple[QualityFinding, ...]: ...


class AccountingValidationPort(ABC):
    @abstractmethod
    async def validate_accounting(
        self,
        *,
        tenant_id: str,
        company_id: str | None,
        execution_result: ExecutionResult,
        context: dict[str, Any],
    ) -> tuple[QualityFinding, ...]: ...


class BusinessRulePort(ABC):
    @abstractmethod
    async def validate_business_rules(
        self,
        *,
        tenant_id: str,
        company_id: str | None,
        execution_result: ExecutionResult,
        context: dict[str, Any],
    ) -> tuple[QualityFinding, ...]: ...


class JurisdictionRulePort(ABC):
    @abstractmethod
    async def validate_jurisdiction(
        self,
        *,
        tenant_id: str,
        company_id: str | None,
        jurisdiction: str | None,
        execution_result: ExecutionResult,
        context: dict[str, Any],
    ) -> tuple[QualityFinding, ...]: ...


class EvidenceValidationPort(ABC):
    @abstractmethod
    async def validate_evidence(
        self,
        *,
        tenant_id: str,
        execution_result: ExecutionResult,
        context: dict[str, Any],
    ) -> tuple[QualityEvidence, QualityFinding, ...]: ...


class KnowledgeAuthorityPort(ABC):
    @abstractmethod
    async def validate_authority(
        self,
        *,
        tenant_id: str,
        evidence: tuple[QualityEvidence, ...],
        context: dict[str, Any],
    ) -> tuple[QualityFinding, ...]: ...


class RiskScoringPort(ABC):
    @abstractmethod
    async def score_risk(
        self,
        *,
        tenant_id: str,
        evaluation_id: str,
        findings: tuple[QualityFinding, ...],
        violations: tuple[QualityViolation, ...],
        context: dict[str, Any],
    ) -> QualityRisk: ...


class AIQualityValidationPort(ABC):
    @abstractmethod
    async def validate_ai_quality(
        self,
        *,
        tenant_id: str,
        execution_result: ExecutionResult,
        context: dict[str, Any],
    ) -> tuple[QualityFinding, ...]: ...
