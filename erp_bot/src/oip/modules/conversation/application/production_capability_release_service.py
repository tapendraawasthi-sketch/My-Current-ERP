"""MAI-49 — production capability release policy (never claims approved).

Slice 1: declare candidate production-release policy from cue detection.
Slice 2 consume is in production_capability_release_consume_service.
Never claims production approved, capability released, or cutover authorized.
"""

from __future__ import annotations

import re
from typing import Any

from ....contracts.production_capability_release import (
    ProductionCapabilityReleaseBundleV1,
    ProductionCapabilityReleaseReadiness,
    ProductionCapabilityReleaseStatus,
    ProductionCapabilityReleaseTopic,
)
from ....contracts.request import CanonicalAIRequestV1

RUNTIME_VERSION = "mai-49.0.2-slice2"
AUTHORITY = "ADR_0066"

_PROD_RELEASE = re.compile(
    r"\b(?:production\s+(?:capability\s+)?release|prod\s+release)\b",
    re.I,
)
_CHECKLIST = re.compile(
    r"\b(?:capability\s+checklist|release\s+checklist)\b",
    re.I,
)
_RISK = re.compile(
    r"\b(?:residual\s+risk|risk\s+acceptance)\b",
    re.I,
)
_OWNER = re.compile(
    r"\b(?:owner\s+sign[- ]?off|product\s+owner\s+approval)\b",
    re.I,
)
_CUTOVER = re.compile(
    r"\b(?:cutover\s+plan|production\s+cutover)\b",
    re.I,
)
_ROLLBACK = re.compile(
    r"\b(?:rollback\s+plan|release\s+rollback)\b",
    re.I,
)
_GATE = re.compile(
    r"\b(?:release\s+gate|production\s+gate)\b",
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
    if _PROD_RELEASE.search(raw):
        in_scope.append(
            ProductionCapabilityReleaseTopic.PRODUCTION_RELEASE.value
        )
    if _CHECKLIST.search(raw):
        in_scope.append(
            ProductionCapabilityReleaseTopic.CAPABILITY_CHECKLIST.value
        )
    if _RISK.search(raw):
        in_scope.append(ProductionCapabilityReleaseTopic.RESIDUAL_RISK.value)
    if _OWNER.search(raw):
        in_scope.append(ProductionCapabilityReleaseTopic.OWNER_SIGNOFF.value)
    if _CUTOVER.search(raw):
        in_scope.append(ProductionCapabilityReleaseTopic.CUTOVER_PLAN.value)
    if _ROLLBACK.search(raw):
        in_scope.append(ProductionCapabilityReleaseTopic.ROLLBACK_PLAN.value)
    if _GATE.search(raw):
        in_scope.append(ProductionCapabilityReleaseTopic.RELEASE_GATE.value)
    if _UNSUPPORTED.search(raw) and not in_scope:
        unsupported.append(ProductionCapabilityReleaseTopic.UNSUPPORTED.value)
    return in_scope, unsupported


def build_production_capability_release_bundle(
    request: CanonicalAIRequestV1,
) -> ProductionCapabilityReleaseBundleV1:
    in_scope, unsupported = _detect_topics(request.raw_text or "")
    if not in_scope and unsupported:
        return ProductionCapabilityReleaseBundleV1(
            analysis_status=ProductionCapabilityReleaseStatus.COMPLETE,
            runtime_version=RUNTIME_VERSION,
            production_capability_release_readiness=(
                ProductionCapabilityReleaseReadiness.BLOCKED
            ),
            unsupported_topics=tuple(unsupported),
            reason_codes=(
                "UNSUPPORTED_TOPIC_OUTSIDE_PILOT",
                "PRODUCTION_CAPABILITY_RELEASE_BLOCKED",
                "NO_RELEASE_AUTHORITY",
                "GAP_P2_008_OPEN",
            ),
            warnings=(
                "UNSUPPORTED_TOPIC_DOCUMENTED",
                "GAP_P2_008_REMAINS_OPEN",
            ),
        )

    if not in_scope:
        return ProductionCapabilityReleaseBundleV1(
            analysis_status=ProductionCapabilityReleaseStatus.SKIP,
            runtime_version=RUNTIME_VERSION,
            production_capability_release_readiness=(
                ProductionCapabilityReleaseReadiness.NOT_APPLICABLE
            ),
            reason_codes=(
                "NO_IN_SCOPE_PRODUCTION_CAPABILITY_RELEASE_TOPIC",
            ),
            warnings=("PRODUCTION_CAPABILITY_RELEASE_NOT_APPLICABLE",),
        )

    pilot_ready = (
        ProductionCapabilityReleaseReadiness.SCOPE_PARTIAL
        if unsupported
        else ProductionCapabilityReleaseReadiness.POLICY_DECLARED
    )
    reasons = [
        "PILOT_SCOPE_PRODUCTION_CAPABILITY_RELEASE_CANDIDATE_ONLY",
        "RELEASE_SUITE_NOT_RELEASED",
        "GOLD_QUESTIONS_NOT_RELEASED",
        "SPECIALIST_SIGNOFF_NOT_SIGNED",
        "NO_RELEASE_AUTHORITY",
        "PRODUCTION_NOT_APPROVED",
        "PRODUCTION_CAPABILITY_NOT_RELEASED",
        "RELEASE_CHECKLIST_NOT_COMPLETE",
        "RESIDUAL_RISK_NOT_ACCEPTED",
        "OWNER_SIGNOFF_NOT_PROVEN",
        "CUTOVER_NOT_AUTHORIZED",
        "ROLLBACK_NOT_PROVEN",
        "PRODUCTION_TRAFFIC_NOT_ENABLED",
        "GAP_P2_008_OPEN",
        *tuple(f"TOPIC_{t}" for t in in_scope),
    ]
    return ProductionCapabilityReleaseBundleV1(
        analysis_status=ProductionCapabilityReleaseStatus.COMPLETE,
        runtime_version=RUNTIME_VERSION,
        production_capability_release_readiness=pilot_ready,
        in_scope_topics=tuple(in_scope),
        unsupported_topics=tuple(unsupported),
        reason_codes=tuple(reasons),
        warnings=(
            "GAP_P2_008_REMAINS_OPEN",
            "PRODUCTION_CAPABILITY_RELEASE_CANDIDATE_ONLY",
            "MUST_NOT_CLAIM_PRODUCTION_APPROVED",
            "SPECIALIST_SIGNOFF_PENDING",
            "NOT_PRODUCTION_APPROVED",
        ),
    )


def attach_production_capability_release_to_request(
    request: CanonicalAIRequestV1,
) -> CanonicalAIRequestV1:
    bundle = build_production_capability_release_bundle(request)
    return request.model_copy(
        update={"production_capability_release_bundle": bundle}
    )


def assert_production_capability_release_authority(
    bundle: ProductionCapabilityReleaseBundleV1 | None,
) -> None:
    if bundle is None:
        return
    if (
        bundle.is_execution_authority
        or bundle.mutation_tools_allowed
        or bundle.release_authority_claimed
        or bundle.production_approved
        or bundle.production_capability_released
        or bundle.release_checklist_complete
        or bundle.residual_risk_accepted
        or bundle.owner_signoff_proven
        or bundle.cutover_authorized
        or bundle.rollback_proven
        or bundle.production_traffic_enabled
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
        != "PRODUCTION_CAPABILITY_RELEASE_CANDIDATE_ONLY"
    ):
        raise RuntimeError("PRODUCTION_CAPABILITY_RELEASE_AUTHORITY")


def production_capability_release_to_metadata(
    bundle: ProductionCapabilityReleaseBundleV1 | None,
) -> dict[str, Any]:
    if bundle is None:
        return {}
    return {
        "analysis_status": bundle.analysis_status.value,
        "runtime_version": bundle.runtime_version,
        "production_capability_release_readiness": (
            bundle.production_capability_release_readiness.value
        ),
        "pilot_scope": "PRODUCTION_CAPABILITY_RELEASE_CANDIDATE_ONLY",
        "in_scope_topics": list(bundle.in_scope_topics),
        "unsupported_topics": list(bundle.unsupported_topics),
        "release_status": "NOT_RELEASED",
        "gold_questions_status": "NOT_RELEASED",
        "specialist_signoff_status": "NOT_SIGNED",
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
        "gap_p2_008_status": "OPEN",
        "kb_retrieval_invoked": False,
        "documents_retrieved": 0,
        "draft_mutations": 0,
        "posting_mutations": 0,
        "reason_codes": list(bundle.reason_codes),
        "warnings": list(bundle.warnings),
        "is_execution_authority": False,
    }
