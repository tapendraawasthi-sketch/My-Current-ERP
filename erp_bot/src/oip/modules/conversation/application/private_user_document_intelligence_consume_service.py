"""MAI-51 slice 2 — consume private user-document intelligence into candidates.

Default: CANDIDATE_ONLY (build document candidate; never ingests / QA live).
Optional allow_* flags are for unit-test labeling only — live ingress always
forces false. Never document ingest, index, or QA live.
"""

from __future__ import annotations

from typing import Any, Mapping

from ....contracts.private_user_document_intelligence import (
    PrivateUserDocumentIntelligenceBundleV1,
    PrivateUserDocumentIntelligenceReadiness,
    PrivateUserDocumentIntelligenceStatus,
)
from ....contracts.request import CanonicalAIRequestV1

RUNTIME_VERSION = "mai-51.0.2-slice2"
AUTHORITY = "ADR_0068"


def _as_pudi_meta(
    bundle: Mapping[str, Any]
    | PrivateUserDocumentIntelligenceBundleV1
    | None,
) -> dict[str, Any] | None:
    if bundle is None:
        return None
    if isinstance(bundle, PrivateUserDocumentIntelligenceBundleV1):
        from .private_user_document_intelligence_service import (
            private_user_document_intelligence_to_metadata,
        )

        return private_user_document_intelligence_to_metadata(bundle)
    if isinstance(bundle, Mapping):
        return dict(bundle)
    return None


def _authority_blocks(data: Mapping[str, Any]) -> bool:
    return (
        data.get("is_execution_authority") is True
        or data.get("mutation_tools_allowed") is True
        or data.get("document_authority_claimed") is True
        or data.get("private_document_intelligence_enabled") is True
        or data.get("document_ingested") is True
        or data.get("document_indexed") is True
        or data.get("document_qa_live") is True
        or data.get("retention_policy_applied") is True
        or data.get("access_control_enforced") is True
        or data.get("cross_tenant_isolation_proven") is True
        or data.get("user_document_released") is True
        or data.get("production_approved") is True
        or data.get("current_law_definitive") is True
        or data.get("legal_effective_dates_proven") is True
        or data.get("claims_verified") is True
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
        or str(
            data.get("pilot_scope")
            or "PRIVATE_USER_DOCUMENT_INTELLIGENCE_CANDIDATE_ONLY"
        )
        != "PRIVATE_USER_DOCUMENT_INTELLIGENCE_CANDIDATE_ONLY"
    )


def resolve_private_user_document_intelligence_consume_mode(
    bundle: Mapping[str, Any]
    | PrivateUserDocumentIntelligenceBundleV1
    | None,
    *,
    allow_ingest: bool = False,
    allow_qa: bool = False,
) -> str:
    """Return consume mode (never implies ingest/QA live on default path)."""
    data = _as_pudi_meta(bundle)
    if data is None:
        return "UNCHANGED"
    if _authority_blocks(data):
        return "BLOCKED"
    status = str(data.get("analysis_status") or "")
    if status != PrivateUserDocumentIntelligenceStatus.COMPLETE.value:
        return "SKIP"
    readiness = str(
        data.get("private_user_document_intelligence_readiness") or ""
    )
    if readiness == PrivateUserDocumentIntelligenceReadiness.BLOCKED.value:
        return "BLOCKED"
    if (
        readiness
        == PrivateUserDocumentIntelligenceReadiness.NOT_APPLICABLE.value
    ):
        return "SKIP"
    if readiness not in {
        PrivateUserDocumentIntelligenceReadiness.POLICY_DECLARED.value,
        PrivateUserDocumentIntelligenceReadiness.SCOPE_PARTIAL.value,
    }:
        return "SKIP"
    topics = data.get("in_scope_topics") or ()
    if not topics:
        return "BLOCKED"
    if allow_ingest:
        return "INVOKE_INGEST"
    if allow_qa:
        return "INVOKE_QA"
    return "CANDIDATE_ONLY"


def build_private_user_document_intelligence_candidate(
    bundle: Mapping[str, Any]
    | PrivateUserDocumentIntelligenceBundleV1
    | None,
    *,
    field_overrides: Mapping[str, Any] | None = None,
    allow_ingest: bool = False,
    allow_qa: bool = False,
) -> dict[str, Any]:
    """Build private user-document intelligence candidate (never ingests)."""
    data = _as_pudi_meta(bundle)
    mode = resolve_private_user_document_intelligence_consume_mode(
        data,
        allow_ingest=allow_ingest,
        allow_qa=allow_qa,
    )
    overrides = dict(field_overrides or {})
    base: dict[str, Any] = {
        "private_user_document_intelligence_consume_mode": mode,
        "private_user_document_intelligence_consume_ready": False,
        "private_user_document_intelligence_candidate": None,
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
        "allow_ingest": False,
        "allow_qa": False,
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
        "pilot_scope": "PRIVATE_USER_DOCUMENT_INTELLIGENCE_CANDIDATE_ONLY",
        "private_user_document_intelligence_readiness": data.get(
            "private_user_document_intelligence_readiness"
        ),
        "in_scope_topics": topics,
        "unsupported_topics": unsupported,
        "release_status": "NOT_RELEASED",
        "gold_questions_status": "NOT_RELEASED",
        "upload_plan": None,
        "ingest_plan": None,
        "index_plan": None,
        "qa_plan": None,
        "summary_plan": None,
        "extraction_plan": None,
        "retention_plan": None,
        "access_control_plan": None,
        "definitive_answer": None,
        "specialist_signoff_status": "NOT_SIGNED",
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
        "field_overrides": overrides,
        "gap_p2_008_status": "OPEN",
        "ready": True,
    }
    ready = mode == "CANDIDATE_ONLY" and bool(candidate["in_scope_topics"])
    base.update(
        {
            "private_user_document_intelligence_consume_ready": ready,
            "private_user_document_intelligence_candidate": candidate,
        }
    )
    return base


def private_user_document_intelligence_consume_observability(
    request: CanonicalAIRequestV1,
    *,
    allow_ingest: bool = False,
    allow_qa: bool = False,
) -> dict[str, Any]:
    """Merge consume observability; live path forces allow flags false."""
    del allow_ingest, allow_qa
    built = build_private_user_document_intelligence_candidate(
        request.private_user_document_intelligence_bundle,
        field_overrides={},
        allow_ingest=False,
        allow_qa=False,
    )
    return {
        "private_user_document_intelligence_consume_mode": built[
            "private_user_document_intelligence_consume_mode"
        ],
        "private_user_document_intelligence_consume_ready": bool(
            built["private_user_document_intelligence_consume_ready"]
        ),
        "private_user_document_intelligence_candidate": built.get(
            "private_user_document_intelligence_candidate"
        ),
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
        "allow_ingest": False,
        "allow_qa": False,
    }


def assert_private_user_document_intelligence_consume_authority(
    obs: Mapping[str, Any] | None,
) -> None:
    if not obs:
        return
    if (
        obs.get("is_execution_authority") is True
        or obs.get("mutation_tools_allowed") is True
        or obs.get("document_authority_claimed") is True
        or obs.get("private_document_intelligence_enabled") is True
        or obs.get("document_ingested") is True
        or obs.get("document_indexed") is True
        or obs.get("document_qa_live") is True
        or obs.get("retention_policy_applied") is True
        or obs.get("access_control_enforced") is True
        or obs.get("cross_tenant_isolation_proven") is True
        or obs.get("user_document_released") is True
        or obs.get("production_approved") is True
        or obs.get("current_law_definitive") is True
        or obs.get("legal_effective_dates_proven") is True
        or obs.get("claims_verified") is True
        or obs.get("legal_proof_claimed") is True
        or obs.get("kb_retrieval_invoked") is True
        or int(obs.get("documents_retrieved") or 0) != 0
        or int(obs.get("draft_mutations") or 0) != 0
        or int(obs.get("posting_mutations") or 0) != 0
        or obs.get("allow_ingest") is True
        or obs.get("allow_qa") is True
        or str(obs.get("gap_p2_008_status") or "OPEN") != "OPEN"
        or str(obs.get("specialist_signoff_status") or "NOT_SIGNED")
        != "NOT_SIGNED"
        or str(obs.get("release_status") or "NOT_RELEASED") != "NOT_RELEASED"
    ):
        raise RuntimeError(
            "PRIVATE_USER_DOCUMENT_INTELLIGENCE_CONSUME_AUTHORITY"
        )


def enrich_pudi_metadata_with_consume(
    pudi_meta: dict[str, Any],
    request: CanonicalAIRequestV1,
) -> dict[str, Any]:
    out = dict(pudi_meta)
    obs = private_user_document_intelligence_consume_observability(
        request,
        allow_ingest=False,
        allow_qa=False,
    )
    out.update(obs)
    out["runtime_version"] = RUNTIME_VERSION
    return out
