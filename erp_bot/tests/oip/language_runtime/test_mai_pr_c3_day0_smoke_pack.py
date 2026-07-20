"""PR-C3-PACK — Day-0 smoke pack READY; NOT_RUN; not PASS (ADR_0093)."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from oip.modules.conversation.application.day0_smoke_pack_policy import (
    AUTHORITY,
    DECISION,
    assert_day0_smoke_pack_honesty,
    day0_smoke_pack_observability,
    load_day0_smoke_pack_registry,
    load_run_status,
)

ROOT = Path(__file__).resolve().parents[4]


def test_registry_not_run_and_honesty() -> None:
    reg = load_day0_smoke_pack_registry()
    assert reg["authority"] == AUTHORITY
    assert reg["decision"] == DECISION
    assert reg["smoke_status"] == "NOT_RUN"
    assert reg["smoke_pass"] is False
    assert reg["pack_ready"] is True
    assert_day0_smoke_pack_honesty()
    with pytest.raises(RuntimeError, match="FALSE_PASS"):
        assert_day0_smoke_pack_honesty({"smoke_pass": True})
    with pytest.raises(RuntimeError, match="FALSE_PASS"):
        assert_day0_smoke_pack_honesty({"smoke_status": "PASS"})
    with pytest.raises(RuntimeError, match="FALSE_EXECUTED"):
        assert_day0_smoke_pack_honesty({"smoke_executed": True})
    with pytest.raises(RuntimeError, match="PRODUCTION_APPROVED"):
        assert_day0_smoke_pack_honesty({"production_approved": True})


def test_artifacts_and_pointer() -> None:
    run = load_run_status()
    assert run["pack_ready"] is True
    assert run["smoke_status"] == "NOT_RUN"
    assert run["smoke_pass"] is False
    art = ROOT / "artifacts" / "prod-ready-pr-c3"
    assert (art / "SMOKE_CHECKLIST.md").is_file()
    assert (art / "SIGN_NOTE.md").is_file()
    assert "NOT_RUN" in (art / "SMOKE_CHECKLIST.md").read_text(encoding="utf-8")

    report = (
        ROOT / "docs" / "mokxya-ai" / "releases" / "DAY0_PRODUCTION_SMOKE_V1.md"
    )
    assert report.is_file()
    text = report.read_text(encoding="utf-8")
    assert "NOT_RUN" in text
    assert "one purchase" in text.lower() or "One purchase" in text

    obs = day0_smoke_pack_observability()
    assert obs["day0_smoke_adr"] == "ADR_0093"
    assert obs["smoke_pass"] is False

    ledger = json.loads(
        (ROOT / "docs" / "mokxya-ai" / "MAI_PHASE_LEDGER.json").read_text(
            encoding="utf-8"
        )
    )
    assert ledger["recommended_next_step"] == "PR-C1-ARM"
    assert ledger.get("day0_smoke_pack", {}).get("authority") == "ADR_0093"
    assert ledger.get("day0_smoke_pack", {}).get("smoke_pass") is False

    plan = (
        ROOT / "MOKXYA_AI_PRODUCTION_READY_EXECUTION_PLAN_V1.txt"
    ).read_text(encoding="utf-8")
    assert "recommended_next_step = PR-C1-ARM" in plan
    assert "last_shipped_step = PR-D1" in plan
    assert "production_approved = false" in plan
    assert "PR-C3" in plan and "PACK_READY" in plan
