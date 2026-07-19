"""NEXT-00 — capability truth matrix honesty invariants."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
MATRIX = ROOT / "docs" / "mokxya-ai" / "MAI_CAPABILITY_TRUTH_MATRIX.json"


def _load() -> dict:
    assert MATRIX.is_file(), f"missing matrix: {MATRIX}"
    return json.loads(MATRIX.read_text(encoding="utf-8"))


def test_matrix_counts_and_no_production_rows() -> None:
    data = _load()
    phases = data["phases"]
    assert len(phases) == 54
    assert data["counts"]["production_approved_true"] == 0
    assert data["counts"]["depth_PRODUCTION"] == 0
    assert data["counts"]["depth_PILOT"] == 0
    assert data["counts"]["launch_rows_production"] == 0
    assert all(p.get("production_approved") is False for p in phases)
    for row in data["launch_capability_candidates"]:
        assert row["production_approved"] is False
        assert row["depth"] in {
            "ANNOTATION_ONLY",
            "CANDIDATE_CONSUMED",
            "GATE_PROVEN",
            "PILOT",
            "PRODUCTION",
        }
        assert row["depth"] != "PRODUCTION"


def test_track_i_dormant_and_candidate_only() -> None:
    data = _load()
    track_i = [p for p in data["phases"] if p["id"] in {
        "MAI-50", "MAI-51", "MAI-52", "MAI-53"
    }]
    assert len(track_i) == 4
    for p in track_i:
        assert p.get("track_i") is True
        assert p["depth"] == "CANDIDATE_CONSUMED"
        assert p["live_effect"] == "DORMANT_TRACK_I"
        assert p["production_approved"] is False


def test_mai08_plus_not_overstated_as_gate_or_production() -> None:
    data = _load()
    for p in data["phases"]:
        n = int(p["id"].split("-")[1])
        if n >= 8:
            assert p["depth"] == "CANDIDATE_CONSUMED", p["id"]
            assert p["production_approved"] is False
            assert p["depth"] not in {"GATE_PROVEN", "PILOT", "PRODUCTION"}


def test_blocking_gaps_include_p0_and_p2_008() -> None:
    data = _load()
    ids = {g["id"] for g in data["blocking_gaps"]}
    assert "GAP-P0-001" in ids
    assert "GAP-P2-008" in ids
    assert "GAP-P1-002" in ids
    assert data["honesty"]["legal_effective_dates_proven"] is False
    assert data["recommended_next_step"] == "NEXT-07"


def test_track_i_freeze_active_adr_0071() -> None:
    data = _load()
    honesty = data["honesty"]
    assert honesty["track_i_freeze_status"] == "ACTIVE"
    assert honesty["track_i_freeze_authority"] == "ADR_0071"
    assert honesty["track_i_dormant_until"] == "NEXT-20"
    assert "NEXT-01" in data.get("completed_steps", [])

    ledger_path = ROOT / "docs" / "mokxya-ai" / "MAI_PHASE_LEDGER.json"
    ledger = json.loads(ledger_path.read_text(encoding="utf-8"))
    freeze = ledger["track_i_freeze"]
    assert freeze["status"] == "ACTIVE"
    assert freeze["authority"] == "ADR_0071"
    assert freeze["until"] == "NEXT-20"
    assert set(freeze["phases"]) == {"MAI-50", "MAI-51", "MAI-52", "MAI-53"}
    assert ledger["recommended_next_step"] == "NEXT-07"

    adr = (
        ROOT
        / "docs"
        / "mokxya-ai"
        / "decisions"
        / "ADR_0071_TRACK_I_DEEPENING_FREEZE_UNTIL_NEXT_20.md"
    )
    assert adr.is_file()
    text = adr.read_text(encoding="utf-8")
    assert "NEXT-20" in text
    assert "MAI-50" in text
