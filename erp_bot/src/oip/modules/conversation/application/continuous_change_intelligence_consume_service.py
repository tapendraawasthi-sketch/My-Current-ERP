"""MAI-43 slice 2 — consume continuous-change policy into candidates.

Default: CANDIDATE_ONLY (build continuous-change candidate; never applies).
Optional allow_* flags are for unit-test labeling only — live ingress always
forces false. Never production truth, cache invalidate, or proven dates.
"""

from __future__ import annotations

from typing import Any, Mapping

from ....contracts.continuous_change_intelligence import (
    ContinuousChangeIntelligenceBundleV1,
    ContinuousChangeIntelligenceStatus,
    ContinuousChangeReadiness,
)
from ....contracts.request import CanonicalAIRequestV1

RUNTIME_VERSION = "mai-43.0.2-slice2"
AUTHORITY = "ADR_0060"


def _as_cci_meta(
    bundle: Mapping[str, Any]
    | ContinuousChangeIntelligenceBundleV1
    | None,
) -> dict[str, Any] | None:
    if bundle is None:
        return None
    if isinstance(bundle, ContinuousChangeIntelligenceBundleV1):
        from .continuous_change_intelligence_service import (
            continuous_change_intelligence_to_metadata,
        )

        return continuous_change_intelligence_to_metadata(bundle)
    if isinstance(bundle, Mapping):
        return dict(bundle)
    return None


def _authority_blocks(data: Mapping[str, Any]) -> bool:
    return (
        data.get("is_execution_authority") is True
        or data.get("mutation_tools_allowed") is True
        or data.get("continuous_change_authority_claimed") is True
        or data.get("unreviewed_as_production_truth") is True
        or data.get("cache_invalidated") is True
        or data.get("rates_changed_as_truth") is True
        or data.get("change_applied") is True
        or data.get("amendment_applied") is True
        or data.get("rollback_executed") is True
        or data.get("current_law_definitive") is True
        or data.get("legal_effective_dates_proven") is True
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
        or str(data.get("release_status") or "NOT_RELEASED") != "NOT_RELEASED"
        or str(data.get("gold_questions_status") or "NOT_RELEASED")
        != "NOT_RELEASED"
        or str(data.get("pilot_scope") or "CONTINUOUS_CHANGE_CANDIDATE_ONLY")
        != "CONTINUOUS_CHANGE_CANDIDATE_ONLY"
    )


def resolve_continuous_change_consume_mode(
    bundle: Mapping[str, Any]
    | ContinuousChangeIntelligenceBundleV1
    | None,
    *,
    allow_change_apply: bool = False,
    allow_cache_invalidate: bool = False,
) -> str:
    """Return consume mode (never implies apply/invalidate on default path)."""
    data = _as_cci_meta(bundle)
    if data is None:
        return "UNCHANGED"
    if _authority_blocks(data):
        return "BLOCKED"
    status = str(data.get("analysis_status") or "")
    if status != ContinuousChangeIntelligenceStatus.COMPLETE.value:
        return "SKIP"
    readiness = str(data.get("continuous_change_readiness") or "")
    if readiness == ContinuousChangeReadiness.BLOCKED.value:
        return "BLOCKED"
    if readiness == ContinuousChangeReadiness.NOT_APPLICABLE.value:
        return "SKIP"
    if readiness not in {
        ContinuousChangeReadiness.POLICY_DECLARED.value,
        ContinuousChangeReadiness.SCOPE_PARTIAL.value,
    }:
        return "SKIP"
    topics = data.get("in_scope_topics") or ()
    if not topics:
        return "BLOCKED"
    if allow_change_apply:
        return "INVOKE_CHANGE_APPLY"
    if allow_cache_invalidate:
        return "INVOKE_CACHE_INVALIDATE"
    return "CANDIDATE_ONLY"


def build_continuous_change_candidate(
    bundle: Mapping[str, Any]
    | ContinuousChangeIntelligenceBundleV1
    | None,
    *,
    field_overrides: Mapping[str, Any] | None = None,
    allow_change_apply: bool = False,
    allow_cache_invalidate: bool = False,
) -> dict[str, Any]:
    """Build continuous-change candidate (never applies or proves dates)."""
    data = _as_cci_meta(bundle)
    mode = resolve_continuous_change_consume_mode(
        data,
        allow_change_apply=allow_change_apply,
        allow_cache_invalidate=allow_cache_invalidate,
    )
    overrides = dict(field_overrides or {})
    base: dict[str, Any] = {
        "continuous_change_consume_mode": mode,
        "continuous_change_consume_ready": False,
        "continuous_change_candidate": None,
        "mutation_tools_allowed": False,
        "continuous_change_authority_claimed": False,
        "unreviewed_as_production_truth": False,
        "cache_invalidated": False,
        "rates_changed_as_truth": False,
        "change_applied": False,
        "amendment_applied": False,
        "rollback_executed": False,
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
        "allow_change_apply": False,
        "allow_cache_invalidate": False,
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
        "pilot_scope": "CONTINUOUS_CHANGE_CANDIDATE_ONLY",
        "continuous_change_readiness": data.get("continuous_change_readiness"),
        "in_scope_topics": topics,
        "unsupported_topics": unsupported,
        "release_status": "NOT_RELEASED",
        "gold_questions_status": "NOT_RELEASED",
        "change_refs": None,
        "impact_analysis": None,
        "reviewer_queue": None,
        "cache_targets": None,
        "rollback_plan": None,
        "definitive_answer": None,
        "specialist_signoff_status": "NOT_SIGNED",
        "research_mode_bound": bool(data.get("research_mode_bound")),
        "continuous_change_authority_claimed": False,
        "unreviewed_as_production_truth": False,
        "cache_invalidated": False,
        "rates_changed_as_truth": False,
        "change_applied": False,
        "amendment_applied": False,
        "rollback_executed": False,
        "current_law_definitive": False,
        "legal_effective_dates_proven": False,
        "field_overrides": overrides,
        "gap_p2_008_status": "OPEN",
        "ready": True,
    }
    ready = mode == "CANDIDATE_ONLY" and bool(candidate["in_scope_topics"])
    base.update(
        {
            "continuous_change_consume_ready": ready,
            "continuous_change_candidate": candidate,
        }
    )
    return base


def continuous_change_consume_observability(
    request: CanonicalAIRequestV1,
    *,
    allow_change_apply: bool = False,
    allow_cache_invalidate: bool = False,
) -> dict[str, Any]:
    """Merge consume observability; live path forces allow flags false."""
    del allow_change_apply, allow_cache_invalidate
    built = build_continuous_change_candidate(
        request.continuous_change_intelligence_bundle,
        field_overrides={},
        allow_change_apply=False,
        allow_cache_invalidate=False,
    )
    return {
        "continuous_change_consume_mode": built[
            "continuous_change_consume_mode"
        ],
        "continuous_change_consume_ready": bool(
            built["continuous_change_consume_ready"]
        ),
        "continuous_change_candidate": built.get(
            "continuous_change_candidate"
        ),
        "mutation_tools_allowed": False,
        "continuous_change_authority_claimed": False,
        "unreviewed_as_production_truth": False,
        "cache_invalidated": False,
        "rates_changed_as_truth": False,
        "change_applied": False,
        "amendment_applied": False,
        "rollback_executed": False,
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
        "allow_change_apply": False,
        "allow_cache_invalidate": False,
    }


def assert_continuous_change_consume_authority(
    obs: Mapping[str, Any] | None,
) -> None:
    if not obs:
        return
    if (
        obs.get("is_execution_authority") is True
        or obs.get("mutation_tools_allowed") is True
        or obs.get("continuous_change_authority_claimed") is True
        or obs.get("unreviewed_as_production_truth") is True
        or obs.get("cache_invalidated") is True
        or obs.get("rates_changed_as_truth") is True
        or obs.get("change_applied") is True
        or obs.get("amendment_applied") is True
        or obs.get("rollback_executed") is True
        or obs.get("current_law_definitive") is True
        or obs.get("legal_effective_dates_proven") is True
        or obs.get("claims_verified") is True
        or obs.get("legal_proof_claimed") is True
        or obs.get("kb_retrieval_invoked") is True
        or int(obs.get("documents_retrieved") or 0) != 0
        or int(obs.get("draft_mutations") or 0) != 0
        or int(obs.get("posting_mutations") or 0) != 0
        or obs.get("allow_change_apply") is True
        or obs.get("allow_cache_invalidate") is True
        or str(obs.get("gap_p2_008_status") or "OPEN") != "OPEN"
        or str(obs.get("specialist_signoff_status") or "NOT_SIGNED")
        != "NOT_SIGNED"
        or str(obs.get("release_status") or "NOT_RELEASED") != "NOT_RELEASED"
    ):
        raise RuntimeError("CONTINUOUS_CHANGE_CONSUME_AUTHORITY")


def enrich_cci_metadata_with_consume(
    cci_meta: dict[str, Any],
    request: CanonicalAIRequestV1,
) -> dict[str, Any]:
    out = dict(cci_meta)
    obs = continuous_change_consume_observability(
        request,
        allow_change_apply=False,
        allow_cache_invalidate=False,
    )
    out.update(obs)
    out["runtime_version"] = RUNTIME_VERSION
    return out
