"""MAI-43 — continuous change intelligence policy (never production truth).

Slice 1: declare candidate continuous-change policy from MAI-36 research frame.
Never applies amendments, never treats unreviewed detections as truth, never
proves effective dates.
"""

from __future__ import annotations

import re
from typing import Any

from ....contracts.continuous_change_intelligence import (
    ContinuousChangeIntelligenceBundleV1,
    ContinuousChangeIntelligenceStatus,
    ContinuousChangeReadiness,
    ContinuousChangeTopic,
)
from ....contracts.legal_question_research import (
    LegalQuestionResearchStatus,
    ResearchModeReadiness,
)
from ....contracts.request import CanonicalAIRequestV1

RUNTIME_VERSION = "mai-43.0.2-slice2"
AUTHORITY = "ADR_0060"

_AMENDMENT = re.compile(r"\b(?:amendment|संशोधन)\b", re.I)
_GAZETTE = re.compile(r"\b(?:gazette|gazetted|राजपत्र)\b", re.I)
_CIRCULAR = re.compile(r"\b(?:circular)\b", re.I)
_EFFECTIVE = re.compile(
    r"\b(?:effective\s+date(?:\s+change)?|commencement\s+date)\b",
    re.I,
)
_NOTIFICATION = re.compile(r"\b(?:notification|सूचना)\b", re.I)
_ORDINANCE = re.compile(r"\b(?:ordinance|अध्यादेश)\b", re.I)
_RATE = re.compile(r"\b(?:rate\s+change|changed\s+rate)\b", re.I)
_UNSUPPORTED = re.compile(
    r"\b(?:customs|excise|भन्सार|अन्तःशुल्क)\b",
    re.I,
)


def _detect_topics(text: str) -> tuple[list[str], list[str]]:
    in_scope: list[str] = []
    unsupported: list[str] = []
    if _AMENDMENT.search(text or ""):
        in_scope.append(ContinuousChangeTopic.AMENDMENT.value)
    if _GAZETTE.search(text or ""):
        in_scope.append(ContinuousChangeTopic.GAZETTE.value)
    if _CIRCULAR.search(text or ""):
        in_scope.append(ContinuousChangeTopic.CIRCULAR.value)
    if _EFFECTIVE.search(text or ""):
        in_scope.append(ContinuousChangeTopic.EFFECTIVE_DATE_CHANGE.value)
    if _NOTIFICATION.search(text or ""):
        in_scope.append(ContinuousChangeTopic.NOTIFICATION.value)
    if _ORDINANCE.search(text or ""):
        in_scope.append(ContinuousChangeTopic.ORDINANCE.value)
    if _RATE.search(text or ""):
        in_scope.append(ContinuousChangeTopic.RATE_CHANGE.value)
    if _UNSUPPORTED.search(text or "") and not in_scope:
        unsupported.append(ContinuousChangeTopic.UNSUPPORTED.value)
    return in_scope, unsupported


def build_continuous_change_intelligence_bundle(
    request: CanonicalAIRequestV1,
) -> ContinuousChangeIntelligenceBundleV1:
    lqr = request.legal_question_research_bundle
    if lqr is None:
        return ContinuousChangeIntelligenceBundleV1(
            analysis_status=ContinuousChangeIntelligenceStatus.SKIP,
            runtime_version=RUNTIME_VERSION,
            continuous_change_readiness=ContinuousChangeReadiness.NOT_APPLICABLE,
            reason_codes=("NO_LEGAL_QUESTION_RESEARCH",),
            warnings=("NO_LEGAL_QUESTION_RESEARCH",),
        )

    if lqr.analysis_status != LegalQuestionResearchStatus.COMPLETE:
        return ContinuousChangeIntelligenceBundleV1(
            analysis_status=ContinuousChangeIntelligenceStatus.SKIP,
            runtime_version=RUNTIME_VERSION,
            continuous_change_readiness=ContinuousChangeReadiness.NOT_APPLICABLE,
            reason_codes=(
                "LEGAL_RESEARCH_NOT_COMPLETE",
                "CONTINUOUS_CHANGE_NOT_APPLICABLE",
            ),
            warnings=("CONTINUOUS_CHANGE_NOT_APPLICABLE",),
        )

    if not lqr.research_mode_active:
        return ContinuousChangeIntelligenceBundleV1(
            analysis_status=ContinuousChangeIntelligenceStatus.SKIP,
            runtime_version=RUNTIME_VERSION,
            continuous_change_readiness=ContinuousChangeReadiness.NOT_APPLICABLE,
            reason_codes=("RESEARCH_MODE_NOT_ACTIVE",),
            warnings=("CONTINUOUS_CHANGE_NOT_APPLICABLE",),
        )

    readiness = lqr.research_mode_readiness
    if readiness not in {
        ResearchModeReadiness.POLICY_DECLARED,
        ResearchModeReadiness.CLARIFY_REQUIRED,
    }:
        return ContinuousChangeIntelligenceBundleV1(
            analysis_status=ContinuousChangeIntelligenceStatus.SKIP,
            runtime_version=RUNTIME_VERSION,
            continuous_change_readiness=ContinuousChangeReadiness.NOT_APPLICABLE,
            reason_codes=("RESEARCH_READINESS_NOT_ELIGIBLE",),
            warnings=("CONTINUOUS_CHANGE_NOT_APPLICABLE",),
        )

    in_scope, unsupported = _detect_topics(request.raw_text or "")
    if not in_scope and unsupported:
        return ContinuousChangeIntelligenceBundleV1(
            analysis_status=ContinuousChangeIntelligenceStatus.COMPLETE,
            runtime_version=RUNTIME_VERSION,
            continuous_change_readiness=ContinuousChangeReadiness.BLOCKED,
            unsupported_topics=tuple(unsupported),
            research_mode_bound=True,
            reason_codes=(
                "UNSUPPORTED_TOPIC_OUTSIDE_PILOT",
                "CONTINUOUS_CHANGE_BLOCKED",
                "NO_CONTINUOUS_CHANGE_AUTHORITY",
                "GAP_P2_008_OPEN",
            ),
            warnings=(
                "UNSUPPORTED_TOPIC_DOCUMENTED",
                "GAP_P2_008_REMAINS_OPEN",
            ),
        )

    if not in_scope:
        return ContinuousChangeIntelligenceBundleV1(
            analysis_status=ContinuousChangeIntelligenceStatus.SKIP,
            runtime_version=RUNTIME_VERSION,
            continuous_change_readiness=ContinuousChangeReadiness.NOT_APPLICABLE,
            reason_codes=("NO_IN_SCOPE_CONTINUOUS_CHANGE_TOPIC",),
            warnings=("CONTINUOUS_CHANGE_NOT_APPLICABLE",),
        )

    pilot_ready = (
        ContinuousChangeReadiness.SCOPE_PARTIAL
        if unsupported
        else ContinuousChangeReadiness.POLICY_DECLARED
    )
    reasons = [
        "RESEARCH_MODE_BOUND",
        "PILOT_SCOPE_CONTINUOUS_CHANGE_CANDIDATE_ONLY",
        "CHANGE_CORPUS_NOT_RELEASED",
        "GOLD_QUESTIONS_NOT_RELEASED",
        "SPECIALIST_SIGNOFF_NOT_SIGNED",
        "NO_CONTINUOUS_CHANGE_AUTHORITY",
        "UNREVIEWED_NOT_PRODUCTION_TRUTH",
        "CACHE_NOT_INVALIDATED",
        "RATES_NOT_CHANGED_AS_TRUTH",
        "CHANGE_NOT_APPLIED",
        "AMENDMENT_NOT_APPLIED",
        "ROLLBACK_NOT_EXECUTED",
        "NO_KB_RETRIEVAL_AUTHORITY",
        "CURRENT_LAW_NOT_DEFINITIVE",
        "LEGAL_EFFECTIVE_DATES_NOT_PROVEN",
        "CLAIMS_NOT_VERIFIED",
        "GAP_P2_008_OPEN",
        *tuple(f"TOPIC_{t}" for t in in_scope),
    ]
    if readiness == ResearchModeReadiness.CLARIFY_REQUIRED:
        reasons.append("UPSTREAM_CLARIFY_REQUIRED_STILL_UNPROVEN")

    return ContinuousChangeIntelligenceBundleV1(
        analysis_status=ContinuousChangeIntelligenceStatus.COMPLETE,
        runtime_version=RUNTIME_VERSION,
        continuous_change_readiness=pilot_ready,
        in_scope_topics=tuple(in_scope),
        unsupported_topics=tuple(unsupported),
        research_mode_bound=True,
        reason_codes=tuple(reasons),
        warnings=(
            "GAP_P2_008_REMAINS_OPEN",
            "LEGAL_EFFECTIVE_DATES_NOT_PROVEN",
            "CONTINUOUS_CHANGE_CANDIDATE_ONLY",
            "UNREVIEWED_DETECTION_MUST_NOT_BE_PRODUCTION_TRUTH",
            "CHANGED_RATES_MUST_INVALIDATE_CACHES_ONLY_AFTER_REVIEW",
            "SPECIALIST_SIGNOFF_PENDING",
            "NOT_PRODUCTION_CHANGE_ELIGIBLE",
        ),
    )


def attach_continuous_change_intelligence_to_request(
    request: CanonicalAIRequestV1,
) -> CanonicalAIRequestV1:
    bundle = build_continuous_change_intelligence_bundle(request)
    return request.model_copy(
        update={"continuous_change_intelligence_bundle": bundle}
    )


def assert_continuous_change_intelligence_authority(
    bundle: ContinuousChangeIntelligenceBundleV1 | None,
) -> None:
    if bundle is None:
        return
    if (
        bundle.is_execution_authority
        or bundle.mutation_tools_allowed
        or bundle.continuous_change_authority_claimed
        or bundle.unreviewed_as_production_truth
        or bundle.cache_invalidated
        or bundle.rates_changed_as_truth
        or bundle.change_applied
        or bundle.amendment_applied
        or bundle.rollback_executed
        or bundle.current_law_definitive
        or bundle.legal_effective_dates_proven
        or bundle.claims_verified
        or bundle.citations_verified
        or bundle.legal_proof_claimed
        or bundle.kb_retrieval_invoked
        or bundle.documents_retrieved != 0
        or bundle.draft_mutations != 0
        or bundle.posting_mutations != 0
        or bundle.gap_p2_008_status != "OPEN"
        or bundle.specialist_signoff_status != "NOT_SIGNED"
        or bundle.release_status != "NOT_RELEASED"
        or bundle.gold_questions_status != "NOT_RELEASED"
        or bundle.pilot_scope != "CONTINUOUS_CHANGE_CANDIDATE_ONLY"
    ):
        raise RuntimeError("CONTINUOUS_CHANGE_INTELLIGENCE_AUTHORITY")


def continuous_change_intelligence_to_metadata(
    bundle: ContinuousChangeIntelligenceBundleV1 | None,
) -> dict[str, Any]:
    if bundle is None:
        return {}
    return {
        "analysis_status": bundle.analysis_status.value,
        "runtime_version": bundle.runtime_version,
        "continuous_change_readiness": (
            bundle.continuous_change_readiness.value
        ),
        "pilot_scope": "CONTINUOUS_CHANGE_CANDIDATE_ONLY",
        "in_scope_topics": list(bundle.in_scope_topics),
        "unsupported_topics": list(bundle.unsupported_topics),
        "release_status": "NOT_RELEASED",
        "gold_questions_status": "NOT_RELEASED",
        "specialist_signoff_status": "NOT_SIGNED",
        "research_mode_bound": bundle.research_mode_bound,
        "mutation_tools_allowed": False,
        "continuous_change_authority_claimed": False,
        "unreviewed_as_production_truth": False,
        "cache_invalidated": False,
        "rates_changed_as_truth": False,
        "change_applied": False,
        "amendment_applied": False,
        "rollback_executed": False,
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
