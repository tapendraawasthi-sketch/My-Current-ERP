"""PR-B2 — launch mutation residual hard-deny (ADR_0085 / GAP-P0-001)."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from oip.modules.conversation.application.launch_mutation_residual_policy import (
    AUTHORITY,
    DECISION,
    PRODUCT_MUTATION_PATH,
    REGISTER_GAP_STATUS,
    assert_launch_mutation_residual_honesty,
    evaluate_silent_writer_attempt,
    launch_mutation_residual_observability,
    load_launch_mutation_residual_registry,
)

ROOT = Path(__file__).resolve().parents[4]


def test_registry_and_honesty() -> None:
    reg = load_launch_mutation_residual_registry()
    assert reg["authority"] == AUTHORITY
    assert reg["decision"] == DECISION
    assert reg["product_mutation_path"] == PRODUCT_MUTATION_PATH
    assert reg["gap_p0_001"]["register_status"] == REGISTER_GAP_STATUS
    assert reg["gap_p0_001"]["closed"] is False
    assert reg["honesty"]["oec_is_sole_mutation_authority"] is False
    assert reg["honesty"]["dual_silent_writer_on_launch_path"] is False
    assert_launch_mutation_residual_honesty()
    with pytest.raises(RuntimeError, match="SOLE_OEC"):
        assert_launch_mutation_residual_honesty(
            {"oec_is_sole_mutation_authority": True}
        )
    with pytest.raises(RuntimeError, match="FALSE_CLOSED"):
        assert_launch_mutation_residual_honesty({"gap_p0_001_closed": True})
    with pytest.raises(RuntimeError, match="DUAL_SILENT"):
        assert_launch_mutation_residual_honesty(
            {"dual_silent_writer_on_launch_path": True}
        )


def test_deny_node_and_oec_on_launch_markers() -> None:
    node = evaluate_silent_writer_attempt(
        writer_path_id="NODE_KHATA_CONFIRM",
        intent="khata_purchase",
        launch_event_id="purchase_invoice_draft",
    )
    assert node["deny"] is True
    assert node["draft_mutations"] == 0
    assert node["error_code"] == "LAUNCH_MUTATION_NODE_KHATA_DENIED"

    oec = evaluate_silent_writer_attempt(
        writer_path_id="OEC_ACTION_RUNTIME",
        launch_event_id="sales_invoice_draft",
    )
    assert oec["deny"] is True
    assert oec["draft_mutations"] == 0

    legacy = evaluate_silent_writer_attempt(
        writer_path_id="NODE_KHATA_CONFIRM",
        intent="khata_purchase",
        channel="legacy_khata_app",
    )
    assert legacy["deny"] is False


def test_gap_register_and_pointer_pr_b3() -> None:
    gap = (ROOT / "docs" / "mokxya-ai" / "MAI_00_GAP_REGISTER.md").read_text(
        encoding="utf-8"
    )
    section = gap.split("### GAP-P0-001")[1].split("### ")[0]
    assert "**Status:** REDUCED" in section
    assert "ADR_0085" in section or "PR-B2" in section
    assert section.count("**Status:** CLOSED") == 0

    obs = launch_mutation_residual_observability()
    assert obs["launch_mutation_adr"] == "ADR_0085"
    assert obs["oec_is_sole_mutation_authority"] is False
    assert obs["node_launch_hard_deny"] is True

    baseline = (
        ROOT / "docs" / "mokxya-ai" / "baselines" / "PR_B2_MUTATION_AUTHORITY_RESIDUAL.md"
    )
    assert baseline.is_file()

    ledger = json.loads(
        (ROOT / "docs" / "mokxya-ai" / "MAI_PHASE_LEDGER.json").read_text(
            encoding="utf-8"
        )
    )
    assert ledger["recommended_next_step"] == "PR-B4"
    assert "PR-B2" in ledger.get("completed_next_steps", [])
    assert ledger.get("launch_mutation_residual", {}).get("authority") == "ADR_0085"

    matrix = json.loads(
        (
            ROOT / "docs" / "mokxya-ai" / "MAI_CAPABILITY_TRUTH_MATRIX.json"
        ).read_text(encoding="utf-8")
    )
    assert matrix["recommended_next_step"] == "PR-B4"
    assert "PR-B2" in matrix.get("completed_steps", [])
    gaps = {g["id"]: g for g in matrix["blocking_gaps"]}
    assert gaps["GAP-P0-001"]["status"] == "REDUCED"

    plan = (
        ROOT / "MOKXYA_AI_PRODUCTION_READY_EXECUTION_PLAN_V1.txt"
    ).read_text(encoding="utf-8")
    assert "recommended_next_step = PR-B4" in plan
