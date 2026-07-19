"""MAI-30 — grounded answer / claim-citation verification annotation.

Slice 1: detect claim-like cues and declare ABSTAIN_WHEN_UNGROUNDED policy.
Never verifies claims/citations, never allows fake citations, never grants
legal proof or execution authority.
"""

from __future__ import annotations

import re
from typing import Any

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

RUNTIME_VERSION = "mai-30.0.1-slice1"
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
