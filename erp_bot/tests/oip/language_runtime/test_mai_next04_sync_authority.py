"""NEXT-04 — sync authority hardening (ADR_0074 / GAP-P1-002)."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from oip.modules.conversation.application.sync_authority_policy import (
    ACCOUNTING_SYNC_AUTHORITY,
    AUTHORITY,
    CONFLICT_POLICY,
    REGISTER_GAP_STATUS,
    RUNTIME_GAP_STATUS,
    assert_sync_authority_honesty,
    load_sync_authority_registry,
    sync_authority_observability,
)

ROOT = Path(__file__).resolve().parents[4]


def test_registry_event_sync_authority() -> None:
    reg = load_sync_authority_registry()
    assert reg["authority"] == AUTHORITY
    assert reg["decision"] == "ACCOUNTING_EVENT_SYNC_QUEUE_AUTHORITY"
    assert (
        reg["accounting_sync_authority"]["id"] == ACCOUNTING_SYNC_AUTHORITY
    )
    assert reg["gap_p1_002"]["register_status"] == REGISTER_GAP_STATUS
    assert reg["gap_p1_002"]["runtime_status"] == RUNTIME_GAP_STATUS
    assert reg["gap_p1_002"]["closed"] is False
    assert reg["policies"]["conflict_policy"] == CONFLICT_POLICY
    assert reg["policies"]["queued_must_not_label_synced"] is True
    blocked = next(
        p
        for p in reg["paths"]
        if p["id"] == "LEGACY_SYNC_OUTBOX_ACCOUNTING"
    )
    assert blocked["status"] == "BLOCKED"


def test_honesty_rejects_false_claims() -> None:
    assert_sync_authority_honesty()
    with pytest.raises(RuntimeError, match="QUEUED_LABELED_SYNCED"):
        assert_sync_authority_honesty({"queued_labeled_synced": True})
    with pytest.raises(RuntimeError, match="AUTO_OVERWRITE"):
        assert_sync_authority_honesty({"conflict_auto_overwrite": True})
    with pytest.raises(RuntimeError, match="SYNC_PUSH"):
        assert_sync_authority_honesty({"allow_sync_push": True})
    with pytest.raises(RuntimeError, match="DUAL_SYNC_FALSE_CLOSED"):
        assert_sync_authority_honesty({"dual_sync_closed": True})


def test_offline_sync_consume_wires_authority() -> None:
    from oip.modules.conversation.application.offline_sync_conflict_reversal_consume_service import (
        assert_offline_sync_consume_authority,
    )

    obs = sync_authority_observability()
    obs.update(
        {
            "offline_sync_consume_mode": "SKIP",
            "is_execution_authority": False,
            "sync_workers_started": False,
            "sync_push_invoked": False,
            "sync_pull_invoked": False,
            "queue_enqueued": False,
            "conflict_resolved": False,
            "reversal_dispatched": False,
            "ui_badge_mutated": False,
            "queued_labeled_synced": False,
            "queue_mutations": 0,
            "sync_mutations": 0,
            "reversal_mutations": 0,
            "gap_p0_001_status": "OPEN",
        }
    )
    assert_offline_sync_consume_authority(obs)


def test_adr_gap_ledger() -> None:
    adr = (
        ROOT
        / "docs"
        / "mokxya-ai"
        / "decisions"
        / "ADR_0074_SYNC_AUTHORITY_HARDENING.md"
    )
    assert adr.is_file()
    text = adr.read_text(encoding="utf-8")
    assert "EVENT_SYNC_QUEUE" in text
    assert "REQUIRE_RECONFIRM_ON_MATERIAL_CONFLICT" in text

    gap = (ROOT / "docs" / "mokxya-ai" / "MAI_00_GAP_REGISTER.md").read_text(
        encoding="utf-8"
    )
    section = gap.split("### GAP-P1-002")[1].split("### ")[0]
    assert "**Status:** REDUCED" in section

    ledger = json.loads(
        (ROOT / "docs" / "mokxya-ai" / "MAI_PHASE_LEDGER.json").read_text(
            encoding="utf-8"
        )
    )
    assert ledger["recommended_next_step"] == "NEXT-11"
    assert ledger["sync_authority"]["decision"] == (
        "ACCOUNTING_EVENT_SYNC_QUEUE_AUTHORITY"
    )
