"""MAI-45 slice 2 — consume load/latency/failover policy into candidates.

Default: CANDIDATE_ONLY (build perf candidate; never claims SLOs met).
Optional allow_* flags are for unit-test labeling only — live ingress always
forces false. Never safety bypass under timeout or production perf approval.
"""

from __future__ import annotations

from typing import Any, Mapping

from ....contracts.load_latency_failover import (
    LoadLatencyFailoverBundleV1,
    LoadLatencyFailoverReadiness,
    LoadLatencyFailoverStatus,
)
from ....contracts.request import CanonicalAIRequestV1

RUNTIME_VERSION = "mai-45.0.2-slice2"
AUTHORITY = "ADR_0062"


def _as_llf_meta(
    bundle: Mapping[str, Any] | LoadLatencyFailoverBundleV1 | None,
) -> dict[str, Any] | None:
    if bundle is None:
        return None
    if isinstance(bundle, LoadLatencyFailoverBundleV1):
        from .load_latency_failover_service import (
            load_latency_failover_to_metadata,
        )

        return load_latency_failover_to_metadata(bundle)
    if isinstance(bundle, Mapping):
        return dict(bundle)
    return None


def _authority_blocks(data: Mapping[str, Any]) -> bool:
    return (
        data.get("is_execution_authority") is True
        or data.get("mutation_tools_allowed") is True
        or data.get("perf_authority_claimed") is True
        or data.get("pilot_slos_met") is True
        or data.get("bounded_degradation_proven") is True
        or data.get("safety_bypass_under_timeout") is True
        or data.get("cost_resource_measured") is True
        or data.get("capacity_proven") is True
        or data.get("load_test_passed") is True
        or data.get("failover_proven") is True
        or data.get("production_perf_approved") is True
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
        or str(data.get("pilot_scope") or "LOAD_LATENCY_FAILOVER_CANDIDATE_ONLY")
        != "LOAD_LATENCY_FAILOVER_CANDIDATE_ONLY"
    )


def resolve_load_latency_failover_consume_mode(
    bundle: Mapping[str, Any] | LoadLatencyFailoverBundleV1 | None,
    *,
    allow_load_test: bool = False,
    allow_slo_claim: bool = False,
) -> str:
    """Return consume mode (never implies SLO pass on default path)."""
    data = _as_llf_meta(bundle)
    if data is None:
        return "UNCHANGED"
    if _authority_blocks(data):
        return "BLOCKED"
    status = str(data.get("analysis_status") or "")
    if status != LoadLatencyFailoverStatus.COMPLETE.value:
        return "SKIP"
    readiness = str(data.get("load_latency_failover_readiness") or "")
    if readiness == LoadLatencyFailoverReadiness.BLOCKED.value:
        return "BLOCKED"
    if readiness == LoadLatencyFailoverReadiness.NOT_APPLICABLE.value:
        return "SKIP"
    if readiness not in {
        LoadLatencyFailoverReadiness.POLICY_DECLARED.value,
        LoadLatencyFailoverReadiness.SCOPE_PARTIAL.value,
    }:
        return "SKIP"
    topics = data.get("in_scope_topics") or ()
    if not topics:
        return "BLOCKED"
    if allow_load_test:
        return "INVOKE_LOAD_TEST"
    if allow_slo_claim:
        return "INVOKE_SLO_CLAIM"
    return "CANDIDATE_ONLY"


def build_load_latency_failover_candidate(
    bundle: Mapping[str, Any] | LoadLatencyFailoverBundleV1 | None,
    *,
    field_overrides: Mapping[str, Any] | None = None,
    allow_load_test: bool = False,
    allow_slo_claim: bool = False,
) -> dict[str, Any]:
    """Build load/latency/failover candidate (never claims SLOs met)."""
    data = _as_llf_meta(bundle)
    mode = resolve_load_latency_failover_consume_mode(
        data,
        allow_load_test=allow_load_test,
        allow_slo_claim=allow_slo_claim,
    )
    overrides = dict(field_overrides or {})
    base: dict[str, Any] = {
        "load_latency_failover_consume_mode": mode,
        "load_latency_failover_consume_ready": False,
        "load_latency_failover_candidate": None,
        "mutation_tools_allowed": False,
        "perf_authority_claimed": False,
        "pilot_slos_met": False,
        "bounded_degradation_proven": False,
        "safety_bypass_under_timeout": False,
        "cost_resource_measured": False,
        "capacity_proven": False,
        "load_test_passed": False,
        "failover_proven": False,
        "production_perf_approved": False,
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
        "allow_load_test": False,
        "allow_slo_claim": False,
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
        "pilot_scope": "LOAD_LATENCY_FAILOVER_CANDIDATE_ONLY",
        "load_latency_failover_readiness": data.get(
            "load_latency_failover_readiness"
        ),
        "in_scope_topics": topics,
        "unsupported_topics": unsupported,
        "release_status": "NOT_RELEASED",
        "gold_questions_status": "NOT_RELEASED",
        "stage_profiles": None,
        "cascade_tuning": None,
        "index_benchmarks": None,
        "load_soak_plan": None,
        "capacity_plan": None,
        "definitive_answer": None,
        "specialist_signoff_status": "NOT_SIGNED",
        "perf_authority_claimed": False,
        "pilot_slos_met": False,
        "bounded_degradation_proven": False,
        "safety_bypass_under_timeout": False,
        "cost_resource_measured": False,
        "capacity_proven": False,
        "load_test_passed": False,
        "failover_proven": False,
        "production_perf_approved": False,
        "field_overrides": overrides,
        "gap_p2_008_status": "OPEN",
        "ready": True,
    }
    ready = mode == "CANDIDATE_ONLY" and bool(candidate["in_scope_topics"])
    base.update(
        {
            "load_latency_failover_consume_ready": ready,
            "load_latency_failover_candidate": candidate,
        }
    )
    return base


def load_latency_failover_consume_observability(
    request: CanonicalAIRequestV1,
    *,
    allow_load_test: bool = False,
    allow_slo_claim: bool = False,
) -> dict[str, Any]:
    """Merge consume observability; live path forces allow flags false."""
    del allow_load_test, allow_slo_claim
    built = build_load_latency_failover_candidate(
        request.load_latency_failover_bundle,
        field_overrides={},
        allow_load_test=False,
        allow_slo_claim=False,
    )
    return {
        "load_latency_failover_consume_mode": built[
            "load_latency_failover_consume_mode"
        ],
        "load_latency_failover_consume_ready": bool(
            built["load_latency_failover_consume_ready"]
        ),
        "load_latency_failover_candidate": built.get(
            "load_latency_failover_candidate"
        ),
        "mutation_tools_allowed": False,
        "perf_authority_claimed": False,
        "pilot_slos_met": False,
        "bounded_degradation_proven": False,
        "safety_bypass_under_timeout": False,
        "cost_resource_measured": False,
        "capacity_proven": False,
        "load_test_passed": False,
        "failover_proven": False,
        "production_perf_approved": False,
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
        "allow_load_test": False,
        "allow_slo_claim": False,
    }


def assert_load_latency_failover_consume_authority(
    obs: Mapping[str, Any] | None,
) -> None:
    if not obs:
        return
    if (
        obs.get("is_execution_authority") is True
        or obs.get("mutation_tools_allowed") is True
        or obs.get("perf_authority_claimed") is True
        or obs.get("pilot_slos_met") is True
        or obs.get("bounded_degradation_proven") is True
        or obs.get("safety_bypass_under_timeout") is True
        or obs.get("cost_resource_measured") is True
        or obs.get("capacity_proven") is True
        or obs.get("load_test_passed") is True
        or obs.get("failover_proven") is True
        or obs.get("production_perf_approved") is True
        or obs.get("current_law_definitive") is True
        or obs.get("legal_effective_dates_proven") is True
        or obs.get("claims_verified") is True
        or obs.get("legal_proof_claimed") is True
        or obs.get("kb_retrieval_invoked") is True
        or int(obs.get("documents_retrieved") or 0) != 0
        or int(obs.get("draft_mutations") or 0) != 0
        or int(obs.get("posting_mutations") or 0) != 0
        or obs.get("allow_load_test") is True
        or obs.get("allow_slo_claim") is True
        or str(obs.get("gap_p2_008_status") or "OPEN") != "OPEN"
        or str(obs.get("specialist_signoff_status") or "NOT_SIGNED")
        != "NOT_SIGNED"
        or str(obs.get("release_status") or "NOT_RELEASED") != "NOT_RELEASED"
    ):
        raise RuntimeError("LOAD_LATENCY_FAILOVER_CONSUME_AUTHORITY")


def enrich_llf_metadata_with_consume(
    llf_meta: dict[str, Any],
    request: CanonicalAIRequestV1,
) -> dict[str, Any]:
    out = dict(llf_meta)
    obs = load_latency_failover_consume_observability(
        request,
        allow_load_test=False,
        allow_slo_claim=False,
    )
    out.update(obs)
    out["runtime_version"] = RUNTIME_VERSION
    return out
