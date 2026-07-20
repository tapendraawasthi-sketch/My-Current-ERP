"""PR-C1 / ADR_0090 + ADR_0100 — launch sales/purchase release (armed when evidence complete)."""

from __future__ import annotations

import json
import os
from functools import lru_cache
from pathlib import Path
from typing import Any, Mapping

AUTHORITY = "ADR_0090"
STEP = "PR-C1"
DECISION = "LAUNCH_SALES_PURCHASE_RELEASE_PACKAGE"
CAPABILITY_ROW = "LAUNCH-ACCOUNTANT-SALES-PURCHASE"
ENV_FLAG = "LAUNCH_ACCOUNTANT_SALES_PURCHASE_PRODUCTION_APPROVED"

DISCLOSURES = (
    "Settlement, returns, and bank recon are not in the AI launch set.",
    "Natural-language yes does not post.",
    "Sync may show Waiting to sync until acknowledged.",
    "Legal and tax-current answers may abstain.",
    "Invoice UI totals are display estimates; ledger uses the domain engine.",
)


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[6]


def registry_path() -> Path:
    return (
        _repo_root()
        / "docs"
        / "mokxya-ai"
        / "MAI_LAUNCH_SALES_PURCHASE_RELEASE_REGISTRY.json"
    )


def run_status_path() -> Path:
    return _repo_root() / "artifacts" / "prod-ready-pr-c1" / "RUN_STATUS.json"


def owner_signoff_path() -> Path:
    return _repo_root() / "artifacts" / "prod-ready-pr-c1" / "OWNER_SIGNOFF.md"


@lru_cache(maxsize=1)
def load_launch_sales_purchase_release_registry() -> dict[str, Any]:
    data = json.loads(registry_path().read_text(encoding="utf-8"))
    if data.get("authority") != AUTHORITY:
        raise RuntimeError("LAUNCH_RELEASE_REGISTRY_AUTHORITY_MISMATCH")
    if data.get("decision") != DECISION:
        raise RuntimeError("LAUNCH_RELEASE_DECISION_MISMATCH")
    return data


def load_run_status() -> dict[str, Any]:
    return json.loads(run_status_path().read_text(encoding="utf-8"))


def blocking_tickets_clear(reg: Mapping[str, Any] | None = None) -> bool:
    reg = reg or load_launch_sales_purchase_release_registry()
    tickets = reg.get("blocking_tickets") or {}
    return bool(tickets) and all(str(v).upper() == "PASS" for v in tickets.values())


def owner_signed() -> bool:
    text = owner_signoff_path().read_text(encoding="utf-8")
    return "**Status:** SIGNED" in text or "**Status:**SIGNED" in text


def env_flag_true() -> bool:
    return os.environ.get(ENV_FLAG, "").strip().lower() in {"1", "true", "yes", "on"}


def arm_evidence_complete(reg: Mapping[str, Any] | None = None) -> bool:
    return blocking_tickets_clear(reg) and owner_signed()


def is_launch_sales_purchase_production_approved() -> bool:
    """Runtime gate: registry armed + tickets + owner + env."""
    reg = load_launch_sales_purchase_release_registry()
    if not reg.get("flag", {}).get("armed"):
        return False
    if reg.get("flag", {}).get("production_approved") is not True:
        return False
    if not blocking_tickets_clear(reg):
        return False
    if not owner_signed():
        return False
    if not env_flag_true():
        return False
    return True


def launch_sales_purchase_release_observability() -> dict[str, Any]:
    reg = load_launch_sales_purchase_release_registry()
    run = load_run_status()
    armed = bool(reg.get("flag", {}).get("armed"))
    row_approved = reg.get("flag", {}).get("production_approved") is True
    return {
        "launch_release_step": STEP,
        "launch_release_adr": AUTHORITY,
        "launch_release_decision": reg["decision"],
        "capability_row": CAPABILITY_ROW,
        "flag_armed": armed,
        "production_approved": row_approved,
        "runtime_production_approved": is_launch_sales_purchase_production_approved(),
        "next_20_done": bool(run.get("next_20_done") or reg.get("honesty", {}).get("next_20_done")),
        "owner_signed": owner_signed(),
        "blocking_tickets_clear": blocking_tickets_clear(reg),
        "arm_evidence_complete": arm_evidence_complete(reg),
        "engineering_pack_ready": bool(run.get("engineering_pack_ready")),
        "disclosures": list(DISCLOSURES),
        "is_execution_authority": False,
    }


def assert_launch_sales_purchase_release_honesty(
    claim: Mapping[str, Any] | None = None,
) -> None:
    reg = load_launch_sales_purchase_release_registry()
    run = load_run_status()
    honesty = reg.get("honesty") or {}
    evidence = arm_evidence_complete(reg)
    armed = reg.get("flag", {}).get("armed") is True

    if armed and not evidence:
        raise RuntimeError("FLAG_ARMED_WITHOUT_EVIDENCE")
    if honesty.get("flag_armed") is True and not evidence:
        raise RuntimeError("LAUNCH_RELEASE_FLAG_ARMED_WITHOUT_EVIDENCE")
    if run.get("flag_armed") is True and not evidence:
        raise RuntimeError("LAUNCH_RELEASE_FLAG_ARMED_WITHOUT_EVIDENCE")

    if honesty.get("production_approved") is True and not (armed and evidence):
        raise RuntimeError("LAUNCH_RELEASE_PRODUCTION_APPROVED")
    if run.get("production_approved") is True and not (armed and evidence):
        raise RuntimeError("LAUNCH_RELEASE_PRODUCTION_APPROVED")

    if honesty.get("next_20_done") is True and not (armed and evidence):
        raise RuntimeError("NEXT_20_FALSE_DONE")
    if run.get("next_20_done") is True and not (armed and evidence):
        raise RuntimeError("NEXT_20_FALSE_DONE")

    if honesty.get("owner_signed") is True and not owner_signed():
        raise RuntimeError("OWNER_FALSE_SIGNOFF")

    if not claim:
        return
    if claim.get("production_approved") is True and not (armed and evidence):
        raise RuntimeError("LAUNCH_RELEASE_PRODUCTION_APPROVED")
    if claim.get("flag_armed") is True and not evidence:
        raise RuntimeError("LAUNCH_RELEASE_FLAG_ARMED_WITHOUT_EVIDENCE")
    if claim.get("next_20_done") is True and not (armed and evidence):
        raise RuntimeError("NEXT_20_FALSE_DONE")
    if claim.get("owner_signed") is True and not owner_signed():
        raise RuntimeError("OWNER_FALSE_SIGNOFF")
