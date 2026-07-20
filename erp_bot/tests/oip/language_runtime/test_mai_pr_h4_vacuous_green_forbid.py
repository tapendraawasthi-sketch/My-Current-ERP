"""PR-H4 — vacuous green / assertion-weakening forbid (ADR_0095)."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from oip.modules.conversation.application.vacuous_green_forbid_policy import (
    AUTHORITY,
    DECISION,
    assert_vacuous_green_forbid_honesty,
    empty_required_population_outcome,
    load_run_status,
    load_vacuous_green_forbid_registry,
    vacuous_green_forbid_observability,
)
from oip.modules.language_runtime.transliteration.application.r3h2_scoring_contracts import (
    GateOutcome,
)

ROOT = Path(__file__).resolve().parents[4]


def test_registry_and_honesty() -> None:
    reg = load_vacuous_green_forbid_registry()
    assert reg["authority"] == AUTHORITY
    assert reg["decision"] == DECISION
    assert reg["honesty"]["vacuous_greens_allowed"] is False
    assert reg["honesty"]["assertion_weakening_allowed"] is False
    assert reg["honesty"]["legacy_scorers_all_rewritten"] is False
    assert len(reg["governed_contract_modules"]) >= 5
    assert_vacuous_green_forbid_honesty()
    with pytest.raises(RuntimeError, match="VACUOUS_GREENS_ALLOWED"):
        assert_vacuous_green_forbid_honesty({"vacuous_greens_allowed": True})
    with pytest.raises(RuntimeError, match="ASSERTION_WEAKENING_ALLOWED"):
        assert_vacuous_green_forbid_honesty({"assertion_weakening_allowed": True})
    with pytest.raises(RuntimeError, match="LEGACY_SCORERS_FALSE_REWRITTEN"):
        assert_vacuous_green_forbid_honesty({"legacy_scorers_all_rewritten": True})
    with pytest.raises(RuntimeError, match="PRODUCTION_APPROVED"):
        assert_vacuous_green_forbid_honesty({"production_approved": True})


def test_empty_required_not_pass_and_pointer() -> None:
    assert empty_required_population_outcome() is GateOutcome.INVALID_REQUIRED_POPULATION
    run = load_run_status()
    assert run["engineering_pack_ready"] is True
    assert run["vacuous_greens_allowed"] is False
    obs = vacuous_green_forbid_observability()
    assert obs["vacuous_green_adr"] == "ADR_0095"
    assert obs["empty_required_outcome"] == "INVALID_REQUIRED_POPULATION"
    assert obs["metric_value_zero_denom_is_none"] is True
    assert obs["production_approved"] is False

    ledger = json.loads(
        (ROOT / "docs" / "mokxya-ai" / "MAI_PHASE_LEDGER.json").read_text(
            encoding="utf-8"
        )
    )
    assert ledger["recommended_next_step"] == "PR-C1-ARM"
    assert "PR-H4" in ledger.get("completed_next_steps", [])
    assert ledger.get("vacuous_green_forbid", {}).get("authority") == "ADR_0095"

    plan = (
        ROOT / "MOKXYA_AI_PRODUCTION_READY_EXECUTION_PLAN_V1.txt"
    ).read_text(encoding="utf-8")
    assert "recommended_next_step = PR-C1-ARM" in plan
    assert "last_shipped_step = PR-D1" in plan
    assert "production_approved = false" in plan

    art = ROOT / "artifacts" / "prod-ready-pr-h4"
    assert (art / "RUN_STATUS.json").is_file()
    assert (art / "SIGN_NOTE.md").is_file()
