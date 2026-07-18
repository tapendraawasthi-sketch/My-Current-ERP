from __future__ import annotations

import hashlib
import json
from pathlib import Path

import pytest

from erp_bot.src.oip.modules.language_runtime.transliteration.application.mai07_r3n5_integrity_invalidation import (
    INVALIDATION_PATH,
    INVALIDATION_VERDICT,
    REPO,
    SPLIT_STEMS,
    build_invalidation_payload,
    serialize_invalidation,
    write_invalidation,
)


def _load(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _all_snapshot_rows(snapshot: dict):
    yield snapshot["lock"]
    yield snapshot["lock_record"]
    yield snapshot["attempt"]
    yield snapshot["qualification"]
    yield snapshot["chain"]
    yield from snapshot["score_reports"].values()
    yield from snapshot["prediction_files"].values()


def test_stored_invalidation_equals_deterministic_recomputation():
    recomputed_first = build_invalidation_payload()
    recomputed_second = build_invalidation_payload()
    assert recomputed_first == recomputed_second
    assert _load(INVALIDATION_PATH) == recomputed_first
    assert INVALIDATION_PATH.read_bytes() == serialize_invalidation(recomputed_first)
    assert "created_utc" not in recomputed_first
    assert "timestamp" not in recomputed_first


def test_snapshot_binds_all_seventeen_required_existing_artifacts():
    snapshot = build_invalidation_payload()["raw_sha256_snapshot"]
    assert set(snapshot["score_reports"]) == set(SPLIT_STEMS)
    assert set(snapshot["prediction_files"]) == set(SPLIT_STEMS)
    rows = list(_all_snapshot_rows(snapshot))
    assert len(rows) == 17
    assert len({row["path"] for row in rows}) == 17
    for row in rows:
        path = REPO / row["path"]
        assert path.is_file()
        assert row["raw_sha256"] == _sha256(path)
        assert row["size_bytes"] == path.stat().st_size


def test_locked_source_dataset_and_original_core_prediction_integrity_match():
    verification = build_invalidation_payload()["integrity_verification"]
    assert verification["locked_sources"]["locked_source_count"] == 11
    assert verification["locked_sources"]["all_match"] is True
    assert verification["locked_dataset"]["locked_split_count"] == 7
    assert verification["locked_dataset"]["all_split_hashes_match"] is True
    assert verification["locked_dataset"]["all_split_counts_match"] is True
    assert verification["locked_dataset"]["all_match"] is True
    core = verification["attempt_binding"]["core_holdout_prediction"]
    assert core["raw_sha256_matches_attempt"] is True
    assert core["count_matches_attempt"] is True
    assert core["original_core_prediction_binding_still_matches"] is True


def test_independent_replay_records_exact_n_over_n_for_all_six_splits():
    replay = build_invalidation_payload()["independent_split_expected_pass_replay"]
    expected = {
        "HOLDOUT_VALIDATION": "2475/2475",
        "SAFETY_CHALLENGE": "400/400",
        "CONTEXT_COUNTERFACTUAL": "300/300",
        "OOV_CHALLENGE": "100/100",
        "MONOTONIC_REGRESSION": "400/400",
        "IDENTITY_ANCHOR_CHALLENGE": "500/500",
    }
    assert replay["implementation"] == (
        "INDEPENDENT_STDLIB_REPLAY_WITHOUT_SCORER_OR_RUNTIME_IMPORT"
    )
    assert replay["split_count"] == 6
    assert replay["all_six_exact"] is True
    assert replay["all_match_persisted_canonical_metrics"] is True
    assert {split: row["exact_fraction"] for split, row in replay["splits"].items()} == expected
    assert all(row["case_observation_bijection"] for row in replay["splits"].values())


def test_release_authority_is_withdrawn_for_both_confirmed_defects():
    payload = build_invalidation_payload()
    replay = payload["independent_split_expected_pass_replay"]
    binding = payload["integrity_verification"]["attempt_binding"]
    defects = {row["defect_id"]: row for row in payload["release_authority"]["defects"]}

    assert payload["numerical_evidence"]["classification"] == "CONSISTENT_AS_CURRENTLY_PERSISTED"
    assert payload["numerical_evidence"]["consistent"] is True
    assert replay["all_canonical_metrics_present"] is True
    assert replay["all_audit_metrics_absent"] is True
    assert replay["all_reported_agreements_still_ok"] is True
    assert binding["required_output_artifact_count"] == 12
    assert binding["attempt_time_hash_bound_output_count"] == 1
    assert binding["attempt_time_unbound_output_count"] == 11
    assert binding["all_output_artifacts_attempt_time_hash_bound"] is False
    assert all(row["confirmed"] for row in defects.values())
    assert "CONTRARY_TO_ADR_0019" in defects["R3N5_INCOMPLETE_INDEPENDENT_SCORING"]["classification"]
    assert payload["release_authority"]["status"] == "WITHDRAWN"
    assert payload["verdict"] == INVALIDATION_VERDICT
    assert payload["all_checks_passed"] is True
    assert payload["r3n5_engineering_verdict_retained"] is False
    assert payload["next_phase"] == "MAI-07R3N6"
    assert payload["next_governed_phase"] == (
        "MAI-07R3N6-FRESH-HOLDOUT-COMPLETE-EVIDENCE-CORRECTIVE"
    )
    assert payload["new_release_candidate_required"] is True
    assert payload["quality_gates_passed"] is False
    assert payload["linguist_approved"] is False
    assert payload["production_approved"] is False
    assert payload["MAI-08"] == "NOT_STARTED"


def test_writer_is_exclusive_and_refuses_overwrite(tmp_path):
    target = tmp_path / "immutable_invalidation.json"
    payload = write_invalidation(target)
    first_bytes = target.read_bytes()
    assert first_bytes == serialize_invalidation(payload)
    with pytest.raises(FileExistsError, match="invalidation_already_exists"):
        write_invalidation(target)
    assert target.read_bytes() == first_bytes
