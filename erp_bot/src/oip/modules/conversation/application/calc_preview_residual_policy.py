"""PR-B4 / ADR_0087 — calc/preview residual (GAP-P2-002 stays REDUCED)."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any, Mapping

AUTHORITY = "ADR_0087"
STEP = "PR-B4"
DECISION = "CALC_PREVIEW_RESIDUAL_SPOTCHECK"
CALC_ON_CONFIRM = "DEXIE_DOMAIN_ENGINE"
REGISTER_GAP_STATUS = "REDUCED"
RUNTIME_GAP_STATUS = "OPEN"


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[6]


def registry_path() -> Path:
    return (
        _repo_root() / "docs" / "mokxya-ai" / "MAI_CALC_PREVIEW_RESIDUAL_REGISTRY.json"
    )


def run_status_path() -> Path:
    return _repo_root() / "artifacts" / "prod-ready-pr-b4" / "RUN_STATUS.json"


@lru_cache(maxsize=1)
def load_calc_preview_residual_registry() -> dict[str, Any]:
    data = json.loads(registry_path().read_text(encoding="utf-8"))
    if data.get("authority") != AUTHORITY:
        raise RuntimeError("CALC_PREVIEW_REGISTRY_AUTHORITY_MISMATCH")
    if data.get("decision") != DECISION:
        raise RuntimeError("CALC_PREVIEW_DECISION_MISMATCH")
    return data


def load_run_status() -> dict[str, Any]:
    return json.loads(run_status_path().read_text(encoding="utf-8"))


def calc_preview_residual_observability() -> dict[str, Any]:
    reg = load_calc_preview_residual_registry()
    run = load_run_status()
    return {
        "calc_preview_residual_step": STEP,
        "calc_preview_residual_adr": AUTHORITY,
        "calc_preview_residual_decision": reg["decision"],
        "calc_authority_on_confirm": CALC_ON_CONFIRM,
        "ui_calculates_authoritative_totals": False,
        "known_paisa_drift_on_launch_fixtures": False,
        "gap_p2_002_register_status": REGISTER_GAP_STATUS,
        "gap_p2_002_status": RUNTIME_GAP_STATUS,
        "gap_p2_002_closed": False,
        "engineering_pack_ready": bool(run.get("engineering_pack_ready")),
        "production_approved": False,
        "is_execution_authority": False,
    }


def assert_calc_preview_residual_honesty(
    claim: Mapping[str, Any] | None = None,
) -> None:
    reg = load_calc_preview_residual_registry()
    run = load_run_status()
    honesty = reg.get("honesty") or {}
    if honesty.get("production_approved") is True or run.get("production_approved") is True:
        raise RuntimeError("CALC_PREVIEW_PRODUCTION_APPROVED")
    if honesty.get("gap_p2_002_closed") is True or run.get("gap_p2_002_closed") is True:
        raise RuntimeError("GAP_P2_002_FALSE_CLOSED")
    if honesty.get("ui_calculates_authoritative_totals") is True:
        raise RuntimeError("UI_AUTHORITATIVE_FORBIDDEN")
    if honesty.get("known_paisa_drift_on_launch_fixtures") is True:
        raise RuntimeError("KNOWN_PAISA_DRIFT_FORBIDDEN")
    if reg["gap_p2_002"].get("closed") is True:
        raise RuntimeError("GAP_P2_002_FALSE_CLOSED")
    if not claim:
        return
    if claim.get("production_approved") is True:
        raise RuntimeError("CALC_PREVIEW_PRODUCTION_APPROVED")
    if claim.get("gap_p2_002_closed") is True:
        raise RuntimeError("GAP_P2_002_FALSE_CLOSED")
    if claim.get("ui_calculates_authoritative_totals") is True:
        raise RuntimeError("UI_AUTHORITATIVE_FORBIDDEN")
    if claim.get("known_paisa_drift_on_launch_fixtures") is True:
        raise RuntimeError("KNOWN_PAISA_DRIFT_FORBIDDEN")
