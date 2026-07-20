"""PR-C1 — launch sales/purchase release package (ADR_0090; armed via ADR_0100)."""

from __future__ import annotations

import json
import os
from pathlib import Path

import pytest

from oip.modules.conversation.application.launch_sales_purchase_release_policy import (
    AUTHORITY,
    CAPABILITY_ROW,
    DECISION,
    ENV_FLAG,
    assert_launch_sales_purchase_release_honesty,
    is_launch_sales_purchase_production_approved,
    launch_sales_purchase_release_observability,
    load_launch_sales_purchase_release_registry,
    load_run_status,
    owner_signed,
)

ROOT = Path(__file__).resolve().parents[4]


def test_registry_armed_and_honesty() -> None:
    load_launch_sales_purchase_release_registry.cache_clear()
    reg = load_launch_sales_purchase_release_registry()
    assert reg["authority"] == AUTHORITY
    assert reg["decision"] == DECISION
    assert reg["capability_row"] == CAPABILITY_ROW
    assert reg["flag"]["armed"] is True
    assert reg["flag"]["production_approved"] is True
    assert reg["honesty"]["next_20_done"] is True
    assert owner_signed() is True
    assert_launch_sales_purchase_release_honesty()
    # Without env, runtime gate stays false
    os.environ.pop(ENV_FLAG, None)
    assert is_launch_sales_purchase_production_approved() is False
    os.environ[ENV_FLAG] = "true"
    try:
        assert is_launch_sales_purchase_production_approved() is True
    finally:
        os.environ.pop(ENV_FLAG, None)


def test_dossier_and_artifacts() -> None:
    run = load_run_status()
    assert run["engineering_pack_ready"] is True
    assert run["flag_armed"] is True
    assert run["production_approved"] is True
    assert run["owner_signed"] is True
    dossier = (
        ROOT
        / "docs"
        / "mokxya-ai"
        / "releases"
        / "LAUNCH_ACCOUNTANT_SALES_PURCHASE_V1.md"
    )
    assert dossier.is_file()
    art = ROOT / "artifacts" / "prod-ready-pr-c1"
    assert (art / "OWNER_SIGNOFF.md").is_file()
    assert "SIGNED" in (art / "OWNER_SIGNOFF.md").read_text(encoding="utf-8")


def test_pointer_after_arm() -> None:
    obs = launch_sales_purchase_release_observability()
    assert obs["launch_release_adr"] == "ADR_0090"
    assert obs["flag_armed"] is True
    assert obs["arm_evidence_complete"] is True

    ledger = json.loads(
        (ROOT / "docs" / "mokxya-ai" / "MAI_PHASE_LEDGER.json").read_text(
            encoding="utf-8"
        )
    )
    assert ledger["recommended_next_step"] == "PR-C3-RUN"
    assert "PR-C1-ARM" in ledger.get("completed_next_steps", [])
    assert ledger.get("launch_sales_purchase_release", {}).get("flag_armed") is True

    matrix = json.loads(
        (
            ROOT / "docs" / "mokxya-ai" / "MAI_CAPABILITY_TRUTH_MATRIX.json"
        ).read_text(encoding="utf-8")
    )
    assert matrix["recommended_next_step"] == "PR-C3-RUN"
    rows = {r["id"]: r for r in matrix["launch_capability_candidates"]}
    row = rows["LAUNCH-ACCOUNTANT-SALES-PURCHASE"]
    assert row["production_approved"] is True
    assert row["depth"] == "PRODUCTION"
    assert matrix["counts"]["launch_rows_production"] == 1

    plan = (
        ROOT / "MOKXYA_AI_PRODUCTION_READY_EXECUTION_PLAN_V1.txt"
    ).read_text(encoding="utf-8")
    assert "recommended_next_step = PR-C3-RUN" in plan
    assert "last_shipped_step = PR-C1-ARM" in plan
