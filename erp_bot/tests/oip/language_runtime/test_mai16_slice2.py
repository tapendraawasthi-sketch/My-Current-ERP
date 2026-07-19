"""MAI-16 slice 2 — consume context assembly into provider; gate memory writes."""

from __future__ import annotations

from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest

from src.oip.contracts.dialogue import ContractStatus, TurnRelationKind, TurnRelationV1
from src.oip.contracts.object_reference import (
    ObjectReferenceBundleV1,
    ObjectReferenceCandidateV1,
    ObjectReferenceKind,
    ObjectReferenceResolutionStatus,
    ObjectReferenceResolutionV1,
    ObjectReferenceStatus,
)
from src.oip.contracts.request import (
    CanonicalAIRequestV1,
    InteractionModeV1,
    TrustedScopeV1,
)
from src.oip.modules.conversation.application.context_assembly_service import (
    RUNTIME_VERSION,
    append_context_assembly_to_system_prompt,
    attach_context_assembly_to_request,
    format_context_assembly_block,
    memory_content_writes_allowed,
    project_readonly_recall_summaries,
    select_readonly_recall_query,
)
from src.oip.modules.orchestrator.application.dto.workflow_context import (
    WorkflowContext,
)
from src.oip.modules.orchestrator.domain.value_objects import StageRunStatus
from src.oip.modules.orchestrator.infrastructure.adapters.stages.module_stages import (
    MemoryConsolidationStageAdapter,
    MemoryStoreStageAdapter,
    MemoryUpdateStageAdapter,
)
from src.oip.modules.provider_runtime.domain.value_objects import (
    ExecutionContext,
    ExecutionPolicyName,
)
from src.oip.modules.provider_runtime.infrastructure.adapters.providers.http_base import (
    HttpProviderAdapter,
)


def test_runtime_slice2() -> None:
    assert RUNTIME_VERSION == "mai-16.0.2-slice2"


def _assembly_meta(*, write_allowed: bool = False) -> dict:
    req = CanonicalAIRequestV1(
        request_id="req-1",
        correlation_id="corr-1",
        conversation_id="conv-1",
        message_id="msg-1",
        raw_text="cash",
        mode=InteractionModeV1.ASK,
        created_at=datetime.now(timezone.utc),
        trusted_scope=TrustedScopeV1(
            principal_id="user-1",
            tenant_id="tenant-a",
            company_id="co-1",
            authentication_method="test",
            policy_version="test",
        ),
        object_reference_bundle=ObjectReferenceBundleV1(
            analysis_status=ObjectReferenceStatus.COMPLETE,
            candidates=(
                ObjectReferenceCandidateV1(
                    candidate_id="oref-0001",
                    kind=ObjectReferenceKind.ACTIVE_DRAFT,
                    object_id="draft-1",
                ),
            ),
            resolutions=(
                ObjectReferenceResolutionV1(
                    candidate_id="oref-0001",
                    kind=ObjectReferenceKind.ACTIVE_DRAFT,
                    object_id="draft-1",
                    resolution_status=ObjectReferenceResolutionStatus.FOUND,
                    draft_kind="purchase",
                    draft_status="awaiting_clarification",
                ),
            ),
            candidate_count=1,
            resolution_count=1,
            found_count=1,
        ),
        turn_relation=TurnRelationV1(
            relation=TurnRelationKind.ANSWER_CLARIFICATION,
            classifier_version="mai-14.0.2-slice2",
            status=ContractStatus.READY,
        ),
    )
    updated = attach_context_assembly_to_request(req)
    from src.oip.modules.conversation.application.context_assembly_service import (
        context_assembly_to_metadata,
    )

    meta = context_assembly_to_metadata(updated.context_assembly_bundle)
    if write_allowed:
        meta = {
            **meta,
            "memory_policy": {**meta["memory_policy"], "write_allowed": True},
        }
    return meta


def test_writes_gated_when_policy_present() -> None:
    meta = {"context_assembly": _assembly_meta()}
    assert memory_content_writes_allowed(meta) is False
    assert memory_content_writes_allowed({}) is True
    assert memory_content_writes_allowed(None) is True


def test_format_block_includes_included_slices() -> None:
    meta = {"context_assembly": _assembly_meta()}
    block = format_context_assembly_block(meta)
    assert "CONTEXT ASSEMBLY (MAI-16 DATA ONLY)" in block
    assert "ACTIVE_DRAFT" in block
    assert "Active task: yes" in block


def test_append_system_prompt() -> None:
    meta = {"context_assembly": _assembly_meta()}
    out = append_context_assembly_to_system_prompt("You are Orbix.", meta)
    assert out.startswith("You are Orbix.")
    assert "CONTEXT ASSEMBLY" in out


def test_http_provider_system_prompt_includes_assembly() -> None:
    meta = _assembly_meta()
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
            "context_assembly": meta,
            "context_assembly_recall": {
                "summaries": ["prior purchase draft note"],
                "read_only": True,
                "memory_writes": 0,
            },
        },
    )
    prompt = HttpProviderAdapter._system_prompt(context=ctx, tools=())
    assert "CONTEXT ASSEMBLY (MAI-16 DATA ONLY)" in prompt
    assert "ACTIVE_DRAFT" in prompt
    assert "prior purchase draft note" in prompt


def test_recall_query_and_projection() -> None:
    meta = {"context_assembly": _assembly_meta()}
    q = select_readonly_recall_query(meta, "cash")
    assert q
    projected = project_readonly_recall_summaries(
        [
            SimpleNamespace(memory_id="m1", summary="hello memory"),
            SimpleNamespace(memory_id="m2", summary="second"),
        ]
    )
    assert projected["memory_writes"] == 0
    assert projected["read_only"] is True
    assert projected["summaries"] == ["hello memory", "second"]


@pytest.mark.asyncio
async def test_memory_store_skipped_when_write_forbidden() -> None:
    ports = MagicMock()
    ports.memory = AsyncMock()
    ports.feature_flags.memory_module_enabled = True
    stage = MemoryStoreStageAdapter(ports)
    ctx = WorkflowContext(
        tenant_id="t1",
        request_id="r1",
        correlation_id="c1",
        conversation_id="conv-1",
        company_id="co-1",
        workflow_id="w1",
        user_id="u1",
        session_id="s1",
        message="cash",
        metadata={"context_assembly": _assembly_meta()},
    )
    _, result = await stage.execute(ctx)
    assert result.status == StageRunStatus.SKIPPED
    ports.memory.store.assert_not_called()


@pytest.mark.asyncio
async def test_memory_update_and_consolidate_skipped() -> None:
    ports = MagicMock()
    ports.memory = AsyncMock()
    ports.feature_flags.memory_module_enabled = True
    meta = {"context_assembly": _assembly_meta()}
    ctx = WorkflowContext(
        tenant_id="t1",
        request_id="r1",
        correlation_id="c1",
        conversation_id="conv-1",
        company_id="co-1",
        workflow_id="w1",
        user_id="u1",
        session_id="s1",
        message="cash",
        execution_ref={"execution_id": "e1"},
        memory_store_ref={"memory_id": "m1"},
        metadata=meta,
    )
    _, r1 = await MemoryUpdateStageAdapter(ports).execute(ctx)
    _, r2 = await MemoryConsolidationStageAdapter(ports).execute(ctx)
    assert r1.status == StageRunStatus.SKIPPED
    assert r2.status == StageRunStatus.SKIPPED
    ports.memory.update.assert_not_called()
    ports.memory.consolidate.assert_not_called()


def test_frozen_eval_fixtures() -> None:
    import json
    from pathlib import Path

    path = (
        Path(__file__).resolve().parents[4]
        / "evals"
        / "mai16"
        / "frozen"
        / "context_assembly_consume_v1.jsonl"
    )
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        case = json.loads(line)
        meta = {"context_assembly": _assembly_meta()}
        allowed = memory_content_writes_allowed(meta)
        assert allowed is case["expected_writes_allowed"]
        block = format_context_assembly_block(meta)
        if case.get("expect_block"):
            assert "CONTEXT ASSEMBLY" in block
            for kind in case.get("expected_kinds") or []:
                assert kind in block
