"""PR-B3 — sync honesty residual (ADR_0086 / GAP-P1-002)."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from oip.modules.conversation.application.sync_honesty_residual_policy import (
    AUTHORITY,
    DECISION,
    REGISTER_GAP_STATUS,
    assert_sync_honesty_residual_honesty,
    load_run_status,
    load_sync_honesty_residual_registry,
    sync_honesty_residual_observability,
)

ROOT = Path(__file__).resolve().parents[4]


def test_registry_and_honesty() -> None:
    reg = load_sync_honesty_residual_registry()
    assert reg["authority"] == AUTHORITY
    assert reg["decision"] == DECISION
    assert reg["gap_p1_002"]["register_status"] == REGISTER_GAP_STATUS
    assert reg["gap_p1_002"]["closed"] is False
    assert reg["policies"]["queued_must_not_label_synced"] is True
    assert reg["honesty"]["dual_sync_closed"] is False
    assert_sync_honesty_residual_honesty()
    with pytest.raises(RuntimeError, match="PRODUCTION_APPROVED"):
        assert_sync_honesty_residual_honesty({"production_approved": True})
    with pytest.raises(RuntimeError, match="DUAL_SYNC"):
        assert_sync_honesty_residual_honesty({"dual_sync_closed": True})
    with pytest.raises(RuntimeError, match="QUEUED_LABELED"):
        assert_sync_honesty_residual_honesty({"queued_labeled_synced": True})
    with pytest.raises(RuntimeError, match="FALSE_CLOSED"):
        assert_sync_honesty_residual_honesty({"gap_p1_002_closed": True})
    # staging_conflict_attested may be true via OWNER_RESIDUAL; claim matches run


def test_artifacts_and_narrative() -> None:
    run = load_run_status()
    assert run["engineering_pack_ready"] is True
    assert run["staging_conflict_attested"] is True
    assert run.get("staging_conflict_attestation_mode") == "OWNER_RESIDUAL"
    assert run["dual_sync_closed"] is False
    art = ROOT / "artifacts" / "prod-ready-pr-b3"
    assert (art / "CONFLICT_RECONFIRM_NARRATIVE.md").is_file()
    assert (art / "BLOCKING_TICKETS.md").is_file()
    residual = (
        ROOT
        / "artifacts"
        / "prod-ready-pr-c1-arm"
        / "OWNER_RESIDUAL_ACCEPTANCE_B3_001.md"
    )
    assert residual.is_file()
    narrative = (art / "CONFLICT_RECONFIRM_NARRATIVE.md").read_text(encoding="utf-8")
    assert "REQUIRE_RECONFIRM" in narrative or "reconfirm" in narrative.lower()
    assert "auto-overwrite" in narrative.lower() or "Forbidden" in narrative


def test_gap_and_pointer_pr_b4() -> None:
    gap = (ROOT / "docs" / "mokxya-ai" / "MAI_00_GAP_REGISTER.md").read_text(
        encoding="utf-8"
    )
    section = gap.split("### GAP-P1-002")[1].split("### ")[0]
    assert "**Status:** REDUCED" in section
    assert "ADR_0086" in section or "PR-B3" in section
    assert section.count("**Status:** CLOSED") == 0

    obs = sync_honesty_residual_observability()
    assert obs["sync_honesty_adr"] == "ADR_0086"
    assert obs["queued_must_not_label_synced"] is True
    assert obs["dual_sync_closed"] is False

    baseline = (
        ROOT / "docs" / "mokxya-ai" / "baselines" / "PR_B3_SYNC_HONESTY_RESIDUAL.md"
    )
    assert baseline.is_file()

    ledger = json.loads(
        (ROOT / "docs" / "mokxya-ai" / "MAI_PHASE_LEDGER.json").read_text(
            encoding="utf-8"
        )
    )
    assert ledger["recommended_next_step"] == "PR-C1-ARM"
    assert "PR-B3" in ledger.get("completed_next_steps", [])
    assert ledger.get("sync_honesty_residual", {}).get("authority") == "ADR_0086"

    matrix = json.loads(
        (
            ROOT / "docs" / "mokxya-ai" / "MAI_CAPABILITY_TRUTH_MATRIX.json"
        ).read_text(encoding="utf-8")
    )
    assert matrix["recommended_next_step"] == "PR-C1-ARM"
    assert "PR-B3" in matrix.get("completed_steps", [])
    gaps = {g["id"]: g for g in matrix["blocking_gaps"]}
    assert gaps["GAP-P1-002"]["status"] == "REDUCED"

    plan = (
        ROOT / "MOKXYA_AI_PRODUCTION_READY_EXECUTION_PLAN_V1.txt"
    ).read_text(encoding="utf-8")
    assert "recommended_next_step = PR-C1-ARM" in plan
