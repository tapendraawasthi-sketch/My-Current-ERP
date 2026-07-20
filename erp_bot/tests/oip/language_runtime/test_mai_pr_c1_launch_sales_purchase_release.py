"""PR-C1 — launch sales/purchase release package (ADR_0090; flag OFF)."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from oip.modules.conversation.application.launch_sales_purchase_release_policy import (
    AUTHORITY,
    CAPABILITY_ROW,
    DECISION,
    assert_launch_sales_purchase_release_honesty,
    is_launch_sales_purchase_production_approved,
    launch_sales_purchase_release_observability,
    load_launch_sales_purchase_release_registry,
    load_run_status,
)

ROOT = Path(__file__).resolve().parents[4]


def test_registry_and_honesty() -> None:
    reg = load_launch_sales_purchase_release_registry()
    assert reg["authority"] == AUTHORITY
    assert reg["decision"] == DECISION
    assert reg["capability_row"] == CAPABILITY_ROW
    assert reg["flag"]["armed"] is False
    assert reg["flag"]["production_approved"] is False
    assert reg["honesty"]["next_20_done"] is False
    assert is_launch_sales_purchase_production_approved() is False
    assert_launch_sales_purchase_release_honesty()
    with pytest.raises(RuntimeError, match="PRODUCTION_APPROVED"):
        assert_launch_sales_purchase_release_honesty({"production_approved": True})
    with pytest.raises(RuntimeError, match="FLAG_ARMED"):
        assert_launch_sales_purchase_release_honesty({"flag_armed": True})
    with pytest.raises(RuntimeError, match="NEXT_20"):
        assert_launch_sales_purchase_release_honesty({"next_20_done": True})
    with pytest.raises(RuntimeError, match="OWNER"):
        assert_launch_sales_purchase_release_honesty({"owner_signed": True})


def test_dossier_and_artifacts() -> None:
    run = load_run_status()
    assert run["engineering_pack_ready"] is True
    assert run["flag_armed"] is False
    assert run["production_approved"] is False
    dossier = (
        ROOT
        / "docs"
        / "mokxya-ai"
        / "releases"
        / "LAUNCH_ACCOUNTANT_SALES_PURCHASE_V1.md"
    )
    assert dossier.is_file()
    text = dossier.read_text(encoding="utf-8")
    assert "Rollback" in text
    assert "Monitoring" in text
    assert "nl_assent" in text.lower() or "does not post" in text.lower()
    art = ROOT / "artifacts" / "prod-ready-pr-c1"
    assert (art / "SIGN_NOTE.md").is_file()
    assert (art / "BLOCKING_TICKETS.md").is_file()
    assert (art / "OWNER_SIGNOFF.md").is_file()
    assert "PENDING" in (art / "OWNER_SIGNOFF.md").read_text(encoding="utf-8")


def test_gap_pointer_pr_c1_arm() -> None:
    obs = launch_sales_purchase_release_observability()
    assert obs["launch_release_adr"] == "ADR_0090"
    assert obs["runtime_production_approved"] is False
    assert obs["flag_armed"] is False

    baseline = (
        ROOT
        / "docs"
        / "mokxya-ai"
        / "baselines"
        / "PR_C1_LAUNCH_SALES_PURCHASE_RELEASE_PACKAGE.md"
    )
    assert baseline.is_file()

    ledger = json.loads(
        (ROOT / "docs" / "mokxya-ai" / "MAI_PHASE_LEDGER.json").read_text(
            encoding="utf-8"
        )
    )
    assert ledger["recommended_next_step"] == "PR-C1-ARM"
    assert "PR-C1" in ledger.get("completed_next_steps", [])
    assert ledger.get("launch_sales_purchase_release", {}).get("authority") == "ADR_0090"
    assert ledger.get("launch_sales_purchase_release", {}).get("flag_armed") is False

    matrix = json.loads(
        (
            ROOT / "docs" / "mokxya-ai" / "MAI_CAPABILITY_TRUTH_MATRIX.json"
        ).read_text(encoding="utf-8")
    )
    assert matrix["recommended_next_step"] == "PR-C1-ARM"
    assert "PR-C1" in matrix.get("completed_steps", [])
    rows = {r["id"]: r for r in matrix["launch_capability_candidates"]}
    row = rows["LAUNCH-ACCOUNTANT-SALES-PURCHASE"]
    assert row["production_approved"] is False
    assert row["depth"] == "ANNOTATION_ONLY"
    assert matrix["counts"]["launch_rows_production"] == 0
    assert matrix["counts"]["production_approved_true"] == 0

    plan = (
        ROOT / "MOKXYA_AI_PRODUCTION_READY_EXECUTION_PLAN_V1.txt"
    ).read_text(encoding="utf-8")
    assert "recommended_next_step = PR-C1-ARM" in plan
    assert "last_shipped_step = PR-D2" in plan
    assert "production_approved = false" in plan

    nxt = (ROOT / "MOKXYA_AI_WHAT_MUST_BE_DONE_NEXT_V1.txt").read_text(
        encoding="utf-8"
    )
    assert "recommended_next_step = PR-C1-ARM" in nxt
    assert "NEXT-20" in nxt
