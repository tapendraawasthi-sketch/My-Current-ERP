"""PR-B4 — calc/preview residual (ADR_0087 / GAP-P2-002)."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from oip.modules.conversation.application.calc_preview_residual_policy import (
    AUTHORITY,
    DECISION,
    REGISTER_GAP_STATUS,
    assert_calc_preview_residual_honesty,
    calc_preview_residual_observability,
    load_calc_preview_residual_registry,
    load_run_status,
)

ROOT = Path(__file__).resolve().parents[4]


def test_registry_and_honesty() -> None:
    reg = load_calc_preview_residual_registry()
    assert reg["authority"] == AUTHORITY
    assert reg["decision"] == DECISION
    assert reg["gap_p2_002"]["register_status"] == REGISTER_GAP_STATUS
    assert reg["gap_p2_002"]["closed"] is False
    assert reg["policies"]["ui_calculates_authoritative_totals"] is False
    assert reg["policies"]["known_paisa_drift_on_launch_fixtures"] is False
    assert reg["honesty"]["gap_p2_002_closed"] is False
    assert_calc_preview_residual_honesty()
    with pytest.raises(RuntimeError, match="PRODUCTION_APPROVED"):
        assert_calc_preview_residual_honesty({"production_approved": True})
    with pytest.raises(RuntimeError, match="FALSE_CLOSED"):
        assert_calc_preview_residual_honesty({"gap_p2_002_closed": True})
    with pytest.raises(RuntimeError, match="UI_AUTHORITATIVE"):
        assert_calc_preview_residual_honesty(
            {"ui_calculates_authoritative_totals": True}
        )
    with pytest.raises(RuntimeError, match="KNOWN_PAISA_DRIFT"):
        assert_calc_preview_residual_honesty(
            {"known_paisa_drift_on_launch_fixtures": True}
        )


def test_artifacts_and_spotcheck() -> None:
    run = load_run_status()
    assert run["engineering_pack_ready"] is True
    assert run["gap_p2_002_closed"] is False
    assert run["known_paisa_drift_on_launch_fixtures"] is False
    art = ROOT / "artifacts" / "prod-ready-pr-b4"
    assert (art / "PAISA_SPOTCHECK.md").is_file()
    assert (art / "RUN_STATUS.json").is_file()
    spot = (art / "PAISA_SPOTCHECK.md").read_text(encoding="utf-8")
    assert "0" in spot
    assert "LAUNCH_SALE" in spot or "paisa" in spot.lower()


def test_labels_wired_to_constants() -> None:
    form = (
        ROOT / "src" / "components" / "invoice" / "SalesInvoiceForm.tsx"
    ).read_text(encoding="utf-8")
    assert "INVOICE_FORM_TOTALS_DISCLAIMER" in form
    card = (
        ROOT / "src" / "components" / "ekhata" / "OrbixJournalCard.tsx"
    ).read_text(encoding="utf-8")
    assert "ORBIX_CONFIRM_PREVIEW_HEADING" in card
    assert "ORBIX_CONFIRM_PREVIEW_HINT" in card
    assert "Authoritative preview" not in card


def test_gap_and_pointer_pr_b5() -> None:
    gap = (ROOT / "docs" / "mokxya-ai" / "MAI_00_GAP_REGISTER.md").read_text(
        encoding="utf-8"
    )
    section = gap.split("### GAP-P2-002")[1].split("### ")[0]
    assert "**Status:** REDUCED" in section
    assert "ADR_0087" in section or "PR-B4" in section
    assert section.count("**Status:** CLOSED") == 0

    obs = calc_preview_residual_observability()
    assert obs["calc_preview_residual_adr"] == "ADR_0087"
    assert obs["gap_p2_002_closed"] is False
    assert obs["known_paisa_drift_on_launch_fixtures"] is False

    baseline = (
        ROOT / "docs" / "mokxya-ai" / "baselines" / "PR_B4_CALC_PREVIEW_RESIDUAL.md"
    )
    assert baseline.is_file()

    ledger = json.loads(
        (ROOT / "docs" / "mokxya-ai" / "MAI_PHASE_LEDGER.json").read_text(
            encoding="utf-8"
        )
    )
    assert ledger["recommended_next_step"] == "PR-C1-ARM"
    assert "PR-B4" in ledger.get("completed_next_steps", [])
    assert ledger.get("calc_preview_residual", {}).get("authority") == "ADR_0087"

    matrix = json.loads(
        (
            ROOT / "docs" / "mokxya-ai" / "MAI_CAPABILITY_TRUTH_MATRIX.json"
        ).read_text(encoding="utf-8")
    )
    assert matrix["recommended_next_step"] == "PR-C1-ARM"
    assert "PR-B4" in matrix.get("completed_steps", [])
    gaps = {g["id"]: g for g in matrix["blocking_gaps"]}
    assert gaps["GAP-P2-002"]["status"] == "REDUCED"

    plan = (
        ROOT / "MOKXYA_AI_PRODUCTION_READY_EXECUTION_PLAN_V1.txt"
    ).read_text(encoding="utf-8")
    assert "recommended_next_step = PR-C1-ARM" in plan
    assert "last_shipped_step = PR-C3-PACK" in plan
