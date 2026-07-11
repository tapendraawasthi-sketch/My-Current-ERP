"""Build action runtime pipeline."""

from __future__ import annotations

from ..domain.action_registry import ActionTypeRegistry
from ..application.pipeline.pipeline import ActionRuntimePipeline
from ..application.pipeline.stages import (
    ApprovalStage,
    AuditStage,
    CompensationStage,
    ConfirmationStage,
    ERPGuardStage,
    ExecuteStage,
    IdempotencyStage,
    InputValidationStage,
    LineageStage,
    MaterializationStage,
    OutboxStage,
    PermissionCapabilityStage,
    PolicyValidationStage,
    ProposalStage,
    QualityDecisionGateStage,
    SnapshotValidationStage,
)
from ..application.ports.action_runtime_ports import (
    ActionCapabilityTokenPort,
    ActionPolicyPort,
    ApprovalPort,
    CompensationPort,
    ERPCommandPort,
    ERPQueryPort,
    PermissionPort,
    SnapshotPort,
)
from ..application.ports.action_repository_port import ActionRepositoryPort


def build_action_runtime_pipeline(
    *,
    registry: ActionTypeRegistry,
    policy_port: ActionPolicyPort,
    approval_port: ApprovalPort,
    snapshot_port: SnapshotPort,
    erp_query: ERPQueryPort,
    permission_port: PermissionPort,
    capability_port: ActionCapabilityTokenPort,
    erp_command: ERPCommandPort,
    compensation_port: CompensationPort,
    repository: ActionRepositoryPort,
) -> ActionRuntimePipeline:
    stages = (
        InputValidationStage(),
        QualityDecisionGateStage(),
        ProposalStage(registry),
        PolicyValidationStage(policy_port, registry),
        ApprovalStage(approval_port, registry),
        SnapshotValidationStage(snapshot_port),
        ERPGuardStage(erp_query),
        PermissionCapabilityStage(permission_port, capability_port),
        IdempotencyStage(repository),
        MaterializationStage(registry),
        ExecuteStage(erp_command, registry),
        ConfirmationStage(),
        CompensationStage(compensation_port, erp_command),
        AuditStage(),
        LineageStage(),
        OutboxStage(),
    )
    return ActionRuntimePipeline(stages=stages)
