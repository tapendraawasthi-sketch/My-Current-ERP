"""PR-C1-ARM — ARMED (ADR_0100); prior blocked attempt was ADR_0091."""

from __future__ import annotations

import json
from pathlib import Path

from oip.modules.conversation.application.pr_c1_arm_attempt_policy import (
    AUTHORITY,
    DECISION,
    assert_pr_c1_arm_attempt_honesty,
    load_pr_c1_arm_attempt_registry,
    load_run_status,
    pr_c1_arm_attempt_observability,
)

ROOT = Path(__file__).resolve().parents[4]


def test_registry_armed_and_honesty() -> None:
    load_pr_c1_arm_attempt_registry.cache_clear()
    reg = load_pr_c1_arm_attempt_registry()
    assert reg["authority"] == AUTHORITY
    assert reg["decision"] == DECISION
    assert reg["attempt_status"] == "ARMED"
    assert reg["flag"]["armed"] is True
    assert reg["flag"]["production_approved"] is True
    assert_pr_c1_arm_attempt_honesty()


def test_artifacts_and_pointer() -> None:
    run = load_run_status()
    assert run["attempt_status"] == "ARMED"
    assert run["flag_armed"] is True
    art = ROOT / "artifacts" / "prod-ready-pr-c1-arm"
    assert (art / "ARM_ATTEMPT.md").is_file()
    assert "ARMED" in (art / "ARM_ATTEMPT.md").read_text(encoding="utf-8")
    assert (art / "OWNER_RESIDUAL_ACCEPTANCE_B1_002.md").is_file()

    obs = pr_c1_arm_attempt_observability()
    assert obs["pr_c1_arm_adr"] == "ADR_0100"
    assert obs["attempt_status"] == "ARMED"
    assert obs["arm_evidence_complete"] is True

    ledger = json.loads(
        (ROOT / "docs" / "mokxya-ai" / "MAI_PHASE_LEDGER.json").read_text(
            encoding="utf-8"
        )
    )
    assert ledger["recommended_next_step"] == "PR-C3-RUN"
    assert "PR-C1-ARM" in ledger.get("completed_next_steps", [])
    assert ledger.get("pr_c1_arm_attempt", {}).get("attempt_status") == "ARMED"
    assert ledger.get("launch_sales_purchase_release", {}).get("flag_armed") is True

    matrix = json.loads(
        (
            ROOT / "docs" / "mokxya-ai" / "MAI_CAPABILITY_TRUTH_MATRIX.json"
        ).read_text(encoding="utf-8")
    )
    assert matrix["recommended_next_step"] == "PR-C3-RUN"
    rows = {r["id"]: r for r in matrix["launch_capability_candidates"]}
    assert rows["LAUNCH-ACCOUNTANT-SALES-PURCHASE"]["production_approved"] is True
    assert rows["LAUNCH-ACCOUNTANT-SALES-PURCHASE"]["depth"] == "PRODUCTION"
    assert matrix["counts"]["launch_rows_production"] == 1

    plan = (
        ROOT / "MOKXYA_AI_PRODUCTION_READY_EXECUTION_PLAN_V1.txt"
    ).read_text(encoding="utf-8")
    assert "recommended_next_step = PR-C3-RUN" in plan
    assert "last_shipped_step = PR-C1-ARM" in plan
