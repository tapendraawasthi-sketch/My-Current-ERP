"""NEXT-11 / ADR_0078 — calc authority honesty (GAP-P2-002 REDUCED).

Does not post, preview, or invent parties/amounts.
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any, Mapping

AUTHORITY = "ADR_0078"
STEP = "NEXT-11"
DECISION = "DEXIE_DOMAIN_ENGINE_CALC_ON_CONFIRM"
REGISTER_GAP_STATUS = "REDUCED"
CALC_ON_CONFIRM = "DEXIE_DOMAIN_ENGINE"


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[6]


def registry_path() -> Path:
    return _repo_root() / "docs" / "mokxya-ai" / "MAI_CALC_AUTHORITY_REGISTRY.json"


@lru_cache(maxsize=1)
def load_calc_authority_registry() -> dict[str, Any]:
    path = registry_path()
    data = json.loads(path.read_text(encoding="utf-8"))
    if data.get("authority") != AUTHORITY:
        raise RuntimeError("CALC_AUTHORITY_REGISTRY_AUTHORITY_MISMATCH")
    if data.get("decision") != DECISION:
        raise RuntimeError("CALC_AUTHORITY_DECISION_MISMATCH")
    return data


def calc_authority_observability() -> dict[str, Any]:
    reg = load_calc_authority_registry()
    pol = reg["policies"]
    return {
        "calc_authority_step": STEP,
        "calc_authority_adr": AUTHORITY,
        "calc_authority_decision": reg["decision"],
        "calc_authority_on_confirm": CALC_ON_CONFIRM,
        "ui_calculates_authoritative_totals": False,
        "ai_journal_math_allowed": False,
        "edit_loop_invents_party_or_amount": False,
        "gap_p2_002_register_status": REGISTER_GAP_STATUS,
        "gap_p2_002_closed": False,
        "production_approved": False,
        "stale_preview_on_confirm": pol["stale_preview_on_confirm"],
    }


def assert_calc_authority_honesty(claim: Mapping[str, Any] | None = None) -> None:
    reg = load_calc_authority_registry()
    if reg["gap_p2_002"].get("register_status") != REGISTER_GAP_STATUS:
        raise RuntimeError("GAP_P2_002_REGISTER_MUST_BE_REDUCED")
    if reg["gap_p2_002"].get("closed") is True:
        raise RuntimeError("GAP_P2_002_FALSE_CLOSED")
    if reg["policies"].get("ui_calculates_authoritative_totals") is True:
        raise RuntimeError("UI_AUTHORITATIVE_TOTALS_FORBIDDEN")
    if reg["policies"].get("ai_journal_math_allowed") is True:
        raise RuntimeError("AI_JOURNAL_MATH_FORBIDDEN")
    if reg["policies"].get("edit_loop_invents_party_or_amount") is True:
        raise RuntimeError("EDIT_LOOP_INVENTION_FORBIDDEN")
    if reg["policies"].get("calc_authority_on_confirm") != CALC_ON_CONFIRM:
        raise RuntimeError("CALC_ON_CONFIRM_MUST_BE_DEXIE_DOMAIN_ENGINE")
    if reg["honesty"].get("production_approved") is True:
        raise RuntimeError("CALC_AUTHORITY_PRODUCTION_APPROVED")

    owners = {f["calc_owner"] for f in reg["flows"]}
    if "DEXIE_DOMAIN_ENGINE" not in owners:
        raise RuntimeError("CALC_AUTHORITY_FLOWS_MISSING_DEXIE")
    if "UI_DISPLAY_ESTIMATE" not in owners:
        raise RuntimeError("CALC_AUTHORITY_FLOWS_MISSING_UI_ESTIMATE")

    if not claim:
        return
    if claim.get("ui_calculates_authoritative_totals") is True:
        raise RuntimeError("UI_AUTHORITATIVE_TOTALS_FORBIDDEN")
    if claim.get("ai_journal_math_allowed") is True:
        raise RuntimeError("AI_JOURNAL_MATH_FORBIDDEN")
    if claim.get("edit_loop_invents_party_or_amount") is True:
        raise RuntimeError("EDIT_LOOP_INVENTION_FORBIDDEN")
    if claim.get("gap_p2_002_closed") is True:
        raise RuntimeError("GAP_P2_002_FALSE_CLOSED")
    if claim.get("invented_party") or claim.get("invented_amount"):
        raise RuntimeError("EDIT_LOOP_INVENTION_FORBIDDEN")


def edit_loop_may_invent(party: str | None, amount: Any) -> bool:
    """Always false — missing fields must clarify, never invent."""
    _ = (party, amount)
    return False
