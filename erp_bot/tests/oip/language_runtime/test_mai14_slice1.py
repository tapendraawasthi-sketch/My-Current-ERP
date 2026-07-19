"""MAI-14 slice 1 — turn-relation decision (annotation only)."""

from __future__ import annotations

from datetime import datetime, timezone

from src.oip.contracts.dialogue import ContractStatus, TurnRelationKind
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
from src.oip.modules.conversation.application.turn_relation_service import (
    RUNTIME_VERSION,
    attach_turn_relation_to_request,
    decide_turn_relation,
)


def _bundle(
    *,
    draft_id: str | None = "draft-1",
    resolution: ObjectReferenceResolutionStatus = ObjectReferenceResolutionStatus.FOUND,
    draft_status: str | None = "awaiting_clarification",
) -> ObjectReferenceBundleV1:
    candidates: list[ObjectReferenceCandidateV1] = [
        ObjectReferenceCandidateV1(
            candidate_id="oref-0000",
            kind=ObjectReferenceKind.CONVERSATION,
            object_id="conv-1",
            reason_codes=("CONVERSATION_ID",),
        )
    ]
    resolutions: list[ObjectReferenceResolutionV1] = [
        ObjectReferenceResolutionV1(
            candidate_id="oref-0000",
            kind=ObjectReferenceKind.CONVERSATION,
            object_id="conv-1",
            resolution_status=ObjectReferenceResolutionStatus.CONVERSATION_FOUND,
            conversation_status="active",
        )
    ]
    if draft_id:
        candidates.append(
            ObjectReferenceCandidateV1(
                candidate_id="oref-0001",
                kind=ObjectReferenceKind.ACTIVE_DRAFT,
                object_id=draft_id,
                reason_codes=("ACTIVE_DRAFT_REFERENCE",),
            )
        )
        resolutions.append(
            ObjectReferenceResolutionV1(
                candidate_id="oref-0001",
                kind=ObjectReferenceKind.ACTIVE_DRAFT,
                object_id=draft_id,
                resolution_status=resolution,
                draft_kind="sale" if resolution == ObjectReferenceResolutionStatus.FOUND else None,
                draft_status=draft_status,
                store_name="sales_drafts.json",
            )
        )
    return ObjectReferenceBundleV1(
        analysis_status=ObjectReferenceStatus.COMPLETE,
        runtime_version="mai-13.0.2-slice2",
        candidates=tuple(candidates),
        resolutions=tuple(resolutions),
        candidate_count=len(candidates),
        resolution_count=len(resolutions),
        found_count=sum(
            1
            for r in resolutions
            if r.resolution_status
            in {
                ObjectReferenceResolutionStatus.FOUND,
                ObjectReferenceResolutionStatus.CONVERSATION_FOUND,
            }
        ),
        missing_count=sum(
            1
            for r in resolutions
            if r.resolution_status == ObjectReferenceResolutionStatus.MISSING
        ),
        not_pending_count=sum(
            1
            for r in resolutions
            if r.resolution_status == ObjectReferenceResolutionStatus.NOT_PENDING
        ),
    )


def test_runtime_version() -> None:
    assert RUNTIME_VERSION == "mai-14.0.1-slice1"


def test_new_topic_without_draft() -> None:
    d = decide_turn_relation(raw_text="aaja ko bikri kati bhayo")
    assert d.relation == TurnRelationKind.NEW_TOPIC
    assert d.classifier_version == RUNTIME_VERSION
    assert d.is_execution_authority is False


def test_stale_new_topic_with_pending_draft() -> None:
    d = decide_turn_relation(
        raw_text="namaste, aaja ko vat report dinus",
        object_reference_bundle=_bundle(),
        active_draft_reference="draft-1",
    )
    assert d.relation == TurnRelationKind.NEW_TOPIC


def test_not_pending_forbids_continue() -> None:
    d = decide_turn_relation(
        raw_text="continue that draft",
        object_reference_bundle=_bundle(
            resolution=ObjectReferenceResolutionStatus.NOT_PENDING,
            draft_status="posted",
        ),
        active_draft_reference="draft-1",
    )
    assert d.relation != TurnRelationKind.CONTINUE_ACTIVE_DRAFT
    assert d.relation in {TurnRelationKind.NEW_TOPIC, TurnRelationKind.UNKNOWN}


def test_cancel_active_draft() -> None:
    d = decide_turn_relation(
        raw_text="cancel this draft",
        object_reference_bundle=_bundle(),
        active_draft_reference="draft-1",
    )
    assert d.relation == TurnRelationKind.CANCEL_ACTIVE_DRAFT
    assert "draft-1" in d.referenced_object_ids


def test_confirmation_intent() -> None:
    d = decide_turn_relation(
        raw_text="yes",
        object_reference_bundle=_bundle(),
    )
    assert d.relation == TurnRelationKind.CONFIRMATION_INTENT
    assert d.is_execution_authority is False


def test_answer_clarification() -> None:
    d = decide_turn_relation(
        raw_text="cash",
        object_reference_bundle=_bundle(draft_status="awaiting_clarification"),
    )
    assert d.relation == TurnRelationKind.ANSWER_CLARIFICATION


def test_correct_active_draft() -> None:
    d = decide_turn_relation(
        raw_text="make it 450 instead",
        object_reference_bundle=_bundle(),
    )
    assert d.relation == TurnRelationKind.CORRECT_ACTIVE_DRAFT


def test_attach_preserves_raw_text() -> None:
    req = CanonicalAIRequestV1(
        request_id="req-1",
        correlation_id="corr-1",
        conversation_id="conv-1",
        message_id="msg-1",
        raw_text="cancel draft please",
        mode=InteractionModeV1.ASK,
        created_at=datetime.now(timezone.utc),
        trusted_scope=TrustedScopeV1(
            principal_id="user-1",
            tenant_id="tenant-a",
            company_id="co-1",
            authentication_method="test",
            policy_version="test",
        ),
        active_draft_reference="draft-1",
        object_reference_bundle=_bundle(),
    )
    updated = attach_turn_relation_to_request(req)
    assert updated.raw_text == req.raw_text
    assert updated.turn_relation is not None
    assert updated.turn_relation.relation == TurnRelationKind.CANCEL_ACTIVE_DRAFT
    assert updated.turn_relation.status == ContractStatus.READY


def test_adapter_metadata() -> None:
    from src.oip.contracts.adapters.canonical_oip import CanonicalOipRequestAdapter

    req = CanonicalAIRequestV1(
        request_id="req-1",
        correlation_id="corr-1",
        conversation_id="conv-1",
        message_id="msg-1",
        raw_text="yes",
        mode=InteractionModeV1.ASK,
        created_at=datetime.now(timezone.utc),
        trusted_scope=TrustedScopeV1(
            principal_id="user-1",
            tenant_id="tenant-a",
            company_id="co-1",
            authentication_method="test",
            policy_version="test",
        ),
        object_reference_bundle=_bundle(),
    )
    req = attach_turn_relation_to_request(req)
    dto = CanonicalOipRequestAdapter().to_intelligence_dto(req, module="orbix")
    tr = (dto.metadata or {}).get("turn_relation")
    assert isinstance(tr, dict)
    assert tr.get("relation") == "CONFIRMATION_INTENT"
    assert tr.get("is_execution_authority") is False
    assert tr.get("classifier_version") == RUNTIME_VERSION


def test_frozen_eval_fixtures() -> None:
    import json
    from pathlib import Path

    path = (
        Path(__file__).resolve().parents[4]
        / "evals"
        / "mai14"
        / "frozen"
        / "turn_relation_critical_v1.jsonl"
    )
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        case = json.loads(line)
        status_name = case.get("draft_resolution", "FOUND")
        resolution = ObjectReferenceResolutionStatus[status_name]
        bundle = None
        if case.get("with_draft", True):
            bundle = _bundle(
                draft_id=case.get("draft_id", "draft-1"),
                resolution=resolution,
                draft_status=case.get("draft_status", "awaiting_clarification"),
            )
        d = decide_turn_relation(
            raw_text=case["raw_text"],
            object_reference_bundle=bundle,
            active_draft_reference=case.get("active_draft_reference"),
        )
        assert d.relation.value == case["expected_relation"], case["case_id"]
        assert d.is_execution_authority is False
