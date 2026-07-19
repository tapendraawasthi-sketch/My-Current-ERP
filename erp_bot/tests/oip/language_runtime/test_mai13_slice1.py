"""MAI-13 slice 1 — conversation object-reference candidates."""

from __future__ import annotations

from datetime import datetime, timezone

from pydantic import ValidationError

from src.oip.contracts.object_reference import (
    ObjectReferenceBundleV1,
    ObjectReferenceCandidateV1,
    ObjectReferenceKind,
)
from src.oip.contracts.request import (
    CanonicalAIRequestV1,
    InteractionModeV1,
    TrustedScopeV1,
)
from src.oip.modules.conversation.application.object_reference_service import (
    RUNTIME_VERSION,
    attach_object_references_to_request,
    build_object_reference_bundle,
)


def _canonical(
    *,
    conversation_id: str = "conv-1",
    active_draft_reference: str | None = None,
    active_ui_context: dict | None = None,
    raw_text: str = "aaja ko bikri",
) -> CanonicalAIRequestV1:
    return CanonicalAIRequestV1(
        request_id="req-1",
        correlation_id="corr-1",
        conversation_id=conversation_id,
        message_id="msg-1",
        raw_text=raw_text,
        mode=InteractionModeV1.ASK,
        created_at=datetime.now(timezone.utc),
        trusted_scope=TrustedScopeV1(
            principal_id="user-1",
            tenant_id="tenant-a",
            company_id="co-1",
            authentication_method="test",
            policy_version="test",
        ),
        active_draft_reference=active_draft_reference,
        active_ui_context=dict(active_ui_context or {}),
    )


def test_runtime_version() -> None:
    assert RUNTIME_VERSION == "mai-13.0.1-slice1"


def test_conversation_candidate_always() -> None:
    bundle = build_object_reference_bundle(conversation_id="conv-abc")
    assert bundle.analysis_status.value == "COMPLETE"
    assert bundle.silent_applications == 0
    assert bundle.draft_mutations == 0
    kinds = {c.kind for c in bundle.candidates}
    assert ObjectReferenceKind.CONVERSATION in kinds
    assert any(c.object_id == "conv-abc" for c in bundle.candidates)


def test_active_draft_candidate() -> None:
    bundle = build_object_reference_bundle(
        conversation_id="conv-1",
        active_draft_reference="draft-xyz",
    )
    draft = [c for c in bundle.candidates if c.kind == ObjectReferenceKind.ACTIVE_DRAFT]
    assert len(draft) == 1
    assert draft[0].object_id == "draft-xyz"
    assert draft[0].applied is False


def test_ui_context_candidates_skip_draft_dup() -> None:
    bundle = build_object_reference_bundle(
        conversation_id="conv-1",
        active_draft_reference="draft-1",
        active_ui_context={
            "draft_id": "draft-1",
            "party_id": "party-9",
            "invoice_id": "inv-2",
        },
    )
    kinds = [c.kind for c in bundle.candidates]
    assert kinds.count(ObjectReferenceKind.ACTIVE_DRAFT) == 1
    ui = [c for c in bundle.candidates if c.kind == ObjectReferenceKind.UI_CONTEXT_OBJECT]
    assert {c.object_id for c in ui} == {"party-9", "inv-2"}


def test_attach_does_not_mutate_raw_text() -> None:
    req = _canonical(
        active_draft_reference="draft-42",
        active_ui_context={"voucher_id": "v-1"},
    )
    updated = attach_object_references_to_request(req)
    assert updated.raw_text == req.raw_text
    assert updated.object_reference_bundle is not None
    assert updated.object_reference_bundle.candidate_count >= 2
    assert updated.object_reference_bundle.silent_applications == 0


def test_candidates_must_not_be_applied() -> None:
    try:
        ObjectReferenceCandidateV1(
            candidate_id="oref-0000",
            kind=ObjectReferenceKind.CONVERSATION,
            object_id="c1",
            applied=True,
        )
        raise AssertionError("expected ValidationError")
    except ValidationError:
        pass


def test_bundle_must_not_mutate() -> None:
    try:
        ObjectReferenceBundleV1(silent_applications=1)
        raise AssertionError("expected ValidationError")
    except ValidationError:
        pass
    try:
        ObjectReferenceBundleV1(draft_mutations=1)
        raise AssertionError("expected ValidationError")
    except ValidationError:
        pass


def test_adapter_emits_metadata() -> None:
    from src.oip.contracts.adapters.canonical_oip import CanonicalOipRequestAdapter

    req = attach_object_references_to_request(
        _canonical(active_draft_reference="draft-m")
    )
    dto = CanonicalOipRequestAdapter().to_intelligence_dto(req, module="orbix")
    oref = (dto.metadata or {}).get("object_reference")
    assert isinstance(oref, dict)
    assert oref.get("runtime_version") == RUNTIME_VERSION
    assert oref.get("silent_applications") == 0
    assert oref.get("draft_mutations") == 0
    assert oref.get("candidate_count", 0) >= 2
    kinds = {c["kind"] for c in oref.get("candidates", [])}
    assert "CONVERSATION" in kinds
    assert "ACTIVE_DRAFT" in kinds


def test_frozen_eval_fixtures() -> None:
    import json
    from pathlib import Path

    path = (
        Path(__file__).resolve().parents[4]
        / "evals"
        / "mai13"
        / "frozen"
        / "object_reference_critical_v1.jsonl"
    )
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        case = json.loads(line)
        bundle = build_object_reference_bundle(
            conversation_id=case["conversation_id"],
            active_draft_reference=case.get("active_draft_reference"),
            active_ui_context=case.get("active_ui_context") or {},
        )
        assert bundle.silent_applications == 0
        assert bundle.draft_mutations == 0
        kinds = {c.kind.value for c in bundle.candidates}
        for expected in case.get("expected_kinds", []):
            assert expected in kinds
        if case.get("expected_draft_id"):
            draft_ids = {
                c.object_id
                for c in bundle.candidates
                if c.kind == ObjectReferenceKind.ACTIVE_DRAFT
            }
            assert case["expected_draft_id"] in draft_ids
