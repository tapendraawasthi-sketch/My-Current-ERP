"""PR-C1-ARM attempt — BLOCKED (ADR_0091); no false flip."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from oip.modules.conversation.application.launch_sales_purchase_release_policy import (
    is_launch_sales_purchase_production_approved,
)
from oip.modules.conversation.application.pr_c1_arm_attempt_policy import (
    AUTHORITY,
    DECISION,
    assert_pr_c1_arm_attempt_honesty,
    load_pr_c1_arm_attempt_registry,
    load_run_status,
    pr_c1_arm_attempt_observability,
)

ROOT = Path(__file__).resolve().parents[4]


def test_registry_blocked_and_honesty() -> None:
    reg = load_pr_c1_arm_attempt_registry()
    assert reg["authority"] == AUTHORITY
    assert reg["decision"] == DECISION
    assert reg["attempt_status"] == "BLOCKED"
    assert reg["flag"]["armed"] is False
    assert reg["flag"]["production_approved"] is False
    assert is_launch_sales_purchase_production_approved() is False
    assert_pr_c1_arm_attempt_honesty()
    with pytest.raises(RuntimeError, match="PRODUCTION_APPROVED"):
        assert_pr_c1_arm_attempt_honesty({"production_approved": True})
    with pytest.raises(RuntimeError, match="FLAG_ARMED"):
        assert_pr_c1_arm_attempt_honesty({"flag_armed": True})
    with pytest.raises(RuntimeError, match="NEXT_20"):
        assert_pr_c1_arm_attempt_honesty({"next_20_done": True})
    with pytest.raises(RuntimeError, match="FALSE_PASS"):
        assert_pr_c1_arm_attempt_honesty({"attempt_status": "PASS"})


def test_artifacts_and_pointer_still_arm() -> None:
    run = load_run_status()
    assert run["attempt_status"] == "BLOCKED"
    assert run["flag_armed"] is False
    art = ROOT / "artifacts" / "prod-ready-pr-c1-arm"
    assert (art / "ARM_ATTEMPT.md").is_file()
    assert "BLOCKED" in (art / "ARM_ATTEMPT.md").read_text(encoding="utf-8")

    obs = pr_c1_arm_attempt_observability()
    assert obs["pr_c1_arm_adr"] == "ADR_0091"
    assert obs["attempt_status"] == "BLOCKED"

    ledger = json.loads(
        (ROOT / "docs" / "mokxya-ai" / "MAI_PHASE_LEDGER.json").read_text(
            encoding="utf-8"
        )
    )
    assert ledger["recommended_next_step"] == "PR-C1-ARM"
    assert ledger.get("pr_c1_arm_attempt", {}).get("authority") == "ADR_0091"
    assert ledger.get("pr_c1_arm_attempt", {}).get("attempt_status") == "BLOCKED"
    assert ledger.get("launch_sales_purchase_release", {}).get("flag_armed") is False

    matrix = json.loads(
        (
            ROOT / "docs" / "mokxya-ai" / "MAI_CAPABILITY_TRUTH_MATRIX.json"
        ).read_text(encoding="utf-8")
    )
    assert matrix["recommended_next_step"] == "PR-C1-ARM"
    rows = {r["id"]: r for r in matrix["launch_capability_candidates"]}
    assert rows["LAUNCH-ACCOUNTANT-SALES-PURCHASE"]["production_approved"] is False
    assert rows["LAUNCH-ACCOUNTANT-SALES-PURCHASE"]["depth"] == "ANNOTATION_ONLY"
    assert matrix["counts"]["launch_rows_production"] == 0

    plan = (
        ROOT / "MOKXYA_AI_PRODUCTION_READY_EXECUTION_PLAN_V1.txt"
    ).read_text(encoding="utf-8")
    assert "recommended_next_step = PR-C1-ARM" in plan
    assert "production_approved = false" in plan
    assert "PR-C1-ARM" in plan and "BLOCKED" in plan
