"""MAI-45 — load/latency/resource/failover policy (never claims SLOs met).

Slice 1: declare candidate load/latency/failover policy from cue detection.
Never claims pilot SLOs met, never allows safety bypass under timeout, never
claims production performance approval.
"""

from __future__ import annotations

import re
from typing import Any

from ....contracts.load_latency_failover import (
    LoadLatencyFailoverBundleV1,
    LoadLatencyFailoverReadiness,
    LoadLatencyFailoverStatus,
    LoadLatencyFailoverTopic,
)
from ....contracts.request import CanonicalAIRequestV1

RUNTIME_VERSION = "mai-45.0.2-slice2"
AUTHORITY = "ADR_0062"

_LOAD = re.compile(r"\b(?:load\s+test|load\s+soak|soak\s+test)\b", re.I)
_LATENCY = re.compile(
    r"\b(?:latency\s+SLO|p95\s+latency|response\s+time\s+budget)\b",
    re.I,
)
_RESOURCE = re.compile(
    r"\b(?:resource\s+budget|cost\s+budget|capacity\s+plan)\b",
    re.I,
)
_FAILOVER = re.compile(r"\b(?:failover|failure\s+test|degradation)\b", re.I)
_CASCADE = re.compile(r"\b(?:cascade\s+tuning|provider\s+cascade)\b", re.I)
_SOAK = re.compile(r"\b(?:soak\s+test|long[- ]running\s+load)\b", re.I)
_CAPACITY = re.compile(
    r"\b(?:capacity\s+plan|Nepal\s+deployment\s+conditions)\b",
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
    if _LOAD.search(raw):
        in_scope.append(LoadLatencyFailoverTopic.LOAD_TEST.value)
    if _LATENCY.search(raw):
        in_scope.append(LoadLatencyFailoverTopic.LATENCY_SLO.value)
    if _RESOURCE.search(raw):
        in_scope.append(LoadLatencyFailoverTopic.RESOURCE_BUDGET.value)
    if _CAPACITY.search(raw):
        in_scope.append(LoadLatencyFailoverTopic.CAPACITY_PLAN.value)
    if _FAILOVER.search(raw):
        in_scope.append(LoadLatencyFailoverTopic.FAILOVER.value)
    if _CASCADE.search(raw):
        in_scope.append(LoadLatencyFailoverTopic.CASCADE_TUNING.value)
    if _SOAK.search(raw):
        in_scope.append(LoadLatencyFailoverTopic.SOAK_TEST.value)
    if _UNSUPPORTED.search(raw) and not in_scope:
        unsupported.append(LoadLatencyFailoverTopic.UNSUPPORTED.value)
    return in_scope, unsupported


def build_load_latency_failover_bundle(
    request: CanonicalAIRequestV1,
) -> LoadLatencyFailoverBundleV1:
    in_scope, unsupported = _detect_topics(request.raw_text or "")
    if not in_scope and unsupported:
        return LoadLatencyFailoverBundleV1(
            analysis_status=LoadLatencyFailoverStatus.COMPLETE,
            runtime_version=RUNTIME_VERSION,
            load_latency_failover_readiness=LoadLatencyFailoverReadiness.BLOCKED,
            unsupported_topics=tuple(unsupported),
            reason_codes=(
                "UNSUPPORTED_TOPIC_OUTSIDE_PILOT",
                "LOAD_LATENCY_FAILOVER_BLOCKED",
                "NO_PERF_AUTHORITY",
                "GAP_P2_008_OPEN",
            ),
            warnings=(
                "UNSUPPORTED_TOPIC_DOCUMENTED",
                "GAP_P2_008_REMAINS_OPEN",
            ),
        )

    if not in_scope:
        return LoadLatencyFailoverBundleV1(
            analysis_status=LoadLatencyFailoverStatus.SKIP,
            runtime_version=RUNTIME_VERSION,
            load_latency_failover_readiness=(
                LoadLatencyFailoverReadiness.NOT_APPLICABLE
            ),
            reason_codes=("NO_IN_SCOPE_LOAD_LATENCY_FAILOVER_TOPIC",),
            warnings=("LOAD_LATENCY_FAILOVER_NOT_APPLICABLE",),
        )

    pilot_ready = (
        LoadLatencyFailoverReadiness.SCOPE_PARTIAL
        if unsupported
        else LoadLatencyFailoverReadiness.POLICY_DECLARED
    )
    reasons = [
        "PILOT_SCOPE_LOAD_LATENCY_FAILOVER_CANDIDATE_ONLY",
        "PERF_SUITE_NOT_RELEASED",
        "GOLD_QUESTIONS_NOT_RELEASED",
        "SPECIALIST_SIGNOFF_NOT_SIGNED",
        "NO_PERF_AUTHORITY",
        "PILOT_SLOS_NOT_MET",
        "BOUNDED_DEGRADATION_NOT_PROVEN",
        "NO_SAFETY_BYPASS_UNDER_TIMEOUT",
        "COST_RESOURCE_NOT_MEASURED",
        "CAPACITY_NOT_PROVEN",
        "LOAD_TEST_NOT_PASSED",
        "FAILOVER_NOT_PROVEN",
        "PRODUCTION_PERF_NOT_APPROVED",
        "GAP_P2_008_OPEN",
        *tuple(f"TOPIC_{t}" for t in in_scope),
    ]
    return LoadLatencyFailoverBundleV1(
        analysis_status=LoadLatencyFailoverStatus.COMPLETE,
        runtime_version=RUNTIME_VERSION,
        load_latency_failover_readiness=pilot_ready,
        in_scope_topics=tuple(in_scope),
        unsupported_topics=tuple(unsupported),
        reason_codes=tuple(reasons),
        warnings=(
            "GAP_P2_008_REMAINS_OPEN",
            "LOAD_LATENCY_FAILOVER_CANDIDATE_ONLY",
            "TIMEOUT_MUST_NOT_BYPASS_SAFETY",
            "SPECIALIST_SIGNOFF_PENDING",
            "NOT_PRODUCTION_PERF_APPROVED",
        ),
    )


def attach_load_latency_failover_to_request(
    request: CanonicalAIRequestV1,
) -> CanonicalAIRequestV1:
    bundle = build_load_latency_failover_bundle(request)
    return request.model_copy(
        update={"load_latency_failover_bundle": bundle}
    )


def assert_load_latency_failover_authority(
    bundle: LoadLatencyFailoverBundleV1 | None,
) -> None:
    if bundle is None:
        return
    if (
        bundle.is_execution_authority
        or bundle.mutation_tools_allowed
        or bundle.perf_authority_claimed
        or bundle.pilot_slos_met
        or bundle.bounded_degradation_proven
        or bundle.safety_bypass_under_timeout
        or bundle.cost_resource_measured
        or bundle.capacity_proven
        or bundle.load_test_passed
        or bundle.failover_proven
        or bundle.production_perf_approved
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
        or bundle.pilot_scope != "LOAD_LATENCY_FAILOVER_CANDIDATE_ONLY"
    ):
        raise RuntimeError("LOAD_LATENCY_FAILOVER_AUTHORITY")


def load_latency_failover_to_metadata(
    bundle: LoadLatencyFailoverBundleV1 | None,
) -> dict[str, Any]:
    if bundle is None:
        return {}
    return {
        "analysis_status": bundle.analysis_status.value,
        "runtime_version": bundle.runtime_version,
        "load_latency_failover_readiness": (
            bundle.load_latency_failover_readiness.value
        ),
        "pilot_scope": "LOAD_LATENCY_FAILOVER_CANDIDATE_ONLY",
        "in_scope_topics": list(bundle.in_scope_topics),
        "unsupported_topics": list(bundle.unsupported_topics),
        "release_status": "NOT_RELEASED",
        "gold_questions_status": "NOT_RELEASED",
        "specialist_signoff_status": "NOT_SIGNED",
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
        "gap_p2_008_status": "OPEN",
        "kb_retrieval_invoked": False,
        "documents_retrieved": 0,
        "draft_mutations": 0,
        "posting_mutations": 0,
        "reason_codes": list(bundle.reason_codes),
        "warnings": list(bundle.warnings),
        "is_execution_authority": False,
    }
