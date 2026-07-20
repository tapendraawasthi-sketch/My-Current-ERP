"""PR-D4 — operator runbook pack READY; not post-launch stable (ADR_0096)."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from oip.modules.conversation.application.operator_runbook_policy import (
    AUTHORITY,
    DECISION,
    assert_operator_runbook_honesty,
    load_operator_runbook_registry,
    load_run_status,
    operator_runbook_observability,
    runbook_path,
)

ROOT = Path(__file__).resolve().parents[4]


def test_registry_and_honesty() -> None:
    reg = load_operator_runbook_registry()
    assert reg["authority"] == AUTHORITY
    assert reg["decision"] == DECISION
    assert reg["pack_ready"] is True
    assert reg["post_launch_stable_claimed"] is False
    assert_operator_runbook_honesty()
    with pytest.raises(RuntimeError, match="PRODUCTION_APPROVED"):
        assert_operator_runbook_honesty({"production_approved": True})
    with pytest.raises(RuntimeError, match="POST_LAUNCH_STABLE"):
        assert_operator_runbook_honesty({"post_launch_stable": True})
    with pytest.raises(RuntimeError, match="DAY0_SMOKE_PASS"):
        assert_operator_runbook_honesty({"day0_smoke_pass": True})


def test_runbook_covers_and_pointer() -> None:
    run = load_run_status()
    assert run["pack_ready"] is True
    assert run["post_launch_stable_claimed"] is False
    text = runbook_path().read_text(encoding="utf-8")
    assert "Rollback" in text
    assert "Waiting to sync" in text or "sync" in text.lower()
    assert "abstain" in text.lower()

    obs = operator_runbook_observability()
    assert obs["runbook_adr"] == "ADR_0096"
    assert obs["covers_rollback"] is True
    assert obs["post_launch_stable"] is False

    ledger = json.loads(
        (ROOT / "docs" / "mokxya-ai" / "MAI_PHASE_LEDGER.json").read_text(
            encoding="utf-8"
        )
    )
    assert ledger["recommended_next_step"] == "PR-C1-ARM"
    assert "PR-D4" in ledger.get("completed_next_steps", [])
    assert ledger.get("operator_runbook", {}).get("authority") == "ADR_0096"

    plan = (
        ROOT / "MOKXYA_AI_PRODUCTION_READY_EXECUTION_PLAN_V1.txt"
    ).read_text(encoding="utf-8")
    assert "recommended_next_step = PR-C1-ARM" in plan
    assert "last_shipped_step = PR-D2" in plan
    assert "production_approved = false" in plan
    assert "PR-D4" in plan and "PACK_READY" in plan
