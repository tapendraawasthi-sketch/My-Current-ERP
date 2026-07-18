"""MAI-07R3F-SEAL-LOCK-CHAIN — append-only RC lock chain tests."""

from __future__ import annotations

import copy
import hashlib
import json
import tempfile
from pathlib import Path

import pytest

from src.oip.modules.language_runtime.transliteration import (
    ENABLE_PROMOTION_OVERLAY,
    PARENT_R3F_INVALIDATED_RC_HASH,
    PARENT_R3F_INVALIDATED_STATUS,
    RESOURCE_PACK_VERSION,
    RUNTIME_VERSION,
)
from src.oip.modules.language_runtime.transliteration.application.build_mai07r3f_seal_lock_chain_rc import (
    LOCK_PATH,
    RC_ID,
    build_lock_body,
)
from src.oip.modules.language_runtime.transliteration.application.eval_mai07_r3f_seal_lock_chain import (
    ATTEMPT_PATH,
    CHAIN_PATH,
    LOCK_PATH as EVAL_LOCK_PATH,
    QUAL_PATH,
)
from src.oip.modules.language_runtime.transliteration.application.eval_mai07_r3f_seal_lock_chain_preflight import (
    write_branch_a_discovery,
    write_preflight_report,
)
from src.oip.modules.language_runtime.transliteration.infrastructure import (
    resource_repository as xlrr,
)
from src.oip.modules.language_runtime.transliteration.application.rc_lock_chain import (
    POST_HOLDOUT_FORBIDDEN_IN_LOCK,
    build_locked_rc,
    compute_rc_semantic_body_sha256,
    create_qualification_result,
    verify_complete_chain,
    verify_locked_rc,
)
from src.oip.modules.language_runtime.transliteration.application.rc_lock_chain_discovery import (
    EXPECTED_LOCK_SEMANTIC,
    EXPECTED_POST_HOLDOUT_SEMANTIC,
    branch_a_report,
    search_exact_lock_body,
)
from src.oip.modules.language_runtime.transliteration.infrastructure.seal_contract_v2 import (
    SEAL_CONTRACT_VERSION,
    predictions_canonical_list_sha256,
    predictions_jsonl_raw_sha256,
    sha256_file,
)

REPO = Path(__file__).resolve().parents[4]
OUT = REPO / "evals/mai07_r3f_seal_lock_chain"
SEAL_NEW = REPO / "evals/mai07_r3f_seal_new"
OLD = REPO / "evals/mai07_r3f_english_identity"
V1 = "5637ccd973173edde3637ce0aeca8e8647431614940fb8a06ceb102e1c736208"
V2 = "0cee0c07d07430bded793e2dbe162e7b496223ecff762cdd69bca8d8d992d4b9"
LOCK_SEM = "63a900a6fcb45be4e45dc059715050fa0b73b381b4f6fd3c9484a2de670ca70e"
LOCK_RAW_FILE = "643dbf93f925ff3a8a5255cb02bfac01cdea41a0ae0ceda2bc1c6064c1fa5a83"
PRED_RAW = "6483be8ddeb97199ce904abeda4c10c5e8b30c261d874bf5ac5cf869ea105d07"
PRED_CANON = "36e99cce4ef2eb341aa4f237cfbdd34afbcc9db0b40e6cf9c20d0674e4d84a87"


@pytest.fixture(scope="module")
def lock_hash_snapshot() -> str:
    return sha256_file(LOCK_PATH)


def test_branch_a_discovery_does_not_mutate_candidates():
    artifacts = [
        OUT / f"{RC_ID}.LOCKED_NOT_RUN.json",
        SEAL_NEW / "MAI_07R3F_SEAL_NEW_RELEASE_CANDIDATE_001.LOCKED_NOT_RUN.json",
    ]
    before = {str(p): sha256_file(p) for p in artifacts if p.exists()}
    search_exact_lock_body(REPO)
    after = {str(p): sha256_file(p) for p in artifacts if p.exists()}
    assert before == after


def test_branch_a_exact_f4c07e24_recovered_in_immutable_file():
    lock_path = SEAL_NEW / "MAI_07R3F_SEAL_NEW_RELEASE_CANDIDATE_001.LOCKED_NOT_RUN.json"
    assert lock_path.exists()
    lock = json.loads(lock_path.read_text(encoding="utf-8"))
    assert compute_rc_semantic_body_sha256(lock) == EXPECTED_LOCK_SEMANTIC
    report = branch_a_report(REPO)
    assert report["reconstruction"]["exact_match"] is True
    assert report["search"]["ok"] is True


def test_locked_body_semantic_hash():
    lock = json.loads(LOCK_PATH.read_text(encoding="utf-8"))
    assert compute_rc_semantic_body_sha256(lock) == LOCK_SEM
    assert lock["manifest_sha256"] == LOCK_SEM


def test_dual_build_reconstruction_identical():
    body = build_lock_body()
    with tempfile.TemporaryDirectory() as ta, tempfile.TemporaryDirectory() as tb:
        pa = Path(ta) / "x.json"
        pb = Path(tb) / "x.json"
        build_locked_rc(body, output_path=pa, dual_build_check=True)
        build_locked_rc(body, output_path=pb, dual_build_check=True)
        assert pa.read_bytes() == pb.read_bytes()


def test_hash_forcing_field_manipulation_rejected():
    lock = json.loads(LOCK_PATH.read_text(encoding="utf-8"))
    tampered = copy.deepcopy(lock)
    tampered["note"] = tampered.get("note", "") + " forced"
    tampered["manifest_sha256"] = EXPECTED_LOCK_SEMANTIC
    v = verify_locked_rc(tampered, expected_semantic=LOCK_SEM)
    assert v["ok"] is False


def test_locked_not_run_rejects_post_holdout_fields():
    body = build_lock_body()
    for field in ("holdout_attempt", "predictions_jsonl_raw_sha256", "metrics"):
        bad = copy.deepcopy(body)
        bad[field] = {"x": 1}
        with tempfile.TemporaryDirectory() as td:
            p = Path(td) / "bad.json"
            build_locked_rc(bad, output_path=p, dual_build_check=False)
            obj = json.loads(p.read_text(encoding="utf-8"))
            assert field not in obj or field in POST_HOLDOUT_FORBIDDEN_IN_LOCK


def test_qualification_is_separate_artifact():
    assert QUAL_PATH.exists()
    qual = json.loads(QUAL_PATH.read_text(encoding="utf-8"))
    lock = json.loads(LOCK_PATH.read_text(encoding="utf-8"))
    assert qual["record_type"] == "QUALIFICATION_RESULT"
    assert qual["parent_lock_semantic_sha256"] == LOCK_SEM
    for field in POST_HOLDOUT_FORBIDDEN_IN_LOCK:
        assert field not in lock


def test_lock_unchanged_after_qualification(lock_hash_snapshot: str):
    assert sha256_file(LOCK_PATH) == lock_hash_snapshot
    assert sha256_file(LOCK_PATH) == LOCK_RAW_FILE


def test_missing_lock_body_fails_closed():
    chain = {
        "locked_not_run_path": "evals/missing/NO_LOCK.json",
        "locked_semantic_sha256": LOCK_SEM,
        "locked_raw_sha256": LOCK_RAW_FILE,
        "holdout_attempt_path": "evals/mai07_r3f_seal_lock_chain/x.json",
    }
    v = verify_complete_chain(chain, REPO)
    assert v["ok"] is False
    assert "missing_locked_body" in v["errors"]


def test_raw_and_canonical_prediction_hashes_distinct():
    pred_path = OUT / "reports/MAI_07R3F_LOCK_CHAIN_HOLDOUT_VALIDATION_PREDICTIONS.jsonl"
    preds = [json.loads(ln) for ln in pred_path.read_text(encoding="utf-8").splitlines() if ln.strip()]
    raw = predictions_jsonl_raw_sha256(pred_path)
    canon = predictions_canonical_list_sha256(preds)
    assert raw == PRED_RAW
    assert canon == PRED_CANON
    assert raw != canon


def test_runtime_resource_mismatch_fails_chain_binding():
    chain = json.loads(CHAIN_PATH.read_text(encoding="utf-8"))
    bad = copy.deepcopy(chain)
    bad["locked_semantic_sha256"] = "0" * 64
    v = verify_complete_chain(bad, REPO)
    assert v["ok"] is False


def test_dataset_threshold_binding():
    lock = json.loads(LOCK_PATH.read_text(encoding="utf-8"))
    ds = json.loads((OUT / "MAI_07R3F_SEAL_LOCK_CHAIN_DATASET_MANIFEST.json").read_text(encoding="utf-8"))
    thr = sha256_file(OUT / "MAI_07R3F_SEAL_LOCK_CHAIN_HOLDOUT_THRESHOLDS.json")
    assert lock["fresh_holdout_dataset_sha256"] == ds["splits"]["HOLDOUT_VALIDATION"]["sha256"]
    assert lock["threshold_sha256"] == thr


def test_overlay_enabled_rc_fails():
    lock = json.loads(LOCK_PATH.read_text(encoding="utf-8"))
    bad = copy.deepcopy(lock)
    bad["ENABLE_PROMOTION_OVERLAY"] = True
    v = verify_locked_rc(bad)
    assert v["ok"] is False
    assert "overlay_enabled" in v["errors"]


def test_duplicate_attempt_fails_on_rerun():
    assert ATTEMPT_PATH.exists()
    from src.oip.modules.language_runtime.transliteration.application import (
        eval_mai07_r3f_seal_lock_chain as ev,
    )

    with pytest.raises(RuntimeError, match="prohibited_rerun|attempt exists"):
        ev.run_split("HOLDOUT_VALIDATION", write=False, one_shot=True)


def test_complete_chain_verifies():
    chain = json.loads(CHAIN_PATH.read_text(encoding="utf-8"))
    v = verify_complete_chain(chain, REPO)
    assert v["ok"] is True, v["errors"]
    assert chain["verdict"] == "PASSED_NEW_LOCK_CHAIN_RC"


def test_historical_invalidated_rc_unchanged():
    rc = json.loads((OLD / "MAI_07R3F_RELEASE_CANDIDATE.manifest.json").read_text(encoding="utf-8"))
    assert rc["manifest_sha256"] == PARENT_R3F_INVALIDATED_RC_HASH
    inv = json.loads((OLD / "MAI_07R3F_RELEASE_CANDIDATE.INVALIDATION.json").read_text(encoding="utf-8"))
    assert inv["parent_rc_status"] == PARENT_R3F_INVALIDATED_STATUS


def test_historical_r3e_and_blocked_r3g_unchanged():
    r3g = json.loads(
        (REPO / "evals/mai07/r3g/reports/MAI_07R3G_PREFLIGHT_REPORT.json").read_text(encoding="utf-8")
    )
    assert r3g["status"] == "BLOCKED_PRECONDITION_FAILED"
    reauth = json.loads(
        (REPO / "evals/mai07/r3g_reauthorized/reports/MAI_07R3G_REAUTHORIZED_PREFLIGHT_REPORT.json").read_text(
            encoding="utf-8"
        )
    )
    assert reauth["status"] == "BLOCKED_PRECONDITION_FAILED"


def test_v1_v2_population_threshold_hashes_unchanged():
    def ds_hash(manifest_path: Path) -> str:
        man = json.loads(manifest_path.read_text(encoding="utf-8"))
        h = hashlib.sha256()
        for f in sorted(man["files"], key=lambda x: x["suite_id"]):
            h.update(f["suite_id"].encode())
            h.update(b"\0")
            h.update((REPO / f["path"]).read_bytes())
        return h.hexdigest()

    assert (
        ds_hash(REPO / "evals/mai07/manifests/MAI_07_ROMANIZED_TRANSLITERATION_V1.manifest.json")
        == V1
    )
    assert (
        ds_hash(REPO / "evals/mai07/manifests/MAI_07_ROMANIZED_TRANSLITERATION_V2.manifest.json")
        == V2
    )
    pop_path = REPO / "evals/mai07/manifests/MAI_07_R3C_POPULATIONS_V2.manifest.json"
    assert sha256_file(pop_path) == "a8461f62acac98561605e5b2ffb2475bb73a3d15cf0f32ef7b98f1247de85632"
    thr_path = REPO / "evals/mai07/manifests/MAI_07_R3C_THRESHOLDS_V1.manifest.json"
    assert sha256_file(thr_path) == "aa4b5d68852edbed7cdc5f025b8051b3235078a65fb78bb0aca3a342fcdf04ef"


def test_runtime_no_frozen_imports():
    xl = REPO / "erp_bot/src/oip/modules/language_runtime/transliteration"
    forbidden = ("frozen_v2", "MAI_07R3C_V2", "review_import", "r3g_reauthorized")
    for rel in (
        "application/transliteration_service.py",
        "infrastructure/deterministic_ranker.py",
        "infrastructure/deterministic_generator.py",
    ):
        text = (xl / rel).read_text(encoding="utf-8")
        for token in forbidden:
            assert token not in text


def test_no_frozen_v2_execution_in_lock_chain_phase():
    chain = json.loads(CHAIN_PATH.read_text(encoding="utf-8"))
    assert chain["frozen_v2_opened"] is False
    pre = write_preflight_report(REPO)
    assert pre["frozen_v2_opened"] is False


def test_no_linguist_production_approval_inferred():
    chain = json.loads(CHAIN_PATH.read_text(encoding="utf-8"))
    qual = json.loads(QUAL_PATH.read_text(encoding="utf-8"))
    assert chain["LINGUIST_APPROVED"] is False
    assert chain["PRODUCTION_APPROVED"] is False
    assert chain["QUALITY_GATES_PASSED"] is False
    assert qual["QUALITY_GATES_PASSED"] is False


def test_fresh_holdout_no_seal_new_reuse():
    man = json.loads((OUT / "MAI_07R3F_SEAL_LOCK_CHAIN_DATASET_MANIFEST.json").read_text(encoding="utf-8"))
    assert man["fresh_vs_seal_new"]["seal_new_holdout_reused"] is False
    assert man["fresh_vs_seal_new"]["exact_sentence_duplicates_vs_seal_new"] == 0
    seal_texts = set()
    for line in (SEAL_NEW / "holdout_validation.jsonl").read_text(encoding="utf-8").splitlines():
        if line.strip():
            seal_texts.add(json.loads(line)["input_text"].strip())
    for line in (OUT / "holdout_validation.jsonl").read_text(encoding="utf-8").splitlines():
        if line.strip():
            assert json.loads(line)["input_text"].strip() not in seal_texts


def test_active_runtime_and_resource():
    assert RUNTIME_VERSION == "mai-07.1.13-r3s-active"
    assert ENABLE_PROMOTION_OVERLAY is False
    assert xlrr.compute_pack_content_hash() == "1617425373bf525968b5af2a3b1cc8b8e5ad83e68457cfbbb47c73c78c84e930"
    lock = json.loads(LOCK_PATH.read_text(encoding="utf-8"))
    assert lock["resource_content_sha256"] == xlrr.compute_pack_content_hash()
    assert lock["seal_contract_version"] == SEAL_CONTRACT_VERSION


def test_seal_new_post_holdout_semantic_unchanged():
    rc = json.loads(
        (SEAL_NEW / "MAI_07R3F_SEAL_NEW_RELEASE_CANDIDATE_001.manifest.json").read_text(encoding="utf-8")
    )
    assert rc["rc_manifest_semantic_sha256"] == EXPECTED_POST_HOLDOUT_SEMANTIC


def test_branch_a_discovery_report_written():
    bundle = write_branch_a_discovery(REPO)
    path = REPO / bundle["path"]
    assert path.exists()


def test_lock_existed_before_attempt():
    lock = json.loads(LOCK_PATH.read_text(encoding="utf-8"))
    record = json.loads((OUT / f"{RC_ID}.LOCK_RECORD.json").read_text(encoding="utf-8"))
    attempt = json.loads(ATTEMPT_PATH.read_text(encoding="utf-8"))
    assert record["rc_manifest_semantic_sha256"] == LOCK_SEM
    assert attempt["parent_lock_semantic_sha256"] == LOCK_SEM
    assert lock["status"] == "LOCKED_NOT_RUN"


def test_check_twice_and_resource_validation_read_only():
    before = sha256_file(xlrr.RESOURCES_DIR / "romanized_lexicon.json")
    assert xlrr.validate_resources()["ok"] is True
    assert xlrr.check_twice_isolated()["second_run_no_diff"] is True
    assert sha256_file(xlrr.RESOURCES_DIR / "romanized_lexicon.json") == before
