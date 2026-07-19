"""MAI-37 slice 2 — consume tax pilot policy into candidates.

Default: CANDIDATE_ONLY (build tax-pilot candidate; never calculates).
Optional allow_* flags are for unit-test labeling only — live ingress always
forces false. Never rate lookup authority, tax calculator, or definitive law.
"""

from __future__ import annotations

from typing import Any, Mapping

from ....contracts.core_nepal_tax_knowledge_pilot import (
    CoreNepalTaxKnowledgePilotBundleV1,
    CoreNepalTaxKnowledgePilotStatus,
    TaxPilotReadiness,
)
from ....contracts.request import CanonicalAIRequestV1

RUNTIME_VERSION = "mai-37.0.2-slice2"
AUTHORITY = "ADR_0054"


def _as_ctk_meta(
    bundle: Mapping[str, Any] | CoreNepalTaxKnowledgePilotBundleV1 | None,
) -> dict[str, Any] | None:
    if bundle is None:
        return None
    if isinstance(bundle, CoreNepalTaxKnowledgePilotBundleV1):
        from .core_nepal_tax_knowledge_pilot_service import (
            core_nepal_tax_knowledge_pilot_to_metadata,
        )

        return core_nepal_tax_knowledge_pilot_to_metadata(bundle)
    if isinstance(bundle, Mapping):
        return dict(bundle)
    return None


def _authority_blocks(data: Mapping[str, Any]) -> bool:
    return (
        data.get("is_execution_authority") is True
        or data.get("mutation_tools_allowed") is True
        or data.get("tax_calculator_invoked") is True
        or data.get("current_law_definitive") is True
        or data.get("legal_effective_dates_proven") is True
        or data.get("amendment_applied") is True
        or data.get("claims_verified") is True
        or data.get("citations_verified") is True
        or data.get("legal_proof_claimed") is True
        or data.get("kb_retrieval_invoked") is True
        or data.get("rate_lookup_executed") is True
        or int(data.get("documents_retrieved") or 0) != 0
        or int(data.get("draft_mutations") or 0) != 0
        or int(data.get("posting_mutations") or 0) != 0
        or str(data.get("gap_p2_008_status") or "OPEN") != "OPEN"
        or str(data.get("specialist_signoff_status") or "NOT_SIGNED")
        != "NOT_SIGNED"
        or str(data.get("gold_questions_status") or "NOT_RELEASED")
        != "NOT_RELEASED"
        or str(data.get("pilot_scope") or "INCOME_TAX_VAT_TDS_ONLY")
        != "INCOME_TAX_VAT_TDS_ONLY"
    )


def resolve_tax_pilot_consume_mode(
    bundle: Mapping[str, Any] | CoreNepalTaxKnowledgePilotBundleV1 | None,
    *,
    allow_rate_lookup: bool = False,
    allow_tax_calculator: bool = False,
) -> str:
    """Return consume mode (never implies calculator on default path)."""
    data = _as_ctk_meta(bundle)
    if data is None:
        return "UNCHANGED"
    if _authority_blocks(data):
        return "BLOCKED"
    status = str(data.get("analysis_status") or "")
    if status != CoreNepalTaxKnowledgePilotStatus.COMPLETE.value:
        return "SKIP"
    readiness = str(data.get("tax_pilot_readiness") or "")
    if readiness == TaxPilotReadiness.BLOCKED.value:
        return "BLOCKED"
    if readiness == TaxPilotReadiness.NOT_APPLICABLE.value:
        return "SKIP"
    if readiness not in {
        TaxPilotReadiness.POLICY_DECLARED.value,
        TaxPilotReadiness.SCOPE_PARTIAL.value,
    }:
        return "SKIP"
    topics = data.get("in_scope_topics") or ()
    if not topics:
        return "BLOCKED"
    if allow_tax_calculator:
        return "INVOKE_TAX_CALCULATOR"
    if allow_rate_lookup:
        return "INVOKE_RATE_LOOKUP"
    return "CANDIDATE_ONLY"


def build_tax_pilot_candidate(
    bundle: Mapping[str, Any] | CoreNepalTaxKnowledgePilotBundleV1 | None,
    *,
    field_overrides: Mapping[str, Any] | None = None,
    allow_rate_lookup: bool = False,
    allow_tax_calculator: bool = False,
) -> dict[str, Any]:
    """Build tax-pilot candidate (never calculates or proves law)."""
    data = _as_ctk_meta(bundle)
    mode = resolve_tax_pilot_consume_mode(
        data,
        allow_rate_lookup=allow_rate_lookup,
        allow_tax_calculator=allow_tax_calculator,
    )
    overrides = dict(field_overrides or {})
    base: dict[str, Any] = {
        "tax_pilot_consume_mode": mode,
        "tax_pilot_consume_ready": False,
        "tax_pilot_candidate": None,
        "mutation_tools_allowed": False,
        "tax_calculator_invoked": False,
        "rate_lookup_executed": False,
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
        "gold_questions_status": "NOT_RELEASED",
        "is_execution_authority": False,
        "runtime_version": RUNTIME_VERSION,
        "allow_rate_lookup": False,
        "allow_tax_calculator": False,
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
        "pilot_scope": "INCOME_TAX_VAT_TDS_ONLY",
        "tax_pilot_readiness": data.get("tax_pilot_readiness"),
        "in_scope_topics": topics,
        "unsupported_topics": unsupported,
        "approved_source_policy": "REVIEWED_PRIMARY_REQUIRED",
        "rate_table_status": "CANDIDATE_REFS_ONLY",
        "rate_table_refs": None,
        "gold_questions_status": "NOT_RELEASED",
        "specialist_signoff_status": "NOT_SIGNED",
        "research_mode_bound": bool(data.get("research_mode_bound")),
        "tax_calculator_invoked": False,
        "rate_lookup_executed": False,
        "current_law_definitive": False,
        "legal_effective_dates_proven": False,
        "computed_amount": None,
        "definitive_answer": None,
        "field_overrides": overrides,
        "gap_p2_008_status": "OPEN",
        "ready": True,
    }
    ready = mode == "CANDIDATE_ONLY" and bool(candidate["in_scope_topics"])
    base.update(
        {
            "tax_pilot_consume_ready": ready,
            "tax_pilot_candidate": candidate,
        }
    )
    return base


def tax_pilot_consume_observability(
    request: CanonicalAIRequestV1,
    *,
    allow_rate_lookup: bool = False,
    allow_tax_calculator: bool = False,
) -> dict[str, Any]:
    """Merge consume observability; live path forces allow flags false."""
    del allow_rate_lookup, allow_tax_calculator
    built = build_tax_pilot_candidate(
        request.core_nepal_tax_knowledge_pilot_bundle,
        field_overrides={},
        allow_rate_lookup=False,
        allow_tax_calculator=False,
    )
    return {
        "tax_pilot_consume_mode": built["tax_pilot_consume_mode"],
        "tax_pilot_consume_ready": bool(built["tax_pilot_consume_ready"]),
        "tax_pilot_candidate": built.get("tax_pilot_candidate"),
        "mutation_tools_allowed": False,
        "tax_calculator_invoked": False,
        "rate_lookup_executed": False,
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
        "gold_questions_status": "NOT_RELEASED",
        "is_execution_authority": False,
        "runtime_version": RUNTIME_VERSION,
        "allow_rate_lookup": False,
        "allow_tax_calculator": False,
    }


def assert_tax_pilot_consume_authority(
    obs: Mapping[str, Any] | None,
) -> None:
    if not obs:
        return
    if (
        obs.get("is_execution_authority") is True
        or obs.get("mutation_tools_allowed") is True
        or obs.get("tax_calculator_invoked") is True
        or obs.get("rate_lookup_executed") is True
        or obs.get("current_law_definitive") is True
        or obs.get("legal_effective_dates_proven") is True
        or obs.get("claims_verified") is True
        or obs.get("legal_proof_claimed") is True
        or obs.get("kb_retrieval_invoked") is True
        or int(obs.get("documents_retrieved") or 0) != 0
        or int(obs.get("draft_mutations") or 0) != 0
        or int(obs.get("posting_mutations") or 0) != 0
        or obs.get("allow_rate_lookup") is True
        or obs.get("allow_tax_calculator") is True
        or str(obs.get("gap_p2_008_status") or "OPEN") != "OPEN"
        or str(obs.get("specialist_signoff_status") or "NOT_SIGNED")
        != "NOT_SIGNED"
    ):
        raise RuntimeError("TAX_PILOT_CONSUME_AUTHORITY")


def enrich_ctk_metadata_with_consume(
    ctk_meta: dict[str, Any],
    request: CanonicalAIRequestV1,
) -> dict[str, Any]:
    out = dict(ctk_meta)
    obs = tax_pilot_consume_observability(
        request,
        allow_rate_lookup=False,
        allow_tax_calculator=False,
    )
    out.update(obs)
    out["runtime_version"] = RUNTIME_VERSION
    return out
