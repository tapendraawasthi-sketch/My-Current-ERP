"""MAI-07R3F-SEAL-NEW — active pack / RC / historical invalidation tests."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

import pytest

from src.oip.modules.language_runtime.transliteration import (
    ENABLE_PROMOTION_OVERLAY,
    PARENT_R3F_INVALIDATED_RC_HASH,
    PARENT_R3F_INVALIDATED_RESOURCE_CLAIM,
    PARENT_R3F_INVALIDATED_STATUS,
    RESOURCE_PACK_VERSION,
    RUNTIME_VERSION,
)
from src.oip.modules.language_runtime.transliteration.infrastructure import (
    resource_repository as xlrr,
)
from src.oip.modules.language_runtime.transliteration.infrastructure.seal_contract_v2 import (
    SEAL_CONTRACT_VERSION,
)

REPO = Path(__file__).resolve().parents[4]
OUT = REPO / "evals/mai07_r3f_seal_new"
OLD = REPO / "evals/mai07_r3f_english_identity"
V1 = "5637ccd973173edde3637ce0aeca8e8647431614940fb8a06ceb102e1c736208"
V2 = "0cee0c07d07430bded793e2dbe162e7b496223ecff762cdd69bca8d8d992d4b9"


def test_historical_invalidated_rc_preserved():
    rc = json.loads((OLD / "MAI_07R3F_RELEASE_CANDIDATE.manifest.json").read_text(encoding="utf-8"))
    assert rc["manifest_sha256"] == PARENT_R3F_INVALIDATED_RC_HASH
    assert rc["resource_content_hash"] == PARENT_R3F_INVALIDATED_RESOURCE_CLAIM
    inv = json.loads((OLD / "MAI_07R3F_RELEASE_CANDIDATE.INVALIDATION.json").read_text(encoding="utf-8"))
    assert inv["parent_rc_status"] == PARENT_R3F_INVALIDATED_STATUS == "INVALIDATED_BY_SEAL_DRIFT"
    assert inv["parent_rc_manifest_sha256"] == PARENT_R3F_INVALIDATED_RC_HASH


def test_historical_resource_claim_unchanged_and_not_active():
    hist = json.loads(
        (xlrr.HISTORICAL_INVALIDATED_R3F_RESOURCES_DIR / "manifest.json").read_text(encoding="utf-8")
    )
    assert hist["content_hash"] == PARENT_R3F_INVALIDATED_RESOURCE_CLAIM
    assert xlrr.RESOURCES_DIR != xlrr.HISTORICAL_INVALIDATED_R3F_RESOURCES_DIR
    assert xlrr.RESOURCES_DIR.name == "mai-07.1.3-r3f-sealnew"


def test_active_pack_claim_equals_compute():
    xlrr.load_resources(force_reload=True)
    report = xlrr.validate_resources()
    assert report["ok"] is True
    assert report["content_hash"] == report["claimed_content_hash"]
    man = json.loads((xlrr.RESOURCES_DIR / "manifest.json").read_text(encoding="utf-8"))
    assert man["content_hash"] == xlrr.compute_pack_content_hash()
    assert man["resource_pack_version"] == RESOURCE_PACK_VERSION == "mai-07.1.3-r3f-sealnew"
    assert man.get("SEALED_READ_ONLY") is True
    assert man.get("seal_contract_version") == SEAL_CONTRACT_VERSION


def test_runtime_references_new_pack_only():
    assert RUNTIME_VERSION == "mai-07.1.3-r3f-sealnew"
    assert RESOURCE_PACK_VERSION == "mai-07.1.3-r3f-sealnew"
    assert ENABLE_PROMOTION_OVERLAY is False
    res = xlrr.load_resources(force_reload=True)
    assert res.version == "mai-07.1.3-r3f-sealnew"
    assert res.content_hash == xlrr.compute_pack_content_hash()


def test_v1_v2_hashes_unchanged():
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


def test_ordinary_checks_do_not_mutate_sealed_or_historical():
    before_active = {
        p.name: hashlib.sha256(p.read_bytes()).hexdigest()
        for p in sorted(xlrr.RESOURCES_DIR.glob("*.json"))
    }
    before_hist = {
        p.name: hashlib.sha256(p.read_bytes()).hexdigest()
        for p in sorted(xlrr.HISTORICAL_INVALIDATED_R3F_RESOURCES_DIR.glob("*.json"))
    }
    assert xlrr.validate_resources()["ok"] is True
    assert xlrr.check_twice_isolated()["second_run_no_diff"] is True
    after_active = {
        p.name: hashlib.sha256(p.read_bytes()).hexdigest()
        for p in sorted(xlrr.RESOURCES_DIR.glob("*.json"))
    }
    after_hist = {
        p.name: hashlib.sha256(p.read_bytes()).hexdigest()
        for p in sorted(xlrr.HISTORICAL_INVALIDATED_R3F_RESOURCES_DIR.glob("*.json"))
    }
    assert before_active == after_active
    assert before_hist == after_hist


def test_fresh_datasets_locked_and_leak_free_vs_old_r3f():
    man = json.loads((OUT / "MAI_07R3F_SEAL_NEW_DATASET_MANIFEST.json").read_text(encoding="utf-8"))
    assert man["minimums_met"] is True
    assert man["totals"]["HOLDOUT_VALIDATION"] >= 1000
    assert man["category_counts"]["holdout_english_identity"] >= 700
    assert man["fresh_vs_old_r3f"]["old_holdout_reused"] is False
    old_texts = set()
    for name in (
        "development.jsonl",
        "holdout_validation.jsonl",
        "safety_challenge.jsonl",
        "context_counterfactual.jsonl",
    ):
        for line in (OLD / name).read_text(encoding="utf-8").splitlines():
            if line.strip():
                old_texts.add(json.loads(line)["input_text"].strip())
    for line in (OUT / "holdout_validation.jsonl").read_text(encoding="utf-8").splitlines():
        if line.strip():
            assert json.loads(line)["input_text"].strip() not in old_texts


def test_rc_locked_before_holdout_fields():
    rc = json.loads(
        (OUT / "MAI_07R3F_SEAL_NEW_RELEASE_CANDIDATE_001.manifest.json").read_text(encoding="utf-8")
    )
    assert rc["locked"] is True
    assert rc["locked_before_holdout"] is True
    assert rc["parent_rc_status"] == "INVALIDATED_BY_SEAL_DRIFT"
    assert rc["seal_contract_version"] == SEAL_CONTRACT_VERSION
    assert rc["no_runtime_tuning"] is True
    assert rc["no_frozen_data_use"] is True
    assert rc["prohibited_rerun"] is True
    assert rc["resource_content_sha256"] == xlrr.compute_pack_content_hash()
