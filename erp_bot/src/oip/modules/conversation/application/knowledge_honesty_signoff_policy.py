"""PR-B5 / ADR_0088 — knowledge honesty sign-off (GAP-P2-008 stays REDUCED)."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any, Mapping

AUTHORITY = "ADR_0088"
STEP = "PR-B5"
DECISION = "KNOWLEDGE_HONESTY_SIGNOFF_PACK"
REGISTER_GAP_STATUS = "REDUCED"
RUNTIME_GAP_STATUS = "OPEN"
ENGINEERING_GATE_STATUS = "PASS"
LAUNCH_ASK_SIGN_STATUS = "ENGINEERING_PASS"


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[6]


def registry_path() -> Path:
    return (
        _repo_root()
        / "docs"
        / "mokxya-ai"
        / "MAI_KNOWLEDGE_HONESTY_SIGNOFF_REGISTRY.json"
    )


def run_status_path() -> Path:
    return _repo_root() / "artifacts" / "prod-ready-pr-b5" / "RUN_STATUS.json"


@lru_cache(maxsize=1)
def load_knowledge_honesty_signoff_registry() -> dict[str, Any]:
    data = json.loads(registry_path().read_text(encoding="utf-8"))
    if data.get("authority") != AUTHORITY:
        raise RuntimeError("KNOWLEDGE_SIGNOFF_REGISTRY_AUTHORITY_MISMATCH")
    if data.get("decision") != DECISION:
        raise RuntimeError("KNOWLEDGE_SIGNOFF_DECISION_MISMATCH")
    return data


def load_run_status() -> dict[str, Any]:
    return json.loads(run_status_path().read_text(encoding="utf-8"))


def knowledge_honesty_signoff_observability() -> dict[str, Any]:
    reg = load_knowledge_honesty_signoff_registry()
    run = load_run_status()
    return {
        "knowledge_honesty_signoff_step": STEP,
        "knowledge_honesty_signoff_adr": AUTHORITY,
        "knowledge_honesty_signoff_decision": reg["decision"],
        "engineering_gate_status": ENGINEERING_GATE_STATUS,
        "launch_ask_sign_status": LAUNCH_ASK_SIGN_STATUS,
        "staging_professional_attested": bool(run.get("staging_professional_attested")),
        "blocking_fix_required": bool(run.get("blocking_fix_required")),
        "gap_p2_008_register_status": REGISTER_GAP_STATUS,
        "gap_p2_008_status": RUNTIME_GAP_STATUS,
        "gap_p2_008_closed": False,
        "engineering_pack_ready": bool(run.get("engineering_pack_ready")),
        "production_approved": False,
        "is_execution_authority": False,
    }


def assert_knowledge_honesty_signoff_honesty(
    claim: Mapping[str, Any] | None = None,
) -> None:
    reg = load_knowledge_honesty_signoff_registry()
    run = load_run_status()
    honesty = reg.get("honesty") or {}
    if honesty.get("production_approved") is True or run.get("production_approved") is True:
        raise RuntimeError("KNOWLEDGE_SIGNOFF_PRODUCTION_APPROVED")
    if honesty.get("gap_p2_008_closed") is True or run.get("gap_p2_008_closed") is True:
        raise RuntimeError("GAP_P2_008_FALSE_CLOSED")
    if honesty.get("claims_verified") is True:
        raise RuntimeError("CLAIMS_VERIFIED_FORBIDDEN")
    if honesty.get("legal_effective_dates_proven") is True:
        raise RuntimeError("LEGAL_DATES_PROVEN_FORBIDDEN")
    if reg["gap_p2_008"].get("closed") is True:
        raise RuntimeError("GAP_P2_008_FALSE_CLOSED")
    if honesty.get("staging_professional_attested") is True and not run.get(
        "staging_professional_attested"
    ):
        raise RuntimeError("STAGING_PROFESSIONAL_FALSE_ATTESTATION")
    if not claim:
        return
    if claim.get("production_approved") is True:
        raise RuntimeError("KNOWLEDGE_SIGNOFF_PRODUCTION_APPROVED")
    if claim.get("gap_p2_008_closed") is True:
        raise RuntimeError("GAP_P2_008_FALSE_CLOSED")
    if claim.get("claims_verified") is True:
        raise RuntimeError("CLAIMS_VERIFIED_FORBIDDEN")
    if claim.get("legal_effective_dates_proven") is True:
        raise RuntimeError("LEGAL_DATES_PROVEN_FORBIDDEN")
    if claim.get("staging_professional_attested") is True and not run.get(
        "staging_professional_attested"
    ):
        raise RuntimeError("STAGING_PROFESSIONAL_FALSE_ATTESTATION")
