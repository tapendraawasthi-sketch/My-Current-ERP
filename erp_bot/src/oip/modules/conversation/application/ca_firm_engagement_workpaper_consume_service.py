"""MAI-52 slice 2 — consume CA-firm engagement / workpaper into candidates.

Default: CANDIDATE_ONLY (build engagement candidate; never opens / posts).
Optional allow_* flags are for unit-test labeling only — live ingress always
forces false. Never open/sign engagement or create/post workpaper.
"""

from __future__ import annotations

from typing import Any, Mapping

from ....contracts.ca_firm_engagement_workpaper import (
    CaFirmEngagementWorkpaperBundleV1,
    CaFirmEngagementWorkpaperReadiness,
    CaFirmEngagementWorkpaperStatus,
)
from ....contracts.request import CanonicalAIRequestV1

RUNTIME_VERSION = "mai-52.0.2-slice2"
AUTHORITY = "ADR_0069"


def _as_ca_meta(
    bundle: Mapping[str, Any] | CaFirmEngagementWorkpaperBundleV1 | None,
) -> dict[str, Any] | None:
    if bundle is None:
        return None
    if isinstance(bundle, CaFirmEngagementWorkpaperBundleV1):
        from .ca_firm_engagement_workpaper_service import (
            ca_firm_engagement_workpaper_to_metadata,
        )

        return ca_firm_engagement_workpaper_to_metadata(bundle)
    if isinstance(bundle, Mapping):
        return dict(bundle)
    return None


def _authority_blocks(data: Mapping[str, Any]) -> bool:
    return (
        data.get("is_execution_authority") is True
        or data.get("mutation_tools_allowed") is True
        or data.get("engagement_authority_claimed") is True
        or data.get("ca_firm_workspace_enabled") is True
        or data.get("engagement_opened") is True
        or data.get("engagement_signed") is True
        or data.get("workpaper_created") is True
        or data.get("workpaper_posted") is True
        or data.get("client_binder_released") is True
        or data.get("staff_assignment_applied") is True
        or data.get("review_notes_finalized") is True
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
            or "CA_FIRM_ENGAGEMENT_WORKPAPER_CANDIDATE_ONLY"
        )
        != "CA_FIRM_ENGAGEMENT_WORKPAPER_CANDIDATE_ONLY"
    )


def resolve_ca_firm_engagement_workpaper_consume_mode(
    bundle: Mapping[str, Any] | CaFirmEngagementWorkpaperBundleV1 | None,
    *,
    allow_open_engagement: bool = False,
    allow_post_workpaper: bool = False,
) -> str:
    """Return consume mode (never implies open/post on default path)."""
    data = _as_ca_meta(bundle)
    if data is None:
        return "UNCHANGED"
    if _authority_blocks(data):
        return "BLOCKED"
    status = str(data.get("analysis_status") or "")
    if status != CaFirmEngagementWorkpaperStatus.COMPLETE.value:
        return "SKIP"
    readiness = str(
        data.get("ca_firm_engagement_workpaper_readiness") or ""
    )
    if readiness == CaFirmEngagementWorkpaperReadiness.BLOCKED.value:
        return "BLOCKED"
    if (
        readiness
        == CaFirmEngagementWorkpaperReadiness.NOT_APPLICABLE.value
    ):
        return "SKIP"
    if readiness not in {
        CaFirmEngagementWorkpaperReadiness.POLICY_DECLARED.value,
        CaFirmEngagementWorkpaperReadiness.SCOPE_PARTIAL.value,
    }:
        return "SKIP"
    topics = data.get("in_scope_topics") or ()
    if not topics:
        return "BLOCKED"
    if allow_open_engagement:
        return "INVOKE_OPEN_ENGAGEMENT"
    if allow_post_workpaper:
        return "INVOKE_POST_WORKPAPER"
    return "CANDIDATE_ONLY"


def build_ca_firm_engagement_workpaper_candidate(
    bundle: Mapping[str, Any] | CaFirmEngagementWorkpaperBundleV1 | None,
    *,
    field_overrides: Mapping[str, Any] | None = None,
    allow_open_engagement: bool = False,
    allow_post_workpaper: bool = False,
) -> dict[str, Any]:
    """Build CA-firm engagement / workpaper candidate (never opens/posts)."""
    data = _as_ca_meta(bundle)
    mode = resolve_ca_firm_engagement_workpaper_consume_mode(
        data,
        allow_open_engagement=allow_open_engagement,
        allow_post_workpaper=allow_post_workpaper,
    )
    overrides = dict(field_overrides or {})
    base: dict[str, Any] = {
        "ca_firm_engagement_workpaper_consume_mode": mode,
        "ca_firm_engagement_workpaper_consume_ready": False,
        "ca_firm_engagement_workpaper_candidate": None,
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
        "allow_open_engagement": False,
        "allow_post_workpaper": False,
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
        "pilot_scope": "CA_FIRM_ENGAGEMENT_WORKPAPER_CANDIDATE_ONLY",
        "ca_firm_engagement_workpaper_readiness": data.get(
            "ca_firm_engagement_workpaper_readiness"
        ),
        "in_scope_topics": topics,
        "unsupported_topics": unsupported,
        "release_status": "NOT_RELEASED",
        "gold_questions_status": "NOT_RELEASED",
        "engagement_plan": None,
        "engagement_letter_plan": None,
        "workpaper_workspace_plan": None,
        "workpaper_review_plan": None,
        "client_binder_plan": None,
        "staff_assignment_plan": None,
        "review_notes_plan": None,
        "definitive_answer": None,
        "specialist_signoff_status": "NOT_SIGNED",
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
        "field_overrides": overrides,
        "gap_p2_008_status": "OPEN",
        "ready": True,
    }
    ready = mode == "CANDIDATE_ONLY" and bool(candidate["in_scope_topics"])
    base.update(
        {
            "ca_firm_engagement_workpaper_consume_ready": ready,
            "ca_firm_engagement_workpaper_candidate": candidate,
        }
    )
    return base


def ca_firm_engagement_workpaper_consume_observability(
    request: CanonicalAIRequestV1,
    *,
    allow_open_engagement: bool = False,
    allow_post_workpaper: bool = False,
) -> dict[str, Any]:
    """Merge consume observability; live path forces allow flags false."""
    del allow_open_engagement, allow_post_workpaper
    built = build_ca_firm_engagement_workpaper_candidate(
        request.ca_firm_engagement_workpaper_bundle,
        field_overrides={},
        allow_open_engagement=False,
        allow_post_workpaper=False,
    )
    return {
        "ca_firm_engagement_workpaper_consume_mode": built[
            "ca_firm_engagement_workpaper_consume_mode"
        ],
        "ca_firm_engagement_workpaper_consume_ready": bool(
            built["ca_firm_engagement_workpaper_consume_ready"]
        ),
        "ca_firm_engagement_workpaper_candidate": built.get(
            "ca_firm_engagement_workpaper_candidate"
        ),
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
        "allow_open_engagement": False,
        "allow_post_workpaper": False,
    }


def assert_ca_firm_engagement_workpaper_consume_authority(
    obs: Mapping[str, Any] | None,
) -> None:
    if not obs:
        return
    if (
        obs.get("is_execution_authority") is True
        or obs.get("mutation_tools_allowed") is True
        or obs.get("engagement_authority_claimed") is True
        or obs.get("ca_firm_workspace_enabled") is True
        or obs.get("engagement_opened") is True
        or obs.get("engagement_signed") is True
        or obs.get("workpaper_created") is True
        or obs.get("workpaper_posted") is True
        or obs.get("client_binder_released") is True
        or obs.get("staff_assignment_applied") is True
        or obs.get("review_notes_finalized") is True
        or obs.get("production_approved") is True
        or obs.get("current_law_definitive") is True
        or obs.get("legal_effective_dates_proven") is True
        or obs.get("claims_verified") is True
        or obs.get("legal_proof_claimed") is True
        or obs.get("kb_retrieval_invoked") is True
        or int(obs.get("documents_retrieved") or 0) != 0
        or int(obs.get("draft_mutations") or 0) != 0
        or int(obs.get("posting_mutations") or 0) != 0
        or obs.get("allow_open_engagement") is True
        or obs.get("allow_post_workpaper") is True
        or str(obs.get("gap_p2_008_status") or "OPEN") != "OPEN"
        or str(obs.get("specialist_signoff_status") or "NOT_SIGNED")
        != "NOT_SIGNED"
        or str(obs.get("release_status") or "NOT_RELEASED") != "NOT_RELEASED"
    ):
        raise RuntimeError("CA_FIRM_ENGAGEMENT_WORKPAPER_CONSUME_AUTHORITY")


def enrich_ca_metadata_with_consume(
    ca_meta: dict[str, Any],
    request: CanonicalAIRequestV1,
) -> dict[str, Any]:
    out = dict(ca_meta)
    obs = ca_firm_engagement_workpaper_consume_observability(
        request,
        allow_open_engagement=False,
        allow_post_workpaper=False,
    )
    out.update(obs)
    out["runtime_version"] = RUNTIME_VERSION
    return out
