"""Build execution pipeline."""

from __future__ import annotations

from ..application.pipeline.pipeline import ExecutionPipeline
from ..application.pipeline.stages import (
    ArtifactStorageStage,
    BudgetValidationStage,
    CapabilityTokenValidationStage,
    CapabilityValidationStage,
    ExecutionContextStage,
    PolicyResolutionStage,
    ProviderInvocationStage,
    ResponseValidationStage,
    ResultAssemblyStage,
    StreamingStage,
    ToolSandboxCreationStage,
    UsageCollectionStage,
)
from ..application.ports.execution_ports import (
    ArtifactStorePort,
    CapabilityTokenPort,
    ExecutionBudgetPort,
    ExecutionHealthPort,
    ExecutionPolicyPort,
    ProviderAdapterRegistryPort,
    StreamingPort,
    ToolSandboxPort,
    UsageCollectorPort,
)


def build_execution_pipeline(
    *,
    policy_port: ExecutionPolicyPort,
    health_port: ExecutionHealthPort,
    token_port: CapabilityTokenPort,
    sandbox_port: ToolSandboxPort,
    budget_port: ExecutionBudgetPort,
    adapter_registry: ProviderAdapterRegistryPort,
    streaming_port: StreamingPort,
    usage_port: UsageCollectorPort,
    artifact_port: ArtifactStorePort,
) -> ExecutionPipeline:
    stages = (
        PolicyResolutionStage(policy_port),
        CapabilityValidationStage(health_port),
        ExecutionContextStage(),
        CapabilityTokenValidationStage(token_port),
        ToolSandboxCreationStage(sandbox_port),
        BudgetValidationStage(budget_port),
        ProviderInvocationStage(adapter_registry, health_port),
        StreamingStage(streaming_port),
        ResponseValidationStage(),
        UsageCollectionStage(usage_port),
        ArtifactStorageStage(artifact_port),
        ResultAssemblyStage(),
    )
    return ExecutionPipeline(stages=stages)
