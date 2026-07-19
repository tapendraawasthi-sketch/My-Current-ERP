"""NEXT-11 — calc authority honesty (ADR_0078 / GAP-P2-002 REDUCED)."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from oip.modules.conversation.application.calc_authority_policy import (
    AUTHORITY,
    CALC_ON_CONFIRM,
    DECISION,
    REGISTER_GAP_STATUS,
    assert_calc_authority_honesty,
    calc_authority_observability,
    edit_loop_may_invent,
    load_calc_authority_registry,
)

ROOT = Path(__file__).resolve().parents[4]


def test_registry_owners_and_gap_reduced() -> None:
    reg = load_calc_authority_registry()
    assert reg["authority"] == AUTHORITY
    assert reg["decision"] == DECISION
    assert reg["gap_p2_002"]["register_status"] == REGISTER_GAP_STATUS
    assert reg["gap_p2_002"]["closed"] is False
    owners = {f["calc_owner"] for f in reg["flows"]}
    assert "DEXIE_DOMAIN_ENGINE" in owners
    assert "UI_DISPLAY_ESTIMATE" in owners
    assert reg["policies"]["calc_authority_on_confirm"] == CALC_ON_CONFIRM
    assert reg["policies"]["ui_calculates_authoritative_totals"] is False
    assert reg["policies"]["edit_loop_invents_party_or_amount"] is False
    assert reg["honesty"]["production_approved"] is False


def test_honesty_rejects_false_claims() -> None:
    assert_calc_authority_honesty()
    with pytest.raises(RuntimeError, match="UI_AUTHORITATIVE"):
        assert_calc_authority_honesty({"ui_calculates_authoritative_totals": True})
    with pytest.raises(RuntimeError, match="AI_JOURNAL_MATH"):
        assert_calc_authority_honesty({"ai_journal_math_allowed": True})
    with pytest.raises(RuntimeError, match="EDIT_LOOP_INVENTION"):
        assert_calc_authority_honesty({"edit_loop_invents_party_or_amount": True})
    with pytest.raises(RuntimeError, match="GAP_P2_002_FALSE_CLOSED"):
        assert_calc_authority_honesty({"gap_p2_002_closed": True})
    with pytest.raises(RuntimeError, match="EDIT_LOOP_INVENTION"):
        assert_calc_authority_honesty({"invented_party": "Ram"})


def test_edit_loop_never_invents() -> None:
    assert edit_loop_may_invent(None, None) is False
    assert edit_loop_may_invent("", 0) is False
    assert edit_loop_may_invent("Ram", 500) is False


def test_observability_and_adr_baseline() -> None:
    obs = calc_authority_observability()
    assert obs["calc_authority_adr"] == "ADR_0078"
    assert obs["calc_authority_on_confirm"] == "DEXIE_DOMAIN_ENGINE"
    assert obs["ui_calculates_authoritative_totals"] is False
    assert obs["gap_p2_002_register_status"] == "REDUCED"
    assert obs["gap_p2_002_closed"] is False
    assert obs["production_approved"] is False

    adr = (
        ROOT
        / "docs"
        / "mokxya-ai"
        / "decisions"
        / "ADR_0078_CALC_AUTHORITY_HONESTY.md"
    )
    assert adr.is_file()
    text = adr.read_text(encoding="utf-8")
    assert "REDUCED" in text
    assert "DEXIE_DOMAIN_ENGINE" in text

    baseline = (
        ROOT / "docs" / "mokxya-ai" / "baselines" / "NEXT_11_CALC_AUTHORITY_HONESTY.md"
    )
    assert baseline.is_file()


def test_gap_register_and_pointer_next12() -> None:
    gap = (ROOT / "docs" / "mokxya-ai" / "MAI_00_GAP_REGISTER.md").read_text(
        encoding="utf-8"
    )
    section = gap.split("### GAP-P2-002")[1].split("### GAP-P2-003")[0]
    assert "**Status:** REDUCED" in section
    assert "CLOSED" in section  # residual honesty: still not CLOSED
    assert section.count("**Status:** CLOSED") == 0

    ledger = json.loads(
        (ROOT / "docs" / "mokxya-ai" / "MAI_PHASE_LEDGER.json").read_text(
            encoding="utf-8"
        )
    )
    assert ledger["recommended_next_step"] == "PR-B5"
    assert "NEXT-11" in ledger.get("completed_next_steps", [])
    assert ledger.get("calc_authority", {}).get("authority") == "ADR_0078"
    assert ledger.get("calc_authority", {}).get("gap_p2_002_register_status") == "REDUCED"

    matrix = json.loads(
        (
            ROOT / "docs" / "mokxya-ai" / "MAI_CAPABILITY_TRUTH_MATRIX.json"
        ).read_text(encoding="utf-8")
    )
    assert matrix["recommended_next_step"] == "PR-B5"
    assert "NEXT-11" in matrix.get("completed_steps", [])
    gaps = {g["id"]: g for g in matrix["blocking_gaps"]}
    assert gaps["GAP-P2-002"]["status"] == "REDUCED"


def test_ui_label_strings_present() -> None:
    form = (
        ROOT / "src" / "components" / "invoice" / "SalesInvoiceForm.tsx"
    ).read_text(encoding="utf-8")
    assert "INVOICE_FORM_TOTALS_DISCLAIMER" in form
    assert "Display estimate" in form or "INVOICE_FORM_TOTALS_DISCLAIMER" in form
    assert "domain engine" in form.lower() or "INVOICE_FORM_TOTALS_DISCLAIMER" in form

    card = (
        ROOT / "src" / "components" / "ekhata" / "OrbixJournalCard.tsx"
    ).read_text(encoding="utf-8")
    assert "ORBIX_CONFIRM_PREVIEW_HEADING" in card
    assert "Authoritative preview" not in card
