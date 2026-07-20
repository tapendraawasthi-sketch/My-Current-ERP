"""PR-C3-PACK / ADR_0093 — Day-0 smoke pack (NOT_RUN; not PASS)."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any, Mapping

AUTHORITY = "ADR_0093"
STEP = "PR-C3-PACK"
DECISION = "DAY0_PRODUCTION_SMOKE_PACK"
SMOKE_STATUS = "NOT_RUN"


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[6]


def registry_path() -> Path:
    return _repo_root() / "docs" / "mokxya-ai" / "MAI_DAY0_SMOKE_PACK_REGISTRY.json"


def run_status_path() -> Path:
    return _repo_root() / "artifacts" / "prod-ready-pr-c3" / "RUN_STATUS.json"


@lru_cache(maxsize=1)
def load_day0_smoke_pack_registry() -> dict[str, Any]:
    data = json.loads(registry_path().read_text(encoding="utf-8"))
    if data.get("authority") != AUTHORITY:
        raise RuntimeError("DAY0_SMOKE_REGISTRY_AUTHORITY_MISMATCH")
    if data.get("decision") != DECISION:
        raise RuntimeError("DAY0_SMOKE_DECISION_MISMATCH")
    return data


def load_run_status() -> dict[str, Any]:
    return json.loads(run_status_path().read_text(encoding="utf-8"))


def day0_smoke_pack_observability() -> dict[str, Any]:
    reg = load_day0_smoke_pack_registry()
    run = load_run_status()
    return {
        "day0_smoke_step": STEP,
        "day0_smoke_adr": AUTHORITY,
        "day0_smoke_decision": reg["decision"],
        "pack_ready": True,
        "smoke_status": SMOKE_STATUS,
        "smoke_pass": False,
        "smoke_executed": False,
        "production_approved": False,
        "next_20_done": False,
        "run_smoke_status": run.get("smoke_status"),
        "is_execution_authority": False,
    }


def assert_day0_smoke_pack_honesty(
    claim: Mapping[str, Any] | None = None,
) -> None:
    reg = load_day0_smoke_pack_registry()
    run = load_run_status()
    honesty = reg.get("honesty") or {}
    if honesty.get("smoke_pass") is True or run.get("smoke_pass") is True:
        raise RuntimeError("DAY0_SMOKE_FALSE_PASS")
    if run.get("smoke_status") == "PASS":
        raise RuntimeError("DAY0_SMOKE_FALSE_PASS")
    if honesty.get("smoke_executed") is True or run.get("smoke_executed") is True:
        raise RuntimeError("DAY0_SMOKE_FALSE_EXECUTED")
    if honesty.get("production_approved") is True or run.get("production_approved") is True:
        raise RuntimeError("DAY0_SMOKE_PRODUCTION_APPROVED")
    if honesty.get("next_20_done") is True or run.get("next_20_done") is True:
        raise RuntimeError("DAY0_SMOKE_NEXT_20")
    if not claim:
        return
    if claim.get("smoke_pass") is True:
        raise RuntimeError("DAY0_SMOKE_FALSE_PASS")
    if claim.get("smoke_status") == "PASS":
        raise RuntimeError("DAY0_SMOKE_FALSE_PASS")
    if claim.get("smoke_executed") is True:
        raise RuntimeError("DAY0_SMOKE_FALSE_EXECUTED")
    if claim.get("production_approved") is True:
        raise RuntimeError("DAY0_SMOKE_PRODUCTION_APPROVED")
    if claim.get("next_20_done") is True:
        raise RuntimeError("DAY0_SMOKE_NEXT_20")
