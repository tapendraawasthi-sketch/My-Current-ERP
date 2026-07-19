"""MAI-44 — security/tenant red-team policy (never claims pen-test pass).

Slice 1: declare candidate security/tenant red-team policy from cue detection.
Never proves isolation, never claims zero critical findings, never broadens
capability via injection paths.
"""

from __future__ import annotations

import re
from typing import Any

from ....contracts.request import CanonicalAIRequestV1
from ....contracts.security_tenant_red_team import (
    SecurityRedTeamReadiness,
    SecurityRedTeamTopic,
    SecurityTenantRedTeamBundleV1,
    SecurityTenantRedTeamStatus,
)

RUNTIME_VERSION = "mai-44.0.2-slice2"
AUTHORITY = "ADR_0061"

_TENANT = re.compile(
    r"\b(?:cross[- ]tenant|tenant\s+isolation|tenant[- ]a\b|company_id\s+leak)\b",
    re.I,
)
_AUTHZ = re.compile(
    r"\b(?:authorization\s+bypass|unauthorized\s+capability|authz\s+bypass)\b",
    re.I,
)
_CONFIRM = re.compile(
    r"\b(?:confirmation\s+attack|nl\s+assent\s+post|assent\s+without\s+token)\b",
    re.I,
)
_PROMPT = re.compile(
    r"\b(?:prompt\s+injection|jailbreak\s+prompt|ignore\s+previous\s+instructions)\b",
    re.I,
)
_TOOL = re.compile(
    r"\b(?:tool\s+injection|tool\s+capability\s+broaden(?:ing)?)\b",
    re.I,
)
_DOC = re.compile(
    r"\b(?:document\s+safety|malicious\s+document|ocr\s+injection)\b",
    re.I,
)
_SECRET = re.compile(
    r"\b(?:secret\s+leak(?:age)?|api\s+key\s+exfil|credential\s+leak)\b",
    re.I,
)
_UNSUPPORTED = re.compile(
    r"\b(?:customs|excise|भन्सार|अन्तःशुल्क)\b",
    re.I,
)


def _detect_topics(text: str) -> tuple[list[str], list[str]]:
    in_scope: list[str] = []
    unsupported: list[str] = []
    if _TENANT.search(text or ""):
        in_scope.append(SecurityRedTeamTopic.TENANT_ISOLATION.value)
    if _AUTHZ.search(text or ""):
        in_scope.append(SecurityRedTeamTopic.AUTHORIZATION.value)
    if _CONFIRM.search(text or ""):
        in_scope.append(SecurityRedTeamTopic.CONFIRMATION_ATTACK.value)
    if _PROMPT.search(text or ""):
        in_scope.append(SecurityRedTeamTopic.PROMPT_INJECTION.value)
    if _TOOL.search(text or ""):
        in_scope.append(SecurityRedTeamTopic.TOOL_INJECTION.value)
    if _DOC.search(text or ""):
        in_scope.append(SecurityRedTeamTopic.DOCUMENT_SAFETY.value)
    if _SECRET.search(text or ""):
        in_scope.append(SecurityRedTeamTopic.SECRET_LEAKAGE.value)
    if _UNSUPPORTED.search(text or "") and not in_scope:
        unsupported.append(SecurityRedTeamTopic.UNSUPPORTED.value)
    return in_scope, unsupported


def build_security_tenant_red_team_bundle(
    request: CanonicalAIRequestV1,
) -> SecurityTenantRedTeamBundleV1:
    in_scope, unsupported = _detect_topics(request.raw_text or "")
    if not in_scope and unsupported:
        return SecurityTenantRedTeamBundleV1(
            analysis_status=SecurityTenantRedTeamStatus.COMPLETE,
            runtime_version=RUNTIME_VERSION,
            security_red_team_readiness=SecurityRedTeamReadiness.BLOCKED,
            unsupported_topics=tuple(unsupported),
            reason_codes=(
                "UNSUPPORTED_TOPIC_OUTSIDE_PILOT",
                "SECURITY_RED_TEAM_BLOCKED",
                "NO_SECURITY_AUTHORITY",
                "GAP_P0_001_OPEN",
                "GAP_P2_008_OPEN",
            ),
            warnings=(
                "UNSUPPORTED_TOPIC_DOCUMENTED",
                "GAP_P0_001_REMAINS_OPEN",
                "GAP_P2_008_REMAINS_OPEN",
            ),
        )

    if not in_scope:
        return SecurityTenantRedTeamBundleV1(
            analysis_status=SecurityTenantRedTeamStatus.SKIP,
            runtime_version=RUNTIME_VERSION,
            security_red_team_readiness=SecurityRedTeamReadiness.NOT_APPLICABLE,
            reason_codes=("NO_IN_SCOPE_SECURITY_RED_TEAM_TOPIC",),
            warnings=("SECURITY_RED_TEAM_NOT_APPLICABLE",),
        )

    pilot_ready = (
        SecurityRedTeamReadiness.SCOPE_PARTIAL
        if unsupported
        else SecurityRedTeamReadiness.POLICY_DECLARED
    )
    reasons = [
        "PILOT_SCOPE_SECURITY_TENANT_RED_TEAM_CANDIDATE_ONLY",
        "ADVERSARIAL_SUITE_NOT_RELEASED",
        "GOLD_QUESTIONS_NOT_RELEASED",
        "SPECIALIST_SIGNOFF_NOT_SIGNED",
        "NO_SECURITY_AUTHORITY",
        "ISOLATION_NOT_PROVEN",
        "ZERO_CRITICAL_FINDINGS_NOT_CLAIMED",
        "CONFIRMATION_ATTACKS_NOT_PROVEN_BLOCKED",
        "INJECTION_CAPABILITY_BROADENING_NOT_PROVEN_BLOCKED",
        "PEN_REVIEW_NOT_PASSED",
        "REMEDIATION_NOT_CLOSED",
        "PRODUCTION_SECURITY_NOT_APPROVED",
        "SECRETS_SCAN_NOT_CLEAN_CLAIMED",
        "GAP_P0_001_OPEN",
        "GAP_P2_008_OPEN",
        *tuple(f"TOPIC_{t}" for t in in_scope),
    ]
    return SecurityTenantRedTeamBundleV1(
        analysis_status=SecurityTenantRedTeamStatus.COMPLETE,
        runtime_version=RUNTIME_VERSION,
        security_red_team_readiness=pilot_ready,
        in_scope_topics=tuple(in_scope),
        unsupported_topics=tuple(unsupported),
        reason_codes=tuple(reasons),
        warnings=(
            "GAP_P0_001_REMAINS_OPEN",
            "GAP_P2_008_REMAINS_OPEN",
            "SECURITY_TENANT_RED_TEAM_CANDIDATE_ONLY",
            "UNREVIEWED_FINDINGS_MUST_NOT_CLAIM_ZERO_CRITICAL",
            "SPECIALIST_SIGNOFF_PENDING",
            "NOT_PRODUCTION_SECURITY_APPROVED",
        ),
    )


def attach_security_tenant_red_team_to_request(
    request: CanonicalAIRequestV1,
) -> CanonicalAIRequestV1:
    bundle = build_security_tenant_red_team_bundle(request)
    return request.model_copy(
        update={"security_tenant_red_team_bundle": bundle}
    )


def assert_security_tenant_red_team_authority(
    bundle: SecurityTenantRedTeamBundleV1 | None,
) -> None:
    if bundle is None:
        return
    if (
        bundle.is_execution_authority
        or bundle.mutation_tools_allowed
        or bundle.security_authority_claimed
        or bundle.isolation_proven
        or bundle.zero_critical_findings_claimed
        or bundle.confirmation_attacks_blocked_proven
        or bundle.injection_capability_broadening_blocked_proven
        or bundle.pen_review_passed
        or bundle.remediation_closed
        or bundle.production_security_approved
        or bundle.secrets_scanned_clean
        or bundle.current_law_definitive
        or bundle.legal_effective_dates_proven
        or bundle.claims_verified
        or bundle.legal_proof_claimed
        or bundle.kb_retrieval_invoked
        or bundle.documents_retrieved != 0
        or bundle.draft_mutations != 0
        or bundle.posting_mutations != 0
        or bundle.gap_p0_001_status != "OPEN"
        or bundle.gap_p2_008_status != "OPEN"
        or bundle.specialist_signoff_status != "NOT_SIGNED"
        or bundle.release_status != "NOT_RELEASED"
        or bundle.gold_questions_status != "NOT_RELEASED"
        or bundle.pilot_scope != "SECURITY_TENANT_RED_TEAM_CANDIDATE_ONLY"
    ):
        raise RuntimeError("SECURITY_TENANT_RED_TEAM_AUTHORITY")


def security_tenant_red_team_to_metadata(
    bundle: SecurityTenantRedTeamBundleV1 | None,
) -> dict[str, Any]:
    if bundle is None:
        return {}
    return {
        "analysis_status": bundle.analysis_status.value,
        "runtime_version": bundle.runtime_version,
        "security_red_team_readiness": (
            bundle.security_red_team_readiness.value
        ),
        "pilot_scope": "SECURITY_TENANT_RED_TEAM_CANDIDATE_ONLY",
        "in_scope_topics": list(bundle.in_scope_topics),
        "unsupported_topics": list(bundle.unsupported_topics),
        "release_status": "NOT_RELEASED",
        "gold_questions_status": "NOT_RELEASED",
        "specialist_signoff_status": "NOT_SIGNED",
        "mutation_tools_allowed": False,
        "security_authority_claimed": False,
        "isolation_proven": False,
        "zero_critical_findings_claimed": False,
        "confirmation_attacks_blocked_proven": False,
        "injection_capability_broadening_blocked_proven": False,
        "pen_review_passed": False,
        "remediation_closed": False,
        "production_security_approved": False,
        "secrets_scanned_clean": False,
        "current_law_definitive": False,
        "legal_effective_dates_proven": False,
        "claims_verified": False,
        "legal_proof_claimed": False,
        "gap_p0_001_status": "OPEN",
        "gap_p2_008_status": "OPEN",
        "kb_retrieval_invoked": False,
        "documents_retrieved": 0,
        "draft_mutations": 0,
        "posting_mutations": 0,
        "reason_codes": list(bundle.reason_codes),
        "warnings": list(bundle.warnings),
        "is_execution_authority": False,
    }
