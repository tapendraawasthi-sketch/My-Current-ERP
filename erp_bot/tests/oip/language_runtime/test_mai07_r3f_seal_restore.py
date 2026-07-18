"""MAI-07R3F-SEAL-RESTORE — mutation-proof sealing tests."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

import pytest

from src.oip.modules.language_runtime.transliteration.infrastructure import (
    resource_repository as xlrr,
)

REPO = Path(__file__).resolve().parents[4]
SEALED_CLAIM = "e94cc8c7775d9ce77ab854ab478387d950a018ba1b76d96e9749d4aad425e50a"


def _hashes(directory: Path) -> dict[str, str]:
    return {
        p.name: hashlib.sha256(p.read_bytes()).hexdigest()
        for p in sorted(directory.glob("*.json"))
    }


def test_validate_resources_is_read_only():
    before = _hashes(xlrr.RESOURCES_DIR)
    report = xlrr.validate_resources()
    after = _hashes(xlrr.RESOURCES_DIR)
    assert before == after
    assert report["mutated_canonical"] is False
    assert report["ok"] is True


def test_validate_does_not_rewrite_expected_hash_on_mismatch():
    # Historical invalidated pack still has unrestorable claim; validation must not rewrite.
    man_path = xlrr.HISTORICAL_INVALIDATED_R3F_RESOURCES_DIR / "manifest.json"
    man = json.loads(man_path.read_text(encoding="utf-8"))
    original_claim = man.get("content_hash")
    before = man_path.read_bytes()
    report = xlrr.validate_resources(resources_dir=xlrr.HISTORICAL_INVALIDATED_R3F_RESOURCES_DIR)
    after = man_path.read_bytes()
    assert before == after
    man2 = json.loads(man_path.read_text(encoding="utf-8"))
    assert man2.get("content_hash") == original_claim == SEALED_CLAIM
    assert report["ok"] is False
    assert any("hash_mismatch" in e for e in report["errors"])


def test_check_twice_isolated_does_not_touch_canonical():
    before_a = _hashes(xlrr.RESOURCES_DIR)
    before_h = _hashes(xlrr.HISTORICAL_INVALIDATED_R3F_RESOURCES_DIR)
    report = xlrr.check_twice_isolated()
    after_a = _hashes(xlrr.RESOURCES_DIR)
    after_h = _hashes(xlrr.HISTORICAL_INVALIDATED_R3F_RESOURCES_DIR)
    assert before_a == after_a
    assert before_h == after_h
    assert report["canonical_untouched"] is True
    assert report["second_run_no_diff"] is True


def test_seal_manifest_hash_refuses_canonical_without_auth():
    with pytest.raises(PermissionError):
        xlrr.seal_manifest_hash()
    with pytest.raises(PermissionError):
        xlrr.seal_manifest_hash(authorize_canonical_seal=True)  # env not set
    with pytest.raises(PermissionError):
        xlrr.seal_manifest_hash(
            resources_dir=xlrr.HISTORICAL_INVALIDATED_R3F_RESOURCES_DIR,
            output_manifest_path=xlrr.HISTORICAL_INVALIDATED_R3F_RESOURCES_DIR / "manifest.json",
        )


def test_seal_to_temp_output_ok(tmp_path: Path):
    for p in xlrr.RESOURCES_DIR.glob("*.json"):
        (tmp_path / p.name).write_bytes(p.read_bytes())
    out = tmp_path / "manifest.json"
    digest = xlrr.seal_manifest_hash(output_manifest_path=out, resources_dir=tmp_path)
    assert len(digest) == 64
    man = json.loads(out.read_text(encoding="utf-8"))
    assert man["content_hash"] == digest
    claim = json.loads((xlrr.RESOURCES_DIR / "manifest.json").read_text(encoding="utf-8"))
    assert claim.get("SEALED_READ_ONLY") is True
    hist = json.loads(
        (xlrr.HISTORICAL_INVALIDATED_R3F_RESOURCES_DIR / "manifest.json").read_text(encoding="utf-8")
    )
    assert hist.get("content_hash") == SEALED_CLAIM


def test_holdout_predictions_match_producer_canonical_list_contract():
    pred_path = (
        REPO
        / "evals/mai07_r3f_english_identity/reports/MAI_07R3F_HOLDOUT_VALIDATION_PREDICTIONS.jsonl"
    )
    rep = json.loads(
        (
            REPO
            / "evals/mai07_r3f_english_identity/reports/MAI_07R3F_HOLDOUT_VALIDATION_SCORE_REPORT.json"
        ).read_text(encoding="utf-8")
    )
    preds = [json.loads(ln) for ln in pred_path.read_text(encoding="utf-8").splitlines() if ln.strip()]
    canon = json.dumps(preds, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    digest = hashlib.sha256(canon.encode("utf-8")).hexdigest()
    assert digest == rep["predictions_sha256"] == "b5cdb56f966a84fd77c2c2727f7dd5269bc16cf90406eb386899fa1d7b5e5a6d"
    raw = hashlib.sha256(pred_path.read_bytes()).hexdigest()
    assert raw != digest
