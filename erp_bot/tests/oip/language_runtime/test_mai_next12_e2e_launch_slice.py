"""NEXT-12 — E2E launch slice evidence honesty (ADR_0079)."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from oip.modules.conversation.application.e2e_launch_slice_policy import (
    AUTHORITY,
    DECISION,
    PRODUCT_CONFIRM_PATH,
    REQUIRED_EVENTS,
    assert_e2e_launch_slice_honesty,
    e2e_launch_slice_observability,
    evidence_paths_exist,
    load_e2e_launch_slice_registry,
)

ROOT = Path(__file__).resolve().parents[4]


def test_registry_covers_three_frozen_events() -> None:
    reg = load_e2e_launch_slice_registry()
    assert reg["authority"] == AUTHORITY
    assert reg["decision"] == DECISION
    assert reg["product_confirm_path"] == PRODUCT_CONFIRM_PATH
    ids = {v["launch_event_id"] for v in reg["verticals"]}
    assert ids == REQUIRED_EVENTS
    assert reg["honesty"]["production_approved"] is False
    assert reg["honesty"]["settlement_in_slice"] is False
    assert reg["policies"]["dual_silent_writers_forbidden"] is True
    assert reg["policies"]["queued_must_not_label_synced"] is True


def test_honesty_rejects_false_claims() -> None:
    assert_e2e_launch_slice_honesty()
    with pytest.raises(RuntimeError, match="PRODUCTION_APPROVED"):
        assert_e2e_launch_slice_honesty({"production_approved": True})
    with pytest.raises(RuntimeError, match="EXECUTION_AUTHORITY"):
        assert_e2e_launch_slice_honesty({"is_execution_authority": True})
    with pytest.raises(RuntimeError, match="OEC_SOLE"):
        assert_e2e_launch_slice_honesty({"oec_sole_mutation_authority": True})
    with pytest.raises(RuntimeError, match="DUAL_WRITERS"):
        assert_e2e_launch_slice_honesty({"dual_silent_writers": True})
    with pytest.raises(RuntimeError, match="QUEUED_SYNCED"):
        assert_e2e_launch_slice_honesty(
            {"queued_labelled_synced_without_ack": True}
        )
    with pytest.raises(RuntimeError, match="SETTLEMENT"):
        assert_e2e_launch_slice_honesty({"settlement_in_slice": True})


def test_evidence_paths_and_manual_script() -> None:
    missing = evidence_paths_exist()
    assert missing == [], missing
    baseline = (
        ROOT / "docs" / "mokxya-ai" / "baselines" / "NEXT_12_E2E_LAUNCH_SLICE.md"
    ).read_text(encoding="utf-8")
    assert "## Manual script" in baseline
    assert "balance sheet" in baseline.lower()
    assert "production_approved" in baseline.lower() or "Not `production_approved`" in baseline


def test_observability_and_pointer_next13() -> None:
    obs = e2e_launch_slice_observability()
    assert obs["e2e_launch_slice_adr"] == "ADR_0079"
    assert set(obs["launch_event_ids"]) == REQUIRED_EVENTS
    assert obs["production_approved"] is False

    ledger = json.loads(
        (ROOT / "docs" / "mokxya-ai" / "MAI_PHASE_LEDGER.json").read_text(
            encoding="utf-8"
        )
    )
    assert ledger["recommended_next_step"] == "PR-B1"
    assert "NEXT-12" in ledger.get("completed_next_steps", [])
    assert ledger.get("e2e_launch_slice", {}).get("authority") == "ADR_0079"

    matrix = json.loads(
        (
            ROOT / "docs" / "mokxya-ai" / "MAI_CAPABILITY_TRUTH_MATRIX.json"
        ).read_text(encoding="utf-8")
    )
    assert matrix["recommended_next_step"] == "PR-B1"
    assert "NEXT-12" in matrix.get("completed_steps", [])
