"""MAI-41 slice 2 — consume domain-release policy into candidates.

Default: CANDIDATE_ONLY (build domain-release candidate; never releases).
Optional allow_* flags are for unit-test labeling only — live ingress always
forces false. Never domain authority, production release, or definitive law.
"""

from __future__ import annotations

from typing import Any, Mapping

from ....contracts.broader_nepal_business_law_domain_release import (
    BroaderNepalBusinessLawDomainReleaseBundleV1,
    BroaderNepalBusinessLawDomainReleaseStatus,
    DomainReleaseReadiness,
)
from ....contracts.request import CanonicalAIRequestV1

RUNTIME_VERSION = "mai-41.0.2-slice2"
AUTHORITY = "ADR_0058"


def _as_bnbl_meta(
    bundle: Mapping[str, Any]
    | BroaderNepalBusinessLawDomainReleaseBundleV1
    | None,
) -> dict[str, Any] | None:
    if bundle is None:
        return None
    if isinstance(bundle, BroaderNepalBusinessLawDomainReleaseBundleV1):
        from .broader_nepal_business_law_domain_release_service import (
            broader_nepal_business_law_domain_release_to_metadata,
        )

        return broader_nepal_business_law_domain_release_to_metadata(bundle)
    if isinstance(bundle, Mapping):
        return dict(bundle)
    return None


def _authority_blocks(data: Mapping[str, Any]) -> bool:
    return (
        data.get("is_execution_authority") is True
        or data.get("mutation_tools_allowed") is True
        or data.get("domain_authority_claimed") is True
        or data.get("domain_released") is True
        or data.get("production_domain_eligible") is True
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
        or str(data.get("release_status") or "NOT_RELEASED") != "NOT_RELEASED"
        or str(data.get("gold_questions_status") or "NOT_RELEASED")
        != "NOT_RELEASED"
        or str(data.get("pilot_scope") or "BROADER_NEPAL_BUSINESS_LAW_CANDIDATE_ONLY")
        != "BROADER_NEPAL_BUSINESS_LAW_CANDIDATE_ONLY"
    )


def resolve_domain_release_consume_mode(
    bundle: Mapping[str, Any]
    | BroaderNepalBusinessLawDomainReleaseBundleV1
    | None,
    *,
    allow_domain_release: bool = False,
    allow_production_eligible: bool = False,
) -> str:
    """Return consume mode (never implies release on default path)."""
    data = _as_bnbl_meta(bundle)
    if data is None:
        return "UNCHANGED"
    if _authority_blocks(data):
        return "BLOCKED"
    status = str(data.get("analysis_status") or "")
    if status != BroaderNepalBusinessLawDomainReleaseStatus.COMPLETE.value:
        return "SKIP"
    readiness = str(data.get("domain_release_readiness") or "")
    if readiness == DomainReleaseReadiness.BLOCKED.value:
        return "BLOCKED"
    if readiness == DomainReleaseReadiness.NOT_APPLICABLE.value:
        return "SKIP"
    if readiness not in {
        DomainReleaseReadiness.POLICY_DECLARED.value,
        DomainReleaseReadiness.SCOPE_PARTIAL.value,
    }:
        return "SKIP"
    topics = data.get("in_scope_topics") or ()
    if not topics:
        return "BLOCKED"
    if allow_domain_release:
        return "INVOKE_DOMAIN_RELEASE"
    if allow_production_eligible:
        return "INVOKE_PRODUCTION_ELIGIBLE"
    return "CANDIDATE_ONLY"


def build_domain_release_candidate(
    bundle: Mapping[str, Any]
    | BroaderNepalBusinessLawDomainReleaseBundleV1
    | None,
    *,
    field_overrides: Mapping[str, Any] | None = None,
    allow_domain_release: bool = False,
    allow_production_eligible: bool = False,
) -> dict[str, Any]:
    """Build domain-release candidate (never releases or proves law)."""
    data = _as_bnbl_meta(bundle)
    mode = resolve_domain_release_consume_mode(
        data,
        allow_domain_release=allow_domain_release,
        allow_production_eligible=allow_production_eligible,
    )
    overrides = dict(field_overrides or {})
    base: dict[str, Any] = {
        "domain_release_consume_mode": mode,
        "domain_release_consume_ready": False,
        "domain_release_candidate": None,
        "mutation_tools_allowed": False,
        "domain_authority_claimed": False,
        "domain_released": False,
        "production_domain_eligible": False,
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
        "allow_domain_release": False,
        "allow_production_eligible": False,
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
        "pilot_scope": "BROADER_NEPAL_BUSINESS_LAW_CANDIDATE_ONLY",
        "domain_release_readiness": data.get("domain_release_readiness"),
        "in_scope_topics": topics,
        "unsupported_topics": unsupported,
        "release_status": "NOT_RELEASED",
        "gold_questions_status": "NOT_RELEASED",
        "domain_refs": None,
        "release_package": None,
        "definitive_answer": None,
        "specialist_signoff_status": "NOT_SIGNED",
        "research_mode_bound": bool(data.get("research_mode_bound")),
        "domain_authority_claimed": False,
        "domain_released": False,
        "production_domain_eligible": False,
        "current_law_definitive": False,
        "legal_effective_dates_proven": False,
        "field_overrides": overrides,
        "gap_p2_008_status": "OPEN",
        "ready": True,
    }
    ready = mode == "CANDIDATE_ONLY" and bool(candidate["in_scope_topics"])
    base.update(
        {
            "domain_release_consume_ready": ready,
            "domain_release_candidate": candidate,
        }
    )
    return base


def domain_release_consume_observability(
    request: CanonicalAIRequestV1,
    *,
    allow_domain_release: bool = False,
    allow_production_eligible: bool = False,
) -> dict[str, Any]:
    """Merge consume observability; live path forces allow flags false."""
    del allow_domain_release, allow_production_eligible
    built = build_domain_release_candidate(
        request.broader_nepal_business_law_domain_release_bundle,
        field_overrides={},
        allow_domain_release=False,
        allow_production_eligible=False,
    )
    return {
        "domain_release_consume_mode": built["domain_release_consume_mode"],
        "domain_release_consume_ready": bool(
            built["domain_release_consume_ready"]
        ),
        "domain_release_candidate": built.get("domain_release_candidate"),
        "mutation_tools_allowed": False,
        "domain_authority_claimed": False,
        "domain_released": False,
        "production_domain_eligible": False,
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
        "allow_domain_release": False,
        "allow_production_eligible": False,
    }


def assert_domain_release_consume_authority(
    obs: Mapping[str, Any] | None,
) -> None:
    if not obs:
        return
    if (
        obs.get("is_execution_authority") is True
        or obs.get("mutation_tools_allowed") is True
        or obs.get("domain_authority_claimed") is True
        or obs.get("domain_released") is True
        or obs.get("production_domain_eligible") is True
        or obs.get("current_law_definitive") is True
        or obs.get("legal_effective_dates_proven") is True
        or obs.get("claims_verified") is True
        or obs.get("legal_proof_claimed") is True
        or obs.get("kb_retrieval_invoked") is True
        or int(obs.get("documents_retrieved") or 0) != 0
        or int(obs.get("draft_mutations") or 0) != 0
        or int(obs.get("posting_mutations") or 0) != 0
        or obs.get("allow_domain_release") is True
        or obs.get("allow_production_eligible") is True
        or str(obs.get("gap_p2_008_status") or "OPEN") != "OPEN"
        or str(obs.get("specialist_signoff_status") or "NOT_SIGNED")
        != "NOT_SIGNED"
        or str(obs.get("release_status") or "NOT_RELEASED") != "NOT_RELEASED"
    ):
        raise RuntimeError("DOMAIN_RELEASE_CONSUME_AUTHORITY")


def enrich_bnbl_metadata_with_consume(
    bnbl_meta: dict[str, Any],
    request: CanonicalAIRequestV1,
) -> dict[str, Any]:
    out = dict(bnbl_meta)
    obs = domain_release_consume_observability(
        request,
        allow_domain_release=False,
        allow_production_eligible=False,
    )
    out.update(obs)
    out["runtime_version"] = RUNTIME_VERSION
    return out
