"""PR-C1-ARM / ADR_0100 — arm armed (ADR_0091 was the prior blocked attempt)."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any, Mapping

from oip.modules.conversation.application.launch_sales_purchase_release_policy import (
    arm_evidence_complete,
    blocking_tickets_clear,
    owner_signed,
)

AUTHORITY = "ADR_0100"
STEP = "PR-C1-ARM"
DECISION = "PR_C1_ARM_ARMED"
ATTEMPT_STATUS = "ARMED"
PRIOR_BLOCKED_AUTHORITY = "ADR_0091"


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
        "prior_blocked_adr": PRIOR_BLOCKED_AUTHORITY,
        "attempt_status": ATTEMPT_STATUS,
        "flag_armed": bool(reg.get("flag", {}).get("armed")),
        "production_approved": bool(reg.get("flag", {}).get("production_approved")),
        "next_20_done": bool(reg.get("honesty", {}).get("next_20_done")),
        "owner_signed": owner_signed(),
        "staging_golden_path_green": bool(
            reg.get("honesty", {}).get("staging_golden_path_green")
        ),
        "blocking_tickets_clear": blocking_tickets_clear(),
        "arm_evidence_complete": arm_evidence_complete(),
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
    evidence = arm_evidence_complete()
    if reg.get("flag", {}).get("armed") is True and not evidence:
        raise RuntimeError("ARM_FLAG_ARMED_WITHOUT_EVIDENCE")
    if honesty.get("flipped_without_evidence") is True:
        raise RuntimeError("ARM_FLIPPED_WITHOUT_EVIDENCE")
    if run.get("attempt_status") == "ARMED" and not evidence:
        raise RuntimeError("ARM_FALSE_ARMED")
    if honesty.get("owner_signed") is True and not owner_signed():
        raise RuntimeError("ARM_OWNER_FALSE_SIGNOFF")
    if not claim:
        return
    if claim.get("flipped_without_evidence") is True:
        raise RuntimeError("ARM_FLIPPED_WITHOUT_EVIDENCE")
    if claim.get("flag_armed") is True and not evidence:
        raise RuntimeError("ARM_FLAG_ARMED_WITHOUT_EVIDENCE")
