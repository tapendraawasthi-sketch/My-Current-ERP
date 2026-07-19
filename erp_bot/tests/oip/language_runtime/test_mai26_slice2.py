"""MAI-26 slice 2 — consume temporal cues into retrieval as_of (never proven)."""

from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest

from src.oip.contracts.request import (
    CanonicalAIRequestV1,
    InteractionModeV1,
    TrustedScopeV1,
)
from src.oip.modules.conversation.application.hierarchical_router_service import (
    attach_router_decision_to_request,
)
from src.oip.modules.conversation.application.knowledge_source_governance_service import (
    attach_knowledge_source_governance_to_request,
)
from src.oip.modules.conversation.application.temporal_cross_ref_service import (
    RUNTIME_VERSION,
    amendment_cues_present,
    attach_temporal_cross_ref_to_request,
    resolve_retrieval_as_of,
    should_apply_retrieval_as_of,
    temporal_cross_ref_to_metadata,
)
from src.oip.modules.orchestrator.application.dto.workflow_context import (
    WorkflowContext,
)
from src.oip.modules.orchestrator.infrastructure.adapters.stages.module_stages import (
    KnowledgeStageAdapter,
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
    req = attach_knowledge_source_governance_to_request(req)
    return attach_temporal_cross_ref_to_request(req)


def test_runtime_slice2() -> None:
    assert RUNTIME_VERSION == "mai-26.0.2-slice2"


def test_resolve_as_of_from_complete_candidate() -> None:
    req = _pipeline("show VAT rate as of 2024-07-16 under VAT Act")
    meta = temporal_cross_ref_to_metadata(req.temporal_cross_ref_bundle)
    assert should_apply_retrieval_as_of(meta) is True
    assert resolve_retrieval_as_of(meta) == "2024-07-16T23:59:59+00:00"
    assert meta.get("legal_effective_dates_proven") is False
    assert meta.get("amendment_filter_mode") == "CUES_ONLY"


def test_skip_has_no_as_of() -> None:
    req = _pipeline("asdf qwer zxcv")
    meta = temporal_cross_ref_to_metadata(req.temporal_cross_ref_bundle)
    assert should_apply_retrieval_as_of(meta) is False
    assert resolve_retrieval_as_of(meta) is None


def test_amendment_cues_only_never_applied() -> None:
    req = _pipeline("show VAT report FY 2080/81 amended section 12 supersedes")
    meta = temporal_cross_ref_to_metadata(req.temporal_cross_ref_bundle)
    assert amendment_cues_present(meta) is True
    assert meta.get("amendment_applied") is False
    assert req.temporal_cross_ref_bundle is not None
    assert req.temporal_cross_ref_bundle.amendment_applied is False


def test_proven_claim_blocks_as_of_apply() -> None:
    assert (
        resolve_retrieval_as_of(
            {
                "analysis_status": "COMPLETE",
                "as_of_candidate": "2024-07-16",
                "legal_effective_dates_proven": True,
                "amendment_applied": False,
                "is_execution_authority": False,
            }
        )
        is None
    )


@pytest.mark.asyncio
async def test_knowledge_stage_passes_as_of() -> None:
    req = _pipeline("show VAT rate as of 2024-07-16 under VAT Act")
    meta = temporal_cross_ref_to_metadata(req.temporal_cross_ref_bundle)
    captured: dict = {}

    async def _retrieve(**kwargs):
        captured.update(kwargs)
        snap = MagicMock()
        snap.snapshot_id = "snap-1"
        snap.as_of = kwargs.get("as_of") or "now"
        bun = MagicMock()
        bun.bundle_id = "bun-1"
        bun.metadata = {"snippets": []}
        return snap, bun

    ports = MagicMock()
    ports.knowledge = MagicMock()
    ports.knowledge.retrieve = AsyncMock(side_effect=_retrieve)
    ports.feature_flags.knowledge_module_enabled = True

    ctx = WorkflowContext(
        workflow_id="wf-1",
        tenant_id="tenant-a",
        request_id="req-1",
        correlation_id="corr-1",
        conversation_id="conv-1",
        company_id="co-1",
        user_id="user-1",
        session_id="sess-1",
        message="show VAT rate as of 2024-07-16 under VAT Act",
        metadata={"temporal_cross_ref": meta},
    )
    adapter = KnowledgeStageAdapter(ports)
    out_ctx, result = await adapter.execute(ctx)
    assert captured.get("as_of") == "2024-07-16T23:59:59+00:00"
    assert out_ctx.knowledge_ref is not None
    assert out_ctx.knowledge_ref.get("as_of_from_temporal_cues") is True
    assert out_ctx.knowledge_ref.get("legal_effective_dates_proven") is False
    assert out_ctx.knowledge_ref.get("amendment_applied") is False
    assert result.status.value == "completed"


def test_frozen_eval_fixtures() -> None:
    import json
    from pathlib import Path

    path = (
        Path(__file__).resolve().parents[4]
        / "evals"
        / "mai26"
        / "frozen"
        / "temporal_cross_ref_consume_v1.jsonl"
    )
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        case = json.loads(line)
        req = _pipeline(case["text"])
        meta = temporal_cross_ref_to_metadata(req.temporal_cross_ref_bundle)
        assert meta.get("legal_effective_dates_proven") is False
        assert meta.get("amendment_applied") is False
        apply = should_apply_retrieval_as_of(meta)
        assert apply is bool(case["expected_apply_as_of"]), case["case_id"]
        resolved = resolve_retrieval_as_of(meta)
        if case.get("expected_as_of"):
            assert resolved == case["expected_as_of"], case["case_id"]
        elif not apply:
            assert resolved is None
        if case.get("expected_amendment_cues") is not None:
            assert amendment_cues_present(meta) is bool(
                case["expected_amendment_cues"]
            ), case["case_id"]
