"""MAI-16 slice 1 — context assembly + memory policy annotation."""

from __future__ import annotations

from datetime import datetime, timezone

from pydantic import ValidationError

from src.oip.contracts.context_assembly import (
    ContextAssemblyStatus,
    ContextSliceKind,
    MemoryPolicyV1,
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
from src.oip.contracts.request import (
    CanonicalAIRequestV1,
    InteractionModeV1,
    TrustedScopeV1,
)
from src.oip.modules.conversation.application.context_assembly_service import (
    RUNTIME_VERSION,
    attach_context_assembly_to_request,
    build_context_assembly_bundle,
)


def _request(
    *,
    with_draft: bool = False,
    awaiting: bool = False,
    turn_relation: TurnRelationKind | None = None,
) -> CanonicalAIRequestV1:
    oref = None
    if with_draft:
        oref = ObjectReferenceBundleV1(
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
                    draft_status=(
                        "awaiting_clarification" if awaiting else "draft"
                    ),
                ),
            ),
            candidate_count=1,
            resolution_count=1,
            found_count=1,
        )
    tr = None
    if turn_relation is not None:
        tr = TurnRelationV1(
            relation=turn_relation,
            classifier_version="mai-14.0.2-slice2",
            status=ContractStatus.READY,
        )
    return CanonicalAIRequestV1(
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
        active_ui_context={"party_id": "party-9"},
        object_reference_bundle=oref,
        turn_relation=tr,
    )


def test_runtime_version() -> None:
    # Slice 2 bumps the shared runtime constant; slice-1 contracts still hold.
    assert RUNTIME_VERSION.startswith("mai-16.")


def test_policy_forbids_write_and_cross_company() -> None:
    try:
        MemoryPolicyV1(write_allowed=True)
        raise AssertionError("expected ValidationError")
    except ValidationError:
        pass
    try:
        MemoryPolicyV1(cross_company_allowed=True)
        raise AssertionError("expected ValidationError")
    except ValidationError:
        pass


def test_active_task_and_clarification_flags() -> None:
    bundle = build_context_assembly_bundle(
        _request(
            with_draft=True,
            awaiting=True,
            turn_relation=TurnRelationKind.ANSWER_CLARIFICATION,
        )
    )
    assert bundle.analysis_status == ContextAssemblyStatus.COMPLETE
    assert bundle.active_task_present is True
    assert bundle.unresolved_clarification_present is True
    kinds = {s.kind for s in bundle.slices if s.included}
    assert ContextSliceKind.ACTIVE_DRAFT in kinds
    assert ContextSliceKind.UNRESOLVED_CLARIFICATION in kinds
    assert ContextSliceKind.TURN_RELATION in kinds
    assert bundle.memory_writes == 0
    assert bundle.is_execution_authority is False


def test_company_echo_from_trusted_scope() -> None:
    bundle = build_context_assembly_bundle(_request())
    assert bundle.company_id_echo == "co-1"
    assert bundle.tenant_id_echo == "tenant-a"
    assert any(
        s.kind == ContextSliceKind.TRUSTED_SCOPE and s.included for s in bundle.slices
    )


def test_attach_preserves_raw_text() -> None:
    req = _request(with_draft=True, awaiting=True)
    updated = attach_context_assembly_to_request(req)
    assert updated.raw_text == req.raw_text
    assert updated.context_assembly_bundle is not None
    assert updated.context_assembly_bundle.memory_policy.write_allowed is False


def test_adapter_metadata() -> None:
    from src.oip.contracts.adapters.canonical_oip import CanonicalOipRequestAdapter

    req = attach_context_assembly_to_request(
        _request(
            with_draft=True,
            awaiting=True,
            turn_relation=TurnRelationKind.CORRECT_ACTIVE_DRAFT,
        )
    )
    dto = CanonicalOipRequestAdapter().to_intelligence_dto(req, module="orbix")
    ca = (dto.metadata or {}).get("context_assembly")
    assert isinstance(ca, dict)
    assert ca.get("runtime_version") == RUNTIME_VERSION
    assert ca.get("memory_writes") == 0
    assert ca.get("is_execution_authority") is False
    assert ca.get("active_task_present") is True


def test_frozen_eval_fixtures() -> None:
    import json
    from pathlib import Path

    path = (
        Path(__file__).resolve().parents[4]
        / "evals"
        / "mai16"
        / "frozen"
        / "context_assembly_critical_v1.jsonl"
    )
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        case = json.loads(line)
        tr = None
        if case.get("turn_relation"):
            tr = TurnRelationKind(case["turn_relation"])
        bundle = build_context_assembly_bundle(
            _request(
                with_draft=bool(case.get("with_draft")),
                awaiting=bool(case.get("awaiting")),
                turn_relation=tr,
            )
        )
        assert bundle.memory_writes == 0
        assert bundle.silent_applications == 0
        assert bundle.active_task_present is case["expected_active_task"]
        assert (
            bundle.unresolved_clarification_present
            is case["expected_unresolved_clarification"]
        )
        if case.get("expected_included_kinds"):
            kinds = {s.kind.value for s in bundle.slices if s.included}
            for k in case["expected_included_kinds"]:
                assert k in kinds, case["case_id"]
