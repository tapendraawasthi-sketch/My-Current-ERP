"""Provider Runtime application ports."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, AsyncIterator

from ...domain.entities import ExecutionAggregate
from ...domain.value_objects import (
    CapabilityToken,
    ExecutionArtifact,
    ExecutionBudget,
    ExecutionContext,
    ExecutionHealth,
    ExecutionPolicy,
    ExecutionPolicyName,
    ExecutionResult,
    ProviderUsage,
    StreamingMode,
)
from ....router.domain.entities import RouteDecision


class ProviderRuntimePort(ABC):
    @abstractmethod
    async def start_execution(
        self,
        *,
        route: RouteDecision,
        execution_policy: ExecutionPolicyName | None = None,
    ) -> ExecutionAggregate:
        """Start provider execution from immutable route decision."""


class ProviderAdapterPort(ABC):
    @abstractmethod
    async def invoke(
        self,
        *,
        provider_id: str,
        context: ExecutionContext,
        prompt: str,
        tools: tuple[str, ...],
        streaming: bool,
    ) -> dict[str, Any]:
        """Invoke provider and return normalized response dict."""


class StreamingPort(ABC):
    @abstractmethod
    async def stream_chunks(
        self,
        *,
        execution_id: str,
        provider_response: dict[str, Any],
        mode: StreamingMode,
    ) -> AsyncIterator[str]:
        """Yield provisional streaming chunks."""


class CapabilityTokenPort(ABC):
    @abstractmethod
    async def issue(
        self,
        *,
        tenant_id: str,
        request_id: str,
        conversation_id: str | None,
        company_id: str | None,
        allowed_tools: tuple[str, ...],
        allowed_erp_actions: tuple[str, ...],
        maximum_calls: int,
        read_scope: tuple[str, ...],
        write_scope: tuple[str, ...],
        ttl_seconds: int = 3600,
    ) -> CapabilityToken:
        """Issue capability token for tool sandbox."""

    @abstractmethod
    async def validate(self, *, token: CapabilityToken) -> bool:
        """Validate token is active and not expired."""

    @abstractmethod
    async def revoke(self, *, token_id: str, tenant_id: str) -> None:
        """Revoke capability token."""


class ArtifactStorePort(ABC):
    @abstractmethod
    async def store(
        self,
        *,
        tenant_id: str,
        execution_id: str,
        content: bytes,
        provider_id: str,
        model: str,
        ttl_seconds: int = 86_400,
        metadata: dict[str, Any] | None = None,
    ) -> ExecutionArtifact:
        """Store encrypted artifact blob; return hash + pointer only."""


class UsageCollectorPort(ABC):
    @abstractmethod
    async def collect(
        self,
        *,
        execution_id: str,
        tenant_id: str,
        provider_id: str,
        provider_response: dict[str, Any],
        latency_ms: int,
        retries: int,
        tool_count: int,
        streaming_duration_ms: int,
    ) -> ProviderUsage:
        """Collect usage metrics from provider response."""


class ToolSandboxPort(ABC):
    @abstractmethod
    async def create_sandbox(
        self,
        *,
        execution_id: str,
        token: CapabilityToken,
        allowed_tools: tuple[str, ...],
    ) -> str:
        """Create isolated tool sandbox; return sandbox_id."""

    @abstractmethod
    async def invoke_tool(
        self,
        *,
        sandbox_id: str,
        token: CapabilityToken,
        tool_id: str,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        """Invoke tool within sandbox if token permits."""


class ExecutionBudgetPort(ABC):
    @abstractmethod
    async def allocate(
        self,
        *,
        execution_id: str,
        tenant_id: str,
        max_tokens: int,
        max_cost_micros: int,
        max_latency_ms: int,
    ) -> ExecutionBudget:
        """Allocate execution budget."""

    @abstractmethod
    async def validate(self, *, budget: ExecutionBudget) -> bool:
        """Return True if budget not exceeded."""


class ExecutionHealthPort(ABC):
    @abstractmethod
    async def get_provider_health(self, *, provider_id: str, tenant_id: str) -> ExecutionHealth:
        """Return provider health for execution gating."""

    @abstractmethod
    async def record_success(self, *, provider_id: str, tenant_id: str, latency_ms: int) -> None:
        """Record successful provider call."""

    @abstractmethod
    async def record_failure(self, *, provider_id: str, tenant_id: str, error_code: str) -> None:
        """Record failed provider call."""


class ExecutionMetricsPort(ABC):
    @abstractmethod
    async def increment(
        self,
        *,
        tenant_id: str,
        metric: str,
        provider_id: str | None = None,
        latency_ms: int = 0,
        cost_micros: int = 0,
        tokens: int = 0,
    ) -> None:
        """Increment daily execution metrics."""


class ExecutionPolicyPort(ABC):
    @abstractmethod
    def resolve(self, *, policy_name: ExecutionPolicyName) -> ExecutionPolicy:
        """Resolve execution policy configuration."""


class ProviderAdapterRegistryPort(ABC):
    @abstractmethod
    def get_adapter(self, provider_id: str) -> ProviderAdapterPort | None:
        """Lookup provider adapter by id."""

    @abstractmethod
    def list_provider_ids(self) -> tuple[str, ...]:
        """List registered provider adapter ids."""
