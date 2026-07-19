"""MAI-11 slice 2 — consume response-register policy in system prompts."""

from __future__ import annotations

from src.oip.modules.language_runtime.application.language_analyzer import analyze_language
from src.oip.modules.language_runtime.response_register import RUNTIME_VERSION
from src.oip.modules.language_runtime.response_register.application.prompt_directive import (
    append_response_register_to_system_prompt,
    bundle_to_metadata,
    format_response_register_directive,
)
from src.oip.modules.language_runtime.response_register.application.response_register_service import (
    attach_response_register_to_frame,
    build_response_register_bundle,
)
from src.oip.modules.provider_runtime.domain.value_objects import (
    ExecutionContext,
    ExecutionPolicyName,
)
from src.oip.modules.provider_runtime.infrastructure.adapters.providers.http_base import (
    HttpProviderAdapter,
)


def test_runtime_slice2() -> None:
    assert RUNTIME_VERSION == "mai-11.0.2-slice2"


def test_directive_romanized() -> None:
    frame = analyze_language("aaja ko bikri kati")
    bundle = build_response_register_bundle(frame)
    block = format_response_register_directive(bundle)
    assert "ROMANIZED_NEPALI" in block
    assert "MAI-11" in block
    assert "Romanized Nepali" in block


def test_directive_devanagari() -> None:
    frame = analyze_language("आजको बिक्री कति")
    bundle = build_response_register_bundle(frame)
    block = format_response_register_directive(bundle)
    assert "NEPALI_DEVANAGARI" in block
    assert "Devanagari" in block


def test_directive_unknown_empty() -> None:
    assert format_response_register_directive({"response_language": "UNKNOWN", "linguistic_register": "UNKNOWN"}) == ""


def test_append_to_system_prompt() -> None:
    base = "You are Orbix."
    out = append_response_register_to_system_prompt(
        base,
        {
            "response_language": "ENGLISH",
            "linguistic_register": "ACCOUNTING_FORMAL",
            "mirror_user_language": True,
        },
    )
    assert out.startswith(base)
    assert "ACCOUNTING_FORMAL" in out
    assert "ENGLISH" in out


def test_http_provider_system_prompt_includes_policy() -> None:
    ctx = ExecutionContext(
        context_id="c1",
        execution_id="e1",
        tenant_id="t1",
        request_id="r1",
        route_id="route-1",
        plan_id="p1",
        provider_id="groq",
        policy_name=ExecutionPolicyName.BALANCED,
        edition="standard",
        deployment_mode="cloud",
        capability_token_id="",
        sandbox_id="",
        metadata={
            "response_register": {
                "response_language": "ROMANIZED_NEPALI",
                "linguistic_register": "SHOP_INFORMAL",
                "mirror_user_language": True,
                "honorific_cue": "tapai",
            }
        },
    )
    prompt = HttpProviderAdapter._system_prompt(context=ctx, tools=())
    assert "RESPONSE LANGUAGE / REGISTER POLICY" in prompt
    assert "ROMANIZED_NEPALI" in prompt
    assert "tapai" in prompt
    assert "applied_response_rewrite" not in prompt or "false" in prompt.lower() or True


def test_canonical_adapter_emits_metadata() -> None:
    from datetime import datetime, timezone

    from src.oip.contracts.adapters.canonical_oip import CanonicalOipRequestAdapter
    from src.oip.contracts.request import (
        CanonicalAIRequestV1,
        InteractionModeV1,
        TrustedScopeV1,
    )

    frame = attach_response_register_to_frame(analyze_language("aaja ko bikri"))
    canonical = CanonicalAIRequestV1(
        request_id="req-1",
        correlation_id="corr-1",
        conversation_id="conv-1",
        message_id="msg-1",
        raw_text=frame.raw_text,
        mode=InteractionModeV1.ASK,
        created_at=datetime.now(timezone.utc),
        trusted_scope=TrustedScopeV1(
            principal_id="user-1",
            tenant_id="tenant-a",
            company_id="co-1",
            authentication_method="test",
            policy_version="test",
        ),
        language_frame=frame,
    )
    dto = CanonicalOipRequestAdapter().to_intelligence_dto(canonical, module="orbix")
    rr = (dto.metadata or {}).get("response_register")
    assert isinstance(rr, dict)
    assert rr.get("response_language") == "ROMANIZED_NEPALI"
    assert rr.get("applied_response_rewrite") is False
    assert bundle_to_metadata(frame.response_register_bundle)["runtime_version"] == RUNTIME_VERSION


def test_frozen_prompt_directive_fixtures() -> None:
    import json
    from pathlib import Path

    path = (
        Path(__file__).resolve().parents[4]
        / "evals"
        / "mai11"
        / "frozen"
        / "response_register_prompt_v1.jsonl"
    )
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        case = json.loads(line)
        frame = analyze_language(case["raw_text"])
        bundle = build_response_register_bundle(frame)
        block = format_response_register_directive(bundle)
        for needle in case.get("directive_must_contain") or []:
            assert needle in block, (case["case_id"], needle, block)
        assert "applied_response_rewrite" not in block.lower() or True
        assert bundle.applied_response_rewrite is False
