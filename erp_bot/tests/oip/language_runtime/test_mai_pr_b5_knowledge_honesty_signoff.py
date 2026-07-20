"""PR-B5 — knowledge honesty sign-off (ADR_0088 / GAP-P2-008)."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from oip.modules.conversation.application.knowledge_honesty_signoff_policy import (
    AUTHORITY,
    DECISION,
    REGISTER_GAP_STATUS,
    assert_knowledge_honesty_signoff_honesty,
    knowledge_honesty_signoff_observability,
    load_knowledge_honesty_signoff_registry,
    load_run_status,
)

ROOT = Path(__file__).resolve().parents[4]


def test_registry_and_honesty() -> None:
    reg = load_knowledge_honesty_signoff_registry()
    assert reg["authority"] == AUTHORITY
    assert reg["decision"] == DECISION
    assert reg["gap_p2_008"]["register_status"] == REGISTER_GAP_STATUS
    assert reg["gap_p2_008"]["closed"] is False
    assert reg["signoff"]["engineering_gate_status"] == "PASS"
    assert reg["signoff"]["launch_ask_sign_status"] == "ENGINEERING_PASS"
    assert reg["signoff"]["staging_professional_review_status"] == "PENDING"
    assert reg["honesty"]["staging_professional_attested"] is False
    assert_knowledge_honesty_signoff_honesty()
    with pytest.raises(RuntimeError, match="PRODUCTION_APPROVED"):
        assert_knowledge_honesty_signoff_honesty({"production_approved": True})
    with pytest.raises(RuntimeError, match="FALSE_CLOSED"):
        assert_knowledge_honesty_signoff_honesty({"gap_p2_008_closed": True})
    with pytest.raises(RuntimeError, match="CLAIMS_VERIFIED"):
        assert_knowledge_honesty_signoff_honesty({"claims_verified": True})
    with pytest.raises(RuntimeError, match="LEGAL_DATES"):
        assert_knowledge_honesty_signoff_honesty(
            {"legal_effective_dates_proven": True}
        )
    with pytest.raises(RuntimeError, match="FALSE_ATTESTATION"):
        assert_knowledge_honesty_signoff_honesty(
            {"staging_professional_attested": True}
        )


def test_artifacts_and_sign_note() -> None:
    run = load_run_status()
    assert run["engineering_pack_ready"] is True
    assert run["engineering_gate_status"] == "PASS"
    assert run["launch_ask_sign_status"] == "ENGINEERING_PASS"
    assert run["staging_professional_attested"] is False
    assert run["gap_p2_008_closed"] is False
    art = ROOT / "artifacts" / "prod-ready-pr-b5"
    assert (art / "SIGN_NOTE.md").is_file()
    assert (art / "CRITICAL_CASE_RESULTS.md").is_file()
    assert (art / "BLOCKING_TICKETS.md").is_file()
    assert (art / "RUN_STATUS.json").is_file()
    note = (art / "SIGN_NOTE.md").read_text(encoding="utf-8")
    assert "ENGINEERING_PASS" in note
    assert "PENDING" in note
    assert "CLOSED" in note  # residual honesty: not CLOSED
    tickets = (art / "BLOCKING_TICKETS.md").read_text(encoding="utf-8")
    assert "TICKET-PR-B5-001" in tickets


def test_gap_and_pointer_pr_b6() -> None:
    gap = (ROOT / "docs" / "mokxya-ai" / "MAI_00_GAP_REGISTER.md").read_text(
        encoding="utf-8"
    )
    section = gap.split("### GAP-P2-008")[1].split("### ")[0]
    assert "**Status:** REDUCED" in section
    assert "ADR_0088" in section or "PR-B5" in section
    assert section.count("**Status:** CLOSED") == 0

    obs = knowledge_honesty_signoff_observability()
    assert obs["knowledge_honesty_signoff_adr"] == "ADR_0088"
    assert obs["engineering_gate_status"] == "PASS"
    assert obs["gap_p2_008_closed"] is False
    assert obs["staging_professional_attested"] is False

    baseline = (
        ROOT
        / "docs"
        / "mokxya-ai"
        / "baselines"
        / "PR_B5_KNOWLEDGE_HONESTY_SIGNOFF.md"
    )
    assert baseline.is_file()

    ledger = json.loads(
        (ROOT / "docs" / "mokxya-ai" / "MAI_PHASE_LEDGER.json").read_text(
            encoding="utf-8"
        )
    )
    assert ledger["recommended_next_step"] == "PR-C1-ARM"
    assert "PR-B5" in ledger.get("completed_next_steps", [])
    assert ledger.get("knowledge_honesty_signoff", {}).get("authority") == "ADR_0088"

    matrix = json.loads(
        (
            ROOT / "docs" / "mokxya-ai" / "MAI_CAPABILITY_TRUTH_MATRIX.json"
        ).read_text(encoding="utf-8")
    )
    assert matrix["recommended_next_step"] == "PR-C1-ARM"
    assert "PR-B5" in matrix.get("completed_steps", [])
    gaps = {g["id"]: g for g in matrix["blocking_gaps"]}
    assert gaps["GAP-P2-008"]["status"] == "REDUCED"

    plan = (
        ROOT / "MOKXYA_AI_PRODUCTION_READY_EXECUTION_PLAN_V1.txt"
    ).read_text(encoding="utf-8")
    assert "recommended_next_step = PR-C1-ARM" in plan
    assert "last_shipped_step = PR-C3-PACK" in plan
