"""PR-B6 / ADR_0089 — hygiene gate (NEXT-H1/H2 subset)."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any, Mapping

AUTHORITY = "ADR_0089"
STEP = "PR-B6"
DECISION = "PROD_READY_HYGIENE_GATE"
GAP_P1_005_STATUS = "REDUCED"
GAP_P2_004_STATUS = "REDUCED"


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[6]


def registry_path() -> Path:
    return _repo_root() / "docs" / "mokxya-ai" / "MAI_HYGIENE_GATE_REGISTRY.json"


def run_status_path() -> Path:
    return _repo_root() / "artifacts" / "prod-ready-pr-b6" / "RUN_STATUS.json"


@lru_cache(maxsize=1)
def load_hygiene_gate_registry() -> dict[str, Any]:
    data = json.loads(registry_path().read_text(encoding="utf-8"))
    if data.get("authority") != AUTHORITY:
        raise RuntimeError("HYGIENE_REGISTRY_AUTHORITY_MISMATCH")
    if data.get("decision") != DECISION:
        raise RuntimeError("HYGIENE_DECISION_MISMATCH")
    return data


def load_run_status() -> dict[str, Any]:
    return json.loads(run_status_path().read_text(encoding="utf-8"))


def hygiene_gate_observability() -> dict[str, Any]:
    reg = load_hygiene_gate_registry()
    run = load_run_status()
    return {
        "hygiene_gate_step": STEP,
        "hygiene_gate_adr": AUTHORITY,
        "hygiene_gate_decision": reg["decision"],
        "gap_p1_005_register_status": GAP_P1_005_STATUS,
        "gap_p2_004_register_status": GAP_P2_004_STATUS,
        "invoice_print_syntax_fixed": True,
        "full_tsc_green_claimed": False,
        "playwright_required_green": False,
        "vacuous_greens_allowed": False,
        "engineering_pack_ready": bool(run.get("engineering_pack_ready")),
        "production_approved": False,
        "is_execution_authority": False,
    }


def assert_hygiene_gate_honesty(claim: Mapping[str, Any] | None = None) -> None:
    reg = load_hygiene_gate_registry()
    run = load_run_status()
    honesty = reg.get("honesty") or {}
    if honesty.get("production_approved") is True or run.get("production_approved") is True:
        raise RuntimeError("HYGIENE_PRODUCTION_APPROVED")
    if honesty.get("full_tsc_green_claimed") is True or run.get("full_tsc_green_claimed") is True:
        raise RuntimeError("FULL_TSC_GREEN_FALSE_CLAIM")
    if honesty.get("vacuous_greens_allowed") is True:
        raise RuntimeError("VACUOUS_GREENS_FORBIDDEN")
    if reg["gap_p2_004"].get("closed") is True and not run.get("full_tsc_green_claimed"):
        # CLOSED only if inventory cleared or signed green — not this ship
        raise RuntimeError("GAP_P2_004_FALSE_CLOSED")
    if not claim:
        return
    if claim.get("production_approved") is True:
        raise RuntimeError("HYGIENE_PRODUCTION_APPROVED")
    if claim.get("full_tsc_green_claimed") is True:
        raise RuntimeError("FULL_TSC_GREEN_FALSE_CLAIM")
    if claim.get("vacuous_greens_allowed") is True:
        raise RuntimeError("VACUOUS_GREENS_FORBIDDEN")
    if claim.get("gap_p2_004_closed") is True:
        raise RuntimeError("GAP_P2_004_FALSE_CLOSED")
