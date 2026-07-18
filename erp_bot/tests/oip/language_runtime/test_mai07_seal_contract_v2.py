"""MAI-07 seal-contract v2.0.0 known-vector and field-separation tests."""

from __future__ import annotations

import hashlib
import json

from src.oip.modules.language_runtime.transliteration.infrastructure import seal_contract_v2 as sc


def test_known_vectors():
    assert sc.KNOWN_VECTOR_EMPTY == hashlib.sha256(b"").hexdigest()
    assert sc.KNOWN_VECTOR_ABC == hashlib.sha256(b"abc").hexdigest()
    assert sc.KNOWN_VECTOR_ABC == "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    assert sc.KNOWN_VECTOR_CANONICAL_EMPTY_LIST == hashlib.sha256(b"[]").hexdigest()


def test_prediction_raw_vs_canonical_are_distinct_contracts():
    preds = [
        {"case_id": "b", "ranked": []},
        {"case_id": "a", "ranked": [{"surface": "x", "is_identity": True, "kind": "IDENTITY", "script": "LATIN", "rank": 1}]},
    ]
    canon = sc.predictions_canonical_list_sha256(preds)
    # Raw JSONL with default separators differs from canonical list digest
    lines = "\n".join(json.dumps(p, ensure_ascii=False, sort_keys=True) for p in sorted(preds, key=lambda x: x["case_id"])) + "\n"
    raw = hashlib.sha256(lines.encode("utf-8")).hexdigest()
    assert canon != raw
    assert canon == sc.predictions_semantic_sha256(preds)


def test_contract_metadata_lists_required_fields():
    meta = sc.contract_metadata()
    assert meta["seal_contract_version"] == "mai-07-artifact-seal-contract.2.0.0"
    for key in (
        "resource_content_sha256",
        "predictions_jsonl_raw_sha256",
        "predictions_canonical_list_sha256",
        "rc_manifest_raw_sha256",
        "rc_manifest_semantic_sha256",
    ):
        assert key in meta["field_catalogue"]
