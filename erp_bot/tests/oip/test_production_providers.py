"""OIP Phase 2.6 — Production provider adapter tests."""

from __future__ import annotations

import json

from dataclasses import replace

import httpx
import pytest

from src.oip.modules.provider_runtime.domain.value_objects import ExecutionContext, ExecutionPolicyName
from src.oip.modules.provider_runtime.infrastructure.adapters.provider_adapter_registry import (
    ProviderAdapterRegistry,
    create_default_provider_adapters,
)
from src.oip.modules.provider_runtime.infrastructure.adapters.providers.anthropic_adapter import (
    AnthropicProviderAdapter,
)
from src.oip.modules.provider_runtime.infrastructure.adapters.providers.errors import (
    ProviderAuthError,
    ProviderRateLimitError,
)
from src.oip.modules.provider_runtime.infrastructure.adapters.providers.gemini_adapter import GeminiProviderAdapter
from src.oip.modules.provider_runtime.infrastructure.adapters.providers.groq_adapter import GroqProviderAdapter
from src.oip.modules.provider_runtime.infrastructure.adapters.providers.http_base import ProviderRuntimeConfig
from src.oip.modules.provider_runtime.infrastructure.adapters.providers.model_catalog import create_default_model_catalog
from src.oip.modules.provider_runtime.infrastructure.adapters.providers.ollama_adapter import OllamaProviderAdapter
from src.oip.modules.provider_runtime.infrastructure.adapters.providers.openai_adapter import OpenAIProviderAdapter
from src.oip.modules.provider_runtime.infrastructure.adapters.streaming_adapter import DefaultStreamingAdapter
from src.oip.modules.provider_runtime.domain.value_objects import StreamingMode
from src.oip.modules.provider_runtime.application.pipeline.stages import ProviderInvocationStage
from src.oip.modules.provider_runtime.infrastructure.adapters.execution_health_adapter import (
    DefaultExecutionHealthAdapter,
)
from src.oip.modules.router.domain.entities import RouteDecision
from src.oip.modules.router.domain.value_objects import FallbackChain, ProviderSelection, RoutingScore


def _execution_context(*, provider_id: str = "openai", model_hint: str | None = "gpt-4o-mini") -> ExecutionContext:
    return ExecutionContext(
        context_id="ctx-1",
        execution_id="exec-1",
        tenant_id="tenant-a",
        request_id="req-1",
        conversation_id="conv-1",
        company_id="company-a",
        route_id="route-1",
        plan_id="plan-1",
        provider_id=provider_id,
        model_hint=model_hint,
        policy_name=ExecutionPolicyName.BALANCED,
        edition="cloud",
        deployment_mode="cloud_saas",
        capability_token_id="tok-1",
        sandbox_id="sandbox-1",
        metadata={},
    )


def _production_config(**overrides) -> ProviderRuntimeConfig:
    base = ProviderRuntimeConfig(
        openai_api_key="test-openai",
        anthropic_api_key="test-anthropic",
        google_api_key="test-google",
        groq_api_key="test-groq",
        force_stub_providers=False,
        offline_mode=False,
        max_retries=2,
        retry_backoff_seconds=0.01,
        provider_timeout_seconds=5.0,
    )
    return replace(base, **overrides)


@pytest.mark.asyncio
async def test_openai_adapter_complete():
    def handler(request: httpx.Request) -> httpx.Response:
        payload = json.loads(request.content.decode())
        assert payload["model"] == "gpt-4o-mini"
        return httpx.Response(
            200,
            json={
                "choices": [{"message": {"content": "Ledger balance is NPR 12,500"}}],
                "usage": {"prompt_tokens": 12, "completion_tokens": 8},
            },
        )

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    adapter = OpenAIProviderAdapter(
        provider_id="openai",
        default_model="gpt-4o-mini",
        region="us-east-1",
        config=_production_config(),
        http_client=client,
    )
    response = await adapter.invoke(
        provider_id="openai",
        context=_execution_context(),
        prompt="What is the cash balance?",
        tools=("erp.ledger.query",),
        streaming=False,
    )
    assert "Ledger balance" in response["text"]
    assert response["usage"]["input_tokens"] == 12
    assert response["json"]["context_window"] > 0
    await client.aclose()


@pytest.mark.asyncio
async def test_openai_adapter_streaming_tokens():
    lines = [
        'data: {"choices":[{"delta":{"content":"Hel"}}]}',
        'data: {"choices":[{"delta":{"content":"lo"}}]}',
        "data: [DONE]",
    ]

    def handler(request: httpx.Request) -> httpx.Response:
        assert json.loads(request.content.decode()).get("stream") is True
        return httpx.Response(200, content="\n".join(lines).encode())

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    adapter = OpenAIProviderAdapter(
        provider_id="openai",
        default_model="gpt-4o-mini",
        region="us-east-1",
        config=_production_config(),
        http_client=client,
    )
    response = await adapter.invoke(
        provider_id="openai",
        context=_execution_context(),
        prompt="Hello",
        tools=(),
        streaming=True,
    )
    assert response["text"] == "Hello"
    assert response["stream_tokens"] == ["Hel", "lo"]
    streaming = DefaultStreamingAdapter()
    chunks = [
        chunk
        async for chunk in streaming.stream_chunks(
            execution_id="exec-1",
            provider_response=response,
            mode=StreamingMode.SSE,
        )
    ]
    assert chunks == ["Hel", "lo"]
    await client.aclose()


@pytest.mark.asyncio
async def test_anthropic_adapter_complete():
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.headers["x-api-key"] == "test-anthropic"
        return httpx.Response(
            200,
            json={
                "content": [{"type": "text", "text": "VAT is 13%"}],
                "usage": {"input_tokens": 10, "output_tokens": 6},
            },
        )

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    adapter = AnthropicProviderAdapter(
        provider_id="anthropic",
        default_model="claude-3-5-haiku-20241022",
        region="us-east-1",
        config=_production_config(),
        http_client=client,
    )
    response = await adapter.invoke(
        provider_id="anthropic",
        context=_execution_context(provider_id="anthropic", model_hint="claude-3-5-haiku-20241022"),
        prompt="Calculate VAT",
        tools=(),
        streaming=False,
    )
    assert response["text"] == "VAT is 13%"
    await client.aclose()


@pytest.mark.asyncio
async def test_gemini_adapter_complete():
    def handler(request: httpx.Request) -> httpx.Response:
        assert "models/gemini-1.5-flash:generateContent" in str(request.url)
        return httpx.Response(
            200,
            json={
                "candidates": [{"content": {"parts": [{"text": "Report ready"}]}}],
                "usageMetadata": {"promptTokenCount": 5, "candidatesTokenCount": 3},
            },
        )

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    adapter = GeminiProviderAdapter(
        provider_id="google",
        default_model="gemini-1.5-flash",
        region="us-central1",
        config=_production_config(),
        http_client=client,
    )
    response = await adapter.invoke(
        provider_id="google",
        context=_execution_context(provider_id="google", model_hint="gemini-1.5-flash"),
        prompt="Generate report",
        tools=(),
        streaming=False,
    )
    assert response["text"] == "Report ready"
    await client.aclose()


@pytest.mark.asyncio
async def test_groq_adapter_complete():
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.headers["Authorization"] == "Bearer test-groq"
        assert request.url.path.endswith("/chat/completions")
        payload = json.loads(request.content.decode())
        assert payload["model"] == "llama-3.3-70b-versatile"
        return httpx.Response(
            200,
            json={
                "choices": [{"message": {"content": "Groq response"}}],
                "usage": {"prompt_tokens": 4, "completion_tokens": 2},
            },
        )

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    adapter = GroqProviderAdapter(
        provider_id="groq",
        default_model="llama-3.3-70b-versatile",
        region="us-west-1",
        config=_production_config(),
        http_client=client,
    )
    response = await adapter.invoke(
        provider_id="groq",
        context=_execution_context(provider_id="groq", model_hint="llama-3.3-70b-versatile"),
        prompt="Quick answer",
        tools=(),
        streaming=False,
    )
    assert response["text"] == "Groq response"
    assert response["usage"]["input_tokens"] == 4
    assert response["provider_id"] == "groq"
    await client.aclose()


@pytest.mark.asyncio
async def test_groq_adapter_streaming_tokens():
    lines = [
        'data: {"choices":[{"delta":{"content":"Gro"}}]}',
        'data: {"choices":[{"delta":{"content":"q"}}]}',
        "data: [DONE]",
    ]

    def handler(request: httpx.Request) -> httpx.Response:
        assert json.loads(request.content.decode()).get("stream") is True
        return httpx.Response(200, content="\n".join(lines).encode())

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    adapter = GroqProviderAdapter(
        provider_id="groq",
        default_model="llama-3.3-70b-versatile",
        region="us-west-1",
        config=_production_config(),
        http_client=client,
    )
    response = await adapter.invoke(
        provider_id="groq",
        context=_execution_context(provider_id="groq", model_hint="llama-3.3-70b-versatile"),
        prompt="Stream me",
        tools=(),
        streaming=True,
    )
    assert response["text"] == "Groq"
    assert response["stream_tokens"] == ["Gro", "q"]
    await client.aclose()


@pytest.mark.asyncio
async def test_groq_rate_limit_retry_then_success():
    calls = {"count": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        calls["count"] += 1
        if calls["count"] == 1:
            return httpx.Response(429, json={"error": "rate limited"})
        return httpx.Response(
            200,
            json={
                "choices": [{"message": {"content": "Recovered"}}],
                "usage": {"prompt_tokens": 1, "completion_tokens": 1},
            },
        )

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    adapter = GroqProviderAdapter(
        provider_id="groq",
        default_model="llama-3.3-70b-versatile",
        region="us-west-1",
        config=_production_config(max_retries=2),
        http_client=client,
    )
    response = await adapter.invoke(
        provider_id="groq",
        context=_execution_context(provider_id="groq", model_hint="llama-3.3-70b-versatile"),
        prompt="retry me",
        tools=(),
        streaming=False,
    )
    assert response["text"] == "Recovered"
    assert calls["count"] == 2
    await client.aclose()


@pytest.mark.asyncio
async def test_groq_production_activation_not_stub():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "choices": [{"message": {"content": "Live Groq"}}],
                "usage": {"prompt_tokens": 3, "completion_tokens": 2},
            },
        )

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    config = _production_config(
        force_stub_providers=False,
        groq_api_key="live-groq-key",
        default_provider="groq",
        default_model="llama-3.3-70b-versatile",
    )
    registry = ProviderAdapterRegistry(config=config, http_client=client)
    adapter = registry.get_adapter("groq")
    assert isinstance(adapter, GroqProviderAdapter)
    response = await adapter.invoke(
        provider_id="groq",
        context=_execution_context(provider_id="groq"),
        prompt="Activate Groq",
        tools=(),
        streaming=False,
    )
    assert response["text"] == "Live Groq"
    assert not response["text"].startswith("[groq]")
    await client.aclose()


@pytest.mark.asyncio
async def test_groq_stub_when_force_stub_enabled():
    client = httpx.AsyncClient(transport=httpx.MockTransport(lambda _: httpx.Response(500)))
    config = _production_config(force_stub_providers=True, groq_api_key="live-groq-key")
    adapter = GroqProviderAdapter(
        provider_id="groq",
        default_model="llama-3.3-70b-versatile",
        region="us-west-1",
        config=config,
        http_client=client,
    )
    response = await adapter.invoke(
        provider_id="groq",
        context=_execution_context(provider_id="groq"),
        prompt="Should stub",
        tools=(),
        streaming=False,
    )
    assert response["text"].startswith("[groq]")
    await client.aclose()


@pytest.mark.asyncio
async def test_groq_default_model_from_env_config():
    config = _production_config(
        default_provider="groq",
        default_model="llama-3.3-70b-versatile",
    )
    adapters = create_default_provider_adapters(config)
    groq = adapters["groq"]
    assert isinstance(groq, GroqProviderAdapter)
    assert groq._default_model == "llama-3.3-70b-versatile"


@pytest.mark.asyncio
async def test_ollama_adapter_complete():
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path.endswith("/api/chat")
        return httpx.Response(
            200,
            json={"message": {"content": "Local model reply"}, "prompt_eval_count": 7, "eval_count": 5},
        )

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    adapter = OllamaProviderAdapter(
        provider_id="ollama",
        default_model="llama3.2",
        region="local",
        config=_production_config(),
        http_client=client,
    )
    response = await adapter.invoke(
        provider_id="ollama",
        context=_execution_context(provider_id="ollama", model_hint="llama3.2"),
        prompt="Offline query",
        tools=(),
        streaming=False,
    )
    assert response["text"] == "Local model reply"
    assert response["usage"]["input_tokens"] == 7
    await client.aclose()


@pytest.mark.asyncio
async def test_openai_rate_limit_retry_then_success():
    calls = {"count": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        calls["count"] += 1
        if calls["count"] == 1:
            return httpx.Response(429, json={"error": "rate limited"})
        return httpx.Response(
            200,
            json={"choices": [{"message": {"content": "Recovered"}}], "usage": {"prompt_tokens": 1, "completion_tokens": 1}},
        )

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    adapter = OpenAIProviderAdapter(
        provider_id="openai",
        default_model="gpt-4o-mini",
        region="us-east-1",
        config=_production_config(max_retries=2),
        http_client=client,
    )
    response = await adapter.invoke(
        provider_id="openai",
        context=_execution_context(),
        prompt="retry me",
        tools=(),
        streaming=False,
    )
    assert response["text"] == "Recovered"
    assert calls["count"] == 2
    await client.aclose()


@pytest.mark.asyncio
async def test_openai_auth_error_not_retryable():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(401, json={"error": "invalid key"})

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    adapter = OpenAIProviderAdapter(
        provider_id="openai",
        default_model="gpt-4o-mini",
        region="us-east-1",
        config=_production_config(max_retries=3),
        http_client=client,
    )
    with pytest.raises(ProviderAuthError):
        await adapter.invoke(
            provider_id="openai",
            context=_execution_context(),
            prompt="fail",
            tools=(),
            streaming=False,
        )
    await client.aclose()


@pytest.mark.asyncio
async def test_provider_registry_resolves_adapters():
    registry = ProviderAdapterRegistry(config=_production_config())
    for provider_id in ("openai", "anthropic", "google", "groq", "ollama"):
        assert registry.get_adapter(provider_id) is not None


@pytest.mark.asyncio
async def test_provider_invocation_fallback():
    calls: list[str] = []

    class FailingAdapter:
        async def invoke(self, **kwargs):
            calls.append(kwargs["provider_id"])
            raise ProviderRateLimitError("throttled")

    class SuccessAdapter:
        async def invoke(self, **kwargs):
            calls.append(kwargs["provider_id"])
            return {
                "provider_id": kwargs["provider_id"],
                "model": "gpt-4o-mini",
                "text": "fallback ok",
                "streamable": False,
                "usage": {"input_tokens": 1, "output_tokens": 1},
            }

    registry = ProviderAdapterRegistry(adapters={"openai": FailingAdapter(), "groq": SuccessAdapter()})
    stage = ProviderInvocationStage(registry, DefaultExecutionHealthAdapter())
    from datetime import datetime, timezone

    from src.oip.modules.router.domain.value_objects import RouteStatus, RoutingPolicyName

    now = datetime.now(timezone.utc)
    route = RouteDecision(
        route_id="route-1",
        plan_id="plan-1",
        request_id="req-1",
        tenant_id="tenant-a",
        company_id="company-a",
        conversation_id="conv-1",
        correlation_id="corr-1",
        status=RouteStatus.APPROVED,
        routing_policy=RoutingPolicyName.BALANCED,
        edition="cloud",
        deployment_mode="cloud_saas",
        primary_provider=ProviderSelection(provider_id="openai", score=RoutingScore()),
        fallback_chain=FallbackChain(providers=("groq",), max_retries=2),
        selected_tools=(),
        estimated_cost_micros=1000,
        estimated_latency_ms=1000,
        estimated_tokens=1000,
        created_at=now,
        updated_at=now,
    )
    from src.oip.modules.provider_runtime.application.pipeline.context import ExecutionPipelineContext
    from src.oip.modules.provider_runtime.domain.entities import ExecutionAggregate
    from src.oip.modules.provider_runtime.domain.value_objects import ExecutionPolicyName, ExecutionStatus

    ctx = ExecutionPipelineContext(
        route=route,
        policy_name=ExecutionPolicyName.BALANCED,
        execution=ExecutionAggregate(
            execution_id="exec-1",
            route_id="route-1",
            plan_id="plan-1",
            request_id="req-1",
            tenant_id="tenant-a",
            correlation_id="corr-1",
            status=ExecutionStatus.RUNNING,
            policy_name=ExecutionPolicyName.BALANCED,
            edition="cloud",
            deployment_mode="cloud_saas",
            provider_id="openai",
            created_at=now,
            updated_at=now,
        ),
        context=_execution_context(),
        prompt="test",
        streaming_enabled=False,
    )
    result = await stage.run(ctx)
    assert result.provider_response["text"] == "fallback ok"
    assert result.resolved_provider_id == "groq"
    assert "openai" in calls and "groq" in calls


def test_model_catalog_cost_estimation():
    catalog = create_default_model_catalog()
    cost = catalog.estimate_cost_micros(model_id="gpt-4o-mini", input_tokens=1000, output_tokens=500)
    assert cost > 0


def test_default_adapters_include_production_types():
    adapters = create_default_provider_adapters(_production_config())
    assert isinstance(adapters["openai"], OpenAIProviderAdapter)
    assert isinstance(adapters["anthropic"], AnthropicProviderAdapter)
    assert isinstance(adapters["google"], GeminiProviderAdapter)
    assert isinstance(adapters["groq"], GroqProviderAdapter)
    assert isinstance(adapters["ollama"], OllamaProviderAdapter)
