"""MAI-30 — grounded answer / claim-citation annotation + consume.

Slice 1: detect claim-like cues; ABSTAIN_WHEN_UNGROUNDED; never verifies.
Slice 2: gate grounding / force safe no-answer when ungrounded claim-like
queries lack evidence candidates. Never marks VERIFIED or legal proof.
"""

from __future__ import annotations

import re
from typing import Any, Mapping

from ....contracts.claim_citation import (
    ClaimCitationBundleV1,
    ClaimCitationStatus,
    ClaimCitationVerificationStatus,
    ClaimCueKind,
    ClaimCueV1,
    GroundedAnswerPolicy,
)
from ....contracts.hybrid_fusion import HybridFusionMode, HybridFusionStatus
from ....contracts.knowledge_source_governance import KnowledgeSourceGovernanceStatus
from ....contracts.request import CanonicalAIRequestV1

RUNTIME_VERSION = "mai-30.0.2-slice2"
AUTHORITY = "ADR_0047"

_LEGAL_TAX = re.compile(
    r"\b(?:VAT\s+Act|Income\s+Tax\s+Act|tax\s+rate|VAT\s+rate|NFRS|IAS|IFRS|"
    r"आयकर|मूल्य\s+अभिवृद्धि\s+कर|कर\s+दर)\b",
    re.IGNORECASE,
)
_ACCOUNTING = re.compile(
    r"\b(?:ledger|journal|debit|credit|balance\s+sheet|P&L|profit\s+and\s+loss|"
    r"खाता|जर्नल|डेबिट|क्रेडिट)\b",
    re.IGNORECASE,
)
_ERP_FACT = re.compile(
    r"\b(?:invoice|voucher|stock|inventory|party\s+balance|"
    r"बिल|भाउचर|स्टक)\b",
    re.IGNORECASE,
)
_PRODUCT = re.compile(
    r"\b(?:can\s+(?:I|you|we)|does\s+(?:it|this)|how\s+do\s+I|"
    r"feature|support|MokXya|Ask\s+MokXya)\b",
    re.IGNORECASE,
)

SAFE_NO_ANSWER_BLOCK = """## GROUNDED ANSWER GATE (MAI-30)
Policy: ABSTAIN_WHEN_UNGROUNDED
Decision: ABSTAIN_UNGROUNDED
Do NOT invent legal, tax, accounting, or product authority.
Do NOT invent citations or claim that claims/citations are verified.
Respond with a safe refusal / no-answer. Ask the user for an authoritative
source or confirmable ERP fact if they need a definitive answer.
claims_verified=false
citations_verified=false
legal_proof_claimed=false
fake_citation_allowed=false
verifier_executed=false
is_execution_authority=false"""


def _add_cues(
    text: str,
    pattern: re.Pattern[str],
    kind: ClaimCueKind,
    reason: str,
    out: list[ClaimCueV1],
) -> None:
    for m in pattern.finditer(text or ""):
        out.append(
            ClaimCueV1(
                cue_id=f"c-{len(out) + 1:04d}",
                kind=kind,
                surface=m.group(0)[:160],
                reason_codes=(reason,),
            )
        )


def build_claim_citation_bundle(
    request: CanonicalAIRequestV1,
) -> ClaimCitationBundleV1:
    gov = request.knowledge_source_governance_bundle
    if gov is None:
        return ClaimCitationBundleV1(
            analysis_status=ClaimCitationStatus.SKIP,
            runtime_version=RUNTIME_VERSION,
            reason_codes=("NO_GOVERNANCE",),
            warnings=("NO_GOVERNANCE",),
        )

    if gov.analysis_status != KnowledgeSourceGovernanceStatus.COMPLETE:
        return ClaimCitationBundleV1(
            analysis_status=ClaimCitationStatus.SKIP,
            runtime_version=RUNTIME_VERSION,
            reason_codes=("GOVERNANCE_NOT_COMPLETE",),
            warnings=("GOVERNANCE_NOT_COMPLETE",),
        )

    cues: list[ClaimCueV1] = []
    text = request.raw_text or ""
    _add_cues(text, _LEGAL_TAX, ClaimCueKind.LEGAL_TAX, "LEGAL_TAX_CUE", cues)
    _add_cues(
        text, _ACCOUNTING, ClaimCueKind.ACCOUNTING_RULE, "ACCOUNTING_RULE_CUE", cues
    )
    _add_cues(text, _ERP_FACT, ClaimCueKind.ERP_FACT, "ERP_FACT_CUE", cues)
    _add_cues(
        text, _PRODUCT, ClaimCueKind.PRODUCT_CAPABILITY, "PRODUCT_CAPABILITY_CUE", cues
    )

    hyb = request.hybrid_fusion_bundle
    verification = ClaimCitationVerificationStatus.UNVERIFIED
    reasons: list[str] = [
        "GOVERNANCE_COMPLETE",
        "ABSTAIN_WHEN_UNGROUNDED",
        "CLAIMS_NOT_VERIFIED",
        "CITATIONS_NOT_VERIFIED",
        "VERIFIER_NOT_EXECUTED",
        "LEGAL_PROOF_NOT_CLAIMED",
        "FAKE_CITATION_NOT_ALLOWED",
        "CITATION_REQUIRED",
    ]
    warnings: list[str] = ["CITATION_PRESENCE_IS_NOT_VERIFICATION"]

    if hyb is None or hyb.analysis_status != HybridFusionStatus.COMPLETE:
        verification = ClaimCitationVerificationStatus.INSUFFICIENT
        reasons.append("HYBRID_FUSION_NOT_COMPLETE")
        warnings.append("INSUFFICIENT_WITHOUT_FUSION_POLICY")
    elif hyb.fusion_mode == HybridFusionMode.SKIP:
        verification = ClaimCitationVerificationStatus.INSUFFICIENT
        reasons.append("FUSION_MODE_SKIP")
    else:
        reasons.append(f"FUSION_MODE_{hyb.fusion_mode.value}")

    if any(c.kind == ClaimCueKind.LEGAL_TAX for c in cues):
        reasons.append("LEGAL_TAX_REQUIRES_GROUNDED_ABSTAIN")
        warnings.append("LEGAL_TAX_UNVERIFIED")

    return ClaimCitationBundleV1(
        analysis_status=ClaimCitationStatus.COMPLETE,
        runtime_version=RUNTIME_VERSION,
        grounded_answer_policy=GroundedAnswerPolicy.ABSTAIN_WHEN_UNGROUNDED,
        verification_status=verification,
        citation_required=True,
        claim_cues=tuple(cues),
        claims_verified=False,
        citations_verified=False,
        verifier_executed=False,
        legal_proof_claimed=False,
        fake_citation_allowed=False,
        reason_codes=tuple(reasons),
        warnings=tuple(warnings),
        documents_retrieved=0,
        draft_mutations=0,
        model_invocations=0,
    )


def attach_claim_citation_to_request(
    request: CanonicalAIRequestV1,
) -> CanonicalAIRequestV1:
    bundle = build_claim_citation_bundle(request)
    return request.model_copy(update={"claim_citation_bundle": bundle})


def assert_claim_citation_authority(
    bundle: ClaimCitationBundleV1 | None,
) -> None:
    if bundle is None:
        return
    if (
        bundle.is_execution_authority
        or bundle.claims_verified
        or bundle.citations_verified
        or bundle.verifier_executed
        or bundle.legal_proof_claimed
        or bundle.fake_citation_allowed
        or bundle.documents_retrieved != 0
        or bundle.draft_mutations != 0
        or bundle.model_invocations != 0
        or bundle.grounded_answer_policy
        != GroundedAnswerPolicy.ABSTAIN_WHEN_UNGROUNDED
    ):
        raise RuntimeError("CLAIM_CITATION_AUTHORITY")


def claim_citation_to_metadata(
    bundle: ClaimCitationBundleV1 | None,
) -> dict[str, Any]:
    if bundle is None:
        return {}
    return {
        "analysis_status": bundle.analysis_status.value,
        "runtime_version": bundle.runtime_version,
        "grounded_answer_policy": bundle.grounded_answer_policy.value,
        "verification_status": bundle.verification_status.value,
        "citation_required": True,
        "claim_cue_count": len(bundle.claim_cues),
        "claim_cue_kinds": [c.kind.value for c in bundle.claim_cues],
        "claims_verified": False,
        "citations_verified": False,
        "verifier_executed": False,
        "legal_proof_claimed": False,
        "fake_citation_allowed": False,
        "reason_codes": list(bundle.reason_codes),
        "warnings": list(bundle.warnings),
        "is_execution_authority": False,
    }


def _as_claim_meta(
    claim_citation: Mapping[str, Any] | ClaimCitationBundleV1 | None,
) -> dict[str, Any] | None:
    if claim_citation is None:
        return None
    if isinstance(claim_citation, ClaimCitationBundleV1):
        return claim_citation_to_metadata(claim_citation)
    if isinstance(claim_citation, Mapping):
        return dict(claim_citation)
    return None


def _authority_blocks(data: Mapping[str, Any]) -> bool:
    return (
        data.get("is_execution_authority") is True
        or data.get("claims_verified") is True
        or data.get("citations_verified") is True
        or data.get("verifier_executed") is True
        or data.get("legal_proof_claimed") is True
        or data.get("fake_citation_allowed") is True
        or str(data.get("grounded_answer_policy") or "")
        not in {
            "",
            GroundedAnswerPolicy.ABSTAIN_WHEN_UNGROUNDED.value,
        }
    )


def resolve_grounded_answer_gate(
    claim_citation: Mapping[str, Any] | ClaimCitationBundleV1 | None,
    *,
    citation_count: int = 0,
    evidence_candidate_count: int = 0,
) -> str:
    """Return gate mode for consume (never implies claims verified)."""
    data = _as_claim_meta(claim_citation)
    if data is None:
        return "UNCHANGED"
    if _authority_blocks(data):
        return "BLOCKED"
    status = str(data.get("analysis_status") or "")
    if status != ClaimCitationStatus.COMPLETE.value:
        return "SKIP"
    if str(data.get("verification_status") or "") == (
        ClaimCitationVerificationStatus.INSUFFICIENT.value
    ):
        return "ABSTAIN_UNGROUNDED"

    kinds = {str(k) for k in (data.get("claim_cue_kinds") or [])}
    grounded = citation_count > 0 or evidence_candidate_count > 0
    if grounded:
        return "ALLOW_WITH_CANDIDATES"

    # Ungrounded claim-like / legal questions must abstain.
    if "LEGAL_TAX" in kinds or kinds:
        return "ABSTAIN_UNGROUNDED"
    return "ALLOW_PROCEED_UNVERIFIED"


def should_emit_safe_no_answer(
    claim_citation: Mapping[str, Any] | ClaimCitationBundleV1 | None,
    *,
    citation_count: int = 0,
    evidence_candidate_count: int = 0,
) -> bool:
    return resolve_grounded_answer_gate(
        claim_citation,
        citation_count=citation_count,
        evidence_candidate_count=evidence_candidate_count,
    ) in {"ABSTAIN_UNGROUNDED", "BLOCKED"}


def grounded_answer_gate_metadata(
    claim_citation: Mapping[str, Any] | ClaimCitationBundleV1 | None,
    *,
    citation_count: int = 0,
    evidence_candidate_count: int = 0,
) -> dict[str, Any]:
    gate = resolve_grounded_answer_gate(
        claim_citation,
        citation_count=citation_count,
        evidence_candidate_count=evidence_candidate_count,
    )
    return {
        "grounded_answer_gate": gate,
        "abstain_ungrounded": gate in {"ABSTAIN_UNGROUNDED", "BLOCKED"},
        "safe_no_answer": gate in {"ABSTAIN_UNGROUNDED", "BLOCKED"},
        "claims_verified": False,
        "citations_verified": False,
        "verifier_executed": False,
        "legal_proof_claimed": False,
        "fake_citation_allowed": False,
        "is_execution_authority": False,
        "citation_count_for_gate": citation_count,
        "evidence_candidate_count_for_gate": evidence_candidate_count,
    }
