"""MAI-36 slice 2 — consume legal research policy into candidates.

Default: CANDIDATE_ONLY (build research-frame candidate; never proves law).
Optional allow_* flags are for unit-test labeling only — live ingress always
forces false. Never research planner execute, KB authority, or mutations.
"""

from __future__ import annotations

from typing import Any, Mapping

from ....contracts.legal_question_research import (
    LegalQuestionResearchBundleV1,
    LegalQuestionResearchStatus,
    ResearchModeReadiness,
)
from ....contracts.request import CanonicalAIRequestV1

RUNTIME_VERSION = "mai-36.0.2-slice2"
AUTHORITY = "ADR_0053"


def _as_lqr_meta(
    bundle: Mapping[str, Any] | LegalQuestionResearchBundleV1 | None,
) -> dict[str, Any] | None:
    if bundle is None:
        return None
    if isinstance(bundle, LegalQuestionResearchBundleV1):
        from .legal_question_research_service import (
            legal_question_research_to_metadata,
        )

        return legal_question_research_to_metadata(bundle)
    if isinstance(bundle, Mapping):
        return dict(bundle)
    return None


def _authority_blocks(data: Mapping[str, Any]) -> bool:
    return (
        data.get("is_execution_authority") is True
        or data.get("mutation_tools_allowed") is True
        or data.get("current_law_definitive") is True
        or data.get("legal_effective_dates_proven") is True
        or data.get("amendment_applied") is True
        or data.get("claims_verified") is True
        or data.get("citations_verified") is True
        or data.get("legal_proof_claimed") is True
        or data.get("research_planner_executed") is True
        or data.get("kb_retrieval_invoked") is True
        or int(data.get("draft_mutations") or 0) != 0
        or int(data.get("research_mode_mutations") or 0) != 0
        or int(data.get("posting_mutations") or 0) != 0
        or str(data.get("gap_p2_008_status") or "OPEN") != "OPEN"
        or data.get("accounting_action_separated") is False
    )


def resolve_legal_research_consume_mode(
    bundle: Mapping[str, Any] | LegalQuestionResearchBundleV1 | None,
    *,
    allow_research_planner: bool = False,
    allow_kb_retrieval: bool = False,
) -> str:
    """Return consume mode (never implies law proof on default path)."""
    data = _as_lqr_meta(bundle)
    if data is None:
        return "UNCHANGED"
    if _authority_blocks(data):
        return "BLOCKED"
    status = str(data.get("analysis_status") or "")
    if status != LegalQuestionResearchStatus.COMPLETE.value:
        return "SKIP"
    readiness = str(data.get("research_mode_readiness") or "")
    if readiness == ResearchModeReadiness.BLOCKED.value:
        return "BLOCKED"
    if readiness == ResearchModeReadiness.NOT_APPLICABLE.value:
        return "SKIP"
    if readiness not in {
        ResearchModeReadiness.POLICY_DECLARED.value,
        ResearchModeReadiness.CLARIFY_REQUIRED.value,
    }:
        return "SKIP"
    if not data.get("research_mode_active"):
        return "BLOCKED"
    if allow_kb_retrieval:
        return "INVOKE_KB_RETRIEVAL"
    if allow_research_planner:
        return "INVOKE_RESEARCH_PLANNER"
    return "CANDIDATE_ONLY"


def build_legal_research_candidate(
    bundle: Mapping[str, Any] | LegalQuestionResearchBundleV1 | None,
    *,
    field_overrides: Mapping[str, Any] | None = None,
    allow_research_planner: bool = False,
    allow_kb_retrieval: bool = False,
) -> dict[str, Any]:
    """Build research-frame candidate (never proves law or mutates)."""
    data = _as_lqr_meta(bundle)
    mode = resolve_legal_research_consume_mode(
        data,
        allow_research_planner=allow_research_planner,
        allow_kb_retrieval=allow_kb_retrieval,
    )
    overrides = dict(field_overrides or {})
    base: dict[str, Any] = {
        "legal_research_consume_mode": mode,
        "legal_research_consume_ready": False,
        "legal_research_candidate": None,
        "mutation_tools_allowed": False,
        "current_law_definitive": False,
        "legal_effective_dates_proven": False,
        "amendment_applied": False,
        "claims_verified": False,
        "citations_verified": False,
        "legal_proof_claimed": False,
        "research_planner_executed": False,
        "kb_retrieval_invoked": False,
        "draft_mutations": 0,
        "research_mode_mutations": 0,
        "posting_mutations": 0,
        "gap_p2_008_status": "OPEN",
        "is_execution_authority": False,
        "runtime_version": RUNTIME_VERSION,
        "allow_research_planner": False,
        "allow_kb_retrieval": False,
    }
    if data is None or mode in {"UNCHANGED", "SKIP", "BLOCKED"}:
        return base

    claim_kinds = data.get("claim_kinds") or ()
    if isinstance(claim_kinds, tuple):
        claim_kinds = list(claim_kinds)

    candidate = {
        "research_mode_active": True,
        "research_mode_readiness": data.get("research_mode_readiness"),
        "claim_kinds": claim_kinds,
        "jurisdiction_status": data.get("jurisdiction_status"),
        "jurisdiction_candidate": data.get("jurisdiction_candidate"),
        "as_of_status": data.get("as_of_status"),
        "as_of_candidate": data.get("as_of_candidate"),
        "risk_class": data.get("risk_class") or "HIGH",
        "source_authority_policy": "APPROVED_EVIDENCE_REQUIRED",
        "clarification_policy": "CLARIFY_MISSING_JURISDICTION_OR_TIME",
        "escalation_policy": data.get("escalation_policy")
        or "PROFESSIONAL_REVIEW_RECOMMENDED",
        "accounting_action_separated": True,
        "mutation_tools_allowed": False,
        "current_law_definitive": False,
        "legal_effective_dates_proven": False,
        "research_plan": None,
        "evidence_pack": None,
        "definitive_answer": None,
        "field_overrides": overrides,
        "gap_p2_008_status": "OPEN",
        "ready": True,
    }
    ready = mode == "CANDIDATE_ONLY" and bool(candidate["research_mode_active"])
    base.update(
        {
            "legal_research_consume_ready": ready,
            "legal_research_candidate": candidate,
        }
    )
    return base


def legal_research_consume_observability(
    request: CanonicalAIRequestV1,
    *,
    allow_research_planner: bool = False,
    allow_kb_retrieval: bool = False,
) -> dict[str, Any]:
    """Merge consume observability; live path forces allow flags false."""
    del allow_research_planner, allow_kb_retrieval
    built = build_legal_research_candidate(
        request.legal_question_research_bundle,
        field_overrides={},
        allow_research_planner=False,
        allow_kb_retrieval=False,
    )
    return {
        "legal_research_consume_mode": built["legal_research_consume_mode"],
        "legal_research_consume_ready": bool(
            built["legal_research_consume_ready"]
        ),
        "legal_research_candidate": built.get("legal_research_candidate"),
        "mutation_tools_allowed": False,
        "current_law_definitive": False,
        "legal_effective_dates_proven": False,
        "amendment_applied": False,
        "claims_verified": False,
        "citations_verified": False,
        "legal_proof_claimed": False,
        "research_planner_executed": False,
        "kb_retrieval_invoked": False,
        "draft_mutations": 0,
        "research_mode_mutations": 0,
        "posting_mutations": 0,
        "gap_p2_008_status": "OPEN",
        "is_execution_authority": False,
        "runtime_version": RUNTIME_VERSION,
        "allow_research_planner": False,
        "allow_kb_retrieval": False,
    }


def assert_legal_research_consume_authority(
    obs: Mapping[str, Any] | None,
) -> None:
    if not obs:
        return
    if (
        obs.get("is_execution_authority") is True
        or obs.get("mutation_tools_allowed") is True
        or obs.get("current_law_definitive") is True
        or obs.get("legal_effective_dates_proven") is True
        or obs.get("amendment_applied") is True
        or obs.get("claims_verified") is True
        or obs.get("citations_verified") is True
        or obs.get("legal_proof_claimed") is True
        or obs.get("research_planner_executed") is True
        or obs.get("kb_retrieval_invoked") is True
        or int(obs.get("draft_mutations") or 0) != 0
        or int(obs.get("research_mode_mutations") or 0) != 0
        or int(obs.get("posting_mutations") or 0) != 0
        or obs.get("allow_research_planner") is True
        or obs.get("allow_kb_retrieval") is True
        or str(obs.get("gap_p2_008_status") or "OPEN") != "OPEN"
    ):
        raise RuntimeError("LEGAL_RESEARCH_CONSUME_AUTHORITY")


def enrich_lqr_metadata_with_consume(
    lqr_meta: dict[str, Any],
    request: CanonicalAIRequestV1,
) -> dict[str, Any]:
    out = dict(lqr_meta)
    obs = legal_research_consume_observability(
        request,
        allow_research_planner=False,
        allow_kb_retrieval=False,
    )
    out.update(obs)
    out["runtime_version"] = RUNTIME_VERSION
    return out
