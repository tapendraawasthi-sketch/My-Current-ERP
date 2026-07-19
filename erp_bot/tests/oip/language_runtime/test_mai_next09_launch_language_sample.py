"""NEXT-09 — launch language sample product-policy review (ADR_0083)."""

from __future__ import annotations

import csv
import json
from pathlib import Path

import pytest

from oip.modules.conversation.application.launch_language_sample_policy import (
    AUTHORITY,
    DECISION,
    REGISTER_GAP_P1_009_STATUS,
    assert_launch_language_sample_honesty,
    launch_language_sample_observability,
    load_launch_language_sample_registry,
)

ROOT = Path(__file__).resolve().parents[4]
REVIEW_DIR = (
    ROOT / "docs" / "mokxya-ai" / "reviews" / "launch_language_sample"
)


def test_registry_and_honesty() -> None:
    reg = load_launch_language_sample_registry()
    assert reg["authority"] == AUTHORITY
    assert reg["decision"] == DECISION
    assert reg["gap_p1_009"]["register_status"] == REGISTER_GAP_P1_009_STATUS
    assert reg["gap_p1_009"]["closed"] is False
    assert reg["honesty"]["product_policy_approved_launch_language_slice"] is True
    assert reg["honesty"]["linguist_approved_launch_language_slice"] is False
    assert reg["honesty"]["production_approved"] is False
    assert reg["review"]["blocking_fix_count"] == 0
    assert_launch_language_sample_honesty()
    with pytest.raises(RuntimeError, match="PRODUCTION_APPROVED"):
        assert_launch_language_sample_honesty({"production_approved": True})
    with pytest.raises(RuntimeError, match="FALSE_LINGUIST"):
        assert_launch_language_sample_honesty(
            {"linguist_approved_launch_language_slice": True}
        )
    with pytest.raises(RuntimeError, match="GAP_P1_009_FALSE_CLOSED"):
        assert_launch_language_sample_honesty({"gap_p1_009_closed": True})


def test_workbook_and_decisions() -> None:
    csv_path = REVIEW_DIR / "LAUNCH_LANGUAGE_SAMPLE_REVIEW_V1.csv"
    decisions_path = REVIEW_DIR / "LAUNCH_LANGUAGE_SAMPLE_DECISIONS.json"
    note = REVIEW_DIR / "SIGNED_REVIEW_NOTE.md"
    assert csv_path.is_file()
    assert decisions_path.is_file()
    assert note.is_file()

    with csv_path.open(encoding="utf-8-sig", newline="") as f:
        rows = list(csv.DictReader(f))
    assert len(rows) >= 30
    langs = {r["language"] for r in rows}
    assert "ENGLISH" in langs
    assert "NEPALI_DEVANAGARI" in langs
    assert "ROMANIZED_NEPALI" in langs
    families = {r["family"] for r in rows}
    for need in ("sale", "purchase", "clarify", "report", "refuse"):
        assert need in families

    decisions = json.loads(decisions_path.read_text(encoding="utf-8"))
    assert decisions["blocking_fix_count"] == 0
    assert decisions["counts"]["FIX"] == 0
    assert decisions["product_policy_approved_launch_language_slice"] is True
    assert decisions["linguist_approved_launch_language_slice"] is False
    assert "PRODUCT_POLICY_APPROVED" in note.read_text(encoding="utf-8")
    assert "LINGUIST_APPROVED" in note.read_text(encoding="utf-8")


def test_gap_register_and_pointer_pr_b1() -> None:
    gap = (ROOT / "docs" / "mokxya-ai" / "MAI_00_GAP_REGISTER.md").read_text(
        encoding="utf-8"
    )
    section = gap.split("### GAP-P1-009")[1].split("### GAP-P2-008")[0]
    assert "**Status:** REDUCED" in section
    assert "NEXT-09" in section
    assert section.count("**Status:** CLOSED") == 0

    obs = launch_language_sample_observability()
    assert obs["launch_language_adr"] == "ADR_0083"
    assert obs["gap_p1_009_register_status"] == "REDUCED"
    assert obs["linguist_approved_launch_language_slice"] is False

    baseline = (
        ROOT
        / "docs"
        / "mokxya-ai"
        / "baselines"
        / "NEXT_09_LAUNCH_LANGUAGE_SAMPLE_REVIEW.md"
    )
    assert baseline.is_file()

    ledger = json.loads(
        (ROOT / "docs" / "mokxya-ai" / "MAI_PHASE_LEDGER.json").read_text(
            encoding="utf-8"
        )
    )
    assert ledger["recommended_next_step"] == "PR-B2"
    assert "NEXT-09" in ledger.get("completed_next_steps", [])
    assert ledger.get("launch_language_sample", {}).get("authority") == "ADR_0083"

    matrix = json.loads(
        (
            ROOT / "docs" / "mokxya-ai" / "MAI_CAPABILITY_TRUTH_MATRIX.json"
        ).read_text(encoding="utf-8")
    )
    assert matrix["recommended_next_step"] == "PR-B2"
    assert "NEXT-09" in matrix.get("completed_steps", [])
    gaps = {g["id"]: g for g in matrix["blocking_gaps"]}
    assert gaps["GAP-P1-009"]["status"] == "REDUCED"
    assert gaps["GAP-P1-012"]["status"] == "REDUCED"

    plan = (
        ROOT / "MOKXYA_AI_PRODUCTION_READY_EXECUTION_PLAN_V1.txt"
    ).read_text(encoding="utf-8")
    assert "recommended_next_step = PR-B2" in plan

    nxt = (ROOT / "MOKXYA_AI_WHAT_MUST_BE_DONE_NEXT_V1.txt").read_text(
        encoding="utf-8"
    )
    assert "recommended_next_step = PR-B2" in nxt
    assert "NEXT-09" in nxt and "last_shipped_step = PR-B1" in nxt
