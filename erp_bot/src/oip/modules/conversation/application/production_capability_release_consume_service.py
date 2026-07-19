"""MAI-49 slice 2 — consume production capability release into candidates.

Default: CANDIDATE_ONLY (build release candidate; never approves / cutover).
Optional allow_* flags are for unit-test labeling only — live ingress always
forces false. Never production approve, cutover authorize, or enable traffic.
"""

from __future__ import annotations

from typing import Any, Mapping

from ....contracts.production_capability_release import (
    ProductionCapabilityReleaseBundleV1,
    ProductionCapabilityReleaseReadiness,
    ProductionCapabilityReleaseStatus,
)
from ....contracts.request import CanonicalAIRequestV1

RUNTIME_VERSION = "mai-49.0.2-slice2"
AUTHORITY = "ADR_0066"


def _as_pcr_meta(
    bundle: Mapping[str, Any] | ProductionCapabilityReleaseBundleV1 | None,
) -> dict[str, Any] | None:
    if bundle is None:
        return None
    if isinstance(bundle, ProductionCapabilityReleaseBundleV1):
        from .production_capability_release_service import (
            production_capability_release_to_metadata,
        )

        return production_capability_release_to_metadata(bundle)
    if isinstance(bundle, Mapping):
        return dict(bundle)
    return None


def _authority_blocks(data: Mapping[str, Any]) -> bool:
    return (
        data.get("is_execution_authority") is True
        or data.get("mutation_tools_allowed") is True
        or data.get("release_authority_claimed") is True
        or data.get("production_approved") is True
        or data.get("production_capability_released") is True
        or data.get("release_checklist_complete") is True
        or data.get("residual_risk_accepted") is True
        or data.get("owner_signoff_proven") is True
        or data.get("cutover_authorized") is True
        or data.get("rollback_proven") is True
        or data.get("production_traffic_enabled") is True
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
            or "PRODUCTION_CAPABILITY_RELEASE_CANDIDATE_ONLY"
        )
        != "PRODUCTION_CAPABILITY_RELEASE_CANDIDATE_ONLY"
    )


def resolve_production_capability_release_consume_mode(
    bundle: Mapping[str, Any] | ProductionCapabilityReleaseBundleV1 | None,
    *,
    allow_cutover: bool = False,
    allow_traffic: bool = False,
) -> str:
    """Return consume mode (never implies cutover/traffic on default path)."""
    data = _as_pcr_meta(bundle)
    if data is None:
        return "UNCHANGED"
    if _authority_blocks(data):
        return "BLOCKED"
    status = str(data.get("analysis_status") or "")
    if status != ProductionCapabilityReleaseStatus.COMPLETE.value:
        return "SKIP"
    readiness = str(
        data.get("production_capability_release_readiness") or ""
    )
    if readiness == ProductionCapabilityReleaseReadiness.BLOCKED.value:
        return "BLOCKED"
    if (
        readiness
        == ProductionCapabilityReleaseReadiness.NOT_APPLICABLE.value
    ):
        return "SKIP"
    if readiness not in {
        ProductionCapabilityReleaseReadiness.POLICY_DECLARED.value,
        ProductionCapabilityReleaseReadiness.SCOPE_PARTIAL.value,
    }:
        return "SKIP"
    topics = data.get("in_scope_topics") or ()
    if not topics:
        return "BLOCKED"
    if allow_cutover:
        return "INVOKE_CUTOVER"
    if allow_traffic:
        return "INVOKE_TRAFFIC"
    return "CANDIDATE_ONLY"


def build_production_capability_release_candidate(
    bundle: Mapping[str, Any] | ProductionCapabilityReleaseBundleV1 | None,
    *,
    field_overrides: Mapping[str, Any] | None = None,
    allow_cutover: bool = False,
    allow_traffic: bool = False,
) -> dict[str, Any]:
    """Build production capability release candidate (never applies)."""
    data = _as_pcr_meta(bundle)
    mode = resolve_production_capability_release_consume_mode(
        data,
        allow_cutover=allow_cutover,
        allow_traffic=allow_traffic,
    )
    overrides = dict(field_overrides or {})
    base: dict[str, Any] = {
        "production_capability_release_consume_mode": mode,
        "production_capability_release_consume_ready": False,
        "production_capability_release_candidate": None,
        "mutation_tools_allowed": False,
        "release_authority_claimed": False,
        "production_approved": False,
        "production_capability_released": False,
        "release_checklist_complete": False,
        "residual_risk_accepted": False,
        "owner_signoff_proven": False,
        "cutover_authorized": False,
        "rollback_proven": False,
        "production_traffic_enabled": False,
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
        "allow_cutover": False,
        "allow_traffic": False,
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
        "pilot_scope": "PRODUCTION_CAPABILITY_RELEASE_CANDIDATE_ONLY",
        "production_capability_release_readiness": data.get(
            "production_capability_release_readiness"
        ),
        "in_scope_topics": topics,
        "unsupported_topics": unsupported,
        "release_status": "NOT_RELEASED",
        "gold_questions_status": "NOT_RELEASED",
        "capability_checklist": None,
        "residual_risk_register": None,
        "owner_signoff_record": None,
        "cutover_plan": None,
        "rollback_plan": None,
        "release_gate_plan": None,
        "definitive_answer": None,
        "specialist_signoff_status": "NOT_SIGNED",
        "release_authority_claimed": False,
        "production_approved": False,
        "production_capability_released": False,
        "release_checklist_complete": False,
        "residual_risk_accepted": False,
        "owner_signoff_proven": False,
        "cutover_authorized": False,
        "rollback_proven": False,
        "production_traffic_enabled": False,
        "field_overrides": overrides,
        "gap_p2_008_status": "OPEN",
        "ready": True,
    }
    ready = mode == "CANDIDATE_ONLY" and bool(candidate["in_scope_topics"])
    base.update(
        {
            "production_capability_release_consume_ready": ready,
            "production_capability_release_candidate": candidate,
        }
    )
    return base


def production_capability_release_consume_observability(
    request: CanonicalAIRequestV1,
    *,
    allow_cutover: bool = False,
    allow_traffic: bool = False,
) -> dict[str, Any]:
    """Merge consume observability; live path forces allow flags false."""
    del allow_cutover, allow_traffic
    built = build_production_capability_release_candidate(
        request.production_capability_release_bundle,
        field_overrides={},
        allow_cutover=False,
        allow_traffic=False,
    )
    return {
        "production_capability_release_consume_mode": built[
            "production_capability_release_consume_mode"
        ],
        "production_capability_release_consume_ready": bool(
            built["production_capability_release_consume_ready"]
        ),
        "production_capability_release_candidate": built.get(
            "production_capability_release_candidate"
        ),
        "mutation_tools_allowed": False,
        "release_authority_claimed": False,
        "production_approved": False,
        "production_capability_released": False,
        "release_checklist_complete": False,
        "residual_risk_accepted": False,
        "owner_signoff_proven": False,
        "cutover_authorized": False,
        "rollback_proven": False,
        "production_traffic_enabled": False,
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
        "allow_cutover": False,
        "allow_traffic": False,
    }


def assert_production_capability_release_consume_authority(
    obs: Mapping[str, Any] | None,
) -> None:
    if not obs:
        return
    if (
        obs.get("is_execution_authority") is True
        or obs.get("mutation_tools_allowed") is True
        or obs.get("release_authority_claimed") is True
        or obs.get("production_approved") is True
        or obs.get("production_capability_released") is True
        or obs.get("release_checklist_complete") is True
        or obs.get("residual_risk_accepted") is True
        or obs.get("owner_signoff_proven") is True
        or obs.get("cutover_authorized") is True
        or obs.get("rollback_proven") is True
        or obs.get("production_traffic_enabled") is True
        or obs.get("current_law_definitive") is True
        or obs.get("legal_effective_dates_proven") is True
        or obs.get("claims_verified") is True
        or obs.get("legal_proof_claimed") is True
        or obs.get("kb_retrieval_invoked") is True
        or int(obs.get("documents_retrieved") or 0) != 0
        or int(obs.get("draft_mutations") or 0) != 0
        or int(obs.get("posting_mutations") or 0) != 0
        or obs.get("allow_cutover") is True
        or obs.get("allow_traffic") is True
        or str(obs.get("gap_p2_008_status") or "OPEN") != "OPEN"
        or str(obs.get("specialist_signoff_status") or "NOT_SIGNED")
        != "NOT_SIGNED"
        or str(obs.get("release_status") or "NOT_RELEASED") != "NOT_RELEASED"
    ):
        raise RuntimeError("PRODUCTION_CAPABILITY_RELEASE_CONSUME_AUTHORITY")


def enrich_pcr_metadata_with_consume(
    pcr_meta: dict[str, Any],
    request: CanonicalAIRequestV1,
) -> dict[str, Any]:
    out = dict(pcr_meta)
    obs = production_capability_release_consume_observability(
        request,
        allow_cutover=False,
        allow_traffic=False,
    )
    out.update(obs)
    out["runtime_version"] = RUNTIME_VERSION
    return out
