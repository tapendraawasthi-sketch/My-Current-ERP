"""PR-B1 / ADR_0084 — staging golden path evidence honesty."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any, Mapping

AUTHORITY = "ADR_0084"
STEP = "PR-B1"
DECISION = "STAGING_GOLDEN_PATH_EVIDENCE_PACK"


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[6]


def registry_path() -> Path:
    return (
        _repo_root() / "docs" / "mokxya-ai" / "MAI_STAGING_GOLDEN_PATH_REGISTRY.json"
    )


def run_status_path() -> Path:
    return _repo_root() / "artifacts" / "prod-ready-pr-b1" / "RUN_STATUS.json"


@lru_cache(maxsize=1)
def load_staging_golden_path_registry() -> dict[str, Any]:
    data = json.loads(registry_path().read_text(encoding="utf-8"))
    if data.get("authority") != AUTHORITY:
        raise RuntimeError("STAGING_GOLDEN_REGISTRY_AUTHORITY_MISMATCH")
    if data.get("decision") != DECISION:
        raise RuntimeError("STAGING_GOLDEN_DECISION_MISMATCH")
    return data


def load_run_status() -> dict[str, Any]:
    return json.loads(run_status_path().read_text(encoding="utf-8"))


def staging_golden_path_observability() -> dict[str, Any]:
    reg = load_staging_golden_path_registry()
    run = load_run_status()
    honesty = reg.get("honesty") or {}
    return {
        "staging_golden_step": STEP,
        "staging_golden_adr": AUTHORITY,
        "staging_golden_decision": reg["decision"],
        "engineering_pack_ready": honesty.get("engineering_pack_ready"),
        "staging_attestation_complete": run.get("staging_attestation_complete"),
        "connected_run_status": (run.get("connected_run") or {}).get("status"),
        "manual_run_status": (run.get("manual_run") or {}).get("status"),
        "blocks_pr_c": run.get("blocks_pr_c"),
        "production_approved": False,
        "is_execution_authority": False,
    }


def assert_staging_golden_path_honesty(
    claim: Mapping[str, Any] | None = None,
) -> None:
    reg = load_staging_golden_path_registry()
    run = load_run_status()
    honesty = reg.get("honesty") or {}
    if honesty.get("production_approved") is True or run.get("production_approved") is True:
        raise RuntimeError("STAGING_GOLDEN_PRODUCTION_APPROVED")
    if honesty.get("is_execution_authority") is True:
        raise RuntimeError("STAGING_GOLDEN_EXECUTION_AUTHORITY")
    if honesty.get("oec_sole_mutation_authority") is True:
        raise RuntimeError("STAGING_GOLDEN_OEC_SOLE")
    # Do not allow claiming attestation complete while run file says otherwise
    if claim and claim.get("staging_attestation_complete") is True:
        if run.get("staging_attestation_complete") is not True:
            raise RuntimeError("STAGING_GOLDEN_FALSE_ATTESTATION")
    if claim and claim.get("production_approved") is True:
        raise RuntimeError("STAGING_GOLDEN_PRODUCTION_APPROVED")
    if claim and claim.get("connected_run_status") == "PASS":
        if (run.get("connected_run") or {}).get("status") != "PASS":
            raise RuntimeError("STAGING_GOLDEN_FALSE_CONNECTED_PASS")
