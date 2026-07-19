"""MAI-40 — financial close / adjustment assistance policy (never posts).

Slice 1: declare close/adjustment assistance scope from MAI-39 NFRS/NAS pilot.
Never posts close, never posts adjustments, never locks books.
"""

from __future__ import annotations

import re
from typing import Any

from ....contracts.financial_close_adjustment_assistance import (
    CloseAssistReadiness,
    CloseAssistTopic,
    FinancialCloseAdjustmentAssistanceBundleV1,
    FinancialCloseAdjustmentAssistanceStatus,
)
from ....contracts.nfrs_nas_policy_disclosure_pilot import (
    NfrsNasPilotReadiness,
    NfrsNasPolicyDisclosurePilotStatus,
)
from ....contracts.request import CanonicalAIRequestV1

RUNTIME_VERSION = "mai-40.0.2-slice2"
AUTHORITY = "ADR_0057"

_CLOSE = re.compile(
    r"\b(?:financial\s+close|month[- ]end|year[- ]end|period[- ]end\s+close|"
    r"closing\s+checklist|close\s+checklist)\b",
    re.I,
)
_ADJUSTMENT = re.compile(
    r"\b(?:adjustment|adjustments|accrual|deferral|prepaid)\b",
    re.I,
)
_CHECKLIST = re.compile(r"\b(?:checklist|worksheet)\b", re.I)
_CLOSING_ENTRY = re.compile(
    r"\b(?:closing\s+entr(?:y|ies)|close\s+entr(?:y|ies))\b",
    re.I,
)
_UNSUPPORTED = re.compile(
    r"\b(?:customs|excise|भन्सार|अन्तःशुल्क)\b",
    re.I,
)


def _detect_topics(text: str) -> tuple[list[str], list[str]]:
    in_scope: list[str] = []
    unsupported: list[str] = []
    if _CLOSE.search(text or ""):
        in_scope.append(CloseAssistTopic.FINANCIAL_CLOSE.value)
    if _ADJUSTMENT.search(text or ""):
        in_scope.append(CloseAssistTopic.ADJUSTMENT.value)
    if _CHECKLIST.search(text or ""):
        in_scope.append(CloseAssistTopic.CHECKLIST.value)
    if _CLOSING_ENTRY.search(text or ""):
        in_scope.append(CloseAssistTopic.CLOSING_ENTRY.value)
    if _UNSUPPORTED.search(text or "") and not in_scope:
        unsupported.append(CloseAssistTopic.UNSUPPORTED.value)
    return in_scope, unsupported


def build_financial_close_adjustment_assistance_bundle(
    request: CanonicalAIRequestV1,
) -> FinancialCloseAdjustmentAssistanceBundleV1:
    nfrs = request.nfrs_nas_policy_disclosure_pilot_bundle
    if nfrs is None:
        return FinancialCloseAdjustmentAssistanceBundleV1(
            analysis_status=FinancialCloseAdjustmentAssistanceStatus.SKIP,
            runtime_version=RUNTIME_VERSION,
            close_assist_readiness=CloseAssistReadiness.NOT_APPLICABLE,
            reason_codes=("NO_NFRS_NAS_PILOT",),
            warnings=("NO_NFRS_NAS_PILOT",),
        )

    if nfrs.analysis_status != NfrsNasPolicyDisclosurePilotStatus.COMPLETE:
        return FinancialCloseAdjustmentAssistanceBundleV1(
            analysis_status=FinancialCloseAdjustmentAssistanceStatus.SKIP,
            runtime_version=RUNTIME_VERSION,
            close_assist_readiness=CloseAssistReadiness.NOT_APPLICABLE,
            reason_codes=(
                "NFRS_NAS_PILOT_NOT_COMPLETE",
                "CLOSE_ASSIST_NOT_APPLICABLE",
            ),
            warnings=("CLOSE_ASSIST_NOT_APPLICABLE",),
        )

    if nfrs.nfrs_nas_readiness == NfrsNasPilotReadiness.BLOCKED:
        return FinancialCloseAdjustmentAssistanceBundleV1(
            analysis_status=FinancialCloseAdjustmentAssistanceStatus.COMPLETE,
            runtime_version=RUNTIME_VERSION,
            close_assist_readiness=CloseAssistReadiness.BLOCKED,
            nfrs_nas_bound=True,
            reason_codes=(
                "UPSTREAM_NFRS_NAS_BLOCKED",
                "NO_CLOSE_POST",
                "NO_ADJUSTMENT_POST",
                "GAP_P2_008_OPEN",
            ),
            warnings=(
                "GAP_P2_008_REMAINS_OPEN",
                "CLOSE_ASSIST_BLOCKED",
            ),
        )

    if nfrs.nfrs_nas_readiness not in {
        NfrsNasPilotReadiness.POLICY_DECLARED,
        NfrsNasPilotReadiness.SCOPE_PARTIAL,
    }:
        return FinancialCloseAdjustmentAssistanceBundleV1(
            analysis_status=FinancialCloseAdjustmentAssistanceStatus.SKIP,
            runtime_version=RUNTIME_VERSION,
            close_assist_readiness=CloseAssistReadiness.NOT_APPLICABLE,
            reason_codes=("NFRS_NAS_READINESS_NOT_ELIGIBLE",),
            warnings=("CLOSE_ASSIST_NOT_APPLICABLE",),
        )

    in_scope, unsupported = _detect_topics(request.raw_text or "")
    if not in_scope and unsupported:
        return FinancialCloseAdjustmentAssistanceBundleV1(
            analysis_status=FinancialCloseAdjustmentAssistanceStatus.COMPLETE,
            runtime_version=RUNTIME_VERSION,
            close_assist_readiness=CloseAssistReadiness.BLOCKED,
            unsupported_topics=tuple(unsupported),
            nfrs_nas_bound=True,
            reason_codes=(
                "UNSUPPORTED_TOPIC_OUTSIDE_PILOT",
                "CLOSE_ASSIST_BLOCKED",
                "NO_CLOSE_POST",
                "GAP_P2_008_OPEN",
            ),
            warnings=(
                "UNSUPPORTED_TOPIC_DOCUMENTED",
                "GAP_P2_008_REMAINS_OPEN",
            ),
        )

    if not in_scope:
        return FinancialCloseAdjustmentAssistanceBundleV1(
            analysis_status=FinancialCloseAdjustmentAssistanceStatus.SKIP,
            runtime_version=RUNTIME_VERSION,
            close_assist_readiness=CloseAssistReadiness.NOT_APPLICABLE,
            reason_codes=("NO_IN_SCOPE_CLOSE_ASSIST_TOPIC",),
            warnings=("CLOSE_ASSIST_NOT_APPLICABLE",),
        )

    pilot_ready = (
        CloseAssistReadiness.SCOPE_PARTIAL
        if unsupported
        else CloseAssistReadiness.POLICY_DECLARED
    )
    reasons = [
        "NFRS_NAS_BOUND",
        "PILOT_SCOPE_FINANCIAL_CLOSE_ADJUSTMENT_ONLY",
        "ADJUSTMENT_CANDIDATE_ASSISTANCE_ONLY",
        "SPECIALIST_SIGNOFF_NOT_SIGNED",
        "NO_CLOSE_POST",
        "NO_ADJUSTMENT_POST",
        "BOOKS_NOT_LOCKED",
        "PERIOD_NOT_CLOSED",
        "NO_KB_RETRIEVAL_AUTHORITY",
        "CURRENT_LAW_NOT_DEFINITIVE",
        "LEGAL_EFFECTIVE_DATES_NOT_PROVEN",
        "CLAIMS_NOT_VERIFIED",
        "GAP_P2_008_OPEN",
        *tuple(f"TOPIC_{t}" for t in in_scope),
    ]
    if nfrs.nfrs_nas_readiness == NfrsNasPilotReadiness.SCOPE_PARTIAL:
        reasons.append("UPSTREAM_SCOPE_PARTIAL_STILL_UNPROVEN")

    return FinancialCloseAdjustmentAssistanceBundleV1(
        analysis_status=FinancialCloseAdjustmentAssistanceStatus.COMPLETE,
        runtime_version=RUNTIME_VERSION,
        close_assist_readiness=pilot_ready,
        in_scope_topics=tuple(in_scope),
        unsupported_topics=tuple(unsupported),
        nfrs_nas_bound=True,
        reason_codes=tuple(reasons),
        warnings=(
            "GAP_P2_008_REMAINS_OPEN",
            "LEGAL_EFFECTIVE_DATES_NOT_PROVEN",
            "ADJUSTMENTS_ARE_CANDIDATE_ASSISTANCE_NOT_POSTS",
            "CLOSE_NOT_POSTED",
            "SPECIALIST_SIGNOFF_PENDING",
        ),
    )


def attach_financial_close_adjustment_assistance_to_request(
    request: CanonicalAIRequestV1,
) -> CanonicalAIRequestV1:
    bundle = build_financial_close_adjustment_assistance_bundle(request)
    return request.model_copy(
        update={"financial_close_adjustment_assistance_bundle": bundle}
    )


def assert_financial_close_adjustment_assistance_authority(
    bundle: FinancialCloseAdjustmentAssistanceBundleV1 | None,
) -> None:
    if bundle is None:
        return
    if (
        bundle.is_execution_authority
        or bundle.mutation_tools_allowed
        or bundle.close_posted
        or bundle.adjustments_posted
        or bundle.books_locked
        or bundle.period_closed
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
        or bundle.adjustment_status != "CANDIDATE_ASSISTANCE_ONLY"
        or bundle.pilot_scope != "FINANCIAL_CLOSE_ADJUSTMENT_ONLY"
    ):
        raise RuntimeError("FINANCIAL_CLOSE_ADJUSTMENT_ASSISTANCE_AUTHORITY")


def financial_close_adjustment_assistance_to_metadata(
    bundle: FinancialCloseAdjustmentAssistanceBundleV1 | None,
) -> dict[str, Any]:
    if bundle is None:
        return {}
    return {
        "analysis_status": bundle.analysis_status.value,
        "runtime_version": bundle.runtime_version,
        "close_assist_readiness": bundle.close_assist_readiness.value,
        "pilot_scope": "FINANCIAL_CLOSE_ADJUSTMENT_ONLY",
        "in_scope_topics": list(bundle.in_scope_topics),
        "unsupported_topics": list(bundle.unsupported_topics),
        "adjustment_status": "CANDIDATE_ASSISTANCE_ONLY",
        "specialist_signoff_status": "NOT_SIGNED",
        "nfrs_nas_bound": bundle.nfrs_nas_bound,
        "mutation_tools_allowed": False,
        "close_posted": False,
        "adjustments_posted": False,
        "books_locked": False,
        "period_closed": False,
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
