"""PR-C2 / ADR_0092 — Ask company reports release package (flag OFF)."""

from __future__ import annotations

import json
import os
from functools import lru_cache
from pathlib import Path
from typing import Any, Mapping

AUTHORITY = "ADR_0092"
STEP = "PR-C2"
DECISION = "LAUNCH_ASK_COMPANY_REPORTS_RELEASE_PACKAGE"
CAPABILITY_ROW = "LAUNCH-ASK-COMPANY-REPORTS"
ENV_FLAG = "LAUNCH_ASK_COMPANY_REPORTS_PRODUCTION_APPROVED"

DISCLOSURES = (
    "Ask Mode is zero mutation — never posts or drafts sales/purchase.",
    "Natural-language yes does not post.",
    "Legal and tax-current answers may abstain.",
    "Production retrieval is LEXICAL_ONLY.",
    "Ungrounded claims force abstain / citation honesty.",
)


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[6]


def registry_path() -> Path:
    return (
        _repo_root()
        / "docs"
        / "mokxya-ai"
        / "MAI_LAUNCH_ASK_COMPANY_REPORTS_RELEASE_REGISTRY.json"
    )


def run_status_path() -> Path:
    return _repo_root() / "artifacts" / "prod-ready-pr-c2" / "RUN_STATUS.json"


def owner_signoff_path() -> Path:
    return _repo_root() / "artifacts" / "prod-ready-pr-c2" / "OWNER_SIGNOFF.md"


@lru_cache(maxsize=1)
def load_launch_ask_company_reports_release_registry() -> dict[str, Any]:
    data = json.loads(registry_path().read_text(encoding="utf-8"))
    if data.get("authority") != AUTHORITY:
        raise RuntimeError("ASK_REPORTS_RELEASE_REGISTRY_AUTHORITY_MISMATCH")
    if data.get("decision") != DECISION:
        raise RuntimeError("ASK_REPORTS_RELEASE_DECISION_MISMATCH")
    return data


def load_run_status() -> dict[str, Any]:
    return json.loads(run_status_path().read_text(encoding="utf-8"))


def blocking_tickets_clear(reg: Mapping[str, Any] | None = None) -> bool:
    reg = reg or load_launch_ask_company_reports_release_registry()
    tickets = reg.get("blocking_tickets") or {}
    return bool(tickets) and all(str(v).upper() == "PASS" for v in tickets.values())


def owner_signed() -> bool:
    text = owner_signoff_path().read_text(encoding="utf-8")
    return "**Status:** SIGNED" in text or "**Status:**SIGNED" in text


def env_flag_true() -> bool:
    return os.environ.get(ENV_FLAG, "").strip().lower() in {"1", "true", "yes", "on"}


def is_launch_ask_company_reports_production_approved() -> bool:
    """Runtime gate: registry armed + tickets + owner + env. Defaults false."""
    reg = load_launch_ask_company_reports_release_registry()
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


def launch_ask_company_reports_release_observability() -> dict[str, Any]:
    reg = load_launch_ask_company_reports_release_registry()
    run = load_run_status()
    return {
        "launch_release_step": STEP,
        "launch_release_adr": AUTHORITY,
        "launch_release_decision": reg["decision"],
        "capability_row": CAPABILITY_ROW,
        "flag_armed": bool(reg.get("flag", {}).get("armed")),
        "production_approved": False,
        "runtime_production_approved": is_launch_ask_company_reports_production_approved(),
        "next_20_done": False,
        "owner_signed": owner_signed(),
        "blocking_tickets_clear": blocking_tickets_clear(reg),
        "engineering_pack_ready": bool(run.get("engineering_pack_ready")),
        "zero_mutation": True,
        "disclosures": list(DISCLOSURES),
        "is_execution_authority": False,
    }


def assert_launch_ask_company_reports_release_honesty(
    claim: Mapping[str, Any] | None = None,
) -> None:
    reg = load_launch_ask_company_reports_release_registry()
    run = load_run_status()
    honesty = reg.get("honesty") or {}
    if honesty.get("production_approved") is True or run.get("production_approved") is True:
        raise RuntimeError("ASK_REPORTS_RELEASE_PRODUCTION_APPROVED")
    if honesty.get("flag_armed") is True or run.get("flag_armed") is True:
        raise RuntimeError("ASK_REPORTS_RELEASE_FLAG_ARMED")
    if honesty.get("next_20_done") is True or run.get("next_20_done") is True:
        raise RuntimeError("NEXT_20_FALSE_DONE")
    if honesty.get("owner_signed") is True and not owner_signed():
        raise RuntimeError("OWNER_FALSE_SIGNOFF")
    if reg.get("flag", {}).get("armed") is True and not blocking_tickets_clear(reg):
        raise RuntimeError("FLAG_ARMED_WITH_OPEN_TICKETS")
    if is_launch_ask_company_reports_production_approved():
        raise RuntimeError("RUNTIME_PRODUCTION_APPROVED_UNEXPECTED")
    if not claim:
        return
    if claim.get("production_approved") is True:
        raise RuntimeError("ASK_REPORTS_RELEASE_PRODUCTION_APPROVED")
    if claim.get("flag_armed") is True:
        raise RuntimeError("ASK_REPORTS_RELEASE_FLAG_ARMED")
    if claim.get("next_20_done") is True:
        raise RuntimeError("NEXT_20_FALSE_DONE")
    if claim.get("owner_signed") is True and not owner_signed():
        raise RuntimeError("OWNER_FALSE_SIGNOFF")
