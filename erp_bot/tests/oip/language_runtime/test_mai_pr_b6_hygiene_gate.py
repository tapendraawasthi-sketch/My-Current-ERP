"""PR-B6 — hygiene gate (ADR_0089 / NEXT-H1 / NEXT-H2)."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from oip.modules.conversation.application.hygiene_gate_policy import (
    AUTHORITY,
    DECISION,
    assert_hygiene_gate_honesty,
    hygiene_gate_observability,
    load_hygiene_gate_registry,
    load_run_status,
)

ROOT = Path(__file__).resolve().parents[4]


def test_registry_and_honesty() -> None:
    reg = load_hygiene_gate_registry()
    assert reg["authority"] == AUTHORITY
    assert reg["decision"] == DECISION
    assert reg["gap_p1_005"]["register_status"] == "REDUCED"
    assert reg["gap_p2_004"]["register_status"] == "REDUCED"
    assert reg["gap_p2_004"]["invoice_print_syntax_fixed"] is True
    assert reg["honesty"]["full_tsc_green_claimed"] is False
    assert reg["honesty"]["vacuous_greens_allowed"] is False
    assert_hygiene_gate_honesty()
    with pytest.raises(RuntimeError, match="PRODUCTION_APPROVED"):
        assert_hygiene_gate_honesty({"production_approved": True})
    with pytest.raises(RuntimeError, match="FULL_TSC_GREEN"):
        assert_hygiene_gate_honesty({"full_tsc_green_claimed": True})
    with pytest.raises(RuntimeError, match="VACUOUS_GREENS"):
        assert_hygiene_gate_honesty({"vacuous_greens_allowed": True})
    with pytest.raises(RuntimeError, match="FALSE_CLOSED"):
        assert_hygiene_gate_honesty({"gap_p2_004_closed": True})


def test_artifacts_and_ci_story() -> None:
    run = load_run_status()
    assert run["engineering_pack_ready"] is True
    assert run["invoice_print_syntax_fixed"] is True
    assert run["full_tsc_green_claimed"] is False
    art = ROOT / "artifacts" / "prod-ready-pr-b6"
    assert (art / "CI_STORY.md").is_file()
    assert (art / "RUN_STATUS.json").is_file()
    assert (art / "TSC_INVENTORY.txt").is_file()
    story = (art / "CI_STORY.md").read_text(encoding="utf-8")
    assert "test:prod-ready-honesty" in story
    assert "test:prod-ready-orbix" in story
    assert (ROOT / "scripts" / "run_prod_ready_hygiene.sh").is_file()
    assert (ROOT / ".github" / "workflows" / "prod-ready-hygiene.yml").is_file()
    pkg = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))
    assert "test:prod-ready-honesty" in pkg["scripts"]
    assert "test:prod-ready-orbix" in pkg["scripts"]


def test_gap_and_pointer_pr_c1() -> None:
    gap = (ROOT / "docs" / "mokxya-ai" / "MAI_00_GAP_REGISTER.md").read_text(
        encoding="utf-8"
    )
    p1 = gap.split("### GAP-P1-005")[1].split("### ")[0]
    assert "**Status:** REDUCED" in p1
    assert "PR-B6" in p1 or "ADR_0089" in p1
    p2 = gap.split("### GAP-P2-004")[1].split("### ")[0]
    assert "**Status:** REDUCED" in p2
    assert "InvoicePrint" in p2 or "invoice" in p2.lower()
    assert p2.count("**Status:** CLOSED") == 0

    obs = hygiene_gate_observability()
    assert obs["hygiene_gate_adr"] == "ADR_0089"
    assert obs["invoice_print_syntax_fixed"] is True
    assert obs["full_tsc_green_claimed"] is False

    baseline = ROOT / "docs" / "mokxya-ai" / "baselines" / "PR_B6_HYGIENE_GATE.md"
    assert baseline.is_file()

    ledger = json.loads(
        (ROOT / "docs" / "mokxya-ai" / "MAI_PHASE_LEDGER.json").read_text(
            encoding="utf-8"
        )
    )
    assert ledger["recommended_next_step"] == "PR-C1"
    assert "PR-B6" in ledger.get("completed_next_steps", [])
    assert ledger.get("hygiene_gate", {}).get("authority") == "ADR_0089"

    matrix = json.loads(
        (
            ROOT / "docs" / "mokxya-ai" / "MAI_CAPABILITY_TRUTH_MATRIX.json"
        ).read_text(encoding="utf-8")
    )
    assert matrix["recommended_next_step"] == "PR-C1"
    assert "PR-B6" in matrix.get("completed_steps", [])

    plan = (
        ROOT / "MOKXYA_AI_PRODUCTION_READY_EXECUTION_PLAN_V1.txt"
    ).read_text(encoding="utf-8")
    assert "recommended_next_step = PR-C1" in plan
    assert "last_shipped_step = PR-B6" in plan
