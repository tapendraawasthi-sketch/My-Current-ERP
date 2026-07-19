"""MAI-22 slice 2 — apply provider cascade onto RouteDecision."""

from __future__ import annotations

from datetime import datetime, timezone

from src.oip.contracts.request import (
    CanonicalAIRequestV1,
    InteractionModeV1,
    TrustedScopeV1,
)
from src.oip.modules.conversation.application.clarification_plan_service import (
    attach_clarification_plan_to_request,
)
from src.oip.modules.conversation.application.event_frame_extraction_service import (
    attach_event_frame_extraction_to_request,
)
from src.oip.modules.conversation.application.event_spec_registry_service import (
    attach_event_spec_registry_to_request,
)
from src.oip.modules.conversation.application.hierarchical_router_service import (
    attach_router_decision_to_request,
)
from src.oip.modules.conversation.application.provider_cascade_service import (
    RUNTIME_VERSION,
    apply_provider_cascade_to_route,
    attach_provider_cascade_to_request,
    provider_cascade_to_metadata,
    should_apply_provider_cascade,
)
from src.oip.modules.conversation.application.typed_plan_service import (
    attach_typed_plan_to_request,
)
from src.oip.modules.router.domain.entities import RouteDecision
from src.oip.modules.router.domain.value_objects import (
    FallbackChain,
    ProviderSelection,
    RouteStatus,
    RoutingPolicyName,
    RoutingScore,
)


def _pipeline(text: str):
    req = CanonicalAIRequestV1(
        request_id="req-1",
        correlation_id="corr-1",
        conversation_id="conv-1",
        message_id="msg-1",
        raw_text=text,
        mode=InteractionModeV1.ASK,
        created_at=datetime.now(timezone.utc),
        trusted_scope=TrustedScopeV1(
            principal_id="user-1",
            tenant_id="tenant-a",
            company_id="co-1",
            authentication_method="test",
            policy_version="test",
        ),
    )
    req = attach_router_decision_to_request(req)
    req = attach_event_spec_registry_to_request(req)
    req = attach_event_frame_extraction_to_request(req)
    req = attach_clarification_plan_to_request(req)
    req = attach_typed_plan_to_request(req)
    return attach_provider_cascade_to_request(req)


def _route(*, primary: str = "openai") -> RouteDecision:
    now = datetime.now(timezone.utc)
    return RouteDecision(
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
        primary_provider=ProviderSelection(
            provider_id=primary, score=RoutingScore()
        ),
        fallback_chain=FallbackChain(providers=("groq",), max_retries=2),
        selected_tools=(),
        estimated_cost_micros=1000,
        estimated_latency_ms=1000,
        estimated_tokens=1000,
        created_at=now,
        updated_at=now,
    )


def test_runtime_slice2() -> None:
    assert RUNTIME_VERSION == "mai-22.0.2-slice2"


def test_none_cascade_keeps_route() -> None:
    assert should_apply_provider_cascade(None) is False
    route = _route(primary="openai")
    out = apply_provider_cascade_to_route(route, None)
    assert out.primary_provider.provider_id == "openai"


def test_skip_cascade_keeps_route() -> None:
    req = _pipeline("bought 50 kg rice from Ram")
    meta = provider_cascade_to_metadata(req.provider_cascade_bundle)
    assert should_apply_provider_cascade(meta) is False
    route = _route(primary="openai")
    out = apply_provider_cascade_to_route(route, meta)
    assert out.primary_provider.provider_id == "openai"


def test_complete_cascade_overlays_route() -> None:
    req = _pipeline("Ram bata 500 ko saman kine")
    meta = provider_cascade_to_metadata(req.provider_cascade_bundle)
    assert should_apply_provider_cascade(meta) is True
    route = _route(primary="openai")
    out = apply_provider_cascade_to_route(route, meta)
    selected = meta["selected_provider_id"]
    assert out.primary_provider.provider_id == selected
    assert list(out.fallback_chain.providers) == list(meta["fallback_chain"])
    pd = out.policy_decisions.get("provider_cascade") or {}
    assert pd.get("applied") is True
    assert pd.get("is_execution_authority") is False
    assert pd.get("selected_provider_id") == selected


def test_execution_authority_blocks_apply() -> None:
    meta = {
        "analysis_status": "COMPLETE",
        "selected_provider_id": "groq",
        "cascade_order": ["groq", "ollama"],
        "fallback_chain": ["ollama"],
        "is_execution_authority": True,
        "model_invocations": 0,
        "draft_mutations": 0,
    }
    assert should_apply_provider_cascade(meta) is False


def test_frozen_eval_fixtures() -> None:
    import json
    from pathlib import Path

    path = (
        Path(__file__).resolve().parents[4]
        / "evals"
        / "mai22"
        / "frozen"
        / "provider_cascade_consume_v1.jsonl"
    )
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        case = json.loads(line)
        req = _pipeline(case["text"])
        meta = provider_cascade_to_metadata(req.provider_cascade_bundle)
        apply = should_apply_provider_cascade(meta)
        if "expected_apply" in case:
            assert apply is case["expected_apply"], case["case_id"]
        if apply:
            route = _route(primary="openai")
            out = apply_provider_cascade_to_route(route, meta)
            assert out.primary_provider.provider_id == meta["selected_provider_id"]
            assert (
                out.policy_decisions.get("provider_cascade", {}).get(
                    "is_execution_authority"
                )
                is False
            )
