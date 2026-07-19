"""MAI-39 slice 2 — consume NFRS/NAS pilot policy into candidates.

Default: CANDIDATE_ONLY (build NFRS/NAS candidate; never maps/files).
Optional allow_* flags are for unit-test labeling only — live ingress always
forces false. Never mapping authority, disclosure filing, or definitive law.
"""

from __future__ import annotations

from typing import Any, Mapping

from ....contracts.nfrs_nas_policy_disclosure_pilot import (
    NfrsNasPilotReadiness,
    NfrsNasPolicyDisclosurePilotBundleV1,
    NfrsNasPolicyDisclosurePilotStatus,
)
from ....contracts.request import CanonicalAIRequestV1

RUNTIME_VERSION = "mai-39.0.2-slice2"
AUTHORITY = "ADR_0056"


def _as_nfrs_meta(
    bundle: Mapping[str, Any] | NfrsNasPolicyDisclosurePilotBundleV1 | None,
) -> dict[str, Any] | None:
    if bundle is None:
        return None
    if isinstance(bundle, NfrsNasPolicyDisclosurePilotBundleV1):
        from .nfrs_nas_policy_disclosure_pilot_service import (
            nfrs_nas_policy_disclosure_pilot_to_metadata,
        )

        return nfrs_nas_policy_disclosure_pilot_to_metadata(bundle)
    if isinstance(bundle, Mapping):
        return dict(bundle)
    return None


def _authority_blocks(data: Mapping[str, Any]) -> bool:
    return (
        data.get("is_execution_authority") is True
        or data.get("mutation_tools_allowed") is True
        or data.get("standards_authority_claimed") is True
        or data.get("mapping_executed") is True
        or data.get("disclosure_filed") is True
        or data.get("filing_ready") is True
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
        or str(data.get("mapping_status") or "CANDIDATE_MAPPINGS_ONLY")
        != "CANDIDATE_MAPPINGS_ONLY"
        or str(data.get("disclosure_status") or "NOT_FILED") != "NOT_FILED"
        or str(data.get("pilot_scope") or "NFRS_NAS_DISCLOSURE_ONLY")
        != "NFRS_NAS_DISCLOSURE_ONLY"
    )


def resolve_nfrs_nas_consume_mode(
    bundle: Mapping[str, Any] | NfrsNasPolicyDisclosurePilotBundleV1 | None,
    *,
    allow_mapping_execute: bool = False,
    allow_disclosure_file: bool = False,
) -> str:
    """Return consume mode (never implies map/file on default path)."""
    data = _as_nfrs_meta(bundle)
    if data is None:
        return "UNCHANGED"
    if _authority_blocks(data):
        return "BLOCKED"
    status = str(data.get("analysis_status") or "")
    if status != NfrsNasPolicyDisclosurePilotStatus.COMPLETE.value:
        return "SKIP"
    readiness = str(data.get("nfrs_nas_readiness") or "")
    if readiness == NfrsNasPilotReadiness.BLOCKED.value:
        return "BLOCKED"
    if readiness == NfrsNasPilotReadiness.NOT_APPLICABLE.value:
        return "SKIP"
    if readiness not in {
        NfrsNasPilotReadiness.POLICY_DECLARED.value,
        NfrsNasPilotReadiness.SCOPE_PARTIAL.value,
    }:
        return "SKIP"
    topics = data.get("in_scope_topics") or ()
    if not topics:
        return "BLOCKED"
    if allow_disclosure_file:
        return "INVOKE_DISCLOSURE_FILE"
    if allow_mapping_execute:
        return "INVOKE_MAPPING_EXECUTE"
    return "CANDIDATE_ONLY"


def build_nfrs_nas_candidate(
    bundle: Mapping[str, Any] | NfrsNasPolicyDisclosurePilotBundleV1 | None,
    *,
    field_overrides: Mapping[str, Any] | None = None,
    allow_mapping_execute: bool = False,
    allow_disclosure_file: bool = False,
) -> dict[str, Any]:
    """Build NFRS/NAS candidate (never maps/files authoritatively)."""
    data = _as_nfrs_meta(bundle)
    mode = resolve_nfrs_nas_consume_mode(
        data,
        allow_mapping_execute=allow_mapping_execute,
        allow_disclosure_file=allow_disclosure_file,
    )
    overrides = dict(field_overrides or {})
    base: dict[str, Any] = {
        "nfrs_nas_consume_mode": mode,
        "nfrs_nas_consume_ready": False,
        "nfrs_nas_candidate": None,
        "mutation_tools_allowed": False,
        "standards_authority_claimed": False,
        "mapping_executed": False,
        "disclosure_filed": False,
        "filing_ready": False,
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
        "mapping_status": "CANDIDATE_MAPPINGS_ONLY",
        "disclosure_status": "NOT_FILED",
        "is_execution_authority": False,
        "runtime_version": RUNTIME_VERSION,
        "allow_mapping_execute": False,
        "allow_disclosure_file": False,
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
        "pilot_scope": "NFRS_NAS_DISCLOSURE_ONLY",
        "nfrs_nas_readiness": data.get("nfrs_nas_readiness"),
        "in_scope_topics": topics,
        "unsupported_topics": unsupported,
        "mapping_status": "CANDIDATE_MAPPINGS_ONLY",
        "disclosure_status": "NOT_FILED",
        "mapping_refs": None,
        "disclosure_draft": None,
        "definitive_answer": None,
        "specialist_signoff_status": "NOT_SIGNED",
        "research_mode_bound": bool(data.get("research_mode_bound")),
        "standards_authority_claimed": False,
        "mapping_executed": False,
        "disclosure_filed": False,
        "filing_ready": False,
        "current_law_definitive": False,
        "legal_effective_dates_proven": False,
        "field_overrides": overrides,
        "gap_p2_008_status": "OPEN",
        "ready": True,
    }
    ready = mode == "CANDIDATE_ONLY" and bool(candidate["in_scope_topics"])
    base.update(
        {
            "nfrs_nas_consume_ready": ready,
            "nfrs_nas_candidate": candidate,
        }
    )
    return base


def nfrs_nas_consume_observability(
    request: CanonicalAIRequestV1,
    *,
    allow_mapping_execute: bool = False,
    allow_disclosure_file: bool = False,
) -> dict[str, Any]:
    """Merge consume observability; live path forces allow flags false."""
    del allow_mapping_execute, allow_disclosure_file
    built = build_nfrs_nas_candidate(
        request.nfrs_nas_policy_disclosure_pilot_bundle,
        field_overrides={},
        allow_mapping_execute=False,
        allow_disclosure_file=False,
    )
    return {
        "nfrs_nas_consume_mode": built["nfrs_nas_consume_mode"],
        "nfrs_nas_consume_ready": bool(built["nfrs_nas_consume_ready"]),
        "nfrs_nas_candidate": built.get("nfrs_nas_candidate"),
        "mutation_tools_allowed": False,
        "standards_authority_claimed": False,
        "mapping_executed": False,
        "disclosure_filed": False,
        "filing_ready": False,
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
        "mapping_status": "CANDIDATE_MAPPINGS_ONLY",
        "disclosure_status": "NOT_FILED",
        "is_execution_authority": False,
        "runtime_version": RUNTIME_VERSION,
        "allow_mapping_execute": False,
        "allow_disclosure_file": False,
    }


def assert_nfrs_nas_consume_authority(
    obs: Mapping[str, Any] | None,
) -> None:
    if not obs:
        return
    if (
        obs.get("is_execution_authority") is True
        or obs.get("mutation_tools_allowed") is True
        or obs.get("standards_authority_claimed") is True
        or obs.get("mapping_executed") is True
        or obs.get("disclosure_filed") is True
        or obs.get("filing_ready") is True
        or obs.get("current_law_definitive") is True
        or obs.get("legal_effective_dates_proven") is True
        or obs.get("claims_verified") is True
        or obs.get("legal_proof_claimed") is True
        or obs.get("kb_retrieval_invoked") is True
        or int(obs.get("documents_retrieved") or 0) != 0
        or int(obs.get("draft_mutations") or 0) != 0
        or int(obs.get("posting_mutations") or 0) != 0
        or obs.get("allow_mapping_execute") is True
        or obs.get("allow_disclosure_file") is True
        or str(obs.get("gap_p2_008_status") or "OPEN") != "OPEN"
        or str(obs.get("specialist_signoff_status") or "NOT_SIGNED")
        != "NOT_SIGNED"
    ):
        raise RuntimeError("NFRS_NAS_CONSUME_AUTHORITY")


def enrich_nfrs_metadata_with_consume(
    nfrs_meta: dict[str, Any],
    request: CanonicalAIRequestV1,
) -> dict[str, Any]:
    out = dict(nfrs_meta)
    obs = nfrs_nas_consume_observability(
        request,
        allow_mapping_execute=False,
        allow_disclosure_file=False,
    )
    out.update(obs)
    out["runtime_version"] = RUNTIME_VERSION
    return out
