"""PR-D4 / ADR_0096 — operator runbook pack (READY; not post-launch stable)."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any, Mapping

AUTHORITY = "ADR_0096"
STEP = "PR-D4"
DECISION = "OPERATOR_RUNBOOK_PACK"


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[6]


def registry_path() -> Path:
    return _repo_root() / "docs" / "mokxya-ai" / "MAI_OPERATOR_RUNBOOK_REGISTRY.json"


def run_status_path() -> Path:
    return _repo_root() / "artifacts" / "prod-ready-pr-d4" / "RUN_STATUS.json"


def runbook_path() -> Path:
    return (
        _repo_root()
        / "docs"
        / "mokxya-ai"
        / "releases"
        / "OPERATOR_RUNBOOK_LAUNCH_V1.md"
    )


@lru_cache(maxsize=1)
def load_operator_runbook_registry() -> dict[str, Any]:
    data = json.loads(registry_path().read_text(encoding="utf-8"))
    if data.get("authority") != AUTHORITY:
        raise RuntimeError("RUNBOOK_REGISTRY_AUTHORITY_MISMATCH")
    if data.get("decision") != DECISION:
        raise RuntimeError("RUNBOOK_DECISION_MISMATCH")
    return data


def load_run_status() -> dict[str, Any]:
    return json.loads(run_status_path().read_text(encoding="utf-8"))


def operator_runbook_observability() -> dict[str, Any]:
    reg = load_operator_runbook_registry()
    run = load_run_status()
    text = runbook_path().read_text(encoding="utf-8")
    return {
        "runbook_step": STEP,
        "runbook_adr": AUTHORITY,
        "runbook_decision": reg["decision"],
        "pack_ready": True,
        "post_launch_stable": False,
        "production_approved": False,
        "day0_smoke_pass": False,
        "next_20_done": False,
        "covers_confirm": "Confirm token" in text or "confirm token" in text.lower(),
        "covers_sync": "Sync stuck" in text or "Waiting to sync" in text,
        "covers_ask_abstain": "abstain" in text.lower(),
        "covers_rollback": "Rollback" in text,
        "run_pack_ready": bool(run.get("pack_ready")),
        "is_execution_authority": False,
    }


def assert_operator_runbook_honesty(
    claim: Mapping[str, Any] | None = None,
) -> None:
    reg = load_operator_runbook_registry()
    run = load_run_status()
    honesty = reg.get("honesty") or {}
    if honesty.get("production_approved") is True or run.get("production_approved") is True:
        raise RuntimeError("RUNBOOK_PRODUCTION_APPROVED")
    if honesty.get("post_launch_stable") is True or run.get("post_launch_stable_claimed") is True:
        raise RuntimeError("RUNBOOK_POST_LAUNCH_STABLE")
    if honesty.get("day0_smoke_pass") is True or run.get("day0_smoke_pass") is True:
        raise RuntimeError("RUNBOOK_DAY0_SMOKE_PASS")
    if honesty.get("next_20_done") is True or run.get("next_20_done") is True:
        raise RuntimeError("RUNBOOK_NEXT_20")
    if not runbook_path().is_file():
        raise RuntimeError("RUNBOOK_MISSING")
    if not claim:
        return
    if claim.get("production_approved") is True:
        raise RuntimeError("RUNBOOK_PRODUCTION_APPROVED")
    if claim.get("post_launch_stable") is True:
        raise RuntimeError("RUNBOOK_POST_LAUNCH_STABLE")
    if claim.get("day0_smoke_pass") is True:
        raise RuntimeError("RUNBOOK_DAY0_SMOKE_PASS")
    if claim.get("next_20_done") is True:
        raise RuntimeError("RUNBOOK_NEXT_20")
