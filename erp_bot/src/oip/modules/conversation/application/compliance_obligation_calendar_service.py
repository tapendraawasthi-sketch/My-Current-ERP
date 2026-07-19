"""MAI-53 — compliance obligation / calendar policy (never arms automation).

Slice 1: declare candidate compliance/calendar policy from cue detection.
Never claims calendar enabled, obligation created, reminder sent, or filing submitted.
"""

from __future__ import annotations

import re
from typing import Any

from ....contracts.compliance_obligation_calendar import (
    ComplianceObligationCalendarBundleV1,
    ComplianceObligationCalendarReadiness,
    ComplianceObligationCalendarStatus,
    ComplianceObligationCalendarTopic,
)
from ....contracts.request import CanonicalAIRequestV1

RUNTIME_VERSION = "mai-53.0.1-slice1"
AUTHORITY = "ADR_0070"

_OBLIGATION = re.compile(
    r"\b(?:compliance\s+obligation)\b",
    re.I,
)
_DEADLINE = re.compile(
    r"\b(?:filing\s+deadline)\b",
    re.I,
)
_CALENDAR = re.compile(
    r"\b(?:compliance\s+calendar)\b",
    re.I,
)
_REMINDER = re.compile(
    r"\b(?:reminder\s+automation|automated\s+reminder)\b",
    re.I,
)
_TRACKING = re.compile(
    r"\b(?:obligation\s+tracking)\b",
    re.I,
)
_ALERT = re.compile(
    r"\b(?:due[- ]?date\s+alert)\b",
    re.I,
)
_REGULATORY = re.compile(
    r"\b(?:regulatory\s+calendar)\b",
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
    if _OBLIGATION.search(raw):
        in_scope.append(
            ComplianceObligationCalendarTopic.COMPLIANCE_OBLIGATION.value
        )
    if _DEADLINE.search(raw):
        in_scope.append(
            ComplianceObligationCalendarTopic.FILING_DEADLINE.value
        )
    if _CALENDAR.search(raw):
        in_scope.append(
            ComplianceObligationCalendarTopic.COMPLIANCE_CALENDAR.value
        )
    if _REMINDER.search(raw):
        in_scope.append(
            ComplianceObligationCalendarTopic.REMINDER_AUTOMATION.value
        )
    if _TRACKING.search(raw):
        in_scope.append(
            ComplianceObligationCalendarTopic.OBLIGATION_TRACKING.value
        )
    if _ALERT.search(raw):
        in_scope.append(ComplianceObligationCalendarTopic.DUE_DATE_ALERT.value)
    if _REGULATORY.search(raw):
        in_scope.append(
            ComplianceObligationCalendarTopic.REGULATORY_CALENDAR.value
        )
    if _UNSUPPORTED.search(raw) and not in_scope:
        unsupported.append(
            ComplianceObligationCalendarTopic.UNSUPPORTED.value
        )
    return in_scope, unsupported


def build_compliance_obligation_calendar_bundle(
    request: CanonicalAIRequestV1,
) -> ComplianceObligationCalendarBundleV1:
    in_scope, unsupported = _detect_topics(request.raw_text or "")
    if not in_scope and unsupported:
        return ComplianceObligationCalendarBundleV1(
            analysis_status=ComplianceObligationCalendarStatus.COMPLETE,
            runtime_version=RUNTIME_VERSION,
            compliance_obligation_calendar_readiness=(
                ComplianceObligationCalendarReadiness.BLOCKED
            ),
            unsupported_topics=tuple(unsupported),
            reason_codes=(
                "UNSUPPORTED_TOPIC_OUTSIDE_PILOT",
                "COMPLIANCE_OBLIGATION_CALENDAR_BLOCKED",
                "NO_CALENDAR_AUTHORITY",
                "GAP_P2_008_OPEN",
            ),
            warnings=(
                "UNSUPPORTED_TOPIC_DOCUMENTED",
                "GAP_P2_008_REMAINS_OPEN",
            ),
        )

    if not in_scope:
        return ComplianceObligationCalendarBundleV1(
            analysis_status=ComplianceObligationCalendarStatus.SKIP,
            runtime_version=RUNTIME_VERSION,
            compliance_obligation_calendar_readiness=(
                ComplianceObligationCalendarReadiness.NOT_APPLICABLE
            ),
            reason_codes=(
                "NO_IN_SCOPE_COMPLIANCE_OBLIGATION_CALENDAR_TOPIC",
            ),
            warnings=("COMPLIANCE_OBLIGATION_CALENDAR_NOT_APPLICABLE",),
        )

    pilot_ready = (
        ComplianceObligationCalendarReadiness.SCOPE_PARTIAL
        if unsupported
        else ComplianceObligationCalendarReadiness.POLICY_DECLARED
    )
    reasons = [
        "PILOT_SCOPE_COMPLIANCE_OBLIGATION_CALENDAR_CANDIDATE_ONLY",
        "RELEASE_SUITE_NOT_RELEASED",
        "GOLD_QUESTIONS_NOT_RELEASED",
        "SPECIALIST_SIGNOFF_NOT_SIGNED",
        "NO_CALENDAR_AUTHORITY",
        "COMPLIANCE_CALENDAR_NOT_ENABLED",
        "OBLIGATION_NOT_CREATED",
        "DEADLINE_NOT_SCHEDULED",
        "REMINDER_NOT_SENT",
        "AUTOMATION_NOT_ARMED",
        "CALENDAR_NOT_SYNCED",
        "FILING_NOT_SUBMITTED",
        "OBLIGATION_NOT_CLOSED",
        "PRODUCTION_NOT_APPROVED",
        "GAP_P2_008_OPEN",
        *tuple(f"TOPIC_{t}" for t in in_scope),
    ]
    return ComplianceObligationCalendarBundleV1(
        analysis_status=ComplianceObligationCalendarStatus.COMPLETE,
        runtime_version=RUNTIME_VERSION,
        compliance_obligation_calendar_readiness=pilot_ready,
        in_scope_topics=tuple(in_scope),
        unsupported_topics=tuple(unsupported),
        reason_codes=tuple(reasons),
        warnings=(
            "GAP_P2_008_REMAINS_OPEN",
            "COMPLIANCE_OBLIGATION_CALENDAR_CANDIDATE_ONLY",
            "MUST_NOT_CLAIM_AUTOMATION_ARMED",
            "SPECIALIST_SIGNOFF_PENDING",
            "NOT_PRODUCTION_APPROVED",
        ),
    )


def attach_compliance_obligation_calendar_to_request(
    request: CanonicalAIRequestV1,
) -> CanonicalAIRequestV1:
    bundle = build_compliance_obligation_calendar_bundle(request)
    return request.model_copy(
        update={"compliance_obligation_calendar_bundle": bundle}
    )


def assert_compliance_obligation_calendar_authority(
    bundle: ComplianceObligationCalendarBundleV1 | None,
) -> None:
    if bundle is None:
        return
    if (
        bundle.is_execution_authority
        or bundle.mutation_tools_allowed
        or bundle.calendar_authority_claimed
        or bundle.compliance_calendar_enabled
        or bundle.obligation_created
        or bundle.deadline_scheduled
        or bundle.reminder_sent
        or bundle.automation_armed
        or bundle.calendar_synced
        or bundle.filing_submitted
        or bundle.obligation_closed
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
        != "COMPLIANCE_OBLIGATION_CALENDAR_CANDIDATE_ONLY"
    ):
        raise RuntimeError("COMPLIANCE_OBLIGATION_CALENDAR_AUTHORITY")


def compliance_obligation_calendar_to_metadata(
    bundle: ComplianceObligationCalendarBundleV1 | None,
) -> dict[str, Any]:
    if bundle is None:
        return {}
    return {
        "analysis_status": bundle.analysis_status.value,
        "runtime_version": bundle.runtime_version,
        "compliance_obligation_calendar_readiness": (
            bundle.compliance_obligation_calendar_readiness.value
        ),
        "pilot_scope": "COMPLIANCE_OBLIGATION_CALENDAR_CANDIDATE_ONLY",
        "in_scope_topics": list(bundle.in_scope_topics),
        "unsupported_topics": list(bundle.unsupported_topics),
        "release_status": "NOT_RELEASED",
        "gold_questions_status": "NOT_RELEASED",
        "specialist_signoff_status": "NOT_SIGNED",
        "mutation_tools_allowed": False,
        "calendar_authority_claimed": False,
        "compliance_calendar_enabled": False,
        "obligation_created": False,
        "deadline_scheduled": False,
        "reminder_sent": False,
        "automation_armed": False,
        "calendar_synced": False,
        "filing_submitted": False,
        "obligation_closed": False,
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
