"""PR-D2 — language defect burn-down pack READY; not collected (ADR_0098)."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from oip.modules.conversation.application.language_defect_burndown_policy import (
    AUTHORITY,
    DECISION,
    assert_language_defect_burndown_honesty,
    language_defect_burndown_observability,
    load_language_defect_burndown_registry,
    load_run_status,
    procedure_path,
)

ROOT = Path(__file__).resolve().parents[4]


def test_registry_and_honesty() -> None:
    reg = load_language_defect_burndown_registry()
    assert reg["authority"] == AUTHORITY
    assert reg["decision"] == DECISION
    assert reg["pack_ready"] is True
    assert reg["defects_collected"] is False
    assert reg["assertion_weakening_allowed"] is False
    assert_language_defect_burndown_honesty()
    with pytest.raises(RuntimeError, match="FALSE_COLLECTED"):
        assert_language_defect_burndown_honesty({"defects_collected": True})
    with pytest.raises(RuntimeError, match="ASSERTION_WEAKENING"):
        assert_language_defect_burndown_honesty({"assertion_weakening_allowed": True})


def test_procedure_and_pointer() -> None:
    run = load_run_status()
    assert run["pack_ready"] is True
    assert run["burn_down_complete"] is False
    text = procedure_path().read_text(encoding="utf-8")
    assert "frozen" in text.lower()
    assert "weaken" in text.lower()

    obs = language_defect_burndown_observability()
    assert obs["lang_burndown_adr"] == "ADR_0098"
    assert obs["defects_collected"] is False

    ledger = json.loads(
        (ROOT / "docs" / "mokxya-ai" / "MAI_PHASE_LEDGER.json").read_text(
            encoding="utf-8"
        )
    )
    assert ledger["recommended_next_step"] == "PR-C1-ARM"
    assert "PR-D2" in ledger.get("completed_next_steps", [])
    assert ledger.get("language_defect_burndown", {}).get("authority") == "ADR_0098"

    plan = (
        ROOT / "MOKXYA_AI_PRODUCTION_READY_EXECUTION_PLAN_V1.txt"
    ).read_text(encoding="utf-8")
    assert "recommended_next_step = PR-C1-ARM" in plan
    assert "last_shipped_step = PR-D2" in plan
    assert "production_approved = false" in plan
