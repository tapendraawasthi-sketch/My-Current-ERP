"""MAI-41 — broader Nepal business-law domain release policy (never releases).

Slice 1: declare candidate domain-release policy from MAI-36 research frame.
Never releases domains, never claims production eligibility, never proves law.
"""

from __future__ import annotations

import re
from typing import Any

from ....contracts.broader_nepal_business_law_domain_release import (
    BroaderNepalBusinessLawDomainReleaseBundleV1,
    BroaderNepalBusinessLawDomainReleaseStatus,
    BusinessLawDomainTopic,
    DomainReleaseReadiness,
)
from ....contracts.legal_question_research import (
    LegalQuestionResearchStatus,
    ResearchModeReadiness,
)
from ....contracts.request import CanonicalAIRequestV1

RUNTIME_VERSION = "mai-41.0.2-slice2"
AUTHORITY = "ADR_0058"

_COMPANY = re.compile(
    r"\b(?:Compan(?:y|ies)\s+Act|company\s+law|incorporation)\b",
    re.I,
)
_LABOR = re.compile(r"\b(?:labor\s+(?:act|law)|labour\s+(?:act|law))\b", re.I)
_CONTRACT = re.compile(r"\b(?:contract\s+law)\b", re.I)
_BUSINESS_DOMAIN = re.compile(
    r"\b(?:business[- ]law|Nepal\s+business[- ]law)\b",
    re.I,
)
_DOMAIN_RELEASE = re.compile(r"\b(?:domain\s+release|broader\s+Nepal)\b", re.I)
_UNSUPPORTED = re.compile(
    r"\b(?:customs|excise|भन्सार|अन्तःशुल्क)\b",
    re.I,
)


def _detect_topics(text: str) -> tuple[list[str], list[str]]:
    in_scope: list[str] = []
    unsupported: list[str] = []
    if _COMPANY.search(text or ""):
        in_scope.append(BusinessLawDomainTopic.COMPANY_LAW.value)
    if _LABOR.search(text or ""):
        in_scope.append(BusinessLawDomainTopic.LABOR_LAW.value)
    if _CONTRACT.search(text or ""):
        in_scope.append(BusinessLawDomainTopic.CONTRACT_LAW.value)
    if _BUSINESS_DOMAIN.search(text or ""):
        in_scope.append(BusinessLawDomainTopic.BUSINESS_LAW_DOMAIN.value)
    if _DOMAIN_RELEASE.search(text or ""):
        in_scope.append(BusinessLawDomainTopic.DOMAIN_RELEASE.value)
    if _UNSUPPORTED.search(text or "") and not in_scope:
        unsupported.append(BusinessLawDomainTopic.UNSUPPORTED.value)
    return in_scope, unsupported


def build_broader_nepal_business_law_domain_release_bundle(
    request: CanonicalAIRequestV1,
) -> BroaderNepalBusinessLawDomainReleaseBundleV1:
    lqr = request.legal_question_research_bundle
    if lqr is None:
        return BroaderNepalBusinessLawDomainReleaseBundleV1(
            analysis_status=BroaderNepalBusinessLawDomainReleaseStatus.SKIP,
            runtime_version=RUNTIME_VERSION,
            domain_release_readiness=DomainReleaseReadiness.NOT_APPLICABLE,
            reason_codes=("NO_LEGAL_QUESTION_RESEARCH",),
            warnings=("NO_LEGAL_QUESTION_RESEARCH",),
        )

    if lqr.analysis_status != LegalQuestionResearchStatus.COMPLETE:
        return BroaderNepalBusinessLawDomainReleaseBundleV1(
            analysis_status=BroaderNepalBusinessLawDomainReleaseStatus.SKIP,
            runtime_version=RUNTIME_VERSION,
            domain_release_readiness=DomainReleaseReadiness.NOT_APPLICABLE,
            reason_codes=(
                "LEGAL_RESEARCH_NOT_COMPLETE",
                "DOMAIN_RELEASE_NOT_APPLICABLE",
            ),
            warnings=("DOMAIN_RELEASE_NOT_APPLICABLE",),
        )

    if not lqr.research_mode_active:
        return BroaderNepalBusinessLawDomainReleaseBundleV1(
            analysis_status=BroaderNepalBusinessLawDomainReleaseStatus.SKIP,
            runtime_version=RUNTIME_VERSION,
            domain_release_readiness=DomainReleaseReadiness.NOT_APPLICABLE,
            reason_codes=("RESEARCH_MODE_NOT_ACTIVE",),
            warnings=("DOMAIN_RELEASE_NOT_APPLICABLE",),
        )

    readiness = lqr.research_mode_readiness
    if readiness not in {
        ResearchModeReadiness.POLICY_DECLARED,
        ResearchModeReadiness.CLARIFY_REQUIRED,
    }:
        return BroaderNepalBusinessLawDomainReleaseBundleV1(
            analysis_status=BroaderNepalBusinessLawDomainReleaseStatus.SKIP,
            runtime_version=RUNTIME_VERSION,
            domain_release_readiness=DomainReleaseReadiness.NOT_APPLICABLE,
            reason_codes=("RESEARCH_READINESS_NOT_ELIGIBLE",),
            warnings=("DOMAIN_RELEASE_NOT_APPLICABLE",),
        )

    in_scope, unsupported = _detect_topics(request.raw_text or "")
    if not in_scope and unsupported:
        return BroaderNepalBusinessLawDomainReleaseBundleV1(
            analysis_status=BroaderNepalBusinessLawDomainReleaseStatus.COMPLETE,
            runtime_version=RUNTIME_VERSION,
            domain_release_readiness=DomainReleaseReadiness.BLOCKED,
            unsupported_topics=tuple(unsupported),
            research_mode_bound=True,
            reason_codes=(
                "UNSUPPORTED_TOPIC_OUTSIDE_PILOT",
                "DOMAIN_RELEASE_BLOCKED",
                "NO_DOMAIN_AUTHORITY",
                "GAP_P2_008_OPEN",
            ),
            warnings=(
                "UNSUPPORTED_TOPIC_DOCUMENTED",
                "GAP_P2_008_REMAINS_OPEN",
            ),
        )

    if not in_scope:
        return BroaderNepalBusinessLawDomainReleaseBundleV1(
            analysis_status=BroaderNepalBusinessLawDomainReleaseStatus.SKIP,
            runtime_version=RUNTIME_VERSION,
            domain_release_readiness=DomainReleaseReadiness.NOT_APPLICABLE,
            reason_codes=("NO_IN_SCOPE_BUSINESS_LAW_TOPIC",),
            warnings=("DOMAIN_RELEASE_NOT_APPLICABLE",),
        )

    pilot_ready = (
        DomainReleaseReadiness.SCOPE_PARTIAL
        if unsupported
        else DomainReleaseReadiness.POLICY_DECLARED
    )
    reasons = [
        "RESEARCH_MODE_BOUND",
        "PILOT_SCOPE_BROADER_NEPAL_BUSINESS_LAW_CANDIDATE_ONLY",
        "DOMAIN_RELEASE_NOT_RELEASED",
        "GOLD_QUESTIONS_NOT_RELEASED",
        "SPECIALIST_SIGNOFF_NOT_SIGNED",
        "NO_DOMAIN_AUTHORITY",
        "NO_DOMAIN_RELEASE",
        "PRODUCTION_DOMAIN_INELIGIBLE",
        "NO_KB_RETRIEVAL_AUTHORITY",
        "CURRENT_LAW_NOT_DEFINITIVE",
        "LEGAL_EFFECTIVE_DATES_NOT_PROVEN",
        "CLAIMS_NOT_VERIFIED",
        "GAP_P2_008_OPEN",
        *tuple(f"TOPIC_{t}" for t in in_scope),
    ]
    if readiness == ResearchModeReadiness.CLARIFY_REQUIRED:
        reasons.append("UPSTREAM_CLARIFY_REQUIRED_STILL_UNPROVEN")

    return BroaderNepalBusinessLawDomainReleaseBundleV1(
        analysis_status=BroaderNepalBusinessLawDomainReleaseStatus.COMPLETE,
        runtime_version=RUNTIME_VERSION,
        domain_release_readiness=pilot_ready,
        in_scope_topics=tuple(in_scope),
        unsupported_topics=tuple(unsupported),
        research_mode_bound=True,
        reason_codes=tuple(reasons),
        warnings=(
            "GAP_P2_008_REMAINS_OPEN",
            "LEGAL_EFFECTIVE_DATES_NOT_PROVEN",
            "DOMAIN_RELEASE_CANDIDATE_ONLY",
            "SPECIALIST_SIGNOFF_PENDING",
            "NOT_PRODUCTION_DOMAIN_ELIGIBLE",
        ),
    )


def attach_broader_nepal_business_law_domain_release_to_request(
    request: CanonicalAIRequestV1,
) -> CanonicalAIRequestV1:
    bundle = build_broader_nepal_business_law_domain_release_bundle(request)
    return request.model_copy(
        update={"broader_nepal_business_law_domain_release_bundle": bundle}
    )


def assert_broader_nepal_business_law_domain_release_authority(
    bundle: BroaderNepalBusinessLawDomainReleaseBundleV1 | None,
) -> None:
    if bundle is None:
        return
    if (
        bundle.is_execution_authority
        or bundle.mutation_tools_allowed
        or bundle.domain_authority_claimed
        or bundle.domain_released
        or bundle.production_domain_eligible
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
        or bundle.pilot_scope != "BROADER_NEPAL_BUSINESS_LAW_CANDIDATE_ONLY"
    ):
        raise RuntimeError("BROADER_NEPAL_BUSINESS_LAW_DOMAIN_RELEASE_AUTHORITY")


def broader_nepal_business_law_domain_release_to_metadata(
    bundle: BroaderNepalBusinessLawDomainReleaseBundleV1 | None,
) -> dict[str, Any]:
    if bundle is None:
        return {}
    return {
        "analysis_status": bundle.analysis_status.value,
        "runtime_version": bundle.runtime_version,
        "domain_release_readiness": bundle.domain_release_readiness.value,
        "pilot_scope": "BROADER_NEPAL_BUSINESS_LAW_CANDIDATE_ONLY",
        "in_scope_topics": list(bundle.in_scope_topics),
        "unsupported_topics": list(bundle.unsupported_topics),
        "release_status": "NOT_RELEASED",
        "gold_questions_status": "NOT_RELEASED",
        "specialist_signoff_status": "NOT_SIGNED",
        "research_mode_bound": bundle.research_mode_bound,
        "mutation_tools_allowed": False,
        "domain_authority_claimed": False,
        "domain_released": False,
        "production_domain_eligible": False,
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
