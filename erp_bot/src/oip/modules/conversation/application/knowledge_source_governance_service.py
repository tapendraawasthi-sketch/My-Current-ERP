"""MAI-24 — knowledge source / document governance annotation + consume.

Slice 1: select allowed/blocked retrieval collections from router domain.
Slice 2: filter NP KB / grounding retrieval by that policy (fail-closed).
Never mutates indexes, drafts, or grants posting. Bundle counters stay zero.
"""

from __future__ import annotations

from typing import Any, Mapping, Sequence

from ....contracts.knowledge_source_governance import (
    KnowledgeSourceGovernanceBundleV1,
    KnowledgeSourceGovernanceStatus,
)
from ....contracts.request import CanonicalAIRequestV1
from ....contracts.router_decision import RouterAnalysisStatus, RouterDomain

RUNTIME_VERSION = "mai-24.0.2-slice2"
AUTHORITY = "ADR_0041"

_EVALUATION_ONLY = "evaluation_only"

# Deterministic engineering seed map (aligned with KB domain_routing_map).
_COLLECTIONS_BY_DOMAIN: dict[str, tuple[str, ...]] = {
    RouterDomain.ACCOUNTING.value: (
        "accounting_and_erp",
        "language_and_normalization",
        "safety_and_governance",
    ),
    RouterDomain.ERP_OPS.value: (
        "accounting_and_erp",
        "safety_and_governance",
        "support_and_help",
    ),
    RouterDomain.REPORTING.value: (
        "accounting_and_erp",
        "analytics_and_decision_support",
        "language_and_normalization",
    ),
    RouterDomain.MASTER_DATA.value: (
        "accounting_and_erp",
        "language_and_normalization",
    ),
    RouterDomain.DIALOGUE.value: (
        "language_and_normalization",
        "intent_and_dialogue",
        "safety_and_governance",
    ),
    RouterDomain.UNKNOWN.value: (
        "language_and_normalization",
        "intent_and_dialogue",
        "safety_and_governance",
    ),
}

_ALWAYS_BLOCKED: tuple[str, ...] = (_EVALUATION_ONLY,)


def build_knowledge_source_governance_bundle(
    request: CanonicalAIRequestV1,
) -> KnowledgeSourceGovernanceBundleV1:
    router = request.router_decision_bundle
    if router is None:
        return KnowledgeSourceGovernanceBundleV1(
            analysis_status=KnowledgeSourceGovernanceStatus.SKIP,
            runtime_version=RUNTIME_VERSION,
            reason_codes=("NO_ROUTER",),
            warnings=("NO_ROUTER",),
            blocked_retrieval_collections=_ALWAYS_BLOCKED,
        )

    domain_key = router.domain.value
    intent_family = router.intent_family.value

    if router.analysis_status != RouterAnalysisStatus.COMPLETE:
        return KnowledgeSourceGovernanceBundleV1(
            analysis_status=KnowledgeSourceGovernanceStatus.SKIP,
            runtime_version=RUNTIME_VERSION,
            domain_key=domain_key,
            intent_family=intent_family,
            reason_codes=("ROUTER_NOT_COMPLETE",),
            warnings=("ROUTER_NOT_COMPLETE",),
            blocked_retrieval_collections=_ALWAYS_BLOCKED,
        )

    if router.ood.is_ood or router.ood.abstain_recommended:
        return KnowledgeSourceGovernanceBundleV1(
            analysis_status=KnowledgeSourceGovernanceStatus.SKIP,
            runtime_version=RUNTIME_VERSION,
            domain_key=domain_key,
            intent_family=intent_family,
            reason_codes=("OOD_ABSTAIN",),
            warnings=("OOD_ABSTAIN",),
            blocked_retrieval_collections=_ALWAYS_BLOCKED,
        )

    allowed = _COLLECTIONS_BY_DOMAIN.get(
        domain_key, _COLLECTIONS_BY_DOMAIN[RouterDomain.UNKNOWN.value]
    )
    # Never allow evaluation corpus even if seed map is wrong.
    allowed = tuple(c for c in allowed if c != _EVALUATION_ONLY)

    return KnowledgeSourceGovernanceBundleV1(
        analysis_status=KnowledgeSourceGovernanceStatus.COMPLETE,
        runtime_version=RUNTIME_VERSION,
        domain_key=domain_key,
        intent_family=intent_family,
        allowed_retrieval_collections=allowed,
        blocked_retrieval_collections=_ALWAYS_BLOCKED,
        eligibility_policy="production_eligible",
        allow_evaluation_corpus=False,
        citation_required=True,
        max_authority_level="GOVERNMENT",
        reason_codes=("ROUTER_COMPLETE", "DETERMINISTIC_DOMAIN_COLLECTION_MAP"),
        documents_retrieved=0,
        index_mutations=0,
        draft_mutations=0,
        model_invocations=0,
    )


def attach_knowledge_source_governance_to_request(
    request: CanonicalAIRequestV1,
) -> CanonicalAIRequestV1:
    bundle = build_knowledge_source_governance_bundle(request)
    return request.model_copy(update={"knowledge_source_governance_bundle": bundle})


def assert_knowledge_source_governance_authority(
    bundle: KnowledgeSourceGovernanceBundleV1 | None,
) -> None:
    if bundle is None:
        return
    if (
        bundle.is_execution_authority
        or bundle.documents_retrieved != 0
        or bundle.index_mutations != 0
        or bundle.draft_mutations != 0
        or bundle.model_invocations != 0
        or bundle.allow_evaluation_corpus
    ):
        raise RuntimeError("KNOWLEDGE_SOURCE_GOVERNANCE_AUTHORITY")
    if _EVALUATION_ONLY in bundle.allowed_retrieval_collections:
        raise RuntimeError("KNOWLEDGE_SOURCE_GOVERNANCE_EVAL_LEAK")


def knowledge_source_governance_to_metadata(
    bundle: KnowledgeSourceGovernanceBundleV1 | None,
) -> dict[str, Any]:
    if bundle is None:
        return {}
    return {
        "analysis_status": bundle.analysis_status.value,
        "runtime_version": bundle.runtime_version,
        "domain_key": bundle.domain_key,
        "intent_family": bundle.intent_family,
        "allowed_retrieval_collections": list(bundle.allowed_retrieval_collections),
        "blocked_retrieval_collections": list(bundle.blocked_retrieval_collections),
        "eligibility_policy": bundle.eligibility_policy,
        "allow_evaluation_corpus": bundle.allow_evaluation_corpus,
        "citation_required": bundle.citation_required,
        "max_authority_level": bundle.max_authority_level,
        "reason_codes": list(bundle.reason_codes),
        "documents_retrieved": bundle.documents_retrieved,
        "index_mutations": bundle.index_mutations,
        "draft_mutations": bundle.draft_mutations,
        "model_invocations": bundle.model_invocations,
        "is_execution_authority": False,
    }


def should_skip_retrieval_for_governance(
    governance: Mapping[str, Any] | KnowledgeSourceGovernanceBundleV1 | None,
) -> bool:
    """Fail-closed: SKIP / authority-violating policy blocks NP KB retrieval."""
    if governance is None:
        return False
    if isinstance(governance, KnowledgeSourceGovernanceBundleV1):
        data = knowledge_source_governance_to_metadata(governance)
    else:
        data = dict(governance)
    if data.get("is_execution_authority") is True:
        return True
    if data.get("allow_evaluation_corpus") is True:
        return True
    status = str(data.get("analysis_status") or "")
    return status in {
        KnowledgeSourceGovernanceStatus.SKIP.value,
        KnowledgeSourceGovernanceStatus.FAILED.value,
    }


def resolve_allowed_collections(
    governance: Mapping[str, Any] | KnowledgeSourceGovernanceBundleV1 | None,
) -> frozenset[str] | None:
    """Return allowed collections for COMPLETE policy; None = no collection filter."""
    if governance is None:
        return None
    if isinstance(governance, KnowledgeSourceGovernanceBundleV1):
        data = knowledge_source_governance_to_metadata(governance)
    else:
        data = dict(governance)
    if str(data.get("analysis_status") or "") != (
        KnowledgeSourceGovernanceStatus.COMPLETE.value
    ):
        return None
    allowed = [
        str(c)
        for c in (data.get("allowed_retrieval_collections") or [])
        if c and str(c) != _EVALUATION_ONLY
    ]
    return frozenset(allowed)


def resolve_blocked_collections(
    governance: Mapping[str, Any] | KnowledgeSourceGovernanceBundleV1 | None,
) -> frozenset[str]:
    blocked: set[str] = {_EVALUATION_ONLY}
    if governance is None:
        return frozenset(blocked)
    if isinstance(governance, KnowledgeSourceGovernanceBundleV1):
        data = knowledge_source_governance_to_metadata(governance)
    else:
        data = dict(governance)
    for c in data.get("blocked_retrieval_collections") or []:
        if c:
            blocked.add(str(c))
    return frozenset(blocked)


def filter_citations_by_governance(
    citations: Sequence[Any],
    governance: Mapping[str, Any] | KnowledgeSourceGovernanceBundleV1 | None,
) -> list[Any]:
    """Drop evaluation / blocked / out-of-policy collection citations."""
    if should_skip_retrieval_for_governance(governance):
        return []
    allowed = resolve_allowed_collections(governance)
    blocked = resolve_blocked_collections(governance)
    out: list[Any] = []
    for c in citations:
        if isinstance(c, Mapping):
            coll = str(c.get("retrieval_collection") or "")
        else:
            coll = str(getattr(c, "retrieval_collection", None) or "")
        if coll in blocked or coll == _EVALUATION_ONLY:
            continue
        if allowed is not None and coll not in allowed:
            continue
        out.append(c)
    return out


__all__ = [
    "AUTHORITY",
    "RUNTIME_VERSION",
    "assert_knowledge_source_governance_authority",
    "attach_knowledge_source_governance_to_request",
    "build_knowledge_source_governance_bundle",
    "filter_citations_by_governance",
    "knowledge_source_governance_to_metadata",
    "resolve_allowed_collections",
    "resolve_blocked_collections",
    "should_skip_retrieval_for_governance",
]
