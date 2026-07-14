"""Unit tests for staging overlay counting (no fake human approval)."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[2]
SCRIPTS = REPO / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

from phase8_release_gate import count_staging_overlay_decisions  # noqa: E402


def test_count_staging_ignores_empty_and_machine(tmp_path: Path):
    p = tmp_path / "review_overlays.jsonl"
    rows = [
        {"record_id": "a", "review_decision": "approve", "reviewer_name": "alice"},
        {"record_id": "b", "review_decision": "defer", "reviewer_name": "alice"},
        {"record_id": "c", "review_decision": "approve", "reviewer_name": "machine_bot"},
        {"record_id": "d", "review_decision": "approve", "reviewer_name": ""},
        {"record_id": "e", "review_decision": "promote_to_gold", "reviewer_name": "bob"},
        {"record_id": "f", "review_decision": "reject", "reviewer_name": "carol"},
    ]
    p.write_text("\n".join(json.dumps(r) for r in rows) + "\n", encoding="utf-8")
    stats = count_staging_overlay_decisions(p)
    assert stats["any_decision"] == 6
    assert stats["approve_class"] == 2  # alice approve + bob gold


def test_count_staging_missing_file(tmp_path: Path):
    stats = count_staging_overlay_decisions(tmp_path / "missing.jsonl")
    assert stats == {"any_decision": 0, "approve_class": 0}
