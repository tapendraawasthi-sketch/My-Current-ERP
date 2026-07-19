"""PR-B3 / ADR_0086 — sync honesty residual (queued≠synced; gap stays REDUCED)."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any, Mapping

AUTHORITY = "ADR_0086"
STEP = "PR-B3"
DECISION = "SYNC_HONESTY_RESIDUAL_PACK"
ACCOUNTING_SYNC_AUTHORITY = "EVENT_SYNC_QUEUE"
REGISTER_GAP_STATUS = "REDUCED"
RUNTIME_GAP_STATUS = "OPEN"
CONFLICT_POLICY = "REQUIRE_RECONFIRM_ON_MATERIAL_CONFLICT"


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[6]


def registry_path() -> Path:
    return (
        _repo_root() / "docs" / "mokxya-ai" / "MAI_SYNC_HONESTY_RESIDUAL_REGISTRY.json"
    )


def run_status_path() -> Path:
    return _repo_root() / "artifacts" / "prod-ready-pr-b3" / "RUN_STATUS.json"


@lru_cache(maxsize=1)
def load_sync_honesty_residual_registry() -> dict[str, Any]:
    data = json.loads(registry_path().read_text(encoding="utf-8"))
    if data.get("authority") != AUTHORITY:
        raise RuntimeError("SYNC_HONESTY_REGISTRY_AUTHORITY_MISMATCH")
    if data.get("decision") != DECISION:
        raise RuntimeError("SYNC_HONESTY_DECISION_MISMATCH")
    return data


def load_run_status() -> dict[str, Any]:
    return json.loads(run_status_path().read_text(encoding="utf-8"))


def sync_honesty_residual_observability() -> dict[str, Any]:
    reg = load_sync_honesty_residual_registry()
    run = load_run_status()
    return {
        "sync_honesty_step": STEP,
        "sync_honesty_adr": AUTHORITY,
        "sync_honesty_decision": reg["decision"],
        "accounting_sync_authority": ACCOUNTING_SYNC_AUTHORITY,
        "queued_must_not_label_synced": True,
        "conflict_policy": CONFLICT_POLICY,
        "conflict_auto_overwrite": False,
        "dual_sync_closed": False,
        "gap_p1_002_register_status": REGISTER_GAP_STATUS,
        "gap_p1_002_status": RUNTIME_GAP_STATUS,
        "gap_p1_002_closed": False,
        "staging_conflict_attested": bool(run.get("staging_conflict_attested")),
        "engineering_pack_ready": bool(run.get("engineering_pack_ready")),
        "production_approved": False,
        "is_execution_authority": False,
    }


def assert_sync_honesty_residual_honesty(
    claim: Mapping[str, Any] | None = None,
) -> None:
    reg = load_sync_honesty_residual_registry()
    run = load_run_status()
    honesty = reg.get("honesty") or {}
    if honesty.get("production_approved") is True or run.get("production_approved") is True:
        raise RuntimeError("SYNC_HONESTY_PRODUCTION_APPROVED")
    if honesty.get("dual_sync_closed") is True or run.get("dual_sync_closed") is True:
        raise RuntimeError("DUAL_SYNC_FALSE_CLOSED")
    if honesty.get("queued_labeled_synced") is True:
        raise RuntimeError("QUEUED_LABELED_SYNCED_FORBIDDEN")
    if honesty.get("conflict_auto_overwrite") is True:
        raise RuntimeError("CONFLICT_AUTO_OVERWRITE_FORBIDDEN")
    if reg["gap_p1_002"].get("closed") is True:
        raise RuntimeError("GAP_P1_002_FALSE_CLOSED")
    if honesty.get("staging_conflict_attested") is True and not run.get(
        "staging_conflict_attested"
    ):
        raise RuntimeError("STAGING_CONFLICT_FALSE_ATTESTATION")
    if not claim:
        return
    if claim.get("production_approved") is True:
        raise RuntimeError("SYNC_HONESTY_PRODUCTION_APPROVED")
    if claim.get("dual_sync_closed") is True:
        raise RuntimeError("DUAL_SYNC_FALSE_CLOSED")
    if claim.get("queued_labeled_synced") is True:
        raise RuntimeError("QUEUED_LABELED_SYNCED_FORBIDDEN")
    if claim.get("gap_p1_002_closed") is True:
        raise RuntimeError("GAP_P1_002_FALSE_CLOSED")
    if claim.get("staging_conflict_attested") is True and not run.get(
        "staging_conflict_attested"
    ):
        raise RuntimeError("STAGING_CONFLICT_FALSE_ATTESTATION")
