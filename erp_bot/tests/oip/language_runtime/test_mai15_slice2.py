"""MAI-15 slice 2 — amount correction overlay into pending drafts."""

from __future__ import annotations

from decimal import Decimal
from pathlib import Path

import pytest

from src.khata.purchase_draft import (
    load_pending_draft,
    save_draft,
    start_or_merge_purchase,
)
from src.oip.integration.mode_aware_erp import handle_mode_aware_erp
from src.oip.modules.conversation.application.reference_coreference_service import (
    RUNTIME_VERSION,
    build_reference_coreference_bundle,
    reference_coreference_to_metadata,
    select_amount_correction_overlay,
)
from src.oip.contracts.dialogue import ContractStatus, TurnRelationKind, TurnRelationV1
from src.oip.contracts.object_reference import (
    ObjectReferenceBundleV1,
    ObjectReferenceCandidateV1,
    ObjectReferenceKind,
    ObjectReferenceResolutionStatus,
    ObjectReferenceResolutionV1,
    ObjectReferenceStatus,
)


@pytest.fixture(autouse=True)
def _isolate_purchase_draft_store(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    import src.khata.purchase_draft as pd

    monkeypatch.setenv("ORBIX_DRAFT_STORE_DIR", str(tmp_path / "drafts"))
    pd._MEMORY.clear()
    yield
    pd._MEMORY.clear()


def test_runtime_slice2() -> None:
    assert RUNTIME_VERSION == "mai-15.0.2-slice2"


def test_select_overlay_matrix() -> None:
    rc = {
        "corrections": [
            {
                "correction_id": "cor-0001",
                "target_kind": "AMOUNT",
                "cue_kind": "NEGATE_REPLACE",
                "proposed_value_surface": "600",
                "applied": False,
            }
        ]
    }
    assert select_amount_correction_overlay(
        reference_coreference=rc,
        turn_relation={"relation": "CORRECT_ACTIVE_DRAFT", "status": "READY"},
        pending_kind="purchase",
    ).get("total_amount") == Decimal("600")
    assert (
        select_amount_correction_overlay(
            reference_coreference=rc,
            turn_relation={"relation": "CONFIRMATION_INTENT"},
            pending_kind="purchase",
        )
        == {}
    )
    assert (
        select_amount_correction_overlay(
            reference_coreference=rc,
            turn_relation={"relation": "ANSWER_CLARIFICATION"},
            pending_kind="purchase",
        )
        == {}
    )
    assert (
        select_amount_correction_overlay(
            reference_coreference=rc,
            turn_relation={"relation": "CORRECT_ACTIVE_DRAFT"},
            pending_kind="financial",
        )
        == {}
    )


def _seed_pending(*, session: str):
    draft = start_or_merge_purchase(
        "I bought 50 kg goods.",
        session_id=session,
        tenant_id="t1",
        company_id="c1",
        user_id="u1",
    )
    save_draft(draft)
    return draft


def _rc_meta_for_text(raw_text: str, draft_id: str) -> dict:
    oref = ObjectReferenceBundleV1(
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
                draft_kind="purchase",
                draft_status="awaiting_clarification",
            ),
        ),
        candidate_count=1,
        resolution_count=1,
        found_count=1,
    )
    bundle = build_reference_coreference_bundle(
        raw_text=raw_text,
        turn_relation=TurnRelationV1(
            relation=TurnRelationKind.CORRECT_ACTIVE_DRAFT,
            classifier_version="mai-14.0.2-slice2",
            status=ContractStatus.READY,
        ),
        object_reference_bundle=oref,
    )
    return reference_coreference_to_metadata(bundle)


def test_correct_applies_amount_overlay() -> None:
    session = "mai15-correct"
    d1 = _seed_pending(session=session)
    result = handle_mode_aware_erp(
        "500 hoina 600",
        orbix_mode="accountant",
        session_id=session,
        tenant_id="t1",
        company_id="c1",
        user_id="u1",
        user_role="accountant",
        turn_relation={
            "relation": "CORRECT_ACTIVE_DRAFT",
            "status": "READY",
        },
        reference_coreference=_rc_meta_for_text("500 hoina 600", d1.draft_id),
    )
    assert result is not None
    assert result.draft_id == d1.draft_id
    assert result.applied_correction is not None
    assert result.applied_correction.get("applied") is True
    assert result.applied_correction.get("value_surface") == "600"
    pending = load_pending_draft(
        session_id=session, tenant_id="t1", company_id="c1", draft_id=d1.draft_id
    )
    assert pending is not None
    assert pending.total_amount == Decimal("600")


def test_make_it_applies_amount() -> None:
    session = "mai15-makeit"
    d1 = _seed_pending(session=session)
    result = handle_mode_aware_erp(
        "make it 450",
        orbix_mode="accountant",
        session_id=session,
        tenant_id="t1",
        company_id="c1",
        user_id="u1",
        user_role="accountant",
        turn_relation={"relation": "CORRECT_ACTIVE_DRAFT", "status": "READY"},
        reference_coreference=_rc_meta_for_text("make it 450", d1.draft_id),
    )
    assert result is not None
    pending = load_pending_draft(
        session_id=session, tenant_id="t1", company_id="c1", draft_id=d1.draft_id
    )
    assert pending is not None
    assert pending.total_amount == Decimal("450")


def test_confirmation_does_not_apply() -> None:
    session = "mai15-confirm"
    d1 = _seed_pending(session=session)
    handle_mode_aware_erp(
        "ho",
        orbix_mode="accountant",
        session_id=session,
        tenant_id="t1",
        company_id="c1",
        user_id="u1",
        user_role="accountant",
        turn_relation={"relation": "CONFIRMATION_INTENT", "status": "READY"},
        reference_coreference=_rc_meta_for_text("500 hoina 600", d1.draft_id),
    )
    pending = load_pending_draft(
        session_id=session, tenant_id="t1", company_id="c1", draft_id=d1.draft_id
    )
    assert pending is not None
    assert pending.total_amount is None


def test_answer_clarification_no_mai15_overlay() -> None:
    session = "mai15-clarify"
    d1 = _seed_pending(session=session)
    # Even if RC metadata has amount correction, ANSWER_CLARIFICATION must not overlay.
    handle_mode_aware_erp(
        "500 hoina 600",
        orbix_mode="accountant",
        session_id=session,
        tenant_id="t1",
        company_id="c1",
        user_id="u1",
        user_role="accountant",
        turn_relation={"relation": "ANSWER_CLARIFICATION", "status": "READY"},
        reference_coreference=_rc_meta_for_text("500 hoina 600", d1.draft_id),
    )
    pending = load_pending_draft(
        session_id=session, tenant_id="t1", company_id="c1", draft_id=d1.draft_id
    )
    assert pending is not None
    # Extract alone must not force MAI-15 negate-replace overlay.
    assert pending.total_amount != Decimal("600")


def test_candidates_remain_unapplied_in_metadata() -> None:
    meta = _rc_meta_for_text("make it 450", "draft-x")
    assert meta.get("draft_mutations") == 0
    assert meta.get("silent_applications") == 0
    for c in meta.get("corrections") or []:
        assert c.get("applied") is False


def test_frozen_eval_apply_matrix() -> None:
    import json
    from pathlib import Path as P

    path = (
        P(__file__).resolve().parents[4]
        / "evals"
        / "mai15"
        / "frozen"
        / "correction_apply_gate_v1.jsonl"
    )
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        case = json.loads(line)
        overlay = select_amount_correction_overlay(
            reference_coreference={
                "corrections": case.get("corrections") or [],
            },
            turn_relation={
                "relation": case["relation"],
                "status": case.get("status", "READY"),
            },
            pending_kind=case.get("pending_kind"),
        )
        allowed = bool(overlay)
        assert allowed is case["allows_amount_apply"], case["case_id"]
