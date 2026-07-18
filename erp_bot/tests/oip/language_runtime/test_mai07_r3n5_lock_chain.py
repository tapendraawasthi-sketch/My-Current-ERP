from __future__ import annotations

import json
from pathlib import Path

import pytest

from erp_bot.src.oip.modules.language_runtime.transliteration.application.eval_mai07_r3n5 import (
    ATTEMPT_PATH,
    CHAIN_PATH,
    LOCKED_PATH,
    LOCK_RECORD_PATH,
    PARENT_FAILED_R3N4_LOCK_SEMANTIC,
    QUALIFICATION_PATH,
    RC_ID,
    preflight,
)
from erp_bot.src.oip.modules.language_runtime.transliteration.application.rc_lock_chain import (
    POST_HOLDOUT_FORBIDDEN_IN_LOCK,
    compute_rc_semantic_body_sha256,
    verify_locked_rc,
    verify_complete_chain,
)
from erp_bot.src.oip.modules.language_runtime.transliteration.infrastructure.seal_contract_v2 import sha256_file


def _load(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def test_ready_to_lock_preflight_is_read_only_and_complete():
    before = {path: path.exists() for path in (LOCKED_PATH, LOCK_RECORD_PATH, ATTEMPT_PATH, QUALIFICATION_PATH, CHAIN_PATH)}
    result = preflight()
    after = {path: path.exists() for path in before}
    if CHAIN_PATH.exists():
        # After the single attempt is consumed, readiness must fail only because
        # holdout artifacts now truthfully exist; all substantive gates remain.
        assert result["ok"] is False
        assert result["no_holdout_artifacts"] is False
    else:
        assert result["ok"] is True
        assert result["no_holdout_artifacts"] is True
    assert result["threshold_minima_ok"] is True
    assert result["threshold_lock_ok"] is True
    assert result["development_ok"] is True
    assert result["canonical_audit_agreement"]["ok"] is True
    assert result["case_agreement"]["ok"] is True
    assert before == after


@pytest.mark.skipif(not LOCKED_PATH.exists(), reason="R3N5 immutable lock not created yet")
def test_physical_lock_is_verifier_valid_and_semantically_bound():
    locked = _load(LOCKED_PATH)
    verification = verify_locked_rc(locked)
    assert verification["ok"] is True
    assert locked["ENABLE_PROMOTION_OVERLAY"] is False
    assert locked["rc_manifest_semantic_sha256"] == compute_rc_semantic_body_sha256(locked)
    assert len(sha256_file(LOCKED_PATH)) == 64
    assert not (set(locked) & POST_HOLDOUT_FORBIDDEN_IN_LOCK)


@pytest.mark.skipif(not LOCK_RECORD_PATH.exists(), reason="R3N5 lock record not created yet")
def test_lock_record_uses_physical_hash_and_parent_semantic():
    record = _load(LOCK_RECORD_PATH)
    assert record["rc_id"] == RC_ID
    assert record["rc_manifest_raw_sha256"] == sha256_file(LOCKED_PATH)
    assert record["parent_lock_semantic_sha256"] == PARENT_FAILED_R3N4_LOCK_SEMANTIC


def test_no_second_r3n5_rc_exists():
    assert not (LOCKED_PATH.parent / "MAI_07R3N5_FRESH_HOLDOUT_RELEASE_CANDIDATE_002.LOCKED_NOT_RUN.json").exists()


@pytest.mark.skipif(not CHAIN_PATH.exists(), reason="R3N5 holdout not consumed yet")
def test_complete_chain_physical_hashes_and_verdict():
    chain = _load(CHAIN_PATH)
    attempt = _load(ATTEMPT_PATH)
    qualification = _load(QUALIFICATION_PATH)
    assert verify_complete_chain(chain, LOCKED_PATH.parents[2])["ok"] is True
    assert chain["locked_raw_sha256"] == sha256_file(LOCKED_PATH)
    assert attempt["parent_lock_raw_sha256"] == sha256_file(LOCKED_PATH)
    assert chain["verdict"] == "PASSED_FRESH_HOLDOUT_CORRECTIVE_RC"
    assert qualification["engineering_verdict"] == "PASSED_FRESH_HOLDOUT_CORRECTIVE_RC"
    assert qualification["candidate_promoted"] is False
    assert qualification["MAI-08"] == "NOT_STARTED"


@pytest.mark.skipif(not QUALIFICATION_PATH.exists(), reason="R3N5 holdout not consumed yet")
def test_exact_required_holdout_metrics_pass():
    metrics = _load(QUALIFICATION_PATH)["metrics_summary"]
    expected = {
        "identity_retention": (850, 850),
        "exact_raw_identity": (850, 850),
        "exactly_one_identity": (850, 850),
        "identity_invariant_analogue": (350, 350),
        "cap_pressure_identity_retention": (350, 350),
        "finalizer_idempotence": (2475, 2475),
        "path_finalization_coverage": (2475, 2475),
        "anchor_validity": (850, 850),
    }
    for metric_id, (numerator, denominator) in expected.items():
        assert metrics[metric_id]["numerator"] == numerator
        assert metrics[metric_id]["denominator"] == denominator


@pytest.mark.skipif(not LOCKED_PATH.exists(), reason="R3N5 immutable lock not created yet")
def test_all_locked_source_hashes_still_match():
    locked = _load(LOCKED_PATH)
    app = LOCKED_PATH.parents[2] / "erp_bot/src/oip/modules/language_runtime/transliteration/application"
    for filename, expected in locked["source_hashes"].items():
        assert sha256_file(app / filename) == expected, filename
