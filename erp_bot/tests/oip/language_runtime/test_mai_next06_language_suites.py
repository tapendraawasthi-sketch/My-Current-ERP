"""NEXT-06 — MAI-04 critical language suite reproof gates."""

from __future__ import annotations

import json
from pathlib import Path

from oip.evaluation.case_loader import load_jsonl_cases
from oip.evaluation.contracts import EvalMode
from oip.evaluation.pipeline_adapter import execute_case
from oip.evaluation.runner import score_case
from oip.evaluation.safety_guard import reset_guard
from oip.evaluation.scorers import (
    _number_role_surfaces_compatible,
    _number_roles_compatible,
    aggregate_scorer_results,
)

REPO = Path(__file__).resolve().parents[4]


def _suite_pass_count(jsonl: Path) -> tuple[int, int]:
    cases = load_jsonl_cases(jsonl)
    guard = reset_guard()
    passed = 0
    for case in cases:
        actual = execute_case(case, mode=EvalMode.COMPONENT, guard=guard)
        scorers = score_case(case, actual, guard_failures=[])
        ok, crit, _ = aggregate_scorer_results(scorers)
        if ok and not crit:
            passed += 1
    return passed, len(cases)


def test_number_role_scorer_compat_helpers() -> None:
    assert _number_role_surfaces_compatible("1", "1 crore")
    assert _number_role_surfaces_compatible("2081", "2081-01-15")
    assert _number_roles_compatible("tax_rate", "percentage")
    assert _number_roles_compatible("unit_price", "amount")
    assert not _number_roles_compatible("invoice_number", "amount")


def test_number_roles_suite_green() -> None:
    passed, total = _suite_pass_count(
        REPO / "evals" / "mai04" / "frozen" / "number_roles_v1.jsonl"
    )
    assert total == 40
    assert passed == 40


def test_context_turn_relation_suite_green() -> None:
    passed, total = _suite_pass_count(
        REPO / "evals" / "mai04" / "frozen" / "context_turn_relation_v1.jsonl"
    )
    assert total == 35
    assert passed == 35


def test_multilingual_still_human_review_not_auto_green() -> None:
    """NEXT-06 does not fake-pass multilingual; HR waiver is documented."""
    cases = load_jsonl_cases(
        REPO / "evals" / "mai04" / "frozen" / "multilingual_v1.jsonl"
    )
    assert len(cases) == 40
    summary_path = (
        REPO
        / "docs"
        / "mokxya-ai"
        / "baselines"
        / "NEXT_06_MAI04_LANGUAGE_SUITE_REPROOF.md"
    )
    text = summary_path.read_text(encoding="utf-8")
    assert "HUMAN_REVIEW_REQUIRED" in text
    assert "WAIVED for automation" in text


def test_ledger_points_next_05() -> None:
    ledger = json.loads(
        (REPO / "docs" / "mokxya-ai" / "MAI_PHASE_LEDGER.json").read_text(
            encoding="utf-8"
        )
    )
    assert ledger["recommended_next_step"] == "PR-B2"
    assert "NEXT-06" in ledger.get("completed_next_steps", []) or ledger[
        "active_phase_note"
    ].find("NEXT-06") >= 0
