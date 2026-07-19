"""MAI-44 slice 2 — consume security/tenant red-team policy into candidates.

Default: CANDIDATE_ONLY (build security red-team candidate; never claims pass).
Optional allow_* flags are for unit-test labeling only — live ingress always
forces false. Never pen-test pass, zero-critical claim, or production approval.
"""

from __future__ import annotations

from typing import Any, Mapping

from ....contracts.request import CanonicalAIRequestV1
from ....contracts.security_tenant_red_team import (
    SecurityRedTeamReadiness,
    SecurityTenantRedTeamBundleV1,
    SecurityTenantRedTeamStatus,
)

RUNTIME_VERSION = "mai-44.0.2-slice2"
AUTHORITY = "ADR_0061"


def _as_strt_meta(
    bundle: Mapping[str, Any] | SecurityTenantRedTeamBundleV1 | None,
) -> dict[str, Any] | None:
    if bundle is None:
        return None
    if isinstance(bundle, SecurityTenantRedTeamBundleV1):
        from .security_tenant_red_team_service import (
            security_tenant_red_team_to_metadata,
        )

        return security_tenant_red_team_to_metadata(bundle)
    if isinstance(bundle, Mapping):
        return dict(bundle)
    return None


def _authority_blocks(data: Mapping[str, Any]) -> bool:
    return (
        data.get("is_execution_authority") is True
        or data.get("mutation_tools_allowed") is True
        or data.get("security_authority_claimed") is True
        or data.get("isolation_proven") is True
        or data.get("zero_critical_findings_claimed") is True
        or data.get("confirmation_attacks_blocked_proven") is True
        or data.get("injection_capability_broadening_blocked_proven") is True
        or data.get("pen_review_passed") is True
        or data.get("remediation_closed") is True
        or data.get("production_security_approved") is True
        or data.get("secrets_scanned_clean") is True
        or data.get("current_law_definitive") is True
        or data.get("legal_effective_dates_proven") is True
        or data.get("claims_verified") is True
        or data.get("legal_proof_claimed") is True
        or data.get("kb_retrieval_invoked") is True
        or int(data.get("documents_retrieved") or 0) != 0
        or int(data.get("draft_mutations") or 0) != 0
        or int(data.get("posting_mutations") or 0) != 0
        or str(data.get("gap_p0_001_status") or "OPEN") != "OPEN"
        or str(data.get("gap_p2_008_status") or "OPEN") != "OPEN"
        or str(data.get("specialist_signoff_status") or "NOT_SIGNED")
        != "NOT_SIGNED"
        or str(data.get("release_status") or "NOT_RELEASED") != "NOT_RELEASED"
        or str(data.get("gold_questions_status") or "NOT_RELEASED")
        != "NOT_RELEASED"
        or str(data.get("pilot_scope") or "SECURITY_TENANT_RED_TEAM_CANDIDATE_ONLY")
        != "SECURITY_TENANT_RED_TEAM_CANDIDATE_ONLY"
    )


def resolve_security_red_team_consume_mode(
    bundle: Mapping[str, Any] | SecurityTenantRedTeamBundleV1 | None,
    *,
    allow_pen_review: bool = False,
    allow_zero_critical_claim: bool = False,
) -> str:
    """Return consume mode (never implies pass claim on default path)."""
    data = _as_strt_meta(bundle)
    if data is None:
        return "UNCHANGED"
    if _authority_blocks(data):
        return "BLOCKED"
    status = str(data.get("analysis_status") or "")
    if status != SecurityTenantRedTeamStatus.COMPLETE.value:
        return "SKIP"
    readiness = str(data.get("security_red_team_readiness") or "")
    if readiness == SecurityRedTeamReadiness.BLOCKED.value:
        return "BLOCKED"
    if readiness == SecurityRedTeamReadiness.NOT_APPLICABLE.value:
        return "SKIP"
    if readiness not in {
        SecurityRedTeamReadiness.POLICY_DECLARED.value,
        SecurityRedTeamReadiness.SCOPE_PARTIAL.value,
    }:
        return "SKIP"
    topics = data.get("in_scope_topics") or ()
    if not topics:
        return "BLOCKED"
    if allow_pen_review:
        return "INVOKE_PEN_REVIEW"
    if allow_zero_critical_claim:
        return "INVOKE_ZERO_CRITICAL_CLAIM"
    return "CANDIDATE_ONLY"


def build_security_red_team_candidate(
    bundle: Mapping[str, Any] | SecurityTenantRedTeamBundleV1 | None,
    *,
    field_overrides: Mapping[str, Any] | None = None,
    allow_pen_review: bool = False,
    allow_zero_critical_claim: bool = False,
) -> dict[str, Any]:
    """Build security red-team candidate (never claims pass)."""
    data = _as_strt_meta(bundle)
    mode = resolve_security_red_team_consume_mode(
        data,
        allow_pen_review=allow_pen_review,
        allow_zero_critical_claim=allow_zero_critical_claim,
    )
    overrides = dict(field_overrides or {})
    base: dict[str, Any] = {
        "security_red_team_consume_mode": mode,
        "security_red_team_consume_ready": False,
        "security_red_team_candidate": None,
        "mutation_tools_allowed": False,
        "security_authority_claimed": False,
        "isolation_proven": False,
        "zero_critical_findings_claimed": False,
        "confirmation_attacks_blocked_proven": False,
        "injection_capability_broadening_blocked_proven": False,
        "pen_review_passed": False,
        "remediation_closed": False,
        "production_security_approved": False,
        "secrets_scanned_clean": False,
        "current_law_definitive": False,
        "legal_effective_dates_proven": False,
        "claims_verified": False,
        "legal_proof_claimed": False,
        "kb_retrieval_invoked": False,
        "documents_retrieved": 0,
        "draft_mutations": 0,
        "posting_mutations": 0,
        "gap_p0_001_status": "OPEN",
        "gap_p2_008_status": "OPEN",
        "specialist_signoff_status": "NOT_SIGNED",
        "release_status": "NOT_RELEASED",
        "gold_questions_status": "NOT_RELEASED",
        "is_execution_authority": False,
        "runtime_version": RUNTIME_VERSION,
        "allow_pen_review": False,
        "allow_zero_critical_claim": False,
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
        "pilot_scope": "SECURITY_TENANT_RED_TEAM_CANDIDATE_ONLY",
        "security_red_team_readiness": data.get("security_red_team_readiness"),
        "in_scope_topics": topics,
        "unsupported_topics": unsupported,
        "release_status": "NOT_RELEASED",
        "gold_questions_status": "NOT_RELEASED",
        "threat_model_refs": None,
        "adversarial_suite_refs": None,
        "finding_register": None,
        "remediation_register": None,
        "pen_review_package": None,
        "definitive_answer": None,
        "specialist_signoff_status": "NOT_SIGNED",
        "security_authority_claimed": False,
        "isolation_proven": False,
        "zero_critical_findings_claimed": False,
        "confirmation_attacks_blocked_proven": False,
        "injection_capability_broadening_blocked_proven": False,
        "pen_review_passed": False,
        "remediation_closed": False,
        "production_security_approved": False,
        "secrets_scanned_clean": False,
        "field_overrides": overrides,
        "gap_p0_001_status": "OPEN",
        "gap_p2_008_status": "OPEN",
        "ready": True,
    }
    ready = mode == "CANDIDATE_ONLY" and bool(candidate["in_scope_topics"])
    base.update(
        {
            "security_red_team_consume_ready": ready,
            "security_red_team_candidate": candidate,
        }
    )
    return base


def security_red_team_consume_observability(
    request: CanonicalAIRequestV1,
    *,
    allow_pen_review: bool = False,
    allow_zero_critical_claim: bool = False,
) -> dict[str, Any]:
    """Merge consume observability; live path forces allow flags false."""
    del allow_pen_review, allow_zero_critical_claim
    built = build_security_red_team_candidate(
        request.security_tenant_red_team_bundle,
        field_overrides={},
        allow_pen_review=False,
        allow_zero_critical_claim=False,
    )
    return {
        "security_red_team_consume_mode": built[
            "security_red_team_consume_mode"
        ],
        "security_red_team_consume_ready": bool(
            built["security_red_team_consume_ready"]
        ),
        "security_red_team_candidate": built.get(
            "security_red_team_candidate"
        ),
        "mutation_tools_allowed": False,
        "security_authority_claimed": False,
        "isolation_proven": False,
        "zero_critical_findings_claimed": False,
        "confirmation_attacks_blocked_proven": False,
        "injection_capability_broadening_blocked_proven": False,
        "pen_review_passed": False,
        "remediation_closed": False,
        "production_security_approved": False,
        "secrets_scanned_clean": False,
        "current_law_definitive": False,
        "legal_effective_dates_proven": False,
        "claims_verified": False,
        "legal_proof_claimed": False,
        "kb_retrieval_invoked": False,
        "documents_retrieved": 0,
        "draft_mutations": 0,
        "posting_mutations": 0,
        "gap_p0_001_status": "OPEN",
        "gap_p2_008_status": "OPEN",
        "specialist_signoff_status": "NOT_SIGNED",
        "release_status": "NOT_RELEASED",
        "gold_questions_status": "NOT_RELEASED",
        "is_execution_authority": False,
        "runtime_version": RUNTIME_VERSION,
        "allow_pen_review": False,
        "allow_zero_critical_claim": False,
    }


def assert_security_red_team_consume_authority(
    obs: Mapping[str, Any] | None,
) -> None:
    if not obs:
        return
    if (
        obs.get("is_execution_authority") is True
        or obs.get("mutation_tools_allowed") is True
        or obs.get("security_authority_claimed") is True
        or obs.get("isolation_proven") is True
        or obs.get("zero_critical_findings_claimed") is True
        or obs.get("confirmation_attacks_blocked_proven") is True
        or obs.get("injection_capability_broadening_blocked_proven") is True
        or obs.get("pen_review_passed") is True
        or obs.get("remediation_closed") is True
        or obs.get("production_security_approved") is True
        or obs.get("secrets_scanned_clean") is True
        or obs.get("current_law_definitive") is True
        or obs.get("legal_effective_dates_proven") is True
        or obs.get("claims_verified") is True
        or obs.get("legal_proof_claimed") is True
        or obs.get("kb_retrieval_invoked") is True
        or int(obs.get("documents_retrieved") or 0) != 0
        or int(obs.get("draft_mutations") or 0) != 0
        or int(obs.get("posting_mutations") or 0) != 0
        or obs.get("allow_pen_review") is True
        or obs.get("allow_zero_critical_claim") is True
        or str(obs.get("gap_p0_001_status") or "OPEN") != "OPEN"
        or str(obs.get("gap_p2_008_status") or "OPEN") != "OPEN"
        or str(obs.get("specialist_signoff_status") or "NOT_SIGNED")
        != "NOT_SIGNED"
        or str(obs.get("release_status") or "NOT_RELEASED") != "NOT_RELEASED"
    ):
        raise RuntimeError("SECURITY_RED_TEAM_CONSUME_AUTHORITY")


def enrich_strt_metadata_with_consume(
    strt_meta: dict[str, Any],
    request: CanonicalAIRequestV1,
) -> dict[str, Any]:
    out = dict(strt_meta)
    obs = security_red_team_consume_observability(
        request,
        allow_pen_review=False,
        allow_zero_critical_claim=False,
    )
    out.update(obs)
    out["runtime_version"] = RUNTIME_VERSION
    return out
