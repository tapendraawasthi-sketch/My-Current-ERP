"""PR-B1 — staging golden path evidence honesty (ADR_0084)."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from oip.modules.conversation.application.staging_golden_path_policy import (
    AUTHORITY,
    DECISION,
    STEP,
    assert_staging_golden_path_honesty,
    load_run_status,
    load_staging_golden_path_registry,
    staging_golden_path_observability,
)

ROOT = Path(__file__).resolve().parents[4]


def test_registry_and_honesty() -> None:
    reg = load_staging_golden_path_registry()
    assert reg["authority"] == AUTHORITY
    assert reg["decision"] == DECISION
    assert reg["step"] == STEP
    assert reg["honesty"]["engineering_pack_ready"] is True
    assert reg["honesty"]["staging_attestation_complete"] is False
    assert reg["honesty"]["production_approved"] is False
    assert_staging_golden_path_honesty()
    with pytest.raises(RuntimeError, match="PRODUCTION_APPROVED"):
        assert_staging_golden_path_honesty({"production_approved": True})
    with pytest.raises(RuntimeError, match="FALSE_ATTESTATION"):
        assert_staging_golden_path_honesty({"staging_attestation_complete": True})
    with pytest.raises(RuntimeError, match="FALSE_CONNECTED_PASS"):
        assert_staging_golden_path_honesty({"connected_run_status": "PASS"})


def test_run_status_and_artifacts() -> None:
    run = load_run_status()
    assert run["authority"] == "ADR_0084"
    assert run["engineering_pack_ready"] is True
    assert run["staging_attestation_complete"] is False
    assert run["blocks_pr_c"] is True
    assert run["connected_run"]["status"] in {"FAIL", "PASS", "PENDING", "PARTIAL"}
    assert run["manual_run"]["status"] in {"PENDING", "PASS", "FAIL"}
    tickets = (
        ROOT / "artifacts" / "prod-ready-pr-b1" / "BLOCKING_TICKETS.md"
    ).read_text(encoding="utf-8")
    assert "TICKET-PR-B1-001" in tickets
    assert "TICKET-PR-B1-002" in tickets
    baseline = (
        ROOT / "docs" / "mokxya-ai" / "baselines" / "PR_B1_STAGING_GOLDEN_PATH.md"
    ).read_text(encoding="utf-8")
    assert "Pass / fail table" in baseline or "Pass / fail" in baseline
    assert "TICKET-PR-B1" in baseline


def test_pointer_pr_b2() -> None:
    obs = staging_golden_path_observability()
    assert obs["staging_golden_adr"] == "ADR_0084"
    assert obs["production_approved"] is False
    assert obs["blocks_pr_c"] is True

    ledger = json.loads(
        (ROOT / "docs" / "mokxya-ai" / "MAI_PHASE_LEDGER.json").read_text(
            encoding="utf-8"
        )
    )
    assert ledger["recommended_next_step"] == "PR-C1"
    assert "PR-B1" in ledger.get("completed_next_steps", [])
    assert ledger.get("staging_golden_path", {}).get("authority") == "ADR_0084"

    matrix = json.loads(
        (
            ROOT / "docs" / "mokxya-ai" / "MAI_CAPABILITY_TRUTH_MATRIX.json"
        ).read_text(encoding="utf-8")
    )
    assert matrix["recommended_next_step"] == "PR-C1"
    assert "PR-B1" in matrix.get("completed_steps", [])

    plan = (
        ROOT / "MOKXYA_AI_PRODUCTION_READY_EXECUTION_PLAN_V1.txt"
    ).read_text(encoding="utf-8")
    assert "recommended_next_step = PR-C1" in plan

    nxt = (ROOT / "MOKXYA_AI_WHAT_MUST_BE_DONE_NEXT_V1.txt").read_text(
        encoding="utf-8"
    )
    assert "recommended_next_step = PR-C1" in nxt
    assert "last_shipped_step = PR-B6" in nxt
