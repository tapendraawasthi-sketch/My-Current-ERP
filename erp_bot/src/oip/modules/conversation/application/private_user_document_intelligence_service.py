"""MAI-51 — private user-document intelligence policy (never ingests docs).

Slice 1: declare candidate private-document policy from cue detection.
Never claims document ingested, indexed, QA live, or cross-tenant isolation proven.
"""

from __future__ import annotations

import re
from typing import Any

from ....contracts.private_user_document_intelligence import (
    PrivateUserDocumentIntelligenceBundleV1,
    PrivateUserDocumentIntelligenceReadiness,
    PrivateUserDocumentIntelligenceStatus,
    PrivateUserDocumentIntelligenceTopic,
)
from ....contracts.request import CanonicalAIRequestV1

RUNTIME_VERSION = "mai-51.0.1-slice1"
AUTHORITY = "ADR_0068"

_PRIVATE_DOC = re.compile(
    r"\b(?:private\s+(?:user[- ]?)?document|user[- ]?document\s+intelligence|"
    r"private\s+document\s+intelligence)\b",
    re.I,
)
_UPLOAD = re.compile(
    r"\b(?:user\s+upload|document\s+upload|upload\s+(?:my\s+)?document)\b",
    re.I,
)
_QA = re.compile(
    r"\b(?:document\s+q(?:uestions?|&\s*a|a)|"
    r"ask\s+(?:about|from)\s+(?:my\s+)?document|"
    r"document\s+question)\b",
    re.I,
)
_SUMMARY = re.compile(
    r"\b(?:document\s+summary|summarize\s+(?:my\s+)?document)\b",
    re.I,
)
_EXTRACT = re.compile(
    r"\b(?:document\s+extraction|extract\s+from\s+(?:my\s+)?document)\b",
    re.I,
)
_RETENTION = re.compile(
    r"\b(?:retention\s+policy|document\s+retention)\b",
    re.I,
)
_ACCESS = re.compile(
    r"\b(?:document\s+access\s+control|access\s+control\s+for\s+documents?)\b",
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
    if _PRIVATE_DOC.search(raw):
        in_scope.append(
            PrivateUserDocumentIntelligenceTopic.PRIVATE_DOCUMENT.value
        )
    if _UPLOAD.search(raw):
        in_scope.append(PrivateUserDocumentIntelligenceTopic.USER_UPLOAD.value)
    if _QA.search(raw):
        in_scope.append(PrivateUserDocumentIntelligenceTopic.DOCUMENT_QA.value)
    if _SUMMARY.search(raw):
        in_scope.append(
            PrivateUserDocumentIntelligenceTopic.DOCUMENT_SUMMARY.value
        )
    if _EXTRACT.search(raw):
        in_scope.append(
            PrivateUserDocumentIntelligenceTopic.DOCUMENT_EXTRACTION.value
        )
    if _RETENTION.search(raw):
        in_scope.append(
            PrivateUserDocumentIntelligenceTopic.RETENTION_POLICY.value
        )
    if _ACCESS.search(raw):
        in_scope.append(
            PrivateUserDocumentIntelligenceTopic.ACCESS_CONTROL.value
        )
    if _UNSUPPORTED.search(raw) and not in_scope:
        unsupported.append(
            PrivateUserDocumentIntelligenceTopic.UNSUPPORTED.value
        )
    return in_scope, unsupported


def build_private_user_document_intelligence_bundle(
    request: CanonicalAIRequestV1,
) -> PrivateUserDocumentIntelligenceBundleV1:
    in_scope, unsupported = _detect_topics(request.raw_text or "")
    if not in_scope and unsupported:
        return PrivateUserDocumentIntelligenceBundleV1(
            analysis_status=PrivateUserDocumentIntelligenceStatus.COMPLETE,
            runtime_version=RUNTIME_VERSION,
            private_user_document_intelligence_readiness=(
                PrivateUserDocumentIntelligenceReadiness.BLOCKED
            ),
            unsupported_topics=tuple(unsupported),
            reason_codes=(
                "UNSUPPORTED_TOPIC_OUTSIDE_PILOT",
                "PRIVATE_USER_DOCUMENT_INTELLIGENCE_BLOCKED",
                "NO_DOCUMENT_AUTHORITY",
                "GAP_P2_008_OPEN",
            ),
            warnings=(
                "UNSUPPORTED_TOPIC_DOCUMENTED",
                "GAP_P2_008_REMAINS_OPEN",
            ),
        )

    if not in_scope:
        return PrivateUserDocumentIntelligenceBundleV1(
            analysis_status=PrivateUserDocumentIntelligenceStatus.SKIP,
            runtime_version=RUNTIME_VERSION,
            private_user_document_intelligence_readiness=(
                PrivateUserDocumentIntelligenceReadiness.NOT_APPLICABLE
            ),
            reason_codes=(
                "NO_IN_SCOPE_PRIVATE_USER_DOCUMENT_INTELLIGENCE_TOPIC",
            ),
            warnings=("PRIVATE_USER_DOCUMENT_INTELLIGENCE_NOT_APPLICABLE",),
        )

    pilot_ready = (
        PrivateUserDocumentIntelligenceReadiness.SCOPE_PARTIAL
        if unsupported
        else PrivateUserDocumentIntelligenceReadiness.POLICY_DECLARED
    )
    reasons = [
        "PILOT_SCOPE_PRIVATE_USER_DOCUMENT_INTELLIGENCE_CANDIDATE_ONLY",
        "RELEASE_SUITE_NOT_RELEASED",
        "GOLD_QUESTIONS_NOT_RELEASED",
        "SPECIALIST_SIGNOFF_NOT_SIGNED",
        "NO_DOCUMENT_AUTHORITY",
        "PRIVATE_DOCUMENT_INTELLIGENCE_NOT_ENABLED",
        "DOCUMENT_NOT_INGESTED",
        "DOCUMENT_NOT_INDEXED",
        "DOCUMENT_QA_NOT_LIVE",
        "RETENTION_POLICY_NOT_APPLIED",
        "ACCESS_CONTROL_NOT_ENFORCED",
        "CROSS_TENANT_ISOLATION_NOT_PROVEN",
        "USER_DOCUMENT_NOT_RELEASED",
        "PRODUCTION_NOT_APPROVED",
        "GAP_P2_008_OPEN",
        *tuple(f"TOPIC_{t}" for t in in_scope),
    ]
    return PrivateUserDocumentIntelligenceBundleV1(
        analysis_status=PrivateUserDocumentIntelligenceStatus.COMPLETE,
        runtime_version=RUNTIME_VERSION,
        private_user_document_intelligence_readiness=pilot_ready,
        in_scope_topics=tuple(in_scope),
        unsupported_topics=tuple(unsupported),
        reason_codes=tuple(reasons),
        warnings=(
            "GAP_P2_008_REMAINS_OPEN",
            "PRIVATE_USER_DOCUMENT_INTELLIGENCE_CANDIDATE_ONLY",
            "MUST_NOT_CLAIM_DOCUMENT_INGESTED",
            "SPECIALIST_SIGNOFF_PENDING",
            "NOT_PRODUCTION_APPROVED",
        ),
    )


def attach_private_user_document_intelligence_to_request(
    request: CanonicalAIRequestV1,
) -> CanonicalAIRequestV1:
    bundle = build_private_user_document_intelligence_bundle(request)
    return request.model_copy(
        update={"private_user_document_intelligence_bundle": bundle}
    )


def assert_private_user_document_intelligence_authority(
    bundle: PrivateUserDocumentIntelligenceBundleV1 | None,
) -> None:
    if bundle is None:
        return
    if (
        bundle.is_execution_authority
        or bundle.mutation_tools_allowed
        or bundle.document_authority_claimed
        or bundle.private_document_intelligence_enabled
        or bundle.document_ingested
        or bundle.document_indexed
        or bundle.document_qa_live
        or bundle.retention_policy_applied
        or bundle.access_control_enforced
        or bundle.cross_tenant_isolation_proven
        or bundle.user_document_released
        or bundle.production_approved
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
        != "PRIVATE_USER_DOCUMENT_INTELLIGENCE_CANDIDATE_ONLY"
    ):
        raise RuntimeError("PRIVATE_USER_DOCUMENT_INTELLIGENCE_AUTHORITY")


def private_user_document_intelligence_to_metadata(
    bundle: PrivateUserDocumentIntelligenceBundleV1 | None,
) -> dict[str, Any]:
    if bundle is None:
        return {}
    return {
        "analysis_status": bundle.analysis_status.value,
        "runtime_version": bundle.runtime_version,
        "private_user_document_intelligence_readiness": (
            bundle.private_user_document_intelligence_readiness.value
        ),
        "pilot_scope": "PRIVATE_USER_DOCUMENT_INTELLIGENCE_CANDIDATE_ONLY",
        "in_scope_topics": list(bundle.in_scope_topics),
        "unsupported_topics": list(bundle.unsupported_topics),
        "release_status": "NOT_RELEASED",
        "gold_questions_status": "NOT_RELEASED",
        "specialist_signoff_status": "NOT_SIGNED",
        "mutation_tools_allowed": False,
        "document_authority_claimed": False,
        "private_document_intelligence_enabled": False,
        "document_ingested": False,
        "document_indexed": False,
        "document_qa_live": False,
        "retention_policy_applied": False,
        "access_control_enforced": False,
        "cross_tenant_isolation_proven": False,
        "user_document_released": False,
        "production_approved": False,
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
