"""MAI-07R3G-REAUTHORIZED-002 protocol — one-shot frozen V2 of sealed R3F candidate."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

import pytest

from src.oip.modules.language_runtime.transliteration import (
    ENABLE_PROMOTION_OVERLAY,
    RUNTIME_VERSION,
)
from src.oip.modules.language_runtime.transliteration.application.eval_mai07_r3g_reauthorized import (
    EXPECTED as R3G_EXPECTED,
)
from src.oip.modules.language_runtime.transliteration.application.eval_mai07_r3g_reauthorized_002 import (
    ATTEMPT_ID,
    ATTEMPT_PATH,
    EXEC_PATH,
    RC_ID_NOT_SELECTED,
    RC_ID_SELECTED,
    RC_001_CHAIN,
    RC_001_LOCK,
    RC_002_CHAIN,
    RC_002_LOCK,
    REPO,
    SELECTION_PATH,
    execute_one_shot,
    immutability_preflight,
    lock_attempt_manifest,
    resolve_candidate_selection,
    scorer_compatibility_preflight,
    validate_predictions,
    validate_selected_rc_chain,
    write_preflight_bundle,
)
from src.oip.modules.language_runtime.transliteration.application.rc_lock_chain import (
    verify_complete_chain,
    verify_locked_rc,
)
from src.oip.modules.language_runtime.transliteration.infrastructure.seal_contract_v2 import (
    predictions_canonical_list_sha256,
    predictions_jsonl_raw_sha256,
)
from src.oip.modules.language_runtime.transliteration.infrastructure import (
    resource_repository as xlrr,
)

OUT = REPO / "evals/mai07/r3g_reauthorized_002"
R3E = REPO / "evals/mai07/r3e"
R3G_HIST = REPO / "evals/mai07/r3g"
R3G_REAUTH = REPO / "evals/mai07/r3g_reauthorized"
PRED_PATH = OUT / "reports/MAI_07R3G_REAUTHORIZED_002_V2_ONE_SHOT_PREDICTIONS.jsonl"


@pytest.fixture(scope="module")
def artifact_hashes() -> dict[str, str]:
    return {
        "selection": hashlib.sha256(SELECTION_PATH.read_bytes()).hexdigest(),
        "attempt": hashlib.sha256(ATTEMPT_PATH.read_bytes()).hexdigest(),
        "rc001_chain": hashlib.sha256(RC_001_CHAIN.read_bytes()).hexdigest(),
        "rc002_chain": hashlib.sha256(RC_002_CHAIN.read_bytes()).hexdigest(),
        "rc001_lock": hashlib.sha256(RC_001_LOCK.read_bytes()).hexdigest(),
        "rc002_lock": hashlib.sha256(RC_002_LOCK.read_bytes()).hexdigest(),
        "r3e_pred": hashlib.sha256(
            (R3E / "reports/MAI_07R3E_V2_ONE_SHOT_PREDICTIONS.jsonl").read_bytes()
        ).hexdigest(),
        "r3g_hist_preflight": hashlib.sha256(
            (R3G_HIST / "reports/MAI_07R3G_PREFLIGHT_REPORT.json").read_bytes()
        ).hexdigest(),
    }


def test_exactly_one_rc_authoritative():
    sel = resolve_candidate_selection(REPO)
    assert sel["selected_rc_id"] == RC_ID_SELECTED
    assert sel["active_frozen_candidate"] is True
    assert sel["eligible_for_frozen_evaluation"] is True
    assert sel["prohibited_candidate_switch"] is True


def test_both_rcs_cannot_be_executed():
    att = json.loads(ATTEMPT_PATH.read_text(encoding="utf-8"))
    assert att["selected_rc_id"] == RC_ID_SELECTED
    assert att["selected_rc_id"] != RC_ID_NOT_SELECTED
    with pytest.raises(RuntimeError, match="already consumed"):
        execute_one_shot(REPO)


def test_candidate_selection_does_not_use_frozen_results():
    sel = json.loads(SELECTION_PATH.read_text(encoding="utf-8"))
    blob = json.dumps(sel, sort_keys=True)
    assert "frozen" not in blob.lower() or "prohibited_frozen_candidate_comparison" in blob
    assert not (OUT / "reports").glob("*SCORE*") or sel["created_utc"] <= json.loads(
        ATTEMPT_PATH.read_text(encoding="utf-8")
    )["created_utc"]


def test_semantically_different_rcs_block(monkeypatch, tmp_path):
    from src.oip.modules.language_runtime.transliteration.application import (
        eval_mai07_r3g_reauthorized_002 as mod,
    )

    lock1 = json.loads(RC_001_LOCK.read_text(encoding="utf-8"))
    lock2 = json.loads(RC_002_LOCK.read_text(encoding="utf-8"))
    bind1 = mod._semantic_binding(lock1)
    bind2 = dict(mod._semantic_binding(lock2))
    bind2["runtime_version"] = "mai-07.9.9-fake"
    rc002_id = lock2["manifest_id"]

    def _patched(lock: dict) -> dict:
        if lock.get("manifest_id") == rc002_id:
            return bind2
        return bind1

    monkeypatch.setattr(mod, "SELECTION_PATH", tmp_path / "candidate_selection.json")
    monkeypatch.setattr(mod, "_semantic_binding", _patched)
    with pytest.raises(RuntimeError, match="AMBIGUOUS|differs"):
        mod.resolve_candidate_selection(REPO)


def test_rc002_preference_is_evidence_strength_only():
    sel = resolve_candidate_selection(REPO)
    assert sel["selection_rule"].startswith("PREFER_PHYSICALLY_PRESERVED")
    assert sel["non_selected_disposition"] == "HISTORICAL_RECOVERED_EQUIVALENT_NOT_SELECTED"
    assert sel["semantic_equivalence_evidence"]["bindings_identical"] is True


def test_selected_lock_chain_verifies():
    chain = validate_selected_rc_chain(REPO)
    assert chain["ok"] is True, chain.get("errors")


def test_non_selected_chain_unchanged(artifact_hashes):
    v = verify_complete_chain(json.loads(RC_001_CHAIN.read_text(encoding="utf-8")), REPO)
    assert v["ok"] is True
    assert hashlib.sha256(RC_001_CHAIN.read_bytes()).hexdigest() == artifact_hashes["rc001_chain"]


def test_candidate_selection_immutable(artifact_hashes):
    assert SELECTION_PATH.exists()
    assert hashlib.sha256(SELECTION_PATH.read_bytes()).hexdigest() == artifact_hashes["selection"]


def test_attempt_cannot_lock_without_selection(monkeypatch, tmp_path):
    from src.oip.modules.language_runtime.transliteration.application import (
        eval_mai07_r3g_reauthorized_002 as mod,
    )

    monkeypatch.setattr(mod, "SELECTION_PATH", tmp_path / "missing_selection.json")

    def _missing(_repo):
        raise FileNotFoundError("candidate selection missing")

    monkeypatch.setattr(mod, "resolve_candidate_selection", _missing)
    with pytest.raises(FileNotFoundError, match="candidate selection missing"):
        mod.lock_attempt_manifest(REPO)


def test_attempt_cannot_execute_twice():
    assert EXEC_PATH.exists()
    with pytest.raises(RuntimeError, match="already consumed"):
        execute_one_shot(REPO)


def test_wrong_runtime_resource_overlay_blocks(monkeypatch):
    from src.oip.modules.language_runtime.transliteration.application import (
        eval_mai07_r3g_reauthorized_002 as mod,
    )

    monkeypatch.setattr(mod, "RUNTIME_VERSION", "mai-07.9.9-bad")
    imm = mod.immutability_preflight(REPO)
    assert imm["ok"] is False


def test_wrong_frozen_data_hash_blocks(monkeypatch):
    from src.oip.modules.language_runtime.transliteration.application import (
        eval_mai07_r3g_reauthorized_002 as mod,
    )

    monkeypatch.setattr(
        mod,
        "R3G_EXPECTED",
        {**R3G_EXPECTED, "v2": "0" * 64},
    )
    imm = mod.immutability_preflight(REPO)
    assert imm["ok"] is False


def test_invalidated_historical_rc_not_selected():
    sel = resolve_candidate_selection(REPO)
    assert "INVALIDATED" not in sel["selected_rc_id"]
    assert sel["selected_rc_id"] == "MAI_07R3F_LOCK_CHAIN_RELEASE_CANDIDATE_002"


def test_missing_lock_body_fails_closed():
    result = verify_locked_rc({"rc_id": "missing"}, expected_semantic="0" * 64)
    assert result["ok"] is False


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


def test_negative_control_target_scoring_non_vacuous():
    canon = json.loads(
        (OUT / "reports/MAI_07R3G_REAUTHORIZED_002_V2_CANONICAL_SCORE_REPORT.json").read_text(
            encoding="utf-8"
        )
    )
    tgt = canon["metrics"]["target"]["TARGET_TOP1_ACCEPTABLE"]
    assert tgt["denominator"] == 288
    assert tgt["numerator"] < tgt["denominator"]


def test_canonical_and_audit_scorers_agree():
    audit = json.loads(
        (OUT / "reports/MAI_07R3G_REAUTHORIZED_002_V2_AUDIT_SCORE_REPORT.json").read_text(
            encoding="utf-8"
        )
    )
    assert audit["agrees_with_canonical"] is True
    pre = scorer_compatibility_preflight(REPO)
    assert pre["ok"] is True


def test_mathematical_invariants_fail_closed():
    qual = json.loads(
        (OUT / f"{ATTEMPT_ID}.QUALITY_RESULT.json").read_text(encoding="utf-8")
    )
    canon = json.loads(
        (OUT / "reports/MAI_07R3G_REAUTHORIZED_002_V2_CANONICAL_SCORE_REPORT.json").read_text(
            encoding="utf-8"
        )
    )
    assert canon.get("invariant_errors") == []
    tgt = qual["metrics"]["target"]
    r1 = tgt["TARGET_RECALL_AT_1"]["numerator"]
    top1 = tgt["TARGET_TOP1_ACCEPTABLE"]["numerator"]
    mrr = tgt["TARGET_MRR"]["value_float"]
    r5 = tgt["TARGET_RECALL_AT_5"]["value_float"]
    assert top1 == r1
    assert r5 >= mrr >= top1 / tgt["denominator"]


def test_mutation_guard_zero():
    exec_obj = json.loads(EXEC_PATH.read_text(encoding="utf-8"))
    assert exec_obj["mutation_attempts"] == 0
    assert exec_obj["successful_mutations"] == 0
    pre = write_preflight_bundle(REPO)
    assert pre.get("mutation_attempts", 0) == 0


def test_frozen_text_not_in_public_reports():
    for path in OUT.glob("reports/*.json"):
        text = path.read_text(encoding="utf-8", errors="replace")
        assert "source_surface" not in text
    for path in OUT.glob("*.json"):
        if path.name.endswith("PREDICTIONS.jsonl"):
            continue
        text = path.read_text(encoding="utf-8", errors="replace")
        assert "source_surface" not in text


def test_quality_failure_does_not_imply_rerun():
    att = json.loads(ATTEMPT_PATH.read_text(encoding="utf-8"))
    assert att["status"] == "LOCKED_NOT_RUN"
    assert att["prohibited_rerun"] is True
    qual = json.loads((OUT / f"{ATTEMPT_ID}.QUALITY_RESULT.json").read_text(encoding="utf-8"))
    assert qual["status"] == "FAILED_QUALITY"
    with pytest.raises(RuntimeError, match="already consumed"):
        execute_one_shot(REPO)


def test_pass_does_not_imply_linguist_or_production():
    qual = json.loads((OUT / f"{ATTEMPT_ID}.QUALITY_RESULT.json").read_text(encoding="utf-8"))
    assert qual["LINGUIST_APPROVED"] is False
    assert qual["PRODUCTION_APPROVED"] is False
    assert qual["QUALITY_GATES_PASSED"] is False


def test_historical_r3e_r3g_unchanged(artifact_hashes):
    r3e_manifest = json.loads(
        (R3E / "MAI_07R3E_FROZEN_V2_ATTEMPT.manifest.json").read_text(encoding="utf-8")
    )
    assert r3e_manifest.get("manifest_content_sha256") == R3G_EXPECTED["r3e_attempt"]
    assert artifact_hashes["r3e_pred"] == R3G_EXPECTED["r3e_pred"]
    hist = json.loads((R3G_HIST / "reports/MAI_07R3G_PREFLIGHT_REPORT.json").read_text(encoding="utf-8"))
    assert hist["status"] == "BLOCKED_PRECONDITION_FAILED"
    blocked = json.loads(
        (R3G_REAUTH / "reports/MAI_07R3G_REAUTHORIZED_PREFLIGHT_REPORT.json").read_text(
            encoding="utf-8"
        )
    )
    assert blocked["status"] == "BLOCKED_PRECONDITION_FAILED"


def test_lock_chain_selection_attempt_unchanged_after_tests(artifact_hashes):
    assert hashlib.sha256(SELECTION_PATH.read_bytes()).hexdigest() == artifact_hashes["selection"]
    assert hashlib.sha256(ATTEMPT_PATH.read_bytes()).hexdigest() == artifact_hashes["attempt"]
    assert hashlib.sha256(RC_001_CHAIN.read_bytes()).hexdigest() == artifact_hashes["rc001_chain"]
    assert hashlib.sha256(RC_002_CHAIN.read_bytes()).hexdigest() == artifact_hashes["rc002_chain"]


def test_mai08_not_touched():
    ledger = json.loads(
        (REPO / "docs/mokxya-ai/MAI_PHASE_LEDGER.json").read_text(encoding="utf-8")
    )
    mai08 = next(p for p in ledger["phases"] if p["id"] == "MAI-08")
    assert mai08["status"] == "NOT_STARTED"


def test_active_runtime_and_resource_pins():
    assert RUNTIME_VERSION == "mai-07.1.3-r3f-sealnew"
    assert ENABLE_PROMOTION_OVERLAY is False
    xlrr.load_resources(force_reload=True)
    assert xlrr.compute_pack_content_hash() == R3G_EXPECTED["resource"]


def test_immutability_preflight_ok():
    imm = immutability_preflight(REPO)
    assert imm["ok"] is True, imm.get("errors")


def test_attempt_manifest_locked_not_run():
    att = json.loads(ATTEMPT_PATH.read_text(encoding="utf-8"))
    assert att["attempt_id"] == ATTEMPT_ID
    assert att["status"] == "LOCKED_NOT_RUN"
    assert att["authorization"] == "EXPLICIT_USER_AUTHORIZATION_MAI_07R3G_REAUTHORIZED_002"
    assert att["overlay_enabled"] is False
