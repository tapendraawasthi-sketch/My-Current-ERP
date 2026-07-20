"""PR-D3 / ADR_0099 — dual-writer/sync residual burn-down (gaps still REDUCED)."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any, Mapping

AUTHORITY = "ADR_0099"
STEP = "PR-D3"
DECISION = "DUAL_WRITER_SYNC_RESIDUAL_BURNDOWN_PACK"


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[6]


def registry_path() -> Path:
    return (
        _repo_root()
        / "docs"
        / "mokxya-ai"
        / "MAI_DUAL_WRITER_SYNC_BURNDOWN_REGISTRY.json"
    )


def run_status_path() -> Path:
    return _repo_root() / "artifacts" / "prod-ready-pr-d3" / "RUN_STATUS.json"


def schedule_path() -> Path:
    return (
        _repo_root()
        / "docs"
        / "mokxya-ai"
        / "releases"
        / "DUAL_WRITER_SYNC_RESIDUAL_BURNDOWN_V1.md"
    )


@lru_cache(maxsize=1)
def load_dual_writer_sync_burndown_registry() -> dict[str, Any]:
    data = json.loads(registry_path().read_text(encoding="utf-8"))
    if data.get("authority") != AUTHORITY:
        raise RuntimeError("DUAL_BURNDOWN_REGISTRY_AUTHORITY_MISMATCH")
    if data.get("decision") != DECISION:
        raise RuntimeError("DUAL_BURNDOWN_DECISION_MISMATCH")
    return data


def load_run_status() -> dict[str, Any]:
    return json.loads(run_status_path().read_text(encoding="utf-8"))


def dual_writer_sync_burndown_observability() -> dict[str, Any]:
    reg = load_dual_writer_sync_burndown_registry()
    run = load_run_status()
    gaps = reg.get("gaps") or {}
    return {
        "dual_burndown_step": STEP,
        "dual_burndown_adr": AUTHORITY,
        "dual_burndown_decision": reg["decision"],
        "pack_ready": True,
        "gap_p0_001_closed": False,
        "gap_p1_002_closed": False,
        "oec_sole": False,
        "production_approved": False,
        "gap_p0_001_status": (gaps.get("GAP-P0-001") or {}).get("register_status"),
        "gap_p1_002_status": (gaps.get("GAP-P1-002") or {}).get("register_status"),
        "schedule_present": schedule_path().is_file(),
        "run_pack_ready": bool(run.get("pack_ready")),
        "is_execution_authority": False,
    }


def assert_dual_writer_sync_burndown_honesty(
    claim: Mapping[str, Any] | None = None,
) -> None:
    reg = load_dual_writer_sync_burndown_registry()
    run = load_run_status()
    honesty = reg.get("honesty") or {}
    gaps = reg.get("gaps") or {}
    if honesty.get("gap_p0_001_closed") is True or run.get("gap_p0_001_closed") is True:
        raise RuntimeError("DUAL_BURNDOWN_P0_FALSE_CLOSED")
    if honesty.get("gap_p1_002_closed") is True or run.get("gap_p1_002_closed") is True:
        raise RuntimeError("DUAL_BURNDOWN_P1_FALSE_CLOSED")
    if (gaps.get("GAP-P0-001") or {}).get("closed") is True:
        raise RuntimeError("DUAL_BURNDOWN_P0_FALSE_CLOSED")
    if (gaps.get("GAP-P1-002") or {}).get("closed") is True:
        raise RuntimeError("DUAL_BURNDOWN_P1_FALSE_CLOSED")
    if honesty.get("oec_sole") is True or run.get("oec_sole") is True:
        raise RuntimeError("DUAL_BURNDOWN_OEC_SOLE")
    if honesty.get("production_approved") is True or run.get("production_approved") is True:
        raise RuntimeError("DUAL_BURNDOWN_PRODUCTION_APPROVED")
    if honesty.get("silent_second_writer_reintroduced") is True:
        raise RuntimeError("DUAL_BURNDOWN_SILENT_SECOND_WRITER")
    if not schedule_path().is_file():
        raise RuntimeError("DUAL_BURNDOWN_SCHEDULE_MISSING")
    if not claim:
        return
    if claim.get("gap_p0_001_closed") is True:
        raise RuntimeError("DUAL_BURNDOWN_P0_FALSE_CLOSED")
    if claim.get("gap_p1_002_closed") is True:
        raise RuntimeError("DUAL_BURNDOWN_P1_FALSE_CLOSED")
    if claim.get("oec_sole") is True:
        raise RuntimeError("DUAL_BURNDOWN_OEC_SOLE")
    if claim.get("production_approved") is True:
        raise RuntimeError("DUAL_BURNDOWN_PRODUCTION_APPROVED")
