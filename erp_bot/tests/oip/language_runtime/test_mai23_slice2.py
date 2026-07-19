"""MAI-23 slice 2 — consume prompt-registry refs into system prompts."""

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
from src.oip.modules.conversation.application.prompt_registry_service import (
    RUNTIME_VERSION,
    append_prompt_registry_to_system_prompt,
    assert_prompt_registry_authority,
    attach_prompt_registry_to_request,
    format_prompt_registry_directive,
    prompt_registry_to_metadata,
    should_apply_prompt_registry,
)
from src.oip.modules.conversation.application.provider_cascade_service import (
    attach_provider_cascade_to_request,
)
from src.oip.modules.conversation.application.typed_plan_service import (
    attach_typed_plan_to_request,
)
from src.oip.modules.provider_runtime.domain.value_objects import (
    ExecutionContext,
    ExecutionPolicyName,
)
from src.oip.modules.provider_runtime.infrastructure.adapters.providers.http_base import (
    HttpProviderAdapter,
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
    req = attach_provider_cascade_to_request(req)
    return attach_prompt_registry_to_request(req)


def test_runtime_slice2() -> None:
    assert RUNTIME_VERSION == "mai-23.0.2-slice2"


def test_directive_complete_purchase() -> None:
    req = _pipeline("Ram bata 500 ko saman kine")
    meta = prompt_registry_to_metadata(req.prompt_registry_bundle)
    assert should_apply_prompt_registry(meta) is True
    block = format_prompt_registry_directive(meta)
    assert "PROMPT REGISTRY" in block
    assert "erp.purchase.preview.v1" in block
    assert "schemas/erp.purchase.preview.v1" in block
    assert_prompt_registry_authority(req.prompt_registry_bundle)


def test_directive_skip_empty() -> None:
    req = _pipeline("bought 50 kg rice from Ram")
    meta = prompt_registry_to_metadata(req.prompt_registry_bundle)
    assert should_apply_prompt_registry(meta) is False
    assert format_prompt_registry_directive(meta) == ""


def test_append_to_system_prompt() -> None:
    base = "You are Orbix."
    out = append_prompt_registry_to_system_prompt(
        base,
        {
            "analysis_status": "COMPLETE",
            "selected_prompt_template_id": "erp.purchase.preview.v1",
            "structured_output_schema_ref": "schemas/erp.purchase.preview.v1",
            "event_type": "purchase",
            "is_execution_authority": False,
            "model_invocations": 0,
            "draft_mutations": 0,
        },
    )
    assert out.startswith(base)
    assert "erp.purchase.preview.v1" in out


def test_http_provider_system_prompt_includes_registry() -> None:
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
            "prompt_registry": {
                "analysis_status": "COMPLETE",
                "selected_prompt_template_id": "erp.report.read.v1",
                "structured_output_schema_ref": "schemas/erp.report.read.v1",
                "event_type": "report",
                "is_execution_authority": False,
                "model_invocations": 0,
                "draft_mutations": 0,
            }
        },
    )
    prompt = HttpProviderAdapter._system_prompt(context=ctx, tools=())
    assert "PROMPT REGISTRY / STRUCTURED OUTPUT" in prompt
    assert "erp.report.read.v1" in prompt


def test_authority_blocks_directive() -> None:
    assert (
        format_prompt_registry_directive(
            {
                "analysis_status": "COMPLETE",
                "selected_prompt_template_id": "erp.purchase.preview.v1",
                "is_execution_authority": True,
                "model_invocations": 0,
                "draft_mutations": 0,
            }
        )
        == ""
    )


def test_frozen_eval_fixtures() -> None:
    import json
    from pathlib import Path

    path = (
        Path(__file__).resolve().parents[4]
        / "evals"
        / "mai23"
        / "frozen"
        / "prompt_registry_consume_v1.jsonl"
    )
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        case = json.loads(line)
        req = _pipeline(case["text"])
        meta = prompt_registry_to_metadata(req.prompt_registry_bundle)
        assert meta.get("model_invocations") == 0
        assert meta.get("is_execution_authority") is False
        apply = should_apply_prompt_registry(meta)
        assert apply is bool(case["expected_apply"]), case["case_id"]
        block = format_prompt_registry_directive(meta)
        if apply:
            for needle in case.get("directive_must_contain") or []:
                assert needle in block, (case["case_id"], needle, block)
        else:
            assert block == ""
