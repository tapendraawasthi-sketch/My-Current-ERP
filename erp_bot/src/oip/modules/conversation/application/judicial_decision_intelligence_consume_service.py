"""MAI-42 slice 2 — consume judicial/decision policy into candidates.

Default: CANDIDATE_ONLY (build judicial-decision candidate; never retrieves).
Optional allow_* flags are for unit-test labeling only — live ingress always
forces false. Never judicial authority, case retrieval, or definitive law.
"""

from __future__ import annotations

from typing import Any, Mapping

from ....contracts.judicial_decision_intelligence import (
    JudicialDecisionIntelligenceBundleV1,
    JudicialDecisionIntelligenceStatus,
    JudicialDecisionReadiness,
)
from ....contracts.request import CanonicalAIRequestV1

RUNTIME_VERSION = "mai-42.0.2-slice2"
AUTHORITY = "ADR_0059"


def _as_jdi_meta(
    bundle: Mapping[str, Any]
    | JudicialDecisionIntelligenceBundleV1
    | None,
) -> dict[str, Any] | None:
    if bundle is None:
        return None
    if isinstance(bundle, JudicialDecisionIntelligenceBundleV1):
        from .judicial_decision_intelligence_service import (
            judicial_decision_intelligence_to_metadata,
        )

        return judicial_decision_intelligence_to_metadata(bundle)
    if isinstance(bundle, Mapping):
        return dict(bundle)
    return None


def _authority_blocks(data: Mapping[str, Any]) -> bool:
    return (
        data.get("is_execution_authority") is True
        or data.get("mutation_tools_allowed") is True
        or data.get("judicial_authority_claimed") is True
        or data.get("headnote_as_binding_rule") is True
        or data.get("subsequent_treatment_definitive") is True
        or data.get("case_retrieved") is True
        or data.get("holdings_extracted") is True
        or data.get("citator_links_claimed") is True
        or data.get("paragraph_anchors_claimed") is True
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
        or str(data.get("pilot_scope") or "JUDICIAL_DECISION_CANDIDATE_ONLY")
        != "JUDICIAL_DECISION_CANDIDATE_ONLY"
    )


def resolve_judicial_decision_consume_mode(
    bundle: Mapping[str, Any]
    | JudicialDecisionIntelligenceBundleV1
    | None,
    *,
    allow_case_retrieve: bool = False,
    allow_judicial_authority: bool = False,
) -> str:
    """Return consume mode (never implies retrieve/authority on default path)."""
    data = _as_jdi_meta(bundle)
    if data is None:
        return "UNCHANGED"
    if _authority_blocks(data):
        return "BLOCKED"
    status = str(data.get("analysis_status") or "")
    if status != JudicialDecisionIntelligenceStatus.COMPLETE.value:
        return "SKIP"
    readiness = str(data.get("judicial_decision_readiness") or "")
    if readiness == JudicialDecisionReadiness.BLOCKED.value:
        return "BLOCKED"
    if readiness == JudicialDecisionReadiness.NOT_APPLICABLE.value:
        return "SKIP"
    if readiness not in {
        JudicialDecisionReadiness.POLICY_DECLARED.value,
        JudicialDecisionReadiness.SCOPE_PARTIAL.value,
    }:
        return "SKIP"
    topics = data.get("in_scope_topics") or ()
    if not topics:
        return "BLOCKED"
    if allow_case_retrieve:
        return "INVOKE_CASE_RETRIEVE"
    if allow_judicial_authority:
        return "INVOKE_JUDICIAL_AUTHORITY"
    return "CANDIDATE_ONLY"


def build_judicial_decision_candidate(
    bundle: Mapping[str, Any]
    | JudicialDecisionIntelligenceBundleV1
    | None,
    *,
    field_overrides: Mapping[str, Any] | None = None,
    allow_case_retrieve: bool = False,
    allow_judicial_authority: bool = False,
) -> dict[str, Any]:
    """Build judicial-decision candidate (never retrieves or proves law)."""
    data = _as_jdi_meta(bundle)
    mode = resolve_judicial_decision_consume_mode(
        data,
        allow_case_retrieve=allow_case_retrieve,
        allow_judicial_authority=allow_judicial_authority,
    )
    overrides = dict(field_overrides or {})
    base: dict[str, Any] = {
        "judicial_decision_consume_mode": mode,
        "judicial_decision_consume_ready": False,
        "judicial_decision_candidate": None,
        "mutation_tools_allowed": False,
        "judicial_authority_claimed": False,
        "headnote_as_binding_rule": False,
        "subsequent_treatment_definitive": False,
        "case_retrieved": False,
        "holdings_extracted": False,
        "citator_links_claimed": False,
        "paragraph_anchors_claimed": False,
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
        "allow_case_retrieve": False,
        "allow_judicial_authority": False,
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
        "pilot_scope": "JUDICIAL_DECISION_CANDIDATE_ONLY",
        "judicial_decision_readiness": data.get("judicial_decision_readiness"),
        "in_scope_topics": topics,
        "unsupported_topics": unsupported,
        "release_status": "NOT_RELEASED",
        "gold_questions_status": "NOT_RELEASED",
        "case_refs": None,
        "holdings": None,
        "citator_links": None,
        "paragraph_anchors": None,
        "definitive_answer": None,
        "specialist_signoff_status": "NOT_SIGNED",
        "research_mode_bound": bool(data.get("research_mode_bound")),
        "judicial_authority_claimed": False,
        "headnote_as_binding_rule": False,
        "subsequent_treatment_definitive": False,
        "case_retrieved": False,
        "holdings_extracted": False,
        "citator_links_claimed": False,
        "paragraph_anchors_claimed": False,
        "current_law_definitive": False,
        "legal_effective_dates_proven": False,
        "field_overrides": overrides,
        "gap_p2_008_status": "OPEN",
        "ready": True,
    }
    ready = mode == "CANDIDATE_ONLY" and bool(candidate["in_scope_topics"])
    base.update(
        {
            "judicial_decision_consume_ready": ready,
            "judicial_decision_candidate": candidate,
        }
    )
    return base


def judicial_decision_consume_observability(
    request: CanonicalAIRequestV1,
    *,
    allow_case_retrieve: bool = False,
    allow_judicial_authority: bool = False,
) -> dict[str, Any]:
    """Merge consume observability; live path forces allow flags false."""
    del allow_case_retrieve, allow_judicial_authority
    built = build_judicial_decision_candidate(
        request.judicial_decision_intelligence_bundle,
        field_overrides={},
        allow_case_retrieve=False,
        allow_judicial_authority=False,
    )
    return {
        "judicial_decision_consume_mode": built[
            "judicial_decision_consume_mode"
        ],
        "judicial_decision_consume_ready": bool(
            built["judicial_decision_consume_ready"]
        ),
        "judicial_decision_candidate": built.get(
            "judicial_decision_candidate"
        ),
        "mutation_tools_allowed": False,
        "judicial_authority_claimed": False,
        "headnote_as_binding_rule": False,
        "subsequent_treatment_definitive": False,
        "case_retrieved": False,
        "holdings_extracted": False,
        "citator_links_claimed": False,
        "paragraph_anchors_claimed": False,
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
        "allow_case_retrieve": False,
        "allow_judicial_authority": False,
    }


def assert_judicial_decision_consume_authority(
    obs: Mapping[str, Any] | None,
) -> None:
    if not obs:
        return
    if (
        obs.get("is_execution_authority") is True
        or obs.get("mutation_tools_allowed") is True
        or obs.get("judicial_authority_claimed") is True
        or obs.get("headnote_as_binding_rule") is True
        or obs.get("subsequent_treatment_definitive") is True
        or obs.get("case_retrieved") is True
        or obs.get("holdings_extracted") is True
        or obs.get("citator_links_claimed") is True
        or obs.get("paragraph_anchors_claimed") is True
        or obs.get("current_law_definitive") is True
        or obs.get("legal_effective_dates_proven") is True
        or obs.get("claims_verified") is True
        or obs.get("legal_proof_claimed") is True
        or obs.get("kb_retrieval_invoked") is True
        or int(obs.get("documents_retrieved") or 0) != 0
        or int(obs.get("draft_mutations") or 0) != 0
        or int(obs.get("posting_mutations") or 0) != 0
        or obs.get("allow_case_retrieve") is True
        or obs.get("allow_judicial_authority") is True
        or str(obs.get("gap_p2_008_status") or "OPEN") != "OPEN"
        or str(obs.get("specialist_signoff_status") or "NOT_SIGNED")
        != "NOT_SIGNED"
        or str(obs.get("release_status") or "NOT_RELEASED") != "NOT_RELEASED"
    ):
        raise RuntimeError("JUDICIAL_DECISION_CONSUME_AUTHORITY")


def enrich_jdi_metadata_with_consume(
    jdi_meta: dict[str, Any],
    request: CanonicalAIRequestV1,
) -> dict[str, Any]:
    out = dict(jdi_meta)
    obs = judicial_decision_consume_observability(
        request,
        allow_case_retrieve=False,
        allow_judicial_authority=False,
    )
    out.update(obs)
    out["runtime_version"] = RUNTIME_VERSION
    return out
