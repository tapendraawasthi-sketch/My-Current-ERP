"""MAI-37 — core Nepal tax knowledge pilot policy (never calculates).

Slice 1: declare IT/VAT/TDS pilot scope from MAI-36 research frame.
Never looks up rates authoritatively, never tax-calcs, never proves law.
"""

from __future__ import annotations

import re
from typing import Any

from ....contracts.core_nepal_tax_knowledge_pilot import (
    CoreNepalTaxKnowledgePilotBundleV1,
    CoreNepalTaxKnowledgePilotStatus,
    TaxPilotReadiness,
    TaxPilotTopic,
)
from ....contracts.legal_question_research import (
    LegalQuestionResearchStatus,
    ResearchModeReadiness,
)
from ....contracts.request import CanonicalAIRequestV1

RUNTIME_VERSION = "mai-37.0.1-slice1"
AUTHORITY = "ADR_0054"

_VAT = re.compile(
    r"\b(?:VAT|value[- ]added\s+tax|मूल्य\s+अभिवृद्धि\s+कर)\b",
    re.IGNORECASE,
)
_INCOME_TAX = re.compile(
    r"\b(?:Income\s+Tax|आयकर|corporate\s+tax|personal\s+tax)\b",
    re.IGNORECASE,
)
_TDS = re.compile(
    r"\b(?:TDS|withholding|tax\s+deduct(?:ed|ion)\s+at\s+source|"
    r"स्रोत\s+मा\s+कट्टी)\b",
    re.IGNORECASE,
)
_UNSUPPORTED = re.compile(
    r"\b(?:customs|excise|NFRS|IFRS|company\s+law|labor\s+act|"
    r"भन्सार|अन्तःशुल्क)\b",
    re.IGNORECASE,
)


def _detect_topics(text: str) -> tuple[list[str], list[str]]:
    in_scope: list[str] = []
    unsupported: list[str] = []
    if _VAT.search(text or ""):
        in_scope.append(TaxPilotTopic.VAT.value)
    if _INCOME_TAX.search(text or ""):
        in_scope.append(TaxPilotTopic.INCOME_TAX.value)
    if _TDS.search(text or ""):
        in_scope.append(TaxPilotTopic.TDS.value)
    if _UNSUPPORTED.search(text or ""):
        unsupported.append(TaxPilotTopic.UNSUPPORTED.value)
    return in_scope, unsupported


def build_core_nepal_tax_knowledge_pilot_bundle(
    request: CanonicalAIRequestV1,
) -> CoreNepalTaxKnowledgePilotBundleV1:
    lqr = request.legal_question_research_bundle
    if lqr is None:
        return CoreNepalTaxKnowledgePilotBundleV1(
            analysis_status=CoreNepalTaxKnowledgePilotStatus.SKIP,
            runtime_version=RUNTIME_VERSION,
            tax_pilot_readiness=TaxPilotReadiness.NOT_APPLICABLE,
            reason_codes=("NO_LEGAL_QUESTION_RESEARCH",),
            warnings=("NO_LEGAL_QUESTION_RESEARCH",),
        )

    if lqr.analysis_status != LegalQuestionResearchStatus.COMPLETE:
        return CoreNepalTaxKnowledgePilotBundleV1(
            analysis_status=CoreNepalTaxKnowledgePilotStatus.SKIP,
            runtime_version=RUNTIME_VERSION,
            tax_pilot_readiness=TaxPilotReadiness.NOT_APPLICABLE,
            reason_codes=(
                "LEGAL_RESEARCH_NOT_COMPLETE",
                "TAX_PILOT_NOT_APPLICABLE",
            ),
            warnings=("TAX_PILOT_NOT_APPLICABLE",),
        )

    if not lqr.research_mode_active:
        return CoreNepalTaxKnowledgePilotBundleV1(
            analysis_status=CoreNepalTaxKnowledgePilotStatus.SKIP,
            runtime_version=RUNTIME_VERSION,
            tax_pilot_readiness=TaxPilotReadiness.NOT_APPLICABLE,
            reason_codes=("RESEARCH_MODE_NOT_ACTIVE",),
            warnings=("TAX_PILOT_NOT_APPLICABLE",),
        )

    readiness = lqr.research_mode_readiness
    if readiness not in {
        ResearchModeReadiness.POLICY_DECLARED,
        ResearchModeReadiness.CLARIFY_REQUIRED,
    }:
        return CoreNepalTaxKnowledgePilotBundleV1(
            analysis_status=CoreNepalTaxKnowledgePilotStatus.SKIP,
            runtime_version=RUNTIME_VERSION,
            tax_pilot_readiness=TaxPilotReadiness.NOT_APPLICABLE,
            reason_codes=("RESEARCH_READINESS_NOT_ELIGIBLE",),
            warnings=("TAX_PILOT_NOT_APPLICABLE",),
        )

    in_scope, unsupported = _detect_topics(request.raw_text or "")
    # LEGAL_TAX research without explicit IT/VAT/TDS surface still in pilot umbrella.
    if not in_scope and "LEGAL_TAX" in (lqr.claim_kinds or ()):
        in_scope = [TaxPilotTopic.VAT.value]  # default cue bucket; still candidate-only
        reasons_extra = ("LEGAL_TAX_MAPPED_TO_PILOT_UMBRELLA",)
    else:
        reasons_extra = ()

    if not in_scope and unsupported:
        return CoreNepalTaxKnowledgePilotBundleV1(
            analysis_status=CoreNepalTaxKnowledgePilotStatus.COMPLETE,
            runtime_version=RUNTIME_VERSION,
            tax_pilot_readiness=TaxPilotReadiness.BLOCKED,
            in_scope_topics=(),
            unsupported_topics=tuple(unsupported),
            research_mode_bound=True,
            reason_codes=(
                "UNSUPPORTED_TOPIC_OUTSIDE_PILOT",
                "TAX_PILOT_BLOCKED",
                "NO_TAX_CALCULATOR",
                "GAP_P2_008_OPEN",
            ),
            warnings=(
                "UNSUPPORTED_TOPIC_DOCUMENTED",
                "GAP_P2_008_REMAINS_OPEN",
            ),
        )

    if not in_scope:
        return CoreNepalTaxKnowledgePilotBundleV1(
            analysis_status=CoreNepalTaxKnowledgePilotStatus.SKIP,
            runtime_version=RUNTIME_VERSION,
            tax_pilot_readiness=TaxPilotReadiness.NOT_APPLICABLE,
            reason_codes=("NO_IN_SCOPE_TAX_TOPIC",),
            warnings=("TAX_PILOT_NOT_APPLICABLE",),
        )

    pilot_ready = (
        TaxPilotReadiness.SCOPE_PARTIAL
        if unsupported
        else TaxPilotReadiness.POLICY_DECLARED
    )

    reasons = [
        "RESEARCH_MODE_BOUND",
        "PILOT_SCOPE_INCOME_TAX_VAT_TDS_ONLY",
        "APPROVED_SOURCE_POLICY_DECLARED",
        "RATE_TABLE_CANDIDATE_REFS_ONLY",
        "GOLD_QUESTIONS_NOT_RELEASED",
        "SPECIALIST_SIGNOFF_NOT_SIGNED",
        "NO_TAX_CALCULATOR",
        "NO_RATE_LOOKUP_EXECUTE",
        "NO_KB_RETRIEVAL_AUTHORITY",
        "CURRENT_LAW_NOT_DEFINITIVE",
        "LEGAL_EFFECTIVE_DATES_NOT_PROVEN",
        "CLAIMS_NOT_VERIFIED",
        "GAP_P2_008_OPEN",
        "NOT_ALL_NEPAL_LAW",
        *reasons_extra,
        *tuple(f"TOPIC_{t}" for t in in_scope),
    ]
    if unsupported:
        reasons.append("UNSUPPORTED_TOPIC_COEXISTING")
    if readiness == ResearchModeReadiness.CLARIFY_REQUIRED:
        reasons.append("UPSTREAM_CLARIFY_REQUIRED_STILL_UNPROVEN")

    return CoreNepalTaxKnowledgePilotBundleV1(
        analysis_status=CoreNepalTaxKnowledgePilotStatus.COMPLETE,
        runtime_version=RUNTIME_VERSION,
        tax_pilot_readiness=pilot_ready,
        in_scope_topics=tuple(in_scope),
        unsupported_topics=tuple(unsupported),
        research_mode_bound=True,
        reason_codes=tuple(reasons),
        warnings=(
            "GAP_P2_008_REMAINS_OPEN",
            "LEGAL_EFFECTIVE_DATES_NOT_PROVEN",
            "RATES_ARE_CANDIDATE_REFS_NOT_AUTHORITY",
            "SPECIALIST_SIGNOFF_PENDING",
            "TAX_CALCULATOR_IS_MAI_38",
        ),
    )


def attach_core_nepal_tax_knowledge_pilot_to_request(
    request: CanonicalAIRequestV1,
) -> CanonicalAIRequestV1:
    bundle = build_core_nepal_tax_knowledge_pilot_bundle(request)
    return request.model_copy(
        update={"core_nepal_tax_knowledge_pilot_bundle": bundle}
    )


def assert_core_nepal_tax_knowledge_pilot_authority(
    bundle: CoreNepalTaxKnowledgePilotBundleV1 | None,
) -> None:
    if bundle is None:
        return
    if (
        bundle.is_execution_authority
        or bundle.mutation_tools_allowed
        or bundle.tax_calculator_invoked
        or bundle.current_law_definitive
        or bundle.legal_effective_dates_proven
        or bundle.amendment_applied
        or bundle.claims_verified
        or bundle.citations_verified
        or bundle.legal_proof_claimed
        or bundle.kb_retrieval_invoked
        or bundle.rate_lookup_executed
        or bundle.documents_retrieved != 0
        or bundle.draft_mutations != 0
        or bundle.posting_mutations != 0
        or bundle.gap_p2_008_status != "OPEN"
        or bundle.specialist_signoff_status != "NOT_SIGNED"
        or bundle.gold_questions_status != "NOT_RELEASED"
        or bundle.pilot_scope != "INCOME_TAX_VAT_TDS_ONLY"
    ):
        raise RuntimeError("CORE_NEPAL_TAX_KNOWLEDGE_PILOT_AUTHORITY")


def core_nepal_tax_knowledge_pilot_to_metadata(
    bundle: CoreNepalTaxKnowledgePilotBundleV1 | None,
) -> dict[str, Any]:
    if bundle is None:
        return {}
    return {
        "analysis_status": bundle.analysis_status.value,
        "runtime_version": bundle.runtime_version,
        "tax_pilot_readiness": bundle.tax_pilot_readiness.value,
        "pilot_scope": "INCOME_TAX_VAT_TDS_ONLY",
        "in_scope_topics": list(bundle.in_scope_topics),
        "unsupported_topics": list(bundle.unsupported_topics),
        "approved_source_policy": "REVIEWED_PRIMARY_REQUIRED",
        "rate_table_status": "CANDIDATE_REFS_ONLY",
        "gold_questions_status": "NOT_RELEASED",
        "specialist_signoff_status": "NOT_SIGNED",
        "research_mode_bound": bundle.research_mode_bound,
        "mutation_tools_allowed": False,
        "tax_calculator_invoked": False,
        "current_law_definitive": False,
        "legal_effective_dates_proven": False,
        "claims_verified": False,
        "legal_proof_claimed": False,
        "gap_p2_008_status": "OPEN",
        "kb_retrieval_invoked": False,
        "rate_lookup_executed": False,
        "documents_retrieved": 0,
        "draft_mutations": 0,
        "posting_mutations": 0,
        "reason_codes": list(bundle.reason_codes),
        "warnings": list(bundle.warnings),
        "is_execution_authority": False,
    }
