"""MAI-52 — CA-firm engagement / workpaper policy (never opens engagements).

Slice 1: declare candidate CA-firm / workpaper policy from cue detection.
Never claims workspace enabled, engagement opened/signed, or workpaper posted.
"""

from __future__ import annotations

import re
from typing import Any

from ....contracts.ca_firm_engagement_workpaper import (
    CaFirmEngagementWorkpaperBundleV1,
    CaFirmEngagementWorkpaperReadiness,
    CaFirmEngagementWorkpaperStatus,
    CaFirmEngagementWorkpaperTopic,
)
from ....contracts.request import CanonicalAIRequestV1

RUNTIME_VERSION = "mai-52.0.1-slice1"
AUTHORITY = "ADR_0069"

_ENGAGEMENT = re.compile(
    r"\b(?:ca[- ]?firm\s+engagement|chartered\s+accountant\s+engagement|"
    r"c\.?a\.?\s+firm\s+engagement)\b",
    re.I,
)
_LETTER = re.compile(
    r"\b(?:engagement\s+letter)\b",
    re.I,
)
_WORKSPACE = re.compile(
    r"\b(?:workpaper\s+workspace|audit\s+workpaper(?:\s+workspace)?)\b",
    re.I,
)
_REVIEW = re.compile(
    r"\b(?:workpaper\s+review)\b",
    re.I,
)
_BINDER = re.compile(
    r"\b(?:client\s+binder)\b",
    re.I,
)
_STAFF = re.compile(
    r"\b(?:staff\s+assignment)\b",
    re.I,
)
_NOTES = re.compile(
    r"\b(?:review\s+notes)\b",
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
    if _ENGAGEMENT.search(raw):
        in_scope.append(
            CaFirmEngagementWorkpaperTopic.CA_FIRM_ENGAGEMENT.value
        )
    if _LETTER.search(raw):
        in_scope.append(
            CaFirmEngagementWorkpaperTopic.ENGAGEMENT_LETTER.value
        )
    if _WORKSPACE.search(raw):
        in_scope.append(
            CaFirmEngagementWorkpaperTopic.WORKPAPER_WORKSPACE.value
        )
    if _REVIEW.search(raw):
        in_scope.append(CaFirmEngagementWorkpaperTopic.WORKPAPER_REVIEW.value)
    if _BINDER.search(raw):
        in_scope.append(CaFirmEngagementWorkpaperTopic.CLIENT_BINDER.value)
    if _STAFF.search(raw):
        in_scope.append(CaFirmEngagementWorkpaperTopic.STAFF_ASSIGNMENT.value)
    if _NOTES.search(raw):
        in_scope.append(CaFirmEngagementWorkpaperTopic.REVIEW_NOTES.value)
    if _UNSUPPORTED.search(raw) and not in_scope:
        unsupported.append(CaFirmEngagementWorkpaperTopic.UNSUPPORTED.value)
    return in_scope, unsupported


def build_ca_firm_engagement_workpaper_bundle(
    request: CanonicalAIRequestV1,
) -> CaFirmEngagementWorkpaperBundleV1:
    in_scope, unsupported = _detect_topics(request.raw_text or "")
    if not in_scope and unsupported:
        return CaFirmEngagementWorkpaperBundleV1(
            analysis_status=CaFirmEngagementWorkpaperStatus.COMPLETE,
            runtime_version=RUNTIME_VERSION,
            ca_firm_engagement_workpaper_readiness=(
                CaFirmEngagementWorkpaperReadiness.BLOCKED
            ),
            unsupported_topics=tuple(unsupported),
            reason_codes=(
                "UNSUPPORTED_TOPIC_OUTSIDE_PILOT",
                "CA_FIRM_ENGAGEMENT_WORKPAPER_BLOCKED",
                "NO_ENGAGEMENT_AUTHORITY",
                "GAP_P2_008_OPEN",
            ),
            warnings=(
                "UNSUPPORTED_TOPIC_DOCUMENTED",
                "GAP_P2_008_REMAINS_OPEN",
            ),
        )

    if not in_scope:
        return CaFirmEngagementWorkpaperBundleV1(
            analysis_status=CaFirmEngagementWorkpaperStatus.SKIP,
            runtime_version=RUNTIME_VERSION,
            ca_firm_engagement_workpaper_readiness=(
                CaFirmEngagementWorkpaperReadiness.NOT_APPLICABLE
            ),
            reason_codes=(
                "NO_IN_SCOPE_CA_FIRM_ENGAGEMENT_WORKPAPER_TOPIC",
            ),
            warnings=("CA_FIRM_ENGAGEMENT_WORKPAPER_NOT_APPLICABLE",),
        )

    pilot_ready = (
        CaFirmEngagementWorkpaperReadiness.SCOPE_PARTIAL
        if unsupported
        else CaFirmEngagementWorkpaperReadiness.POLICY_DECLARED
    )
    reasons = [
        "PILOT_SCOPE_CA_FIRM_ENGAGEMENT_WORKPAPER_CANDIDATE_ONLY",
        "RELEASE_SUITE_NOT_RELEASED",
        "GOLD_QUESTIONS_NOT_RELEASED",
        "SPECIALIST_SIGNOFF_NOT_SIGNED",
        "NO_ENGAGEMENT_AUTHORITY",
        "CA_FIRM_WORKSPACE_NOT_ENABLED",
        "ENGAGEMENT_NOT_OPENED",
        "ENGAGEMENT_NOT_SIGNED",
        "WORKPAPER_NOT_CREATED",
        "WORKPAPER_NOT_POSTED",
        "CLIENT_BINDER_NOT_RELEASED",
        "STAFF_ASSIGNMENT_NOT_APPLIED",
        "REVIEW_NOTES_NOT_FINALIZED",
        "PRODUCTION_NOT_APPROVED",
        "GAP_P2_008_OPEN",
        *tuple(f"TOPIC_{t}" for t in in_scope),
    ]
    return CaFirmEngagementWorkpaperBundleV1(
        analysis_status=CaFirmEngagementWorkpaperStatus.COMPLETE,
        runtime_version=RUNTIME_VERSION,
        ca_firm_engagement_workpaper_readiness=pilot_ready,
        in_scope_topics=tuple(in_scope),
        unsupported_topics=tuple(unsupported),
        reason_codes=tuple(reasons),
        warnings=(
            "GAP_P2_008_REMAINS_OPEN",
            "CA_FIRM_ENGAGEMENT_WORKPAPER_CANDIDATE_ONLY",
            "MUST_NOT_CLAIM_ENGAGEMENT_OPENED",
            "SPECIALIST_SIGNOFF_PENDING",
            "NOT_PRODUCTION_APPROVED",
        ),
    )


def attach_ca_firm_engagement_workpaper_to_request(
    request: CanonicalAIRequestV1,
) -> CanonicalAIRequestV1:
    bundle = build_ca_firm_engagement_workpaper_bundle(request)
    return request.model_copy(
        update={"ca_firm_engagement_workpaper_bundle": bundle}
    )


def assert_ca_firm_engagement_workpaper_authority(
    bundle: CaFirmEngagementWorkpaperBundleV1 | None,
) -> None:
    if bundle is None:
        return
    if (
        bundle.is_execution_authority
        or bundle.mutation_tools_allowed
        or bundle.engagement_authority_claimed
        or bundle.ca_firm_workspace_enabled
        or bundle.engagement_opened
        or bundle.engagement_signed
        or bundle.workpaper_created
        or bundle.workpaper_posted
        or bundle.client_binder_released
        or bundle.staff_assignment_applied
        or bundle.review_notes_finalized
        or bundle.production_approved
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
        != "CA_FIRM_ENGAGEMENT_WORKPAPER_CANDIDATE_ONLY"
    ):
        raise RuntimeError("CA_FIRM_ENGAGEMENT_WORKPAPER_AUTHORITY")


def ca_firm_engagement_workpaper_to_metadata(
    bundle: CaFirmEngagementWorkpaperBundleV1 | None,
) -> dict[str, Any]:
    if bundle is None:
        return {}
    return {
        "analysis_status": bundle.analysis_status.value,
        "runtime_version": bundle.runtime_version,
        "ca_firm_engagement_workpaper_readiness": (
            bundle.ca_firm_engagement_workpaper_readiness.value
        ),
        "pilot_scope": "CA_FIRM_ENGAGEMENT_WORKPAPER_CANDIDATE_ONLY",
        "in_scope_topics": list(bundle.in_scope_topics),
        "unsupported_topics": list(bundle.unsupported_topics),
        "release_status": "NOT_RELEASED",
        "gold_questions_status": "NOT_RELEASED",
        "specialist_signoff_status": "NOT_SIGNED",
        "mutation_tools_allowed": False,
        "engagement_authority_claimed": False,
        "ca_firm_workspace_enabled": False,
        "engagement_opened": False,
        "engagement_signed": False,
        "workpaper_created": False,
        "workpaper_posted": False,
        "client_binder_released": False,
        "staff_assignment_applied": False,
        "review_notes_finalized": False,
        "production_approved": False,
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
