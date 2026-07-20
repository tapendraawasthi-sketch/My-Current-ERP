"""PR-H3 / ADR_0094 — secondary AI stack quarantine (extends ADR_0073)."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any, Mapping

from oip.domain.constitution.ai_stack_mount_policy import (
    PRIMARY_CHAT_ROUTE,
    SECONDARY_STACK_IDS,
    secondary_ai_stacks_allowed,
)

AUTHORITY = "ADR_0094"
STEP = "PR-H3"
DECISION = "SECONDARY_AI_STACK_QUARANTINE"
DISPOSITION = "QUARANTINED_NON_PROD_ONLY"
EXTENDS = "ADR_0073"


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[6]


def registry_path() -> Path:
    return (
        _repo_root()
        / "docs"
        / "mokxya-ai"
        / "MAI_SECONDARY_AI_STACK_QUARANTINE_REGISTRY.json"
    )


def run_status_path() -> Path:
    return _repo_root() / "artifacts" / "prod-ready-pr-h3" / "RUN_STATUS.json"


@lru_cache(maxsize=1)
def load_secondary_ai_stack_quarantine_registry() -> dict[str, Any]:
    data = json.loads(registry_path().read_text(encoding="utf-8"))
    if data.get("authority") != AUTHORITY:
        raise RuntimeError("QUARANTINE_REGISTRY_AUTHORITY_MISMATCH")
    if data.get("decision") != DECISION:
        raise RuntimeError("QUARANTINE_DECISION_MISMATCH")
    return data


def load_run_status() -> dict[str, Any]:
    return json.loads(run_status_path().read_text(encoding="utf-8"))


def secondary_ai_stack_quarantine_observability() -> dict[str, Any]:
    reg = load_secondary_ai_stack_quarantine_registry()
    run = load_run_status()
    falcon = reg.get("falcon_orphan_ui") or []
    return {
        "quarantine_step": STEP,
        "quarantine_adr": AUTHORITY,
        "quarantine_decision": reg["decision"],
        "extends": EXTENDS,
        "disposition": DISPOSITION,
        "primary_chat_route": PRIMARY_CHAT_ROUTE,
        "deletion_in_this_ship": False,
        "gap_p1_001_closed": False,
        "gap_p1_001_register_status": "REDUCED",
        "gap_p3_001_closed": False,
        "gap_p3_001_register_status": "REDUCED",
        "production_approved": False,
        "prod_secondary_allowed_default": secondary_ai_stacks_allowed(
            environ={"NODE_ENV": "production", "RENDER": "true"}
        ),
        "stack_ids": list(SECONDARY_STACK_IDS),
        "inventory_count": len(reg.get("stacks") or []),
        "falcon_orphan_ui_count": len(falcon),
        "run_pack_ready": bool(run.get("engineering_pack_ready")),
        "is_execution_authority": False,
    }


def assert_secondary_ai_stack_quarantine_honesty(
    claim: Mapping[str, Any] | None = None,
) -> None:
    reg = load_secondary_ai_stack_quarantine_registry()
    run = load_run_status()
    honesty = reg.get("honesty") or {}
    if honesty.get("gap_p1_001_closed") is True or run.get("gap_p1_001_closed") is True:
        raise RuntimeError("QUARANTINE_GAP_FALSE_CLOSED")
    if honesty.get("gap_p3_001_closed") is True or run.get("gap_p3_001_closed") is True:
        raise RuntimeError("QUARANTINE_GAP_P3_FALSE_CLOSED")
    if honesty.get("secondary_deleted") is True or run.get("deletion_in_this_ship") is True:
        raise RuntimeError("QUARANTINE_FALSE_DELETE")
    if honesty.get("falcon_tree_deleted") is True:
        raise RuntimeError("QUARANTINE_FALCON_FALSE_DELETE")
    if honesty.get("production_approved") is True or run.get("production_approved") is True:
        raise RuntimeError("QUARANTINE_PRODUCTION_APPROVED")
    if honesty.get("secondary_default_on_in_production") is True:
        raise RuntimeError("QUARANTINE_SECONDARY_DEFAULT_ON")
    if secondary_ai_stacks_allowed(
        environ={"NODE_ENV": "production", "RENDER": "true"}
    ):
        raise RuntimeError("QUARANTINE_PROD_GATE_REGRESSION")
    if reg.get("disposition") != DISPOSITION:
        raise RuntimeError("QUARANTINE_DISPOSITION_MISMATCH")
    if not claim:
        return
    if claim.get("gap_p1_001_closed") is True:
        raise RuntimeError("QUARANTINE_GAP_FALSE_CLOSED")
    if claim.get("gap_p3_001_closed") is True:
        raise RuntimeError("QUARANTINE_GAP_P3_FALSE_CLOSED")
    if claim.get("secondary_deleted") is True:
        raise RuntimeError("QUARANTINE_FALSE_DELETE")
    if claim.get("falcon_tree_deleted") is True:
        raise RuntimeError("QUARANTINE_FALCON_FALSE_DELETE")
    if claim.get("production_approved") is True:
        raise RuntimeError("QUARANTINE_PRODUCTION_APPROVED")
