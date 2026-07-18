from __future__ import annotations

import json

import pytest

from erp_bot.src.oip.modules.language_runtime.transliteration.application.mai07_r3n5_dataset_builder import (
    AUTHORIZE_ENV,
    SPLIT_COUNTS,
    build_all,
    manifest_for,
    write_all,
)
from erp_bot.src.oip.modules.language_runtime.transliteration.application.mai07_r3n4_candidate_runtime import (
    analyze_language_r3n4,
)
from erp_bot.src.oip.modules.language_runtime.transliteration.application.r3n5_target_span_contract import (
    target_span_from_case,
)


@pytest.fixture(scope="module")
def corpus():
    return build_all()


def test_exact_fresh_split_cardinalities(corpus):
    assert {split: len(rows) for split, rows in corpus.items()} == SPLIT_COUNTS
    assert sum(SPLIT_COUNTS.values()) == 5075


def test_all_targets_are_raw_offset_and_digest_valid(corpus):
    for rows in corpus.values():
        for row in rows:
            target = target_span_from_case(row)
            assert row["input_text"][target.raw_start : target.raw_end_exclusive] == row["highlighted_span"]


def test_ids_and_texts_are_unique(corpus):
    rows = [row for split in corpus.values() for row in split]
    assert len({row["case_id"] for row in rows}) == len(rows)
    assert len({row["input_text"] for row in rows}) == len(rows)


def test_every_target_is_an_exact_analyzer_span_before_lock(corpus):
    for rows in corpus.values():
        for row in rows:
            target = target_span_from_case(row)
            frame = analyze_language_r3n4(row["input_text"])
            matches = [
                annotation
                for annotation in frame.span_annotations
                if annotation.start_offset == target.raw_start
                and annotation.end_offset == target.raw_end_exclusive
                and annotation.original_text == target.raw_surface
            ]
            assert len(matches) == 1, row["case_id"]


def test_holdout_population_floors(corpus):
    counts = manifest_for(corpus)["splits"]["HOLDOUT_VALIDATION"]["population_counts"]
    required = {
        "ENGLISH_IDENTITY_REQUIRED": 200,
        "ROMANIZED_NEPALI_REQUIRED": 200,
        "IDENTITY_RETENTION_REQUIRED": 850,
        "IDENTITY_INVARIANT_ANALOGUE": 350,
        "CANDIDATE_CAP_PRESSURE": 350,
        "MULTI_TOKEN_IDENTITY": 300,
        "REFINED_SPAN_IDENTITY": 200,
        "COALESCED_SPAN_IDENTITY": 200,
        "SERIALIZATION_ROUNDTRIP": 500,
        "UNICODE_IDENTITY": 150,
        "ACRONYM_IDENTITY_REQUIRED": 100,
        "IDENTIFIER_PROTECTION_REQUIRED": 100,
        "PROTECTED_IDENTITY_REQUIRED": 100,
        "SHARED_OR_AMBIGUOUS": 150,
        "ENGLISH_GUARD_ANALOGUE": 100,
        "ACRONYM_IDENTIFIER_ANALOGUE": 75,
        "FINALIZER_IDEMPOTENCE_REQUIRED": 2475,
    }
    for population, minimum in required.items():
        assert counts[population] >= minimum


def test_manifest_is_deterministic(corpus):
    first = json.dumps(manifest_for(corpus), sort_keys=True)
    second = json.dumps(manifest_for(build_all()), sort_keys=True)
    assert first == second


def test_write_requires_explicit_authority(monkeypatch, tmp_path):
    monkeypatch.delenv(AUTHORIZE_ENV, raising=False)
    with pytest.raises(PermissionError):
        write_all(tmp_path)
