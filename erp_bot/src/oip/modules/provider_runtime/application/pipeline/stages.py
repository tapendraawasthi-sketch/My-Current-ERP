"""Execution pipeline stages — independently testable."""

from __future__ import annotations

import time
import uuid
from datetime import datetime, timezone
from typing import Protocol

from ...domain.value_objects import (
    ExecutionContext,
    ExecutionFailure,
    ExecutionLimits,
    ExecutionPolicyName,
    ExecutionResult,
    ExecutionStatus,
    FailureKind,
    ProviderUsage,
    RetryClass,
    StreamingMode,
    StreamingState,
)
from ..ports.execution_ports import (
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
import os

from .....infrastructure.observability.logging import log_event
from .context import ExecutionPipelineContext

_OIP_CHAT_DEBUG = os.getenv("OIP_CHAT_DEBUG", "false").lower() in {"1", "true", "yes"}
_EXPLICIT_WORKFLOW_INTENTS = frozenset({"workflow_approval"})


def _resolve_provider_prompt(*, route, policy_decisions: dict) -> str:
    """Use the user's message for chat; reserve plan-execution phrasing for explicit workflows."""
    intent_type = policy_decisions.get("execution_intent_type") or policy_decisions.get(
        "intent_type", "general_query"
    )
    user_message = str(policy_decisions.get("user_message") or "").strip()
    if intent_type in _EXPLICIT_WORKFLOW_INTENTS:
        return f"Execute plan {route.plan_id} for request {route.request_id}"
    if user_message:
        return user_message
    return f"Execute plan {route.plan_id} for request {route.request_id}"


def _build_execution_grounding(policy_decisions: dict) -> dict:
    """Attach NP Language KB (+ optional OIP snippets) into execution metadata."""
    user_message = str(policy_decisions.get("user_message") or "").strip()
    # Prefer pre-built grounding from orchestrator; otherwise retrieve here.
    prebuilt = str(policy_decisions.get("grounding_block") or "").strip()
    if prebuilt:
        return {
            "grounding_block": prebuilt,
            "grounding_citation_count": int(policy_decisions.get("grounding_citation_count") or 0),
            "grounding_language_form": policy_decisions.get("grounding_language_form"),
            "grounding_normalized_text": policy_decisions.get("grounding_normalized_text"),
            "grounding_np_kb_enabled": bool(policy_decisions.get("grounding_np_kb_enabled")),
            "grounding_oip_snippet_count": int(policy_decisions.get("grounding_oip_snippet_count") or 0),
            "grounding_sources": list(policy_decisions.get("grounding_sources") or []),
            "np_kb": policy_decisions.get("np_kb") or {"enabled": False},
        }
    if not user_message:
        return {}
    try:
        from src.nlu.prompt_grounding import build_prompt_grounding

        snippets = policy_decisions.get("knowledge_snippets")
        if not isinstance(snippets, list):
            snippets = None
        grounding = build_prompt_grounding(user_message, knowledge_snippets=snippets, top_k=5)
        return grounding.to_metadata()
    except Exception:
        return {}


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _utc_now_iso() -> str:
    return _utc_now().isoformat()


class ExecutionStage(Protocol):
    @property
    def name(self) -> str: ...

    async def run(self, context: ExecutionPipelineContext) -> ExecutionPipelineContext: ...


class CapabilityValidationStage:
    name = "capability_validation"

    def __init__(self, health_port: ExecutionHealthPort) -> None:
        self._health = health_port

    async def run(self, context: ExecutionPipelineContext) -> ExecutionPipelineContext:
        route = context.route
        provider_id = route.primary_provider.provider_id
        health = await self._health.get_provider_health(provider_id=provider_id, tenant_id=route.tenant_id)
        if health.circuit_state.value == "open":
            context.failure_message = FailureKind.CIRCUIT_OPEN.value
        return context


class ExecutionContextStage:
    name = "execution_context"

    async def run(self, context: ExecutionPipelineContext) -> ExecutionPipelineContext:
        route = context.route
        execution = context.execution
        if execution is None:
            return context
        policy_decisions = dict(route.policy_decisions or {})
        grounding_meta = _build_execution_grounding(policy_decisions)
        response_register = policy_decisions.get("response_register")
        if not isinstance(response_register, dict):
            response_register = {}
        context_assembly = policy_decisions.get("context_assembly")
        if not isinstance(context_assembly, dict):
            context_assembly = {}
        context_assembly_recall = policy_decisions.get("context_assembly_recall")
        if not isinstance(context_assembly_recall, dict):
            context_assembly_recall = {}
        exec_meta: dict = {
            "estimated_tokens": route.estimated_tokens,
            **grounding_meta,
            "response_register": response_register,
        }
        if context_assembly:
            exec_meta["context_assembly"] = context_assembly
        if context_assembly_recall:
            exec_meta["context_assembly_recall"] = context_assembly_recall
        context.context = ExecutionContext(
            context_id=str(uuid.uuid4()),
            execution_id=execution.execution_id,
            tenant_id=route.tenant_id,
            request_id=route.request_id,
            conversation_id=route.conversation_id,
            company_id=route.company_id,
            route_id=route.route_id,
            plan_id=route.plan_id,
            provider_id=route.primary_provider.provider_id,
            model_hint=route.primary_provider.model_hint,
            policy_name=context.policy_name,
            edition=route.edition,
            deployment_mode=route.deployment_mode,
            capability_token_id="",
            sandbox_id="",
            metadata=exec_meta,
        )
        context.prompt = _resolve_provider_prompt(route=route, policy_decisions=policy_decisions)
        if _OIP_CHAT_DEBUG:
            log_event(
                "oip.provider_runtime.execution_context",
                intent_type=policy_decisions.get("execution_intent_type"),
                user_message=policy_decisions.get("user_message"),
                provider_prompt=context.prompt,
                grounding_citations=grounding_meta.get("grounding_citation_count"),
                grounding_sources=grounding_meta.get("grounding_sources"),
                plan_id=route.plan_id,
                request_id=route.request_id,
            )
        return context


class CapabilityTokenValidationStage:
    name = "capability_token_validation"

    def __init__(self, token_port: CapabilityTokenPort) -> None:
        self._tokens = token_port

    async def run(self, context: ExecutionPipelineContext) -> ExecutionPipelineContext:
        route = context.route
        tool_ids = tuple(t.tool_id for t in route.selected_tools)
        token = await self._tokens.issue(
            tenant_id=route.tenant_id,
            request_id=route.request_id,
            conversation_id=route.conversation_id,
            company_id=route.company_id,
            allowed_tools=tool_ids,
            allowed_erp_actions=("read",),
            maximum_calls=10,
            read_scope=("erp", "knowledge", "memory"),
            write_scope=(),
        )
        valid = await self._tokens.validate(token=token)
        if not valid:
            context.failure_message = FailureKind.CAPABILITY_INVALID.value
            return context
        context.capability_token = token
        if context.context:
            context.context = context.context.model_copy(update={"capability_token_id": token.token_id})
        return context


class ToolSandboxCreationStage:
    name = "tool_sandbox_creation"

    def __init__(self, sandbox_port: ToolSandboxPort) -> None:
        self._sandbox = sandbox_port

    async def run(self, context: ExecutionPipelineContext) -> ExecutionPipelineContext:
        if context.failure_message or context.execution is None or context.capability_token is None:
            return context
        route = context.route
        tool_ids = tuple(t.tool_id for t in route.selected_tools)
        sandbox_id = await self._sandbox.create_sandbox(
            execution_id=context.execution.execution_id,
            token=context.capability_token,
            allowed_tools=tool_ids,
        )
        context.sandbox_id = sandbox_id
        if context.context:
            context.context = context.context.model_copy(update={"sandbox_id": sandbox_id})
        return context


class BudgetValidationStage:
    name = "budget_validation"

    def __init__(self, budget_port: ExecutionBudgetPort) -> None:
        self._budget = budget_port

    async def run(self, context: ExecutionPipelineContext) -> ExecutionPipelineContext:
        if context.failure_message or context.execution is None or context.policy is None:
            return context
        route = context.route
        budget = await self._budget.allocate(
            execution_id=context.execution.execution_id,
            tenant_id=route.tenant_id,
            max_tokens=context.policy.max_tokens,
            max_cost_micros=context.policy.max_cost_micros,
            max_latency_ms=context.policy.max_latency_ms,
        )
        if not await self._budget.validate(budget=budget):
            context.failure_message = FailureKind.BUDGET_EXCEEDED.value
            return context
        context.budget = budget
        return context


class ProviderInvocationStage:
    name = "provider_invocation"

    def __init__(
        self,
        adapter_registry: ProviderAdapterRegistryPort,
        health_port: ExecutionHealthPort,
    ) -> None:
        self._registry = adapter_registry
        self._health = health_port

    async def run(self, context: ExecutionPipelineContext) -> ExecutionPipelineContext:
        if context.failure_message or context.context is None:
            return context
        route = context.route
        primary = context.context.provider_id
        candidates = [primary, *list(route.fallback_chain.providers)]
        provider_ids: list[str] = []
        seen: set[str] = set()
        for candidate in candidates:
            if candidate and candidate not in seen:
                seen.add(candidate)
                provider_ids.append(candidate)
        tool_ids = tuple(t.tool_id for t in route.selected_tools)
        max_attempts = max(1, route.fallback_chain.max_retries + 1)

        last_error = ""
        for attempt, provider_id in enumerate(provider_ids[:max_attempts]):
            adapter = self._registry.get_adapter(provider_id)
            if adapter is None:
                continue
            started = time.perf_counter()
            try:
                if _OIP_CHAT_DEBUG:
                    log_event(
                        "oip.provider_runtime.provider_invocation",
                        provider_id=provider_id,
                        prompt=context.prompt,
                        tools=list(tool_ids),
                    )
                response = await adapter.invoke(
                    provider_id=provider_id,
                    context=context.context.model_copy(update={"provider_id": provider_id}),
                    prompt=context.prompt,
                    tools=tool_ids,
                    streaming=context.streaming_enabled,
                )
                if _OIP_CHAT_DEBUG:
                    log_event(
                        "oip.provider_runtime.provider_response",
                        provider_id=provider_id,
                        response_preview=str(response.get("text", ""))[:500],
                    )
                latency_ms = int((time.perf_counter() - started) * 1000)
                response["_latency_ms"] = latency_ms
                response["_retry_count"] = attempt
                context.provider_response = response
                context.retry_count = attempt
                context.resolved_provider_id = provider_id
                if context.context:
                    context.context = context.context.model_copy(update={"provider_id": provider_id})
                await self._health.record_success(
                    provider_id=provider_id,
                    tenant_id=route.tenant_id,
                    latency_ms=latency_ms,
                )
                return context
            except Exception as exc:
                error_code = getattr(exc, "error_code", FailureKind.PROVIDER_UNAVAILABLE.value)
                last_error = str(error_code)
                await self._health.record_failure(
                    provider_id=provider_id,
                    tenant_id=route.tenant_id,
                    error_code=str(error_code),
                )
                retryable = bool(getattr(exc, "retryable", False))
                if not retryable and attempt + 1 >= len(provider_ids[:max_attempts]):
                    break
                if attempt + 1 >= len(provider_ids[:max_attempts]):
                    break

        context.failure_message = last_error or FailureKind.PROVIDER_UNAVAILABLE.value
        context.provider_response = {"error": last_error, "_retry_count": context.retry_count}
        return context


class StreamingStage:
    name = "streaming"

    def __init__(self, streaming_port: StreamingPort) -> None:
        self._streaming = streaming_port

    async def run(self, context: ExecutionPipelineContext) -> ExecutionPipelineContext:
        if context.failure_message or context.execution is None:
            return context
        if not context.streaming_enabled or not context.provider_response.get("streamable"):
            context.streaming = StreamingState(
                streaming_id=str(uuid.uuid4()),
                execution_id=context.execution.execution_id,
                mode=StreamingMode.NONE,
                provisional=True,
            )
            return context
        chunks: list[str] = []
        async for chunk in self._streaming.stream_chunks(
            execution_id=context.execution.execution_id,
            provider_response=context.provider_response,
            mode=StreamingMode.SSE,
        ):
            chunks.append(chunk)
        context.stream_chunks = chunks
        context.streaming = StreamingState(
            streaming_id=str(uuid.uuid4()),
            execution_id=context.execution.execution_id,
            mode=StreamingMode.SSE,
            chunk_count=len(chunks),
            provisional=True,
            started_at=_utc_now_iso(),
            completed_at=_utc_now_iso(),
        )
        return context


class ResponseValidationStage:
    name = "response_validation"

    async def run(self, context: ExecutionPipelineContext) -> ExecutionPipelineContext:
        if context.failure_message:
            return context
        if not context.provider_response or context.provider_response.get("error"):
            context.failure_message = FailureKind.PROVIDER_UNAVAILABLE.value
        return context


class UsageCollectionStage:
    name = "usage_collection"

    def __init__(self, usage_port: UsageCollectorPort) -> None:
        self._usage = usage_port

    async def run(self, context: ExecutionPipelineContext) -> ExecutionPipelineContext:
        if context.failure_message or context.execution is None:
            return context
        route = context.route
        latency = int(context.provider_response.get("_latency_ms", route.estimated_latency_ms))
        retries = int(context.provider_response.get("_retry_count", context.retry_count))
        context.usage = await self._usage.collect(
            execution_id=context.execution.execution_id,
            tenant_id=route.tenant_id,
            provider_id=context.resolved_provider_id or route.primary_provider.provider_id,
            provider_response=context.provider_response,
            latency_ms=latency,
            retries=retries,
            tool_count=len(route.selected_tools),
            streaming_duration_ms=len(context.stream_chunks) * 10,
        )
        return context


class ArtifactStorageStage:
    name = "artifact_storage"

    def __init__(self, artifact_port: ArtifactStorePort) -> None:
        self._artifacts = artifact_port

    async def run(self, context: ExecutionPipelineContext) -> ExecutionPipelineContext:
        if context.failure_message or context.execution is None:
            return context
        route = context.route
        content = context.provider_response.get("raw_content", context.provider_response.get("text", ""))
        if isinstance(content, str):
            content_bytes = content.encode("utf-8")
        else:
            content_bytes = str(content).encode("utf-8")
        context.artifact = await self._artifacts.store(
            tenant_id=route.tenant_id,
            execution_id=context.execution.execution_id,
            content=content_bytes,
            provider_id=route.primary_provider.provider_id,
            model=context.provider_response.get("model", ""),
            metadata={"route_id": route.route_id},
        )
        return context


class ResultAssemblyStage:
    name = "result_assembly"

    async def run(self, context: ExecutionPipelineContext) -> ExecutionPipelineContext:
        if context.execution is None:
            return context
        if context.failure_message:
            context.result = ExecutionResult(
                result_id=str(uuid.uuid4()),
                execution_id=context.execution.execution_id,
                success=False,
                failure=ExecutionFailure(
                    failure_id=str(uuid.uuid4()),
                    execution_id=context.execution.execution_id,
                    kind=FailureKind(context.failure_message)
                    if context.failure_message in FailureKind._value2member_map_
                    else FailureKind.PROVIDER_UNAVAILABLE,
                    retry_class=RetryClass.NON_RETRYABLE,
                    message=context.failure_message,
                    provider_id=context.route.primary_provider.provider_id,
                    occurred_at=_utc_now_iso(),
                ),
            )
            return context
        text = context.provider_response.get("text", "")
        context.result = ExecutionResult(
            result_id=str(uuid.uuid4()),
            execution_id=context.execution.execution_id,
            success=True,
            output_text=text,
            output_json=context.provider_response.get("json", {}),
            artifact_id=context.artifact.artifact_id if context.artifact else None,
            usage=context.usage,
        )
        return context


class PolicyResolutionStage:
    name = "policy_resolution"

    def __init__(self, policy_port: ExecutionPolicyPort) -> None:
        self._policy = policy_port

    async def run(self, context: ExecutionPipelineContext) -> ExecutionPipelineContext:
        context.policy = self._policy.resolve(policy_name=context.policy_name)
        context.streaming_enabled = context.policy.streaming_enabled
        return context
