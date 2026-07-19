"""MAI-53 slice 2 — consume compliance obligation / calendar into candidates.

Default: CANDIDATE_ONLY (build calendar candidate; never arms / submits).
Optional allow_* flags are for unit-test labeling only — live ingress always
forces false. Never arm automation or submit filings.
"""

from __future__ import annotations

from typing import Any, Mapping

from ....contracts.compliance_obligation_calendar import (
    ComplianceObligationCalendarBundleV1,
    ComplianceObligationCalendarReadiness,
    ComplianceObligationCalendarStatus,
)
from ....contracts.request import CanonicalAIRequestV1

RUNTIME_VERSION = "mai-53.0.2-slice2"
AUTHORITY = "ADR_0070"


def _as_coc_meta(
    bundle: Mapping[str, Any]
    | ComplianceObligationCalendarBundleV1
    | None,
) -> dict[str, Any] | None:
    if bundle is None:
        return None
    if isinstance(bundle, ComplianceObligationCalendarBundleV1):
        from .compliance_obligation_calendar_service import (
            compliance_obligation_calendar_to_metadata,
        )

        return compliance_obligation_calendar_to_metadata(bundle)
    if isinstance(bundle, Mapping):
        return dict(bundle)
    return None


def _authority_blocks(data: Mapping[str, Any]) -> bool:
    return (
        data.get("is_execution_authority") is True
        or data.get("mutation_tools_allowed") is True
        or data.get("calendar_authority_claimed") is True
        or data.get("compliance_calendar_enabled") is True
        or data.get("obligation_created") is True
        or data.get("deadline_scheduled") is True
        or data.get("reminder_sent") is True
        or data.get("automation_armed") is True
        or data.get("calendar_synced") is True
        or data.get("filing_submitted") is True
        or data.get("obligation_closed") is True
        or data.get("production_approved") is True
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
            or "COMPLIANCE_OBLIGATION_CALENDAR_CANDIDATE_ONLY"
        )
        != "COMPLIANCE_OBLIGATION_CALENDAR_CANDIDATE_ONLY"
    )


def resolve_compliance_obligation_calendar_consume_mode(
    bundle: Mapping[str, Any]
    | ComplianceObligationCalendarBundleV1
    | None,
    *,
    allow_arm_automation: bool = False,
    allow_submit_filing: bool = False,
) -> str:
    """Return consume mode (never implies arm/submit on default path)."""
    data = _as_coc_meta(bundle)
    if data is None:
        return "UNCHANGED"
    if _authority_blocks(data):
        return "BLOCKED"
    status = str(data.get("analysis_status") or "")
    if status != ComplianceObligationCalendarStatus.COMPLETE.value:
        return "SKIP"
    readiness = str(
        data.get("compliance_obligation_calendar_readiness") or ""
    )
    if readiness == ComplianceObligationCalendarReadiness.BLOCKED.value:
        return "BLOCKED"
    if (
        readiness
        == ComplianceObligationCalendarReadiness.NOT_APPLICABLE.value
    ):
        return "SKIP"
    if readiness not in {
        ComplianceObligationCalendarReadiness.POLICY_DECLARED.value,
        ComplianceObligationCalendarReadiness.SCOPE_PARTIAL.value,
    }:
        return "SKIP"
    topics = data.get("in_scope_topics") or ()
    if not topics:
        return "BLOCKED"
    if allow_arm_automation:
        return "INVOKE_ARM_AUTOMATION"
    if allow_submit_filing:
        return "INVOKE_SUBMIT_FILING"
    return "CANDIDATE_ONLY"


def build_compliance_obligation_calendar_candidate(
    bundle: Mapping[str, Any]
    | ComplianceObligationCalendarBundleV1
    | None,
    *,
    field_overrides: Mapping[str, Any] | None = None,
    allow_arm_automation: bool = False,
    allow_submit_filing: bool = False,
) -> dict[str, Any]:
    """Build compliance obligation / calendar candidate (never arms/submits)."""
    data = _as_coc_meta(bundle)
    mode = resolve_compliance_obligation_calendar_consume_mode(
        data,
        allow_arm_automation=allow_arm_automation,
        allow_submit_filing=allow_submit_filing,
    )
    overrides = dict(field_overrides or {})
    base: dict[str, Any] = {
        "compliance_obligation_calendar_consume_mode": mode,
        "compliance_obligation_calendar_consume_ready": False,
        "compliance_obligation_calendar_candidate": None,
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
        "allow_arm_automation": False,
        "allow_submit_filing": False,
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
        "pilot_scope": "COMPLIANCE_OBLIGATION_CALENDAR_CANDIDATE_ONLY",
        "compliance_obligation_calendar_readiness": data.get(
            "compliance_obligation_calendar_readiness"
        ),
        "in_scope_topics": topics,
        "unsupported_topics": unsupported,
        "release_status": "NOT_RELEASED",
        "gold_questions_status": "NOT_RELEASED",
        "obligation_plan": None,
        "filing_deadline_plan": None,
        "compliance_calendar_plan": None,
        "reminder_automation_plan": None,
        "obligation_tracking_plan": None,
        "due_date_alert_plan": None,
        "regulatory_calendar_plan": None,
        "definitive_answer": None,
        "specialist_signoff_status": "NOT_SIGNED",
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
        "field_overrides": overrides,
        "gap_p2_008_status": "OPEN",
        "ready": True,
    }
    ready = mode == "CANDIDATE_ONLY" and bool(candidate["in_scope_topics"])
    base.update(
        {
            "compliance_obligation_calendar_consume_ready": ready,
            "compliance_obligation_calendar_candidate": candidate,
        }
    )
    return base


def compliance_obligation_calendar_consume_observability(
    request: CanonicalAIRequestV1,
    *,
    allow_arm_automation: bool = False,
    allow_submit_filing: bool = False,
) -> dict[str, Any]:
    """Merge consume observability; live path forces allow flags false."""
    del allow_arm_automation, allow_submit_filing
    built = build_compliance_obligation_calendar_candidate(
        request.compliance_obligation_calendar_bundle,
        field_overrides={},
        allow_arm_automation=False,
        allow_submit_filing=False,
    )
    return {
        "compliance_obligation_calendar_consume_mode": built[
            "compliance_obligation_calendar_consume_mode"
        ],
        "compliance_obligation_calendar_consume_ready": bool(
            built["compliance_obligation_calendar_consume_ready"]
        ),
        "compliance_obligation_calendar_candidate": built.get(
            "compliance_obligation_calendar_candidate"
        ),
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
        "allow_arm_automation": False,
        "allow_submit_filing": False,
    }


def assert_compliance_obligation_calendar_consume_authority(
    obs: Mapping[str, Any] | None,
) -> None:
    if not obs:
        return
    if (
        obs.get("is_execution_authority") is True
        or obs.get("mutation_tools_allowed") is True
        or obs.get("calendar_authority_claimed") is True
        or obs.get("compliance_calendar_enabled") is True
        or obs.get("obligation_created") is True
        or obs.get("deadline_scheduled") is True
        or obs.get("reminder_sent") is True
        or obs.get("automation_armed") is True
        or obs.get("calendar_synced") is True
        or obs.get("filing_submitted") is True
        or obs.get("obligation_closed") is True
        or obs.get("production_approved") is True
        or obs.get("current_law_definitive") is True
        or obs.get("legal_effective_dates_proven") is True
        or obs.get("claims_verified") is True
        or obs.get("legal_proof_claimed") is True
        or obs.get("kb_retrieval_invoked") is True
        or int(obs.get("documents_retrieved") or 0) != 0
        or int(obs.get("draft_mutations") or 0) != 0
        or int(obs.get("posting_mutations") or 0) != 0
        or obs.get("allow_arm_automation") is True
        or obs.get("allow_submit_filing") is True
        or str(obs.get("gap_p2_008_status") or "OPEN") != "OPEN"
        or str(obs.get("specialist_signoff_status") or "NOT_SIGNED")
        != "NOT_SIGNED"
        or str(obs.get("release_status") or "NOT_RELEASED") != "NOT_RELEASED"
    ):
        raise RuntimeError("COMPLIANCE_OBLIGATION_CALENDAR_CONSUME_AUTHORITY")


def enrich_coc_metadata_with_consume(
    coc_meta: dict[str, Any],
    request: CanonicalAIRequestV1,
) -> dict[str, Any]:
    out = dict(coc_meta)
    obs = compliance_obligation_calendar_consume_observability(
        request,
        allow_arm_automation=False,
        allow_submit_filing=False,
    )
    out.update(obs)
    out["runtime_version"] = RUNTIME_VERSION
    return out
