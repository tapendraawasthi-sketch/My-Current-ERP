"""MAI-42 — judicial/decision intelligence policy (never judicial authority).

Slice 1: declare candidate judicial/decision policy from MAI-36 research frame.
Never retrieves cases, never treats headnotes as binding rules, never proves law.
"""

from __future__ import annotations

import re
from typing import Any

from ....contracts.judicial_decision_intelligence import (
    JudicialDecisionIntelligenceBundleV1,
    JudicialDecisionIntelligenceStatus,
    JudicialDecisionReadiness,
    JudicialDecisionTopic,
)
from ....contracts.legal_question_research import (
    LegalQuestionResearchStatus,
    ResearchModeReadiness,
)
from ....contracts.request import CanonicalAIRequestV1

RUNTIME_VERSION = "mai-42.0.1-slice1"
AUTHORITY = "ADR_0059"

_COURT = re.compile(
    r"\b(?:Supreme\s+Court|High\s+Court|court\s+decision|judicial\s+decision|"
    r"फैसला)\b",
    re.I,
)
_HOLDING = re.compile(
    r"\b(?:holding|ratio\s+decidendi|headnote)\b",
    re.I,
)
_ISSUE = re.compile(r"\b(?:legal\s+issue|issue\s+framed)\b", re.I)
_CITATOR = re.compile(
    r"\b(?:citator|subsequent\s+treatment|overruled|distinguished)\b",
    re.I,
)
_CASE_STATUS = re.compile(r"\b(?:case\s+status|disposition)\b", re.I)
_UNSUPPORTED = re.compile(
    r"\b(?:customs|excise|भन्सार|अन्तःशुल्क)\b",
    re.I,
)


def _detect_topics(text: str) -> tuple[list[str], list[str]]:
    in_scope: list[str] = []
    unsupported: list[str] = []
    if _COURT.search(text or ""):
        in_scope.append(JudicialDecisionTopic.COURT_DECISION.value)
    if _HOLDING.search(text or ""):
        in_scope.append(JudicialDecisionTopic.HOLDING.value)
    if _ISSUE.search(text or ""):
        in_scope.append(JudicialDecisionTopic.ISSUE.value)
    if _CITATOR.search(text or ""):
        in_scope.append(JudicialDecisionTopic.CITATOR.value)
    if _CASE_STATUS.search(text or ""):
        in_scope.append(JudicialDecisionTopic.CASE_STATUS.value)
    if _UNSUPPORTED.search(text or "") and not in_scope:
        unsupported.append(JudicialDecisionTopic.UNSUPPORTED.value)
    return in_scope, unsupported


def build_judicial_decision_intelligence_bundle(
    request: CanonicalAIRequestV1,
) -> JudicialDecisionIntelligenceBundleV1:
    lqr = request.legal_question_research_bundle
    if lqr is None:
        return JudicialDecisionIntelligenceBundleV1(
            analysis_status=JudicialDecisionIntelligenceStatus.SKIP,
            runtime_version=RUNTIME_VERSION,
            judicial_decision_readiness=JudicialDecisionReadiness.NOT_APPLICABLE,
            reason_codes=("NO_LEGAL_QUESTION_RESEARCH",),
            warnings=("NO_LEGAL_QUESTION_RESEARCH",),
        )

    if lqr.analysis_status != LegalQuestionResearchStatus.COMPLETE:
        return JudicialDecisionIntelligenceBundleV1(
            analysis_status=JudicialDecisionIntelligenceStatus.SKIP,
            runtime_version=RUNTIME_VERSION,
            judicial_decision_readiness=JudicialDecisionReadiness.NOT_APPLICABLE,
            reason_codes=(
                "LEGAL_RESEARCH_NOT_COMPLETE",
                "JUDICIAL_DECISION_NOT_APPLICABLE",
            ),
            warnings=("JUDICIAL_DECISION_NOT_APPLICABLE",),
        )

    if not lqr.research_mode_active:
        return JudicialDecisionIntelligenceBundleV1(
            analysis_status=JudicialDecisionIntelligenceStatus.SKIP,
            runtime_version=RUNTIME_VERSION,
            judicial_decision_readiness=JudicialDecisionReadiness.NOT_APPLICABLE,
            reason_codes=("RESEARCH_MODE_NOT_ACTIVE",),
            warnings=("JUDICIAL_DECISION_NOT_APPLICABLE",),
        )

    readiness = lqr.research_mode_readiness
    if readiness not in {
        ResearchModeReadiness.POLICY_DECLARED,
        ResearchModeReadiness.CLARIFY_REQUIRED,
    }:
        return JudicialDecisionIntelligenceBundleV1(
            analysis_status=JudicialDecisionIntelligenceStatus.SKIP,
            runtime_version=RUNTIME_VERSION,
            judicial_decision_readiness=JudicialDecisionReadiness.NOT_APPLICABLE,
            reason_codes=("RESEARCH_READINESS_NOT_ELIGIBLE",),
            warnings=("JUDICIAL_DECISION_NOT_APPLICABLE",),
        )

    in_scope, unsupported = _detect_topics(request.raw_text or "")
    if not in_scope and unsupported:
        return JudicialDecisionIntelligenceBundleV1(
            analysis_status=JudicialDecisionIntelligenceStatus.COMPLETE,
            runtime_version=RUNTIME_VERSION,
            judicial_decision_readiness=JudicialDecisionReadiness.BLOCKED,
            unsupported_topics=tuple(unsupported),
            research_mode_bound=True,
            reason_codes=(
                "UNSUPPORTED_TOPIC_OUTSIDE_PILOT",
                "JUDICIAL_DECISION_BLOCKED",
                "NO_JUDICIAL_AUTHORITY",
                "GAP_P2_008_OPEN",
            ),
            warnings=(
                "UNSUPPORTED_TOPIC_DOCUMENTED",
                "GAP_P2_008_REMAINS_OPEN",
            ),
        )

    if not in_scope:
        return JudicialDecisionIntelligenceBundleV1(
            analysis_status=JudicialDecisionIntelligenceStatus.SKIP,
            runtime_version=RUNTIME_VERSION,
            judicial_decision_readiness=JudicialDecisionReadiness.NOT_APPLICABLE,
            reason_codes=("NO_IN_SCOPE_JUDICIAL_DECISION_TOPIC",),
            warnings=("JUDICIAL_DECISION_NOT_APPLICABLE",),
        )

    pilot_ready = (
        JudicialDecisionReadiness.SCOPE_PARTIAL
        if unsupported
        else JudicialDecisionReadiness.POLICY_DECLARED
    )
    reasons = [
        "RESEARCH_MODE_BOUND",
        "PILOT_SCOPE_JUDICIAL_DECISION_CANDIDATE_ONLY",
        "CASE_CORPUS_NOT_RELEASED",
        "GOLD_QUESTIONS_NOT_RELEASED",
        "SPECIALIST_SIGNOFF_NOT_SIGNED",
        "NO_JUDICIAL_AUTHORITY",
        "HEADNOTE_NOT_BINDING_RULE",
        "SUBSEQUENT_TREATMENT_NOT_DEFINITIVE",
        "NO_CASE_RETRIEVAL",
        "NO_HOLDINGS_EXTRACTED",
        "NO_CITATOR_LINKS",
        "NO_PARAGRAPH_ANCHORS",
        "NO_KB_RETRIEVAL_AUTHORITY",
        "CURRENT_LAW_NOT_DEFINITIVE",
        "LEGAL_EFFECTIVE_DATES_NOT_PROVEN",
        "CLAIMS_NOT_VERIFIED",
        "GAP_P2_008_OPEN",
        *tuple(f"TOPIC_{t}" for t in in_scope),
    ]
    if readiness == ResearchModeReadiness.CLARIFY_REQUIRED:
        reasons.append("UPSTREAM_CLARIFY_REQUIRED_STILL_UNPROVEN")

    return JudicialDecisionIntelligenceBundleV1(
        analysis_status=JudicialDecisionIntelligenceStatus.COMPLETE,
        runtime_version=RUNTIME_VERSION,
        judicial_decision_readiness=pilot_ready,
        in_scope_topics=tuple(in_scope),
        unsupported_topics=tuple(unsupported),
        research_mode_bound=True,
        reason_codes=tuple(reasons),
        warnings=(
            "GAP_P2_008_REMAINS_OPEN",
            "LEGAL_EFFECTIVE_DATES_NOT_PROVEN",
            "JUDICIAL_DECISION_CANDIDATE_ONLY",
            "HEADNOTE_MUST_NOT_BE_TREATED_AS_BINDING_RULE",
            "SUBSEQUENT_TREATMENT_UNCERTAINTY_MUST_BE_DISCLOSED",
            "SPECIALIST_SIGNOFF_PENDING",
            "NOT_PRODUCTION_JUDICIAL_ELIGIBLE",
        ),
    )


def attach_judicial_decision_intelligence_to_request(
    request: CanonicalAIRequestV1,
) -> CanonicalAIRequestV1:
    bundle = build_judicial_decision_intelligence_bundle(request)
    return request.model_copy(
        update={"judicial_decision_intelligence_bundle": bundle}
    )


def assert_judicial_decision_intelligence_authority(
    bundle: JudicialDecisionIntelligenceBundleV1 | None,
) -> None:
    if bundle is None:
        return
    if (
        bundle.is_execution_authority
        or bundle.mutation_tools_allowed
        or bundle.judicial_authority_claimed
        or bundle.headnote_as_binding_rule
        or bundle.subsequent_treatment_definitive
        or bundle.case_retrieved
        or bundle.holdings_extracted
        or bundle.citator_links_claimed
        or bundle.paragraph_anchors_claimed
        or bundle.current_law_definitive
        or bundle.legal_effective_dates_proven
        or bundle.amendment_applied
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
        or bundle.pilot_scope != "JUDICIAL_DECISION_CANDIDATE_ONLY"
    ):
        raise RuntimeError("JUDICIAL_DECISION_INTELLIGENCE_AUTHORITY")


def judicial_decision_intelligence_to_metadata(
    bundle: JudicialDecisionIntelligenceBundleV1 | None,
) -> dict[str, Any]:
    if bundle is None:
        return {}
    return {
        "analysis_status": bundle.analysis_status.value,
        "runtime_version": bundle.runtime_version,
        "judicial_decision_readiness": bundle.judicial_decision_readiness.value,
        "pilot_scope": "JUDICIAL_DECISION_CANDIDATE_ONLY",
        "in_scope_topics": list(bundle.in_scope_topics),
        "unsupported_topics": list(bundle.unsupported_topics),
        "release_status": "NOT_RELEASED",
        "gold_questions_status": "NOT_RELEASED",
        "specialist_signoff_status": "NOT_SIGNED",
        "research_mode_bound": bundle.research_mode_bound,
        "mutation_tools_allowed": False,
        "judicial_authority_claimed": False,
        "headnote_as_binding_rule": False,
        "subsequent_treatment_definitive": False,
        "case_retrieved": False,
        "holdings_extracted": False,
        "citator_links_claimed": False,
        "paragraph_anchors_claimed": False,
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
