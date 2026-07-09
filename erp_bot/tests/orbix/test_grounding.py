"""Grounding / anti-hallucination gate tests — no network needed.

Run: cd erp_bot && python -m pytest tests/orbix/test_grounding.py
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from src.orbix.reasoning.verifier import (  # noqa: E402
    verify_citations_exist,
    verify_ledger_math,
)
from src.orbix.schemas import EvidenceRef  # noqa: E402


def _ev(uri: str, snippet: str = "") -> EvidenceRef:
    return EvidenceRef(id="ev1", source_type="code", uri=uri, snippet=snippet)


def test_unsupported_file_path_is_flagged():
    answer = "The shortcut is defined in src/components/RightButtonBar.tsx."
    errors = verify_citations_exist(answer, evidence=[])
    assert any("RightButtonBar.tsx" in e for e in errors)


def test_supported_file_path_passes():
    answer = "The shortcut lives in src/components/BusyMenuBar.tsx."
    evidence = [_ev("src/components/BusyMenuBar.tsx", "PAGE_SHORTCUTS")]
    errors = verify_citations_exist(answer, evidence=evidence)
    assert errors == []


def test_unsupported_shortcut_is_flagged():
    answer = "Press F5 to open Journal Entry."
    errors = verify_citations_exist(answer, evidence=[])
    assert any("F5" in e for e in errors)


def test_ledger_imbalance_is_flagged():
    lines = [{"account": "Cash", "debit": 100}, {"account": "Sales", "credit": 90}]
    errors = verify_ledger_math(lines)
    assert any("unbalanced" in e for e in errors)


def test_balanced_ledger_passes():
    lines = [{"account": "Cash", "debit": 100}, {"account": "Sales", "credit": 100}]
    assert verify_ledger_math(lines) == []


if __name__ == "__main__":
    test_unsupported_file_path_is_flagged()
    test_supported_file_path_passes()
    test_unsupported_shortcut_is_flagged()
    test_ledger_imbalance_is_flagged()
    test_balanced_ledger_passes()
    print("All grounding tests passed.")
