"""MAI-07R3I-FROZEN-REAUTHORIZED protocol — one-shot frozen V2 of sealed R3H2 RC."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

import pytest

from src.oip.modules.language_runtime.transliteration import (
    ENABLE_PROMOTION_OVERLAY,
    RESOURCE_PACK_VERSION,
    RUNTIME_VERSION,
)
from src.oip.modules.language_runtime.transliteration.application.eval_mai07_r3g_reauthorized import (
    EXPECTED as R3G_EXPECTED,
)
from src.oip.modules.language_runtime.transliteration.application.eval_mai07_r3i_frozen_reauthorized import (
    ATTEMPT_ID,
    ATTEMPT_PATH,
    AUTHORIZATION,
    CANDIDATE_LOCK_SEMANTIC,
    CANDIDATE_PACK_DIR,
    CANDIDATE_PACK_VERSION,
    CANDIDATE_POLICY_VERSION,
    CANDIDATE_RESOURCE_HASH,
    DEFAULT_PACK_VERSION,
    DEFAULT_RESOURCE_HASH,
    EXEC_PATH,
    FROZEN_HASHES,
    OUT,
    RC_CHAIN,
    RC_ID_SELECTED,
    RC_LOCK,
    REPO,
    SELECTION_PATH,
    execute_one_shot,
    immutability_preflight,
    lock_attempt_manifest,
    prove_candidate_pack_load,
    resolve_candidate_selection,
    schema_compatibility_preflight,
    validate_predictions,
    validate_selected_rc_chain,
    verify_r3h2_rc_chain,
    write_preflight_bundle,
)
from src.oip.modules.language_runtime.transliteration.infrastructure import (
    resource_repository as xlrr,
)
from src.oip.modules.language_runtime.transliteration.infrastructure.seal_contract_v2 import (
    predictions_canonical_list_sha256,
    predictions_jsonl_raw_sha256,
)

PRED_PATH = OUT / "reports/MAI_07R3I_V2_ONE_SHOT_PREDICTIONS.jsonl"
R3G002 = REPO / "evals/mai07/r3g_reauthorized_002"


def test_preflight_ok():
    pre = write_preflight_bundle(REPO)
    assert pre["status"] == "PREFLIGHT_OK", pre.get("errors")
    assert pre["frozen_v2_opened"] is False


def test_only_r3h2_rc_selectable():
    sel = resolve_candidate_selection(REPO)
    assert sel["selected_rc_id"] == RC_ID_SELECTED
    assert sel["active_frozen_candidate"] is True
    assert sel["prohibited_candidate_switch"] is True
    assert "R3H2" in sel["selected_rc_id"]
    assert "R3F_LOCK_CHAIN" not in sel["selected_rc_id"]
    assert "INVALIDATED" not in sel["selected_rc_id"]


def test_candidate_pack_sentinel_proves_r3h2_load():
    proof = prove_candidate_pack_load(REPO)
    assert proof["selected_candidate_pack_loaded"] is True
    assert proof["selected_resource_pack_version"] == CANDIDATE_PACK_VERSION
    assert proof["selected_resource_content_sha256"] == CANDIDATE_RESOURCE_HASH
    assert proof["selected_policy_version"] == CANDIDATE_POLICY_VERSION
    assert proof["default_pack_not_used"] is True
    assert proof["default_resource_content_sha256"] == DEFAULT_RESOURCE_HASH
    assert proof["frozen_case_used"] is False


def test_frozen_hashes_match_r3g_expected():
    imm = immutability_preflight(REPO)
    assert imm["ok"] is True, imm.get("errors")
    assert imm["hashes"]["v1"] == R3G_EXPECTED["v1"]
    assert imm["hashes"]["v2"] == R3G_EXPECTED["v2"]
    assert imm["hashes"]["v2_man"] == R3G_EXPECTED["v2_man"]
    assert imm["hashes"]["pop"] == R3G_EXPECTED["pop"]
    assert imm["hashes"]["thr"] == R3G_EXPECTED["thr"]
    assert imm["hashes"]["canonical_scorer_lf"] == R3G_EXPECTED["canonical_scorer_lf"]
    assert imm["hashes"]["audit_scorer_lf"] == R3G_EXPECTED["audit_scorer_lf"]
    assert FROZEN_HASHES["v2"] == R3G_EXPECTED["v2"]


def test_default_pack_not_used_as_frozen_runner():
    xlrr.load_resources(force_reload=True)
    assert xlrr.compute_pack_content_hash() == DEFAULT_RESOURCE_HASH
    assert RESOURCE_PACK_VERSION == DEFAULT_PACK_VERSION
    assert RUNTIME_VERSION == DEFAULT_PACK_VERSION
    cand = xlrr.compute_pack_content_hash(resources_dir=CANDIDATE_PACK_DIR)
    assert cand == CANDIDATE_RESOURCE_HASH
    assert cand != DEFAULT_RESOURCE_HASH
    assert ENABLE_PROMOTION_OVERLAY is False


def test_r3h2_rc_chain_verifies():
    v = verify_r3h2_rc_chain(REPO)
    assert v["ok"] is True, v.get("errors")
    assert v["locked_semantic_sha256"] == CANDIDATE_LOCK_SEMANTIC
    assert v["overlay_key_required_on_lock"] is False
    assert v["overlay_module_disabled"] is True
    chain = validate_selected_rc_chain(REPO)
    assert chain["ok"] is True, chain.get("errors")


def test_schema_compatibility_preflight():
    sc = schema_compatibility_preflight(REPO)
    assert sc["ok"] is True
    assert sc["synthetic_review_metadata_present"] is True
    assert sc["frozen_scorers_unpatched"] is True
    assert sc["r3c_saved_predictions_scored"] == 696


def test_cannot_lock_twice_after_lock():
    assert ATTEMPT_PATH.exists(), "attempt must be locked before this test suite expects immutability"
    with pytest.raises(FileExistsError, match="already locked"):
        lock_attempt_manifest(REPO)


def test_attempt_manifest_locked_not_run():
    att = json.loads(ATTEMPT_PATH.read_text(encoding="utf-8"))
    assert att["attempt_id"] == ATTEMPT_ID
    assert att["status"] == "LOCKED_NOT_RUN"
    assert att["authorization"] == AUTHORIZATION
    assert att["selected_rc_id"] == RC_ID_SELECTED
    assert att["selected_rc_lock_semantic_sha256"] == CANDIDATE_LOCK_SEMANTIC
    assert att["candidate_resource_content_sha256"] == CANDIDATE_RESOURCE_HASH
    assert att["overlay_enabled"] is False
    assert att["selected_candidate_pack_loaded"] is True
    assert att["default_pack_not_used"] is True
    assert att["prohibited_rerun"] is True
    assert att["frozen_opened_before_lock"] is False
    assert att["LINGUIST_APPROVED"] is False
    assert att["PRODUCTION_APPROVED"] is False


def test_invalidated_historical_rc_not_selected():
    sel = resolve_candidate_selection(REPO)
    assert sel["selected_rc_id"] == RC_ID_SELECTED
    blob = json.dumps(sel, sort_keys=True)
    assert "INVALIDATED_BY_SEAL_DRIFT" not in blob


def test_wrong_runtime_blocks(monkeypatch):
    from src.oip.modules.language_runtime.transliteration.application import (
        eval_mai07_r3i_frozen_reauthorized as mod,
    )

    monkeypatch.setattr(mod, "RUNTIME_VERSION", "mai-07.9.9-bad")
    imm = mod.immutability_preflight(REPO)
    assert imm["ok"] is False


def test_wrong_frozen_hash_blocks(monkeypatch):
    from src.oip.modules.language_runtime.transliteration.application import (
        eval_mai07_r3i_frozen_reauthorized as mod,
    )

    monkeypatch.setattr(
        mod,
        "FROZEN_HASHES",
        {**FROZEN_HASHES, "v2": "0" * 64},
    )
    imm = mod.immutability_preflight(REPO)
    assert imm["ok"] is False


def test_mai08_not_touched():
    ledger = json.loads(
        (REPO / "docs/mokxya-ai/MAI_PHASE_LEDGER.json").read_text(encoding="utf-8")
    )
    mai08 = next(p for p in ledger["phases"] if p["id"] == "MAI-08")
    assert mai08["status"] == "NOT_STARTED"


def test_historical_r3g002_unchanged():
    pred = R3G002 / "reports/MAI_07R3G_REAUTHORIZED_002_V2_ONE_SHOT_PREDICTIONS.jsonl"
    assert pred.exists()
    canon = R3G002 / "reports/MAI_07R3G_REAUTHORIZED_002_V2_CANONICAL_SCORE_REPORT.json"
    assert canon.exists()
    att = json.loads(
        (R3G002 / "MAI_07R3G_REAUTHORIZED_002_FROZEN_V2_ATTEMPT.manifest.json").read_text(
            encoding="utf-8"
        )
    )
    assert att["status"] == "LOCKED_NOT_RUN"


def test_r3h2_lock_unchanged_after_protocol():
    lock = json.loads(RC_LOCK.read_text(encoding="utf-8"))
    assert lock["status"] == "LOCKED_NOT_RUN"
    assert lock["rc_manifest_semantic_sha256"] == CANDIDATE_LOCK_SEMANTIC
    assert hashlib.sha256(RC_LOCK.read_bytes()).hexdigest()
    assert RC_CHAIN.exists()


# --- execute-dependent (skip until EXEC_PATH exists) ---


@pytest.mark.skipif(not EXEC_PATH.exists(), reason="R3I frozen execute not yet run")
def test_attempt_cannot_execute_twice():
    with pytest.raises(RuntimeError, match="already consumed"):
        execute_one_shot(REPO)


@pytest.mark.skipif(not EXEC_PATH.exists(), reason="R3I frozen execute not yet run")
def test_saved_predictions_696_unique_ids():
    preds = [
        json.loads(ln)
        for ln in PRED_PATH.read_text(encoding="utf-8").splitlines()
        if ln.strip()
    ]
    ids = [p["case_id"] for p in preds]
    assert len(ids) == 696
    assert len(set(ids)) == 696
    v = validate_predictions(preds, set(ids))
    assert v["ok"] is True
    assert all(p.get("resource_pack_version") == CANDIDATE_PACK_VERSION for p in preds)


@pytest.mark.skipif(not EXEC_PATH.exists(), reason="R3I frozen execute not yet run")
def test_raw_and_canonical_prediction_hashes_distinct():
    preds = [
        json.loads(ln)
        for ln in PRED_PATH.read_text(encoding="utf-8").splitlines()
        if ln.strip()
    ]
    raw = predictions_jsonl_raw_sha256(PRED_PATH)
    canon = predictions_canonical_list_sha256(preds)
    assert raw != canon
    exec_obj = json.loads(EXEC_PATH.read_text(encoding="utf-8"))
    assert exec_obj["predictions_jsonl_raw_sha256"] == raw
    assert exec_obj["predictions_canonical_list_sha256"] == canon


@pytest.mark.skipif(not EXEC_PATH.exists(), reason="R3I frozen execute not yet run")
def test_canonical_and_audit_scorers_agree():
    audit = json.loads(
        (OUT / "reports/MAI_07R3I_V2_AUDIT_SCORE_REPORT.json").read_text(encoding="utf-8")
    )
    assert audit["agrees_with_canonical"] is True


@pytest.mark.skipif(not EXEC_PATH.exists(), reason="R3I frozen execute not yet run")
def test_mathematical_invariants():
    qual = json.loads((OUT / f"{ATTEMPT_ID}.QUALITY_RESULT.json").read_text(encoding="utf-8"))
    canon = json.loads(
        (OUT / "reports/MAI_07R3I_V2_CANONICAL_SCORE_REPORT.json").read_text(encoding="utf-8")
    )
    assert canon.get("invariant_errors") == []
    tgt = qual["metrics"]["target"]
    r1 = tgt["TARGET_RECALL_AT_1"]["numerator"]
    top1 = tgt["TARGET_TOP1_ACCEPTABLE"]["numerator"]
    mrr = tgt["TARGET_MRR"]["value_float"]
    r5 = tgt["TARGET_RECALL_AT_5"]["value_float"]
    assert top1 == r1
    assert r5 >= mrr >= top1 / tgt["denominator"]


@pytest.mark.skipif(not EXEC_PATH.exists(), reason="R3I frozen execute not yet run")
def test_mutation_guard_zero():
    exec_obj = json.loads(EXEC_PATH.read_text(encoding="utf-8"))
    assert exec_obj["mutation_attempts"] == 0
    assert exec_obj["successful_mutations"] == 0


@pytest.mark.skipif(not EXEC_PATH.exists(), reason="R3I frozen execute not yet run")
def test_frozen_text_not_in_public_reports():
    for path in OUT.glob("reports/*.json"):
        text = path.read_text(encoding="utf-8", errors="replace")
        assert "input_text" not in text
    for path in OUT.glob("*.json"):
        text = path.read_text(encoding="utf-8", errors="replace")
        assert "input_text" not in text


@pytest.mark.skipif(not EXEC_PATH.exists(), reason="R3I frozen execute not yet run")
def test_quality_failure_does_not_imply_rerun():
    att = json.loads(ATTEMPT_PATH.read_text(encoding="utf-8"))
    assert att["status"] == "LOCKED_NOT_RUN"
    assert att["prohibited_rerun"] is True
    with pytest.raises(RuntimeError, match="already consumed"):
        execute_one_shot(REPO)


@pytest.mark.skipif(not EXEC_PATH.exists(), reason="R3I frozen execute not yet run")
def test_pass_does_not_imply_linguist_or_production():
    qual = json.loads((OUT / f"{ATTEMPT_ID}.QUALITY_RESULT.json").read_text(encoding="utf-8"))
    assert qual["LINGUIST_APPROVED"] is False
    assert qual["PRODUCTION_APPROVED"] is False
    assert qual["status"] == "FAILED_QUALITY"
    assert qual["QUALITY_GATES_PASSED"] is False


@pytest.mark.skipif(not EXEC_PATH.exists(), reason="R3I frozen execute not yet run")
def test_failed_quality_does_not_promote_r3h2_or_start_mai08():
    from src.oip.modules.language_runtime.transliteration import (
        RESOURCE_PACK_VERSION,
        RUNTIME_VERSION,
    )

    assert RESOURCE_PACK_VERSION == DEFAULT_PACK_VERSION
    assert RUNTIME_VERSION == DEFAULT_PACK_VERSION
    assert xlrr.compute_pack_content_hash() == DEFAULT_RESOURCE_HASH
    ledger = json.loads(
        (REPO / "docs/mokxya-ai/MAI_PHASE_LEDGER.json").read_text(encoding="utf-8")
    )
    mai08 = next(p for p in ledger["phases"] if p["id"] == "MAI-08")
    assert mai08["status"] == "NOT_STARTED"
    r3i = next(p for p in ledger["phases"] if p["id"] == "MAI-07R3I")
    assert r3i["status"] == "FAILED_QUALITY"
    assert r3i["pack_promoted"] is False


@pytest.mark.skipif(not EXEC_PATH.exists(), reason="R3I frozen execute not yet run")
def test_negative_control_target_scoring_non_vacuous():
    canon = json.loads(
        (OUT / "reports/MAI_07R3I_V2_CANONICAL_SCORE_REPORT.json").read_text(encoding="utf-8")
    )
    tgt = canon["metrics"]["target"]["TARGET_TOP1_ACCEPTABLE"]
    assert tgt["denominator"] == 288
    assert tgt["numerator"] < tgt["denominator"]


def test_selection_path_exists_after_preflight():
    assert SELECTION_PATH.exists() or ATTEMPT_PATH.exists()
