"""PR-D3 — dual-writer/sync burn-down pack READY; gaps still REDUCED."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from oip.modules.conversation.application.dual_writer_sync_burndown_policy import (
    AUTHORITY,
    DECISION,
    assert_dual_writer_sync_burndown_honesty,
    dual_writer_sync_burndown_observability,
    load_dual_writer_sync_burndown_registry,
    load_run_status,
    schedule_path,
)

ROOT = Path(__file__).resolve().parents[4]


def test_registry_and_honesty() -> None:
    reg = load_dual_writer_sync_burndown_registry()
    assert reg["authority"] == AUTHORITY
    assert reg["decision"] == DECISION
    assert reg["pack_ready"] is True
    assert reg["gaps"]["GAP-P0-001"]["closed"] is False
    assert reg["gaps"]["GAP-P1-002"]["closed"] is False
    assert_dual_writer_sync_burndown_honesty()
    with pytest.raises(RuntimeError, match="P0_FALSE_CLOSED"):
        assert_dual_writer_sync_burndown_honesty({"gap_p0_001_closed": True})
    with pytest.raises(RuntimeError, match="OEC_SOLE"):
        assert_dual_writer_sync_burndown_honesty({"oec_sole": True})


def test_schedule_and_pointer() -> None:
    run = load_run_status()
    assert run["pack_ready"] is True
    assert run["gap_p0_001_closed"] is False
    text = schedule_path().read_text(encoding="utf-8")
    assert "REDUCED" in text
    assert "second writer" in text.lower() or "second writers" in text.lower()

    obs = dual_writer_sync_burndown_observability()
    assert obs["dual_burndown_adr"] == "ADR_0099"
    assert obs["gap_p0_001_status"] == "REDUCED"

    ledger = json.loads(
        (ROOT / "docs" / "mokxya-ai" / "MAI_PHASE_LEDGER.json").read_text(
            encoding="utf-8"
        )
    )
    assert ledger["recommended_next_step"] == "PR-C1-ARM"
    assert "PR-D3" in ledger.get("completed_next_steps", [])
    assert ledger.get("dual_writer_sync_burndown", {}).get("authority") == "ADR_0099"

    plan = (
        ROOT / "MOKXYA_AI_PRODUCTION_READY_EXECUTION_PLAN_V1.txt"
    ).read_text(encoding="utf-8")
    assert "recommended_next_step = PR-C1-ARM" in plan
    assert "last_shipped_step = PR-D3" in plan
    assert "production_approved = false" in plan
