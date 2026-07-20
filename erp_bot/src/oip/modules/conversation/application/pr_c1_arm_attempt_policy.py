"""PR-C1-ARM / ADR_0091 — arm attempt blocked (flag stays OFF)."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any, Mapping

AUTHORITY = "ADR_0091"
STEP = "PR-C1-ARM"
DECISION = "PR_C1_ARM_ATTEMPT_BLOCKED"
ATTEMPT_STATUS = "BLOCKED"


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[6]


def registry_path() -> Path:
    return _repo_root() / "docs" / "mokxya-ai" / "MAI_PR_C1_ARM_ATTEMPT_REGISTRY.json"


def run_status_path() -> Path:
    return _repo_root() / "artifacts" / "prod-ready-pr-c1-arm" / "RUN_STATUS.json"


@lru_cache(maxsize=1)
def load_pr_c1_arm_attempt_registry() -> dict[str, Any]:
    data = json.loads(registry_path().read_text(encoding="utf-8"))
    if data.get("authority") != AUTHORITY:
        raise RuntimeError("ARM_ATTEMPT_REGISTRY_AUTHORITY_MISMATCH")
    if data.get("decision") != DECISION:
        raise RuntimeError("ARM_ATTEMPT_DECISION_MISMATCH")
    return data


def load_run_status() -> dict[str, Any]:
    return json.loads(run_status_path().read_text(encoding="utf-8"))


def pr_c1_arm_attempt_observability() -> dict[str, Any]:
    reg = load_pr_c1_arm_attempt_registry()
    run = load_run_status()
    return {
        "pr_c1_arm_step": STEP,
        "pr_c1_arm_adr": AUTHORITY,
        "pr_c1_arm_decision": reg["decision"],
        "attempt_status": ATTEMPT_STATUS,
        "flag_armed": False,
        "production_approved": False,
        "next_20_done": False,
        "owner_signed": False,
        "staging_golden_path_green": False,
        "blocking_tickets_clear": False,
        "flipped_without_evidence": False,
        "engineering_pack_ready": True,
        "is_execution_authority": False,
        "run_attempt_status": run.get("attempt_status"),
    }


def assert_pr_c1_arm_attempt_honesty(
    claim: Mapping[str, Any] | None = None,
) -> None:
    reg = load_pr_c1_arm_attempt_registry()
    run = load_run_status()
    honesty = reg.get("honesty") or {}
    if honesty.get("production_approved") is True or run.get("production_approved") is True:
        raise RuntimeError("ARM_PRODUCTION_APPROVED")
    if honesty.get("flag_armed") is True or run.get("flag_armed") is True:
        raise RuntimeError("ARM_FLAG_ARMED")
    if honesty.get("next_20_done") is True or run.get("next_20_done") is True:
        raise RuntimeError("ARM_NEXT_20_DONE")
    if run.get("attempt_status") == "PASS":
        raise RuntimeError("ARM_FALSE_PASS")
    if honesty.get("flipped_without_evidence") is True:
        raise RuntimeError("ARM_FLIPPED_WITHOUT_EVIDENCE")
    if not claim:
        return
    if claim.get("production_approved") is True:
        raise RuntimeError("ARM_PRODUCTION_APPROVED")
    if claim.get("flag_armed") is True:
        raise RuntimeError("ARM_FLAG_ARMED")
    if claim.get("next_20_done") is True:
        raise RuntimeError("ARM_NEXT_20_DONE")
    if claim.get("attempt_status") == "PASS":
        raise RuntimeError("ARM_FALSE_PASS")
