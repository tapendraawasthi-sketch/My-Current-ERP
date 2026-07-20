"""PR-D1 — error budget & incident loop pack READY; not 14-day stable."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from oip.modules.conversation.application.error_budget_incident_loop_policy import (
    AUTHORITY,
    DECISION,
    assert_error_budget_incident_loop_honesty,
    error_budget_incident_loop_observability,
    load_error_budget_incident_loop_registry,
    load_run_status,
    loop_doc_path,
)

ROOT = Path(__file__).resolve().parents[4]


def test_registry_and_honesty() -> None:
    reg = load_error_budget_incident_loop_registry()
    assert reg["authority"] == AUTHORITY
    assert reg["decision"] == DECISION
    assert reg["pack_ready"] is True
    assert reg["fourteen_day_stable_claimed"] is False
    assert len(reg["signals"]) >= 4
    assert_error_budget_incident_loop_honesty()
    with pytest.raises(RuntimeError, match="PRODUCTION_APPROVED"):
        assert_error_budget_incident_loop_honesty({"production_approved": True})
    with pytest.raises(RuntimeError, match="FOURTEEN_DAY_STABLE"):
        assert_error_budget_incident_loop_honesty({"fourteen_day_stable": True})


def test_doc_and_pointer() -> None:
    run = load_run_status()
    assert run["pack_ready"] is True
    assert run["weekly_reviews_executed"] is False
    text = loop_doc_path().read_text(encoding="utf-8")
    assert "Weekly loop" in text
    assert "P0" in text
    assert "14 consecutive days" in text or "14-day" in text.lower()

    obs = error_budget_incident_loop_observability()
    assert obs["incident_loop_adr"] == "ADR_0097"
    assert obs["fourteen_day_stable"] is False

    ledger = json.loads(
        (ROOT / "docs" / "mokxya-ai" / "MAI_PHASE_LEDGER.json").read_text(
            encoding="utf-8"
        )
    )
    assert ledger["recommended_next_step"] == "PR-C1-ARM"
    assert "PR-D1" in ledger.get("completed_next_steps", [])
    assert ledger.get("error_budget_incident_loop", {}).get("authority") == "ADR_0097"

    plan = (
        ROOT / "MOKXYA_AI_PRODUCTION_READY_EXECUTION_PLAN_V1.txt"
    ).read_text(encoding="utf-8")
    assert "recommended_next_step = PR-C1-ARM" in plan
    assert "last_shipped_step = PR-D1" in plan
    assert "production_approved = false" in plan
