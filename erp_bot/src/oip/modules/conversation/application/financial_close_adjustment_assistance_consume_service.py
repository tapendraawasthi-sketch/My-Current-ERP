"""MAI-40 slice 2 — consume close/adjustment policy into candidates.

Default: CANDIDATE_ONLY (build close-assist candidate; never posts).
Optional allow_* flags are for unit-test labeling only — live ingress always
forces false. Never close post, adjustment post, or book lock.
"""

from __future__ import annotations

from typing import Any, Mapping

from ....contracts.financial_close_adjustment_assistance import (
    CloseAssistReadiness,
    FinancialCloseAdjustmentAssistanceBundleV1,
    FinancialCloseAdjustmentAssistanceStatus,
)
from ....contracts.request import CanonicalAIRequestV1

RUNTIME_VERSION = "mai-40.0.2-slice2"
AUTHORITY = "ADR_0057"


def _as_fcaa_meta(
    bundle: Mapping[str, Any]
    | FinancialCloseAdjustmentAssistanceBundleV1
    | None,
) -> dict[str, Any] | None:
    if bundle is None:
        return None
    if isinstance(bundle, FinancialCloseAdjustmentAssistanceBundleV1):
        from .financial_close_adjustment_assistance_service import (
            financial_close_adjustment_assistance_to_metadata,
        )

        return financial_close_adjustment_assistance_to_metadata(bundle)
    if isinstance(bundle, Mapping):
        return dict(bundle)
    return None


def _authority_blocks(data: Mapping[str, Any]) -> bool:
    return (
        data.get("is_execution_authority") is True
        or data.get("mutation_tools_allowed") is True
        or data.get("close_posted") is True
        or data.get("adjustments_posted") is True
        or data.get("books_locked") is True
        or data.get("period_closed") is True
        or data.get("current_law_definitive") is True
        or data.get("legal_effective_dates_proven") is True
        or data.get("amendment_applied") is True
        or data.get("claims_verified") is True
        or data.get("citations_verified") is True
        or data.get("legal_proof_claimed") is True
        or data.get("kb_retrieval_invoked") is True
        or int(data.get("documents_retrieved") or 0) != 0
        or int(data.get("draft_mutations") or 0) != 0
        or int(data.get("posting_mutations") or 0) != 0
        or str(data.get("gap_p2_008_status") or "OPEN") != "OPEN"
        or str(data.get("specialist_signoff_status") or "NOT_SIGNED")
        != "NOT_SIGNED"
        or str(data.get("adjustment_status") or "CANDIDATE_ASSISTANCE_ONLY")
        != "CANDIDATE_ASSISTANCE_ONLY"
        or str(data.get("pilot_scope") or "FINANCIAL_CLOSE_ADJUSTMENT_ONLY")
        != "FINANCIAL_CLOSE_ADJUSTMENT_ONLY"
    )


def resolve_close_assist_consume_mode(
    bundle: Mapping[str, Any]
    | FinancialCloseAdjustmentAssistanceBundleV1
    | None,
    *,
    allow_close_post: bool = False,
    allow_adjustment_post: bool = False,
) -> str:
    """Return consume mode (never implies post/lock on default path)."""
    data = _as_fcaa_meta(bundle)
    if data is None:
        return "UNCHANGED"
    if _authority_blocks(data):
        return "BLOCKED"
    status = str(data.get("analysis_status") or "")
    if status != FinancialCloseAdjustmentAssistanceStatus.COMPLETE.value:
        return "SKIP"
    readiness = str(data.get("close_assist_readiness") or "")
    if readiness == CloseAssistReadiness.BLOCKED.value:
        return "BLOCKED"
    if readiness == CloseAssistReadiness.NOT_APPLICABLE.value:
        return "SKIP"
    if readiness not in {
        CloseAssistReadiness.POLICY_DECLARED.value,
        CloseAssistReadiness.SCOPE_PARTIAL.value,
    }:
        return "SKIP"
    topics = data.get("in_scope_topics") or ()
    if not topics:
        return "BLOCKED"
    if allow_close_post:
        return "INVOKE_CLOSE_POST"
    if allow_adjustment_post:
        return "INVOKE_ADJUSTMENT_POST"
    return "CANDIDATE_ONLY"


def build_close_assist_candidate(
    bundle: Mapping[str, Any]
    | FinancialCloseAdjustmentAssistanceBundleV1
    | None,
    *,
    field_overrides: Mapping[str, Any] | None = None,
    allow_close_post: bool = False,
    allow_adjustment_post: bool = False,
) -> dict[str, Any]:
    """Build close-assist candidate (never posts or locks)."""
    data = _as_fcaa_meta(bundle)
    mode = resolve_close_assist_consume_mode(
        data,
        allow_close_post=allow_close_post,
        allow_adjustment_post=allow_adjustment_post,
    )
    overrides = dict(field_overrides or {})
    base: dict[str, Any] = {
        "close_assist_consume_mode": mode,
        "close_assist_consume_ready": False,
        "close_assist_candidate": None,
        "mutation_tools_allowed": False,
        "close_posted": False,
        "adjustments_posted": False,
        "books_locked": False,
        "period_closed": False,
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
        "adjustment_status": "CANDIDATE_ASSISTANCE_ONLY",
        "is_execution_authority": False,
        "runtime_version": RUNTIME_VERSION,
        "allow_close_post": False,
        "allow_adjustment_post": False,
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
        "pilot_scope": "FINANCIAL_CLOSE_ADJUSTMENT_ONLY",
        "close_assist_readiness": data.get("close_assist_readiness"),
        "in_scope_topics": topics,
        "unsupported_topics": unsupported,
        "adjustment_status": "CANDIDATE_ASSISTANCE_ONLY",
        "checklist_refs": None,
        "adjustment_drafts": None,
        "definitive_answer": None,
        "specialist_signoff_status": "NOT_SIGNED",
        "nfrs_nas_bound": bool(data.get("nfrs_nas_bound")),
        "close_posted": False,
        "adjustments_posted": False,
        "books_locked": False,
        "period_closed": False,
        "current_law_definitive": False,
        "legal_effective_dates_proven": False,
        "field_overrides": overrides,
        "gap_p2_008_status": "OPEN",
        "ready": True,
    }
    ready = mode == "CANDIDATE_ONLY" and bool(candidate["in_scope_topics"])
    base.update(
        {
            "close_assist_consume_ready": ready,
            "close_assist_candidate": candidate,
        }
    )
    return base


def close_assist_consume_observability(
    request: CanonicalAIRequestV1,
    *,
    allow_close_post: bool = False,
    allow_adjustment_post: bool = False,
) -> dict[str, Any]:
    """Merge consume observability; live path forces allow flags false."""
    del allow_close_post, allow_adjustment_post
    built = build_close_assist_candidate(
        request.financial_close_adjustment_assistance_bundle,
        field_overrides={},
        allow_close_post=False,
        allow_adjustment_post=False,
    )
    return {
        "close_assist_consume_mode": built["close_assist_consume_mode"],
        "close_assist_consume_ready": bool(
            built["close_assist_consume_ready"]
        ),
        "close_assist_candidate": built.get("close_assist_candidate"),
        "mutation_tools_allowed": False,
        "close_posted": False,
        "adjustments_posted": False,
        "books_locked": False,
        "period_closed": False,
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
        "adjustment_status": "CANDIDATE_ASSISTANCE_ONLY",
        "is_execution_authority": False,
        "runtime_version": RUNTIME_VERSION,
        "allow_close_post": False,
        "allow_adjustment_post": False,
    }


def assert_close_assist_consume_authority(
    obs: Mapping[str, Any] | None,
) -> None:
    if not obs:
        return
    if (
        obs.get("is_execution_authority") is True
        or obs.get("mutation_tools_allowed") is True
        or obs.get("close_posted") is True
        or obs.get("adjustments_posted") is True
        or obs.get("books_locked") is True
        or obs.get("period_closed") is True
        or obs.get("current_law_definitive") is True
        or obs.get("legal_effective_dates_proven") is True
        or obs.get("claims_verified") is True
        or obs.get("legal_proof_claimed") is True
        or obs.get("kb_retrieval_invoked") is True
        or int(obs.get("documents_retrieved") or 0) != 0
        or int(obs.get("draft_mutations") or 0) != 0
        or int(obs.get("posting_mutations") or 0) != 0
        or obs.get("allow_close_post") is True
        or obs.get("allow_adjustment_post") is True
        or str(obs.get("gap_p2_008_status") or "OPEN") != "OPEN"
        or str(obs.get("specialist_signoff_status") or "NOT_SIGNED")
        != "NOT_SIGNED"
    ):
        raise RuntimeError("CLOSE_ASSIST_CONSUME_AUTHORITY")


def enrich_fcaa_metadata_with_consume(
    fcaa_meta: dict[str, Any],
    request: CanonicalAIRequestV1,
) -> dict[str, Any]:
    out = dict(fcaa_meta)
    obs = close_assist_consume_observability(
        request,
        allow_close_post=False,
        allow_adjustment_post=False,
    )
    out.update(obs)
    out["runtime_version"] = RUNTIME_VERSION
    return out
