"""MAI-36 — legal question framer / research-mode policy (never mutates).

Slice 1: frame LEGAL_TAX claim cues into research mode with jurisdiction/time
slots and clarify-missing policy. Never verifies current law, never mutates
accounting, never runs research planner retrieval as authority.
"""

from __future__ import annotations

import re
from typing import Any

from ....contracts.claim_citation import (
    ClaimCitationStatus,
    ClaimCueKind,
)
from ....contracts.legal_question_research import (
    EscalationPolicy,
    LegalQuestionResearchBundleV1,
    LegalQuestionResearchStatus,
    LegalRiskClass,
    ResearchModeReadiness,
    SlotStatus,
)
from ....contracts.request import CanonicalAIRequestV1

RUNTIME_VERSION = "mai-36.0.1-slice1"
AUTHORITY = "ADR_0053"

_JURISDICTION = re.compile(
    r"\b(?:Nepal|Nepali|NP|नेपाल|Inland\s+Revenue|IRD)\b",
    re.IGNORECASE,
)
_AS_OF = re.compile(
    r"\b(?:as\s+of|effective|current|आजको|लागु)\b|"
    r"\b(?:20\d{2}-\d{2}-\d{2}|20\d{2})\b",
    re.IGNORECASE,
)


def build_legal_question_research_bundle(
    request: CanonicalAIRequestV1,
) -> LegalQuestionResearchBundleV1:
    claim = request.claim_citation_bundle
    if claim is None:
        return LegalQuestionResearchBundleV1(
            analysis_status=LegalQuestionResearchStatus.SKIP,
            runtime_version=RUNTIME_VERSION,
            research_mode_readiness=ResearchModeReadiness.NOT_APPLICABLE,
            reason_codes=("NO_CLAIM_CITATION",),
            warnings=("NO_CLAIM_CITATION",),
        )

    if claim.analysis_status != ClaimCitationStatus.COMPLETE:
        return LegalQuestionResearchBundleV1(
            analysis_status=LegalQuestionResearchStatus.SKIP,
            runtime_version=RUNTIME_VERSION,
            research_mode_readiness=ResearchModeReadiness.NOT_APPLICABLE,
            reason_codes=(
                "CLAIM_CITATION_NOT_COMPLETE",
                "RESEARCH_NOT_APPLICABLE",
            ),
            warnings=("RESEARCH_NOT_APPLICABLE",),
        )

    kinds = tuple(sorted({c.kind.value for c in (claim.claim_cues or ())}))
    has_legal = ClaimCueKind.LEGAL_TAX.value in kinds
    if not has_legal:
        return LegalQuestionResearchBundleV1(
            analysis_status=LegalQuestionResearchStatus.SKIP,
            runtime_version=RUNTIME_VERSION,
            research_mode_readiness=ResearchModeReadiness.NOT_APPLICABLE,
            claim_kinds=kinds,
            reason_codes=("NO_LEGAL_TAX_CUE", "RESEARCH_NOT_APPLICABLE"),
            warnings=("RESEARCH_NOT_APPLICABLE",),
        )

    text = request.raw_text or ""
    jur_match = _JURISDICTION.search(text)
    as_of_match = _AS_OF.search(text)

    # Prefer temporal as_of candidate when present (still unproven).
    as_of_candidate: str | None = None
    temporal = request.temporal_cross_ref_bundle
    if temporal is not None:
        for cue in getattr(temporal, "temporal_cues", ()) or ():
            cand = getattr(cue, "as_of_candidate", None) or getattr(
                cue, "surface", None
            )
            if cand:
                as_of_candidate = str(cand)[:64]
                break

    if jur_match:
        jurisdiction_status = SlotStatus.PRESENT
        jurisdiction_candidate = jur_match.group(0)[:64]
    else:
        jurisdiction_status = SlotStatus.MISSING
        jurisdiction_candidate = None

    if as_of_match or as_of_candidate:
        as_of_status = SlotStatus.PRESENT
        if as_of_candidate is None and as_of_match:
            as_of_candidate = as_of_match.group(0)[:64]
    else:
        as_of_status = SlotStatus.MISSING
        as_of_candidate = None

    missing = (
        jurisdiction_status == SlotStatus.MISSING
        or as_of_status == SlotStatus.MISSING
    )
    readiness = (
        ResearchModeReadiness.CLARIFY_REQUIRED
        if missing
        else ResearchModeReadiness.POLICY_DECLARED
    )

    reasons = [
        "LEGAL_TAX_CUE_PRESENT",
        "RESEARCH_MODE_POLICY_DECLARED",
        "ACCOUNTING_ACTION_SEPARATED",
        "MUTATION_TOOLS_DENIED",
        "CURRENT_LAW_NOT_DEFINITIVE",
        "LEGAL_EFFECTIVE_DATES_NOT_PROVEN",
        "AMENDMENT_NOT_APPLIED",
        "CLAIMS_NOT_VERIFIED",
        "CITATIONS_NOT_VERIFIED",
        "LEGAL_PROOF_NOT_CLAIMED",
        "APPROVED_EVIDENCE_REQUIRED",
        "GAP_P2_008_OPEN",
        "NO_RESEARCH_PLANNER_EXECUTE",
        "NO_KB_RETRIEVAL_AUTHORITY",
        "NOT_COURT_OR_REGULATOR_OR_COUNSEL",
    ]
    if jurisdiction_status == SlotStatus.MISSING:
        reasons.append("JURISDICTION_MISSING_CLARIFY")
    else:
        reasons.append("JURISDICTION_CANDIDATE_PRESENT_UNVERIFIED")
    if as_of_status == SlotStatus.MISSING:
        reasons.append("AS_OF_MISSING_CLARIFY")
    else:
        reasons.append("AS_OF_CANDIDATE_PRESENT_UNPROVEN")
    if readiness == ResearchModeReadiness.CLARIFY_REQUIRED:
        reasons.append("CLARIFY_REQUIRED_BEFORE_DEFINITIVE_ANSWER")

    return LegalQuestionResearchBundleV1(
        analysis_status=LegalQuestionResearchStatus.COMPLETE,
        runtime_version=RUNTIME_VERSION,
        research_mode_readiness=readiness,
        research_mode_active=True,
        claim_kinds=kinds,
        jurisdiction_status=jurisdiction_status,
        jurisdiction_candidate=jurisdiction_candidate,
        as_of_status=as_of_status,
        as_of_candidate=as_of_candidate,
        risk_class=LegalRiskClass.HIGH,
        escalation_policy=EscalationPolicy.PROFESSIONAL_REVIEW_RECOMMENDED,
        reason_codes=tuple(reasons),
        warnings=(
            "GAP_P2_008_REMAINS_OPEN",
            "LEGAL_EFFECTIVE_DATES_NOT_PROVEN",
            "RESEARCH_PLANNER_PENDING_LATER_SLICE",
            "DO_NOT_CLAIM_CURRENT_LAW",
        ),
    )


def attach_legal_question_research_to_request(
    request: CanonicalAIRequestV1,
) -> CanonicalAIRequestV1:
    bundle = build_legal_question_research_bundle(request)
    return request.model_copy(
        update={"legal_question_research_bundle": bundle}
    )


def assert_legal_question_research_authority(
    bundle: LegalQuestionResearchBundleV1 | None,
) -> None:
    if bundle is None:
        return
    if (
        bundle.is_execution_authority
        or bundle.mutation_tools_allowed
        or bundle.current_law_definitive
        or bundle.legal_effective_dates_proven
        or bundle.amendment_applied
        or bundle.claims_verified
        or bundle.citations_verified
        or bundle.legal_proof_claimed
        or bundle.research_planner_executed
        or bundle.kb_retrieval_invoked
        or bundle.draft_mutations != 0
        or bundle.research_mode_mutations != 0
        or bundle.posting_mutations != 0
        or bundle.gap_p2_008_status != "OPEN"
        or not bundle.accounting_action_separated
    ):
        raise RuntimeError("LEGAL_QUESTION_RESEARCH_AUTHORITY")


def legal_question_research_to_metadata(
    bundle: LegalQuestionResearchBundleV1 | None,
) -> dict[str, Any]:
    if bundle is None:
        return {}
    return {
        "analysis_status": bundle.analysis_status.value,
        "runtime_version": bundle.runtime_version,
        "research_mode_readiness": bundle.research_mode_readiness.value,
        "research_mode_active": bundle.research_mode_active,
        "claim_kinds": list(bundle.claim_kinds),
        "jurisdiction_status": bundle.jurisdiction_status.value,
        "jurisdiction_candidate": bundle.jurisdiction_candidate,
        "as_of_status": bundle.as_of_status.value,
        "as_of_candidate": bundle.as_of_candidate,
        "risk_class": bundle.risk_class.value,
        "source_authority_policy": "APPROVED_EVIDENCE_REQUIRED",
        "clarification_policy": "CLARIFY_MISSING_JURISDICTION_OR_TIME",
        "escalation_policy": bundle.escalation_policy.value,
        "mutation_tools_allowed": False,
        "accounting_action_separated": True,
        "current_law_definitive": False,
        "legal_effective_dates_proven": False,
        "amendment_applied": False,
        "claims_verified": False,
        "citations_verified": False,
        "legal_proof_claimed": False,
        "gap_p2_008_status": "OPEN",
        "research_planner_executed": False,
        "kb_retrieval_invoked": False,
        "draft_mutations": 0,
        "research_mode_mutations": 0,
        "posting_mutations": 0,
        "reason_codes": list(bundle.reason_codes),
        "warnings": list(bundle.warnings),
        "is_execution_authority": False,
    }
