"""MAI-47 — human review / pilot ops policy (never claims review complete).

Slice 1: declare candidate human-review/pilot-ops policy from cue detection.
Never claims human review complete, pilot approved, or go-live authorized.
"""

from __future__ import annotations

import re
from typing import Any

from ....contracts.human_review_pilot_operations import (
    HumanReviewPilotOperationsBundleV1,
    HumanReviewPilotOperationsReadiness,
    HumanReviewPilotOperationsStatus,
    HumanReviewPilotOperationsTopic,
)
from ....contracts.request import CanonicalAIRequestV1

RUNTIME_VERSION = "mai-47.0.2-slice2"
AUTHORITY = "ADR_0064"

_HUMAN_REVIEW = re.compile(
    r"\b(?:human\s+review|professional\s+review|honesty\s+review)\b",
    re.I,
)
_PILOT_OPS = re.compile(
    r"\b(?:pilot\s+ops|pilot\s+operations|ops\s+pilot)\b",
    re.I,
)
_GOLD = re.compile(
    r"\b(?:gold\s+suite|gold\s+questions|eval\s+gold)\b",
    re.I,
)
_SIGNOFF = re.compile(
    r"\b(?:reviewer\s+sign[- ]?off|specialist\s+sign[- ]?off)\b",
    re.I,
)
_RUNBOOK = re.compile(
    r"\b(?:ops\s+runbook|operations\s+runbook|pilot\s+runbook)\b",
    re.I,
)
_ACCEPTANCE = re.compile(
    r"\b(?:acceptance\s+criteria|acceptance\s+gate)\b",
    re.I,
)
_GO_LIVE = re.compile(
    r"\b(?:go[- ]live\s+checklist|go[- ]live\s+gate)\b",
    re.I,
)
_UNSUPPORTED = re.compile(
    r"\b(?:customs|excise|भन्सार|अन्तःशुल्क)\b",
    re.I,
)


def _detect_topics(text: str) -> tuple[list[str], list[str]]:
    in_scope: list[str] = []
    unsupported: list[str] = []
    raw = text or ""
    if _HUMAN_REVIEW.search(raw):
        in_scope.append(HumanReviewPilotOperationsTopic.HUMAN_REVIEW.value)
    if _PILOT_OPS.search(raw):
        in_scope.append(HumanReviewPilotOperationsTopic.PILOT_OPS.value)
    if _GOLD.search(raw):
        in_scope.append(HumanReviewPilotOperationsTopic.GOLD_SUITE.value)
    if _SIGNOFF.search(raw):
        in_scope.append(
            HumanReviewPilotOperationsTopic.REVIEWER_SIGNOFF.value
        )
    if _RUNBOOK.search(raw):
        in_scope.append(HumanReviewPilotOperationsTopic.OPS_RUNBOOK.value)
    if _ACCEPTANCE.search(raw):
        in_scope.append(
            HumanReviewPilotOperationsTopic.ACCEPTANCE_CRITERIA.value
        )
    if _GO_LIVE.search(raw):
        in_scope.append(
            HumanReviewPilotOperationsTopic.GO_LIVE_CHECKLIST.value
        )
    if _UNSUPPORTED.search(raw) and not in_scope:
        unsupported.append(HumanReviewPilotOperationsTopic.UNSUPPORTED.value)
    return in_scope, unsupported


def build_human_review_pilot_operations_bundle(
    request: CanonicalAIRequestV1,
) -> HumanReviewPilotOperationsBundleV1:
    in_scope, unsupported = _detect_topics(request.raw_text or "")
    if not in_scope and unsupported:
        return HumanReviewPilotOperationsBundleV1(
            analysis_status=HumanReviewPilotOperationsStatus.COMPLETE,
            runtime_version=RUNTIME_VERSION,
            human_review_pilot_operations_readiness=(
                HumanReviewPilotOperationsReadiness.BLOCKED
            ),
            unsupported_topics=tuple(unsupported),
            reason_codes=(
                "UNSUPPORTED_TOPIC_OUTSIDE_PILOT",
                "HUMAN_REVIEW_PILOT_OPERATIONS_BLOCKED",
                "NO_REVIEW_AUTHORITY",
                "GAP_P2_008_OPEN",
            ),
            warnings=(
                "UNSUPPORTED_TOPIC_DOCUMENTED",
                "GAP_P2_008_REMAINS_OPEN",
            ),
        )

    if not in_scope:
        return HumanReviewPilotOperationsBundleV1(
            analysis_status=HumanReviewPilotOperationsStatus.SKIP,
            runtime_version=RUNTIME_VERSION,
            human_review_pilot_operations_readiness=(
                HumanReviewPilotOperationsReadiness.NOT_APPLICABLE
            ),
            reason_codes=(
                "NO_IN_SCOPE_HUMAN_REVIEW_PILOT_OPERATIONS_TOPIC",
            ),
            warnings=("HUMAN_REVIEW_PILOT_OPERATIONS_NOT_APPLICABLE",),
        )

    pilot_ready = (
        HumanReviewPilotOperationsReadiness.SCOPE_PARTIAL
        if unsupported
        else HumanReviewPilotOperationsReadiness.POLICY_DECLARED
    )
    reasons = [
        "PILOT_SCOPE_HUMAN_REVIEW_PILOT_OPERATIONS_CANDIDATE_ONLY",
        "REVIEW_SUITE_NOT_RELEASED",
        "GOLD_QUESTIONS_NOT_RELEASED",
        "SPECIALIST_SIGNOFF_NOT_SIGNED",
        "NO_REVIEW_AUTHORITY",
        "HUMAN_REVIEW_NOT_COMPLETE",
        "PILOT_NOT_APPROVED",
        "PRODUCTION_PILOT_NOT_AUTHORIZED",
        "REVIEWER_SIGNOFF_NOT_PROVEN",
        "GOLD_SUITE_NOT_ACCEPTED",
        "OPS_RUNBOOK_NOT_LIVE",
        "ACCEPTANCE_CRITERIA_NOT_MET",
        "GO_LIVE_NOT_AUTHORIZED",
        "GAP_P2_008_OPEN",
        *tuple(f"TOPIC_{t}" for t in in_scope),
    ]
    return HumanReviewPilotOperationsBundleV1(
        analysis_status=HumanReviewPilotOperationsStatus.COMPLETE,
        runtime_version=RUNTIME_VERSION,
        human_review_pilot_operations_readiness=pilot_ready,
        in_scope_topics=tuple(in_scope),
        unsupported_topics=tuple(unsupported),
        reason_codes=tuple(reasons),
        warnings=(
            "GAP_P2_008_REMAINS_OPEN",
            "HUMAN_REVIEW_PILOT_OPERATIONS_CANDIDATE_ONLY",
            "MUST_NOT_CLAIM_HUMAN_REVIEW_COMPLETE",
            "SPECIALIST_SIGNOFF_PENDING",
            "NOT_PRODUCTION_PILOT_AUTHORIZED",
        ),
    )


def attach_human_review_pilot_operations_to_request(
    request: CanonicalAIRequestV1,
) -> CanonicalAIRequestV1:
    bundle = build_human_review_pilot_operations_bundle(request)
    return request.model_copy(
        update={"human_review_pilot_operations_bundle": bundle}
    )


def assert_human_review_pilot_operations_authority(
    bundle: HumanReviewPilotOperationsBundleV1 | None,
) -> None:
    if bundle is None:
        return
    if (
        bundle.is_execution_authority
        or bundle.mutation_tools_allowed
        or bundle.review_authority_claimed
        or bundle.human_review_complete
        or bundle.pilot_approved
        or bundle.production_pilot_authorized
        or bundle.reviewer_signoff_proven
        or bundle.gold_suite_accepted
        or bundle.ops_runbook_live
        or bundle.acceptance_criteria_met
        or bundle.go_live_authorized
        or bundle.current_law_definitive
        or bundle.legal_effective_dates_proven
        or bundle.claims_verified
        or bundle.legal_proof_claimed
        or bundle.kb_retrieval_invoked
        or bundle.documents_retrieved != 0
        or bundle.draft_mutations != 0
        or bundle.posting_mutations != 0
        or bundle.gap_p2_008_status != "OPEN"
        or bundle.specialist_signoff_status != "NOT_SIGNED"
        or bundle.release_status != "NOT_RELEASED"
        or bundle.gold_questions_status != "NOT_RELEASED"
        or bundle.pilot_scope
        != "HUMAN_REVIEW_PILOT_OPERATIONS_CANDIDATE_ONLY"
    ):
        raise RuntimeError("HUMAN_REVIEW_PILOT_OPERATIONS_AUTHORITY")


def human_review_pilot_operations_to_metadata(
    bundle: HumanReviewPilotOperationsBundleV1 | None,
) -> dict[str, Any]:
    if bundle is None:
        return {}
    return {
        "analysis_status": bundle.analysis_status.value,
        "runtime_version": bundle.runtime_version,
        "human_review_pilot_operations_readiness": (
            bundle.human_review_pilot_operations_readiness.value
        ),
        "pilot_scope": "HUMAN_REVIEW_PILOT_OPERATIONS_CANDIDATE_ONLY",
        "in_scope_topics": list(bundle.in_scope_topics),
        "unsupported_topics": list(bundle.unsupported_topics),
        "release_status": "NOT_RELEASED",
        "gold_questions_status": "NOT_RELEASED",
        "specialist_signoff_status": "NOT_SIGNED",
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
        "gap_p2_008_status": "OPEN",
        "kb_retrieval_invoked": False,
        "documents_retrieved": 0,
        "draft_mutations": 0,
        "posting_mutations": 0,
        "reason_codes": list(bundle.reason_codes),
        "warnings": list(bundle.warnings),
        "is_execution_authority": False,
    }
