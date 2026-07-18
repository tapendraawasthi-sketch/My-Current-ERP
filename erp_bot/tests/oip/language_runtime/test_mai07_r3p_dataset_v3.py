"""MAI-07R3P V3 dataset freeze consumption tests."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

from src.oip.modules.language_runtime.transliteration.application.build_mai07r3p_dataset_v3 import (
    DATASET_ID,
    EXPECTED_FREEZE_SHA,
    THRESHOLD_MANIFEST,
    build_twice_and_verify,
    build_v3_cases,
)

REPO = Path(__file__).resolve().parents[4]
V3_MAN = REPO / "evals/mai07/manifests/MAI_07_ROMANIZED_TRANSLITERATION_V3.manifest.json"
THR_MAN = REPO / "evals/mai07/manifests/MAI_07_R3P_THRESHOLDS_V3.manifest.json"
REL_MAN = REPO / "evals/mai07/manifests/MAI_07_R3P_V3_RELEASE_CANDIDATE.manifest.json"
FREEZE = REPO / "docs/mokxya-ai/reviews/mai07_v3/MAI_07_V3_HUMAN_REVIEW_FREEZE_MANIFEST.json"


def test_freeze_pin():
    h = hashlib.sha256(FREEZE.read_bytes()).hexdigest()
    assert h == EXPECTED_FREEZE_SHA


def test_dataset_determinism_and_lineage():
    out = build_twice_and_verify(REPO)
    assert out["ok"]
    assert out["total_cases"] == 1111
    man = json.loads(V3_MAN.read_text(encoding="utf-8"))
    assert man["dataset_id"] == DATASET_ID
    assert man["dataset_hash"] == out["dataset_hash"]
    assert man["parent_freeze_sha256"] == EXPECTED_FREEZE_SHA
    assert man["prohibited_for_training"] is True
    assert man["option_a_mechanical_remap"] is True
    assert man["QUALITY_GATES_PASSED"] is False
    assert man["runtime_evaluation_performed"] is False


def test_thresholds_locked_before_observation():
    thr = json.loads(THR_MAN.read_text(encoding="utf-8"))
    assert thr["locked_before_runtime_observation"] is True
    assert thr["threshold_id"] == THRESHOLD_MANIFEST["threshold_id"]
    assert "target_candidate_top1_accuracy" in thr["gates"]


def test_pools_and_populations():
    built = build_v3_cases(REPO)
    r = built["reconciliation"]
    assert r["total_cases"] == 1111
    assert r["disposition_mismatch_fluent_vs_linguist"] == 0
    assert r["pool_counts"]["FROZEN_EVALUATION"] + r["pool_counts"]["POLICY_DEVELOPMENT"] == 1111
    assert "TRANSLITERATION_REQUIRED" in r["population_counts"]
    assert "IDENTITY_REQUIRED" in r["population_counts"]


def test_release_candidate_awaits_eval():
    rel = json.loads(REL_MAN.read_text(encoding="utf-8"))
    assert rel["dataset_id"] == DATASET_ID
    assert rel["QUALITY_GATES_PASSED"] is True
    assert rel["PRODUCTION_APPROVED"] is True
    assert rel["CUTOVER_AUTHORIZED"] is True
    assert rel["candidate_promoted"] is True
    assert rel["mai_08"] == "NOT_STARTED"
    assert rel["status"] == "V3_RUNTIME_CUTOVER_COMPLETE"
    assert rel["last_attempt_id"] == "MAI_07R3Q_FROZEN_V3_ATTEMPT_001"
    assert rel["last_verdict"] == "PASSED_QUALITY"
    assert rel["authority"] == "ADR_0024"
    assert rel["active_runtime_version"] == "mai-07.1.13-r3s-active"
    assert rel["active_pack_version"] == "mai-07.1.11-r3n6-chaincomplete"
