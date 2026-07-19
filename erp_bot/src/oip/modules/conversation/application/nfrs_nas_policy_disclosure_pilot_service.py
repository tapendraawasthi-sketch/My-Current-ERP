"""MAI-39 — NFRS/NAS policy, mapping, disclosure pilot (never files).

Slice 1: declare NFRS/NAS/disclosure pilot scope from MAI-36 research frame.
Never executes mapping authority, never files disclosures, never proves law.
Independent of MAI-37 tax pilot (which treats NFRS as unsupported).
"""

from __future__ import annotations

import re
from typing import Any

from ....contracts.legal_question_research import (
    LegalQuestionResearchStatus,
    ResearchModeReadiness,
)
from ....contracts.nfrs_nas_policy_disclosure_pilot import (
    NfrsNasPilotReadiness,
    NfrsNasPolicyDisclosurePilotBundleV1,
    NfrsNasPolicyDisclosurePilotStatus,
    NfrsNasTopic,
)
from ....contracts.request import CanonicalAIRequestV1

RUNTIME_VERSION = "mai-39.0.2-slice2"
AUTHORITY = "ADR_0056"

_NFRS = re.compile(r"\b(?:NFRS|Nepal\s+Financial\s+Reporting\s+Standards?)\b", re.I)
_NAS = re.compile(r"\b(?:NAS|Nepal\s+Accounting\s+Standards?)\b", re.I)
_DISCLOSURE = re.compile(r"\b(?:disclosure|disclosures|disclose)\b", re.I)
_MAPPING = re.compile(r"\b(?:map(?:ping)?|chart\s+of\s+accounts)\b", re.I)
# Tax-only cues are out of this pilot (SKIP via empty in_scope), not BLOCKED.
_UNSUPPORTED = re.compile(
    r"\b(?:customs|excise|भन्सार|अन्तःशुल्क)\b",
    re.I,
)


def _detect_topics(text: str) -> tuple[list[str], list[str]]:
    in_scope: list[str] = []
    unsupported: list[str] = []
    if _NFRS.search(text or ""):
        in_scope.append(NfrsNasTopic.NFRS.value)
    if _NAS.search(text or ""):
        in_scope.append(NfrsNasTopic.NAS.value)
    if _DISCLOSURE.search(text or ""):
        in_scope.append(NfrsNasTopic.DISCLOSURE.value)
    if _MAPPING.search(text or ""):
        in_scope.append(NfrsNasTopic.MAPPING.value)
    if _UNSUPPORTED.search(text or "") and not in_scope:
        unsupported.append(NfrsNasTopic.UNSUPPORTED.value)
    return in_scope, unsupported


def build_nfrs_nas_policy_disclosure_pilot_bundle(
    request: CanonicalAIRequestV1,
) -> NfrsNasPolicyDisclosurePilotBundleV1:
    lqr = request.legal_question_research_bundle
    if lqr is None:
        return NfrsNasPolicyDisclosurePilotBundleV1(
            analysis_status=NfrsNasPolicyDisclosurePilotStatus.SKIP,
            runtime_version=RUNTIME_VERSION,
            nfrs_nas_readiness=NfrsNasPilotReadiness.NOT_APPLICABLE,
            reason_codes=("NO_LEGAL_QUESTION_RESEARCH",),
            warnings=("NO_LEGAL_QUESTION_RESEARCH",),
        )

    if lqr.analysis_status != LegalQuestionResearchStatus.COMPLETE:
        return NfrsNasPolicyDisclosurePilotBundleV1(
            analysis_status=NfrsNasPolicyDisclosurePilotStatus.SKIP,
            runtime_version=RUNTIME_VERSION,
            nfrs_nas_readiness=NfrsNasPilotReadiness.NOT_APPLICABLE,
            reason_codes=(
                "LEGAL_RESEARCH_NOT_COMPLETE",
                "NFRS_NAS_PILOT_NOT_APPLICABLE",
            ),
            warnings=("NFRS_NAS_PILOT_NOT_APPLICABLE",),
        )

    if not lqr.research_mode_active:
        return NfrsNasPolicyDisclosurePilotBundleV1(
            analysis_status=NfrsNasPolicyDisclosurePilotStatus.SKIP,
            runtime_version=RUNTIME_VERSION,
            nfrs_nas_readiness=NfrsNasPilotReadiness.NOT_APPLICABLE,
            reason_codes=("RESEARCH_MODE_NOT_ACTIVE",),
            warnings=("NFRS_NAS_PILOT_NOT_APPLICABLE",),
        )

    readiness = lqr.research_mode_readiness
    if readiness not in {
        ResearchModeReadiness.POLICY_DECLARED,
        ResearchModeReadiness.CLARIFY_REQUIRED,
    }:
        return NfrsNasPolicyDisclosurePilotBundleV1(
            analysis_status=NfrsNasPolicyDisclosurePilotStatus.SKIP,
            runtime_version=RUNTIME_VERSION,
            nfrs_nas_readiness=NfrsNasPilotReadiness.NOT_APPLICABLE,
            reason_codes=("RESEARCH_READINESS_NOT_ELIGIBLE",),
            warnings=("NFRS_NAS_PILOT_NOT_APPLICABLE",),
        )

    in_scope, unsupported = _detect_topics(request.raw_text or "")
    if not in_scope and unsupported:
        return NfrsNasPolicyDisclosurePilotBundleV1(
            analysis_status=NfrsNasPolicyDisclosurePilotStatus.COMPLETE,
            runtime_version=RUNTIME_VERSION,
            nfrs_nas_readiness=NfrsNasPilotReadiness.BLOCKED,
            unsupported_topics=tuple(unsupported),
            research_mode_bound=True,
            reason_codes=(
                "UNSUPPORTED_TOPIC_OUTSIDE_PILOT",
                "NFRS_NAS_PILOT_BLOCKED",
                "NO_STANDARDS_AUTHORITY",
                "GAP_P2_008_OPEN",
            ),
            warnings=(
                "UNSUPPORTED_TOPIC_DOCUMENTED",
                "GAP_P2_008_REMAINS_OPEN",
            ),
        )

    if not in_scope:
        return NfrsNasPolicyDisclosurePilotBundleV1(
            analysis_status=NfrsNasPolicyDisclosurePilotStatus.SKIP,
            runtime_version=RUNTIME_VERSION,
            nfrs_nas_readiness=NfrsNasPilotReadiness.NOT_APPLICABLE,
            reason_codes=("NO_IN_SCOPE_NFRS_NAS_TOPIC",),
            warnings=("NFRS_NAS_PILOT_NOT_APPLICABLE",),
        )

    pilot_ready = (
        NfrsNasPilotReadiness.SCOPE_PARTIAL
        if unsupported
        else NfrsNasPilotReadiness.POLICY_DECLARED
    )
    reasons = [
        "RESEARCH_MODE_BOUND",
        "PILOT_SCOPE_NFRS_NAS_DISCLOSURE_ONLY",
        "MAPPING_CANDIDATE_ONLY",
        "DISCLOSURE_NOT_FILED",
        "SPECIALIST_SIGNOFF_NOT_SIGNED",
        "NO_STANDARDS_AUTHORITY",
        "NO_MAPPING_EXECUTE",
        "NO_DISCLOSURE_FILE",
        "NOT_FILING_READY",
        "NO_KB_RETRIEVAL_AUTHORITY",
        "CURRENT_LAW_NOT_DEFINITIVE",
        "LEGAL_EFFECTIVE_DATES_NOT_PROVEN",
        "CLAIMS_NOT_VERIFIED",
        "GAP_P2_008_OPEN",
        *tuple(f"TOPIC_{t}" for t in in_scope),
    ]
    if readiness == ResearchModeReadiness.CLARIFY_REQUIRED:
        reasons.append("UPSTREAM_CLARIFY_REQUIRED_STILL_UNPROVEN")

    return NfrsNasPolicyDisclosurePilotBundleV1(
        analysis_status=NfrsNasPolicyDisclosurePilotStatus.COMPLETE,
        runtime_version=RUNTIME_VERSION,
        nfrs_nas_readiness=pilot_ready,
        in_scope_topics=tuple(in_scope),
        unsupported_topics=tuple(unsupported),
        research_mode_bound=True,
        reason_codes=tuple(reasons),
        warnings=(
            "GAP_P2_008_REMAINS_OPEN",
            "LEGAL_EFFECTIVE_DATES_NOT_PROVEN",
            "MAPPINGS_ARE_CANDIDATES_NOT_AUTHORITY",
            "DISCLOSURES_NOT_FILED",
            "SPECIALIST_SIGNOFF_PENDING",
        ),
    )


def attach_nfrs_nas_policy_disclosure_pilot_to_request(
    request: CanonicalAIRequestV1,
) -> CanonicalAIRequestV1:
    bundle = build_nfrs_nas_policy_disclosure_pilot_bundle(request)
    return request.model_copy(
        update={"nfrs_nas_policy_disclosure_pilot_bundle": bundle}
    )


def assert_nfrs_nas_policy_disclosure_pilot_authority(
    bundle: NfrsNasPolicyDisclosurePilotBundleV1 | None,
) -> None:
    if bundle is None:
        return
    if (
        bundle.is_execution_authority
        or bundle.mutation_tools_allowed
        or bundle.standards_authority_claimed
        or bundle.mapping_executed
        or bundle.disclosure_filed
        or bundle.filing_ready
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
        or bundle.mapping_status != "CANDIDATE_MAPPINGS_ONLY"
        or bundle.disclosure_status != "NOT_FILED"
        or bundle.pilot_scope != "NFRS_NAS_DISCLOSURE_ONLY"
    ):
        raise RuntimeError("NFRS_NAS_POLICY_DISCLOSURE_PILOT_AUTHORITY")


def nfrs_nas_policy_disclosure_pilot_to_metadata(
    bundle: NfrsNasPolicyDisclosurePilotBundleV1 | None,
) -> dict[str, Any]:
    if bundle is None:
        return {}
    return {
        "analysis_status": bundle.analysis_status.value,
        "runtime_version": bundle.runtime_version,
        "nfrs_nas_readiness": bundle.nfrs_nas_readiness.value,
        "pilot_scope": "NFRS_NAS_DISCLOSURE_ONLY",
        "in_scope_topics": list(bundle.in_scope_topics),
        "unsupported_topics": list(bundle.unsupported_topics),
        "mapping_status": "CANDIDATE_MAPPINGS_ONLY",
        "disclosure_status": "NOT_FILED",
        "specialist_signoff_status": "NOT_SIGNED",
        "research_mode_bound": bundle.research_mode_bound,
        "mutation_tools_allowed": False,
        "standards_authority_claimed": False,
        "mapping_executed": False,
        "disclosure_filed": False,
        "filing_ready": False,
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
