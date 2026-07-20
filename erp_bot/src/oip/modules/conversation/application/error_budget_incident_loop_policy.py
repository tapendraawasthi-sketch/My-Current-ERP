"""PR-D1 / ADR_0097 — error budget & incident loop pack (not 14-day stable)."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any, Mapping

AUTHORITY = "ADR_0097"
STEP = "PR-D1"
DECISION = "ERROR_BUDGET_INCIDENT_LOOP_PACK"


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[6]


def registry_path() -> Path:
    return (
        _repo_root()
        / "docs"
        / "mokxya-ai"
        / "MAI_ERROR_BUDGET_INCIDENT_LOOP_REGISTRY.json"
    )


def run_status_path() -> Path:
    return _repo_root() / "artifacts" / "prod-ready-pr-d1" / "RUN_STATUS.json"


def loop_doc_path() -> Path:
    return (
        _repo_root()
        / "docs"
        / "mokxya-ai"
        / "releases"
        / "ERROR_BUDGET_INCIDENT_LOOP_V1.md"
    )


@lru_cache(maxsize=1)
def load_error_budget_incident_loop_registry() -> dict[str, Any]:
    data = json.loads(registry_path().read_text(encoding="utf-8"))
    if data.get("authority") != AUTHORITY:
        raise RuntimeError("INCIDENT_LOOP_REGISTRY_AUTHORITY_MISMATCH")
    if data.get("decision") != DECISION:
        raise RuntimeError("INCIDENT_LOOP_DECISION_MISMATCH")
    return data


def load_run_status() -> dict[str, Any]:
    return json.loads(run_status_path().read_text(encoding="utf-8"))


def error_budget_incident_loop_observability() -> dict[str, Any]:
    reg = load_error_budget_incident_loop_registry()
    run = load_run_status()
    text = loop_doc_path().read_text(encoding="utf-8")
    return {
        "incident_loop_step": STEP,
        "incident_loop_adr": AUTHORITY,
        "incident_loop_decision": reg["decision"],
        "pack_ready": True,
        "fourteen_day_stable": False,
        "weekly_reviews_executed": False,
        "production_approved": False,
        "signal_count": len(reg.get("signals") or []),
        "doc_has_weekly_loop": "Weekly loop" in text,
        "doc_has_p0": "P0" in text,
        "run_pack_ready": bool(run.get("pack_ready")),
        "is_execution_authority": False,
    }


def assert_error_budget_incident_loop_honesty(
    claim: Mapping[str, Any] | None = None,
) -> None:
    reg = load_error_budget_incident_loop_registry()
    run = load_run_status()
    honesty = reg.get("honesty") or {}
    if honesty.get("production_approved") is True or run.get("production_approved") is True:
        raise RuntimeError("INCIDENT_LOOP_PRODUCTION_APPROVED")
    if (
        honesty.get("fourteen_day_stable") is True
        or run.get("fourteen_day_stable_claimed") is True
    ):
        raise RuntimeError("INCIDENT_LOOP_FOURTEEN_DAY_STABLE")
    if honesty.get("post_launch_stable") is True:
        raise RuntimeError("INCIDENT_LOOP_POST_LAUNCH_STABLE")
    if honesty.get("day0_smoke_pass") is True or run.get("day0_smoke_pass") is True:
        raise RuntimeError("INCIDENT_LOOP_DAY0_SMOKE_PASS")
    if run.get("weekly_reviews_executed") is True:
        raise RuntimeError("INCIDENT_LOOP_FALSE_WEEKLY_EXECUTED")
    if not loop_doc_path().is_file():
        raise RuntimeError("INCIDENT_LOOP_DOC_MISSING")
    if not claim:
        return
    if claim.get("production_approved") is True:
        raise RuntimeError("INCIDENT_LOOP_PRODUCTION_APPROVED")
    if claim.get("fourteen_day_stable") is True:
        raise RuntimeError("INCIDENT_LOOP_FOURTEEN_DAY_STABLE")
    if claim.get("day0_smoke_pass") is True:
        raise RuntimeError("INCIDENT_LOOP_DAY0_SMOKE_PASS")
