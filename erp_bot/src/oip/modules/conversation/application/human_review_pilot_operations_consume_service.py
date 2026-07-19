"""MAI-47 slice 2 — consume human review / pilot ops policy into candidates.

Default: CANDIDATE_ONLY (build review/pilot candidate; never claims complete).
Optional allow_* flags are for unit-test labeling only — live ingress always
forces false. Never go-live authorization or production pilot approval.
"""

from __future__ import annotations

from typing import Any, Mapping

from ....contracts.human_review_pilot_operations import (
    HumanReviewPilotOperationsBundleV1,
    HumanReviewPilotOperationsReadiness,
    HumanReviewPilotOperationsStatus,
)
from ....contracts.request import CanonicalAIRequestV1

RUNTIME_VERSION = "mai-47.0.2-slice2"
AUTHORITY = "ADR_0064"


def _as_hrpo_meta(
    bundle: Mapping[str, Any] | HumanReviewPilotOperationsBundleV1 | None,
) -> dict[str, Any] | None:
    if bundle is None:
        return None
    if isinstance(bundle, HumanReviewPilotOperationsBundleV1):
        from .human_review_pilot_operations_service import (
            human_review_pilot_operations_to_metadata,
        )

        return human_review_pilot_operations_to_metadata(bundle)
    if isinstance(bundle, Mapping):
        return dict(bundle)
    return None


def _authority_blocks(data: Mapping[str, Any]) -> bool:
    return (
        data.get("is_execution_authority") is True
        or data.get("mutation_tools_allowed") is True
        or data.get("review_authority_claimed") is True
        or data.get("human_review_complete") is True
        or data.get("pilot_approved") is True
        or data.get("production_pilot_authorized") is True
        or data.get("reviewer_signoff_proven") is True
        or data.get("gold_suite_accepted") is True
        or data.get("ops_runbook_live") is True
        or data.get("acceptance_criteria_met") is True
        or data.get("go_live_authorized") is True
        or data.get("current_law_definitive") is True
        or data.get("legal_effective_dates_proven") is True
        or data.get("claims_verified") is True
        or data.get("legal_proof_claimed") is True
        or data.get("kb_retrieval_invoked") is True
        or int(data.get("documents_retrieved") or 0) != 0
        or int(data.get("draft_mutations") or 0) != 0
        or int(data.get("posting_mutations") or 0) != 0
        or str(data.get("gap_p2_008_status") or "OPEN") != "OPEN"
        or str(data.get("specialist_signoff_status") or "NOT_SIGNED")
        != "NOT_SIGNED"
        or str(data.get("release_status") or "NOT_RELEASED") != "NOT_RELEASED"
        or str(data.get("gold_questions_status") or "NOT_RELEASED")
        != "NOT_RELEASED"
        or str(
            data.get("pilot_scope")
            or "HUMAN_REVIEW_PILOT_OPERATIONS_CANDIDATE_ONLY"
        )
        != "HUMAN_REVIEW_PILOT_OPERATIONS_CANDIDATE_ONLY"
    )


def resolve_human_review_pilot_operations_consume_mode(
    bundle: Mapping[str, Any] | HumanReviewPilotOperationsBundleV1 | None,
    *,
    allow_reviewer_signoff: bool = False,
    allow_go_live: bool = False,
) -> str:
    """Return consume mode (never implies review complete on default path)."""
    data = _as_hrpo_meta(bundle)
    if data is None:
        return "UNCHANGED"
    if _authority_blocks(data):
        return "BLOCKED"
    status = str(data.get("analysis_status") or "")
    if status != HumanReviewPilotOperationsStatus.COMPLETE.value:
        return "SKIP"
    readiness = str(data.get("human_review_pilot_operations_readiness") or "")
    if readiness == HumanReviewPilotOperationsReadiness.BLOCKED.value:
        return "BLOCKED"
    if readiness == HumanReviewPilotOperationsReadiness.NOT_APPLICABLE.value:
        return "SKIP"
    if readiness not in {
        HumanReviewPilotOperationsReadiness.POLICY_DECLARED.value,
        HumanReviewPilotOperationsReadiness.SCOPE_PARTIAL.value,
    }:
        return "SKIP"
    topics = data.get("in_scope_topics") or ()
    if not topics:
        return "BLOCKED"
    if allow_reviewer_signoff:
        return "INVOKE_REVIEWER_SIGNOFF"
    if allow_go_live:
        return "INVOKE_GO_LIVE"
    return "CANDIDATE_ONLY"


def build_human_review_pilot_operations_candidate(
    bundle: Mapping[str, Any] | HumanReviewPilotOperationsBundleV1 | None,
    *,
    field_overrides: Mapping[str, Any] | None = None,
    allow_reviewer_signoff: bool = False,
    allow_go_live: bool = False,
) -> dict[str, Any]:
    """Build human review / pilot ops candidate (never claims review complete)."""
    data = _as_hrpo_meta(bundle)
    mode = resolve_human_review_pilot_operations_consume_mode(
        data,
        allow_reviewer_signoff=allow_reviewer_signoff,
        allow_go_live=allow_go_live,
    )
    overrides = dict(field_overrides or {})
    base: dict[str, Any] = {
        "human_review_pilot_operations_consume_mode": mode,
        "human_review_pilot_operations_consume_ready": False,
        "human_review_pilot_operations_candidate": None,
        "mutation_tools_allowed": False,
        "review_authority_claimed": False,
        "human_review_complete": False,
        "pilot_approved": False,
        "production_pilot_authorized": False,
        "reviewer_signoff_proven": False,
        "gold_suite_accepted": False,
        "ops_runbook_live": False,
        "acceptance_criteria_met": False,
        "go_live_authorized": False,
        "current_law_definitive": False,
        "legal_effective_dates_proven": False,
        "claims_verified": False,
        "legal_proof_claimed": False,
        "kb_retrieval_invoked": False,
        "documents_retrieved": 0,
        "draft_mutations": 0,
        "posting_mutations": 0,
        "gap_p2_008_status": "OPEN",
        "specialist_signoff_status": "NOT_SIGNED",
        "release_status": "NOT_RELEASED",
        "gold_questions_status": "NOT_RELEASED",
        "is_execution_authority": False,
        "runtime_version": RUNTIME_VERSION,
        "allow_reviewer_signoff": False,
        "allow_go_live": False,
    }
    if data is None or mode in {"UNCHANGED", "SKIP", "BLOCKED"}:
        return base

    topics = data.get("in_scope_topics") or ()
    if isinstance(topics, tuple):
        topics = list(topics)
    unsupported = data.get("unsupported_topics") or ()
    if isinstance(unsupported, tuple):
        unsupported = list(unsupported)

    candidate = {
        "pilot_scope": "HUMAN_REVIEW_PILOT_OPERATIONS_CANDIDATE_ONLY",
        "human_review_pilot_operations_readiness": data.get(
            "human_review_pilot_operations_readiness"
        ),
        "in_scope_topics": topics,
        "unsupported_topics": unsupported,
        "release_status": "NOT_RELEASED",
        "gold_questions_status": "NOT_RELEASED",
        "review_packet": None,
        "pilot_ops_plan": None,
        "gold_suite_packet": None,
        "signoff_packet": None,
        "ops_runbook": None,
        "acceptance_packet": None,
        "go_live_packet": None,
        "definitive_answer": None,
        "specialist_signoff_status": "NOT_SIGNED",
        "review_authority_claimed": False,
        "human_review_complete": False,
        "pilot_approved": False,
        "production_pilot_authorized": False,
        "reviewer_signoff_proven": False,
        "gold_suite_accepted": False,
        "ops_runbook_live": False,
        "acceptance_criteria_met": False,
        "go_live_authorized": False,
        "field_overrides": overrides,
        "gap_p2_008_status": "OPEN",
        "ready": True,
    }
    ready = mode == "CANDIDATE_ONLY" and bool(candidate["in_scope_topics"])
    base.update(
        {
            "human_review_pilot_operations_consume_ready": ready,
            "human_review_pilot_operations_candidate": candidate,
        }
    )
    return base


def human_review_pilot_operations_consume_observability(
    request: CanonicalAIRequestV1,
    *,
    allow_reviewer_signoff: bool = False,
    allow_go_live: bool = False,
) -> dict[str, Any]:
    """Merge consume observability; live path forces allow flags false."""
    del allow_reviewer_signoff, allow_go_live
    built = build_human_review_pilot_operations_candidate(
        request.human_review_pilot_operations_bundle,
        field_overrides={},
        allow_reviewer_signoff=False,
        allow_go_live=False,
    )
    return {
        "human_review_pilot_operations_consume_mode": built[
            "human_review_pilot_operations_consume_mode"
        ],
        "human_review_pilot_operations_consume_ready": bool(
            built["human_review_pilot_operations_consume_ready"]
        ),
        "human_review_pilot_operations_candidate": built.get(
            "human_review_pilot_operations_candidate"
        ),
        "mutation_tools_allowed": False,
        "review_authority_claimed": False,
        "human_review_complete": False,
        "pilot_approved": False,
        "production_pilot_authorized": False,
        "reviewer_signoff_proven": False,
        "gold_suite_accepted": False,
        "ops_runbook_live": False,
        "acceptance_criteria_met": False,
        "go_live_authorized": False,
        "current_law_definitive": False,
        "legal_effective_dates_proven": False,
        "claims_verified": False,
        "legal_proof_claimed": False,
        "kb_retrieval_invoked": False,
        "documents_retrieved": 0,
        "draft_mutations": 0,
        "posting_mutations": 0,
        "gap_p2_008_status": "OPEN",
        "specialist_signoff_status": "NOT_SIGNED",
        "release_status": "NOT_RELEASED",
        "gold_questions_status": "NOT_RELEASED",
        "is_execution_authority": False,
        "runtime_version": RUNTIME_VERSION,
        "allow_reviewer_signoff": False,
        "allow_go_live": False,
    }


def assert_human_review_pilot_operations_consume_authority(
    obs: Mapping[str, Any] | None,
) -> None:
    if not obs:
        return
    if (
        obs.get("is_execution_authority") is True
        or obs.get("mutation_tools_allowed") is True
        or obs.get("review_authority_claimed") is True
        or obs.get("human_review_complete") is True
        or obs.get("pilot_approved") is True
        or obs.get("production_pilot_authorized") is True
        or obs.get("reviewer_signoff_proven") is True
        or obs.get("gold_suite_accepted") is True
        or obs.get("ops_runbook_live") is True
        or obs.get("acceptance_criteria_met") is True
        or obs.get("go_live_authorized") is True
        or obs.get("current_law_definitive") is True
        or obs.get("legal_effective_dates_proven") is True
        or obs.get("claims_verified") is True
        or obs.get("legal_proof_claimed") is True
        or obs.get("kb_retrieval_invoked") is True
        or int(obs.get("documents_retrieved") or 0) != 0
        or int(obs.get("draft_mutations") or 0) != 0
        or int(obs.get("posting_mutations") or 0) != 0
        or obs.get("allow_reviewer_signoff") is True
        or obs.get("allow_go_live") is True
        or str(obs.get("gap_p2_008_status") or "OPEN") != "OPEN"
        or str(obs.get("specialist_signoff_status") or "NOT_SIGNED")
        != "NOT_SIGNED"
        or str(obs.get("release_status") or "NOT_RELEASED") != "NOT_RELEASED"
    ):
        raise RuntimeError("HUMAN_REVIEW_PILOT_OPERATIONS_CONSUME_AUTHORITY")


def enrich_hrpo_metadata_with_consume(
    hrpo_meta: dict[str, Any],
    request: CanonicalAIRequestV1,
) -> dict[str, Any]:
    out = dict(hrpo_meta)
    obs = human_review_pilot_operations_consume_observability(
        request,
        allow_reviewer_signoff=False,
        allow_go_live=False,
    )
    out.update(obs)
    out["runtime_version"] = RUNTIME_VERSION
    return out
