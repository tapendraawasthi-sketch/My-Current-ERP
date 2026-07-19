"""MAI-10 slice 2 — concept→intent bridge (evidence-gated)."""

from __future__ import annotations

import pytest

from src.oip.modules.language_runtime.domain_lexicon import RUNTIME_VERSION
from src.oip.modules.language_runtime.domain_lexicon.application.concept_intent_bridge import (
    map_concepts_to_intent,
    resolve_intent_from_message,
)
from src.oip.modules.planner.application.pipeline.intent_classification_stage import (
    IntentClassificationStage,
    create_default_intent_registry,
)


def test_runtime_slice2() -> None:
    assert RUNTIME_VERSION == "mai-10.0.2-slice2"


def test_devanagari_sales_routes() -> None:
    resolved = resolve_intent_from_message("आजको बिक्री कति")
    assert resolved is not None
    assert resolved[0] == "sales_entry"


def test_sales_report_prefers_report() -> None:
    resolved = resolve_intent_from_message("today sales report")
    assert resolved is not None
    assert resolved[0] == "report_generation"


def test_education_abstains_from_bridge() -> None:
    assert resolve_intent_from_message("what is bikri") is None


def test_sales_and_purchase_ambiguous() -> None:
    assert (
        map_concepts_to_intent(
            ["CONCEPT_SALES", "CONCEPT_PURCHASE"],
            message="bikri ra kharid",
        )
        is None
    )


def test_credit_alone_does_not_route() -> None:
    assert resolve_intent_from_message("udhaar") is None


def test_purchase_devanagari() -> None:
    resolved = resolve_intent_from_message("खरिद भयो")
    assert resolved is not None
    assert resolved[0] == "purchase_entry"


@pytest.mark.asyncio
async def test_planner_stage_uses_bridge_metadata() -> None:
    from src.oip.modules.planner.application.dto.planning_request import PlanningRequestDto
    from src.oip.modules.planner.application.pipeline.context import PlanningContext
    from src.oip.modules.planner.domain.value_objects import PlanningPolicyName

    stage = IntentClassificationStage(create_default_intent_registry())
    ctx = PlanningContext(
        request=PlanningRequestDto(
            request_id="r1",
            correlation_id="c1",
            tenant_id="t1",
            user_id="u1",
            session_id="s1",
            module="orbix",
            message="आजको बिक्री",
            policy_name=PlanningPolicyName.BALANCED,
        )
    )
    ctx.normalized_message = "आजको बिक्री"
    ctx = await stage.run(ctx)
    assert ctx.intent == "sales_entry"
    assert ctx.task_profile is not None
    assert ctx.task_profile.metadata.get("intent_source") == "mai10_concept_bridge"
    assert "CONCEPT_SALES" in ctx.task_profile.metadata.get("concept_ids", [])


@pytest.mark.asyncio
async def test_planner_education_not_stolen() -> None:
    from src.oip.modules.planner.application.dto.planning_request import PlanningRequestDto
    from src.oip.modules.planner.application.pipeline.context import PlanningContext
    from src.oip.modules.planner.domain.value_objects import PlanningPolicyName

    stage = IntentClassificationStage(create_default_intent_registry())
    ctx = PlanningContext(
        request=PlanningRequestDto(
            request_id="r1",
            correlation_id="c1",
            tenant_id="t1",
            user_id="u1",
            session_id="s1",
            module="orbix",
            message="what is bikri",
            policy_name=PlanningPolicyName.BALANCED,
        )
    )
    ctx.normalized_message = "what is bikri"
    ctx = await stage.run(ctx)
    assert ctx.intent == "accounting_education"


@pytest.mark.asyncio
async def test_frozen_intent_bridge_fixtures() -> None:
    import json
    from pathlib import Path

    from src.oip.modules.planner.application.dto.planning_request import PlanningRequestDto
    from src.oip.modules.planner.application.pipeline.context import PlanningContext
    from src.oip.modules.planner.domain.value_objects import PlanningPolicyName

    path = (
        Path(__file__).resolve().parents[4]
        / "evals"
        / "mai10"
        / "frozen"
        / "concept_intent_bridge_v1.jsonl"
    )
    stage = IntentClassificationStage(create_default_intent_registry())
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        case = json.loads(line)
        ctx = PlanningContext(
            request=PlanningRequestDto(
                request_id="r1",
                correlation_id="c1",
                tenant_id="t1",
                user_id="u1",
                session_id="s1",
                module="orbix",
                message=case["raw_text"],
                policy_name=PlanningPolicyName.BALANCED,
            )
        )
        ctx.normalized_message = case["raw_text"]
        ctx = await stage.run(ctx)
        assert ctx.intent == case["expected_intent"], (case["case_id"], ctx.intent)
        source = (ctx.task_profile.metadata or {}).get("intent_source") if ctx.task_profile else None
        if "expected_intent_source" in case:
            assert source == case["expected_intent_source"], case["case_id"]
        if "forbidden_intent_source" in case:
            assert source != case["forbidden_intent_source"], case["case_id"]
