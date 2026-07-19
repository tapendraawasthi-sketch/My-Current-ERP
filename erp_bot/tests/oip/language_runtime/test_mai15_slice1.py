"""MAI-15 slice 1 — reference / coreference / correction annotation."""

from __future__ import annotations

from datetime import datetime, timezone

from pydantic import ValidationError

from src.oip.contracts.dialogue import TurnRelationKind, TurnRelationV1, ContractStatus
from src.oip.contracts.object_reference import (
    ObjectReferenceBundleV1,
    ObjectReferenceCandidateV1,
    ObjectReferenceKind,
    ObjectReferenceResolutionStatus,
    ObjectReferenceResolutionV1,
    ObjectReferenceStatus,
)
from src.oip.contracts.reference_coreference import (
    CorrectionCandidateV1,
    CorrectionCueKind,
    CorrectionTargetKind,
    ReferenceCoreferenceStatus,
)
from src.oip.contracts.request import (
    CanonicalAIRequestV1,
    InteractionModeV1,
    TrustedScopeV1,
)
from src.oip.modules.conversation.application.reference_coreference_service import (
    RUNTIME_VERSION,
    attach_reference_coreference_to_request,
    build_reference_coreference_bundle,
)


def _oref_found(draft_id: str = "draft-1") -> ObjectReferenceBundleV1:
    return ObjectReferenceBundleV1(
        analysis_status=ObjectReferenceStatus.COMPLETE,
        candidates=(
            ObjectReferenceCandidateV1(
                candidate_id="oref-0001",
                kind=ObjectReferenceKind.ACTIVE_DRAFT,
                object_id=draft_id,
            ),
        ),
        resolutions=(
            ObjectReferenceResolutionV1(
                candidate_id="oref-0001",
                kind=ObjectReferenceKind.ACTIVE_DRAFT,
                object_id=draft_id,
                resolution_status=ObjectReferenceResolutionStatus.FOUND,
                draft_kind="sale",
                draft_status="awaiting_clarification",
            ),
        ),
        candidate_count=1,
        resolution_count=1,
        found_count=1,
    )


def test_runtime_version() -> None:
    assert RUNTIME_VERSION.startswith("mai-15.")


def test_negate_amount_correction_with_draft() -> None:
    bundle = build_reference_coreference_bundle(
        raw_text="500 hoina 600",
        turn_relation=TurnRelationV1(
            relation=TurnRelationKind.CORRECT_ACTIVE_DRAFT,
            classifier_version="mai-14.0.2-slice2",
            status=ContractStatus.READY,
        ),
        object_reference_bundle=_oref_found(),
    )
    assert bundle.correction_count == 1
    assert bundle.corrections[0].cue_kind == CorrectionCueKind.NEGATE_REPLACE
    assert bundle.corrections[0].proposed_value_surface == "600"
    assert bundle.corrections[0].applied is False
    assert bundle.silent_applications == 0
    assert any(m.kind.value == "AMOUNT" for m in bundle.mentions)


def test_prior_cue_ambiguous_without_draft() -> None:
    bundle = build_reference_coreference_bundle(raw_text="tyo")
    assert bundle.mention_count >= 1
    assert bundle.mentions[0].resolution_status.value == "AMBIGUOUS"
    assert bundle.correction_count == 0


def test_confirm_only_no_corrections() -> None:
    bundle = build_reference_coreference_bundle(
        raw_text="ho",
        turn_relation=TurnRelationV1(
            relation=TurnRelationKind.CONFIRMATION_INTENT,
            classifier_version="mai-14.0.2-slice2",
            status=ContractStatus.READY,
        ),
        object_reference_bundle=_oref_found(),
    )
    assert bundle.correction_count == 0
    assert bundle.mention_count == 0
    assert bundle.turn_relation_echo == TurnRelationKind.CONFIRMATION_INTENT


def test_never_applied() -> None:
    try:
        CorrectionCandidateV1(
            correction_id="cor-0000",
            target_kind=CorrectionTargetKind.AMOUNT,
            cue_kind=CorrectionCueKind.REPLACE_AMOUNT,
            applied=True,
        )
        raise AssertionError("expected ValidationError")
    except ValidationError:
        pass


def test_attach_preserves_raw_text() -> None:
    req = CanonicalAIRequestV1(
        request_id="req-1",
        correlation_id="corr-1",
        conversation_id="conv-1",
        message_id="msg-1",
        raw_text="make it 450",
        mode=InteractionModeV1.ASK,
        created_at=datetime.now(timezone.utc),
        trusted_scope=TrustedScopeV1(
            principal_id="user-1",
            tenant_id="tenant-a",
            company_id="co-1",
            authentication_method="test",
            policy_version="test",
        ),
        turn_relation=TurnRelationV1(
            relation=TurnRelationKind.CORRECT_ACTIVE_DRAFT,
            classifier_version="mai-14.0.2-slice2",
            status=ContractStatus.READY,
        ),
        object_reference_bundle=_oref_found(),
    )
    updated = attach_reference_coreference_to_request(req)
    assert updated.raw_text == req.raw_text
    assert updated.reference_coreference_bundle is not None
    assert updated.reference_coreference_bundle.analysis_status == (
        ReferenceCoreferenceStatus.COMPLETE
    )


def test_adapter_metadata() -> None:
    from src.oip.contracts.adapters.canonical_oip import CanonicalOipRequestAdapter

    req = CanonicalAIRequestV1(
        request_id="req-1",
        correlation_id="corr-1",
        conversation_id="conv-1",
        message_id="msg-1",
        raw_text="500 hoina 600",
        mode=InteractionModeV1.ASK,
        created_at=datetime.now(timezone.utc),
        trusted_scope=TrustedScopeV1(
            principal_id="user-1",
            tenant_id="tenant-a",
            company_id="co-1",
            authentication_method="test",
            policy_version="test",
        ),
        object_reference_bundle=_oref_found(),
    )
    req = attach_reference_coreference_to_request(req)
    dto = CanonicalOipRequestAdapter().to_intelligence_dto(req, module="orbix")
    rc = (dto.metadata or {}).get("reference_coreference")
    assert isinstance(rc, dict)
    assert rc.get("runtime_version") == RUNTIME_VERSION
    assert rc.get("correction_count", 0) >= 1
    assert rc.get("silent_applications") == 0


def test_frozen_eval_fixtures() -> None:
    import json
    from pathlib import Path

    path = (
        Path(__file__).resolve().parents[4]
        / "evals"
        / "mai15"
        / "frozen"
        / "reference_coreference_critical_v1.jsonl"
    )
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        case = json.loads(line)
        oref = _oref_found() if case.get("with_draft") else None
        tr = None
        if case.get("turn_relation"):
            tr = TurnRelationV1(
                relation=TurnRelationKind(case["turn_relation"]),
                classifier_version="mai-14.0.2-slice2",
                status=ContractStatus.READY,
            )
        bundle = build_reference_coreference_bundle(
            raw_text=case["raw_text"],
            turn_relation=tr,
            object_reference_bundle=oref,
            active_ui_context=case.get("active_ui_context") or {},
        )
        assert bundle.silent_applications == 0
        assert bundle.draft_mutations == 0
        assert bundle.correction_count == case["expected_correction_count"]
        if "expected_min_mentions" in case:
            assert bundle.mention_count >= case["expected_min_mentions"]
        if case.get("expected_cue_kind"):
            assert any(
                c.cue_kind.value == case["expected_cue_kind"] for c in bundle.corrections
            )
