from __future__ import annotations

import copy
import inspect
import json
from pathlib import Path

import pytest

from erp_bot.src.oip.modules.language_runtime.transliteration.application import (
    mai07_r3n6_dataset_builder as builder,
)
from erp_bot.src.oip.modules.language_runtime.transliteration.application.mai07_r3n4_candidate_runtime import (
    analyze_language_r3n4,
)
from erp_bot.src.oip.modules.language_runtime.transliteration.application.r3n5_target_span_contract import (
    target_span_from_case,
)


@pytest.fixture(scope="module")
def corpus():
    return builder.build_all()


def test_exact_fresh_split_cardinalities_and_seeds(corpus):
    assert {split: len(rows) for split, rows in corpus.items()} == builder.SPLIT_COUNTS
    assert sum(builder.SPLIT_COUNTS.values()) == 5075
    assert builder.SEED_DEVELOPMENT == 20260730
    assert builder.SEED_HOLDOUT == 20260731

    for split, rows in corpus.items():
        expected_seed = builder.SEED_DEVELOPMENT if split == "DEVELOPMENT" else builder.SEED_HOLDOUT
        assert {row["seed_family"] for row in rows} == {expected_seed}


def test_development_and_holdout_target_authorities_are_exactly_disjoint(corpus):
    development = corpus["DEVELOPMENT"]
    holdout = corpus["HOLDOUT_VALIDATION"]

    assert {
        row["target_raw_surface_sha256"] for row in development
    }.isdisjoint({row["target_raw_surface_sha256"] for row in holdout})
    assert {
        (row["highlighted_span"], row["expected_behavior"])
        for row in development
    }.isdisjoint(
        {
            (row["highlighted_span"], row["expected_behavior"])
            for row in holdout
        }
    )
    assert {row["input_text"] for row in development}.isdisjoint(
        {row["input_text"] for row in holdout}
    )
    assert {row["template_family"] for row in development}.isdisjoint(
        {row["template_family"] for row in holdout}
    )
    assert {
        builder._context_template_signature(row) for row in development
    }.isdisjoint(
        {builder._context_template_signature(row) for row in holdout}
    )


def test_development_has_no_holdout_constructor_or_pool_dependency():
    development_target_source = inspect.getsource(builder._development_target_for)
    development_case_source = inspect.getsource(builder._development_case)

    assert "HOLDOUT_VALIDATION" not in development_target_source
    assert "_holdout_target_for" not in development_target_source
    assert "HOLDOUT_" not in development_target_source
    assert "HOLDOUT_VALIDATION" not in development_case_source
    assert "_holdout_case" not in development_case_source


def test_seeded_selection_is_deterministic_and_seed_sensitive():
    first = [
        builder._seeded_pick(
            builder.DEVELOPMENT_ENGLISH,
            seed=builder.SEED_DEVELOPMENT,
            namespace="development-english",
            index=index,
        )
        for index in range(100)
    ]
    replay = [
        builder._seeded_pick(
            builder.DEVELOPMENT_ENGLISH,
            seed=builder.SEED_DEVELOPMENT,
            namespace="development-english",
            index=index,
        )
        for index in range(100)
    ]
    changed_seed = [
        builder._seeded_pick(
            builder.DEVELOPMENT_ENGLISH,
            seed=builder.SEED_DEVELOPMENT + 1,
            namespace="development-english",
            index=index,
        )
        for index in range(100)
    ]

    assert first == replay
    assert first != changed_seed


def test_r3n6_versions_and_training_prohibition_are_explicit(corpus):
    for rows in corpus.values():
        for row in rows:
            assert row["schema_version"] == "mai07_r3n6_fresh_holdout_case_v1"
            assert row["builder_version"] == "mai-07-r3n6-dataset.1.0.0"
            assert row["template_family"].startswith("r3n6_targetspan_v1_")
            assert row["prohibited_for_training"] is True
            assert row["gold_from_runtime"] is False
            assert row["parent_prediction_inputs_used"] is False
            assert row["expected_behavior"] in builder.EXPECTED_BEHAVIOR_ENUM


def test_all_targets_are_raw_offset_and_digest_valid(corpus):
    for rows in corpus.values():
        for row in rows:
            target = target_span_from_case(row)
            assert row["input_text"][target.raw_start : target.raw_end_exclusive] == row["highlighted_span"]
            assert target.raw_surface == row["highlighted_span"]


def test_every_target_maps_to_exactly_one_analyzer_span(corpus):
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


def test_ids_texts_and_target_source_hashes_are_unique(corpus):
    rows = [row for split_rows in corpus.values() for row in split_rows]
    assert len({row["case_id"] for row in rows}) == len(rows)
    assert len({row["input_text"] for row in rows}) == len(rows)
    assert len({row["target_source_text_sha256"] for row in rows}) == len(rows)


def test_base26_context_codes_are_injective_across_rollover_boundaries():
    codes = [builder._alpha_code(index) for index in range(60_000)]
    assert len(set(codes)) == len(codes)
    assert builder._alpha_code(25) != builder._alpha_code(26)
    assert builder._alpha_code(675) != builder._alpha_code(676)


def test_zero_r3n5_input_overlap_on_all_governed_dimensions(corpus):
    prior = builder._r3n5_input_rows()
    current = [row for split_rows in corpus.values() for row in split_rows]

    dimensions = (
        "case_id",
        "input_text",
        "target_source_text_sha256",
        "template_family",
        "target_raw_surface_sha256",
    )
    for dimension in dimensions:
        assert {str(row[dimension]) for row in current}.isdisjoint(
            {str(row[dimension]) for row in prior}
        ), dimension


def test_r3n5_reads_are_restricted_to_input_split_allowlist():
    paths = builder._r3n5_input_paths()
    assert len(paths) == len(builder.SPLIT_FILES)
    assert {path.name for path in paths} == set(builder.SPLIT_FILES.values())
    assert all(path.parent == builder.R3N5_OUT for path in paths)
    assert all("prediction" not in str(path).lower() for path in paths)
    assert all("score" not in str(path).lower() and "report" not in str(path).lower() for path in paths)


def test_holdout_population_floors(corpus):
    counts = builder.manifest_for(corpus)["splits"]["HOLDOUT_VALIDATION"]["population_counts"]
    required = {
        "ENGLISH_IDENTITY_REQUIRED": 200,
        "ROMANIZED_NEPALI_REQUIRED": 200,
        "IDENTITY_RETENTION_REQUIRED": 850,
        "EXACT_RAW_IDENTITY_REQUIRED": 850,
        "EXACTLY_ONE_IDENTITY_REQUIRED": 850,
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


def test_manifest_is_deterministic_and_discloses_one_way_freshness(corpus):
    first = builder.manifest_for(corpus)
    second = builder.manifest_for(builder.build_all())
    assert json.dumps(first, sort_keys=True) == json.dumps(second, sort_keys=True)
    assert first["parent_prediction_jsonl_opened"] is False
    assert first["parent_score_report_opened"] is False
    assert first["r3n5_input_splits_used_for_one_way_freshness_only"] is True
    assert first["r3n5_freshness_dimensions"] == [
        "case_id",
        "input_text",
        "target_source_text_sha256",
        "template_family",
        "target_raw_surface_sha256",
    ]
    assert first["expected_behavior_enum"] == sorted(builder.EXPECTED_BEHAVIOR_ENUM)
    assert first["development_holdout_target_surfaces_disjoint"] is True
    assert first["development_holdout_target_behavior_pairs_disjoint"] is True
    assert first["development_holdout_context_templates_disjoint"] is True


def test_exact_corpus_authority_accepts_only_deterministic_build(corpus):
    manifest = builder.manifest_for(corpus)
    assert builder.assert_exact_corpus_authority(corpus, manifest) == manifest

    changed_corpus = copy.deepcopy(corpus)
    changed_corpus["DEVELOPMENT"][0]["population_ids"].append("UNAUTHORIZED_POPULATION")
    with pytest.raises(ValueError, match="r3n6_split_not_exact_build_output:DEVELOPMENT"):
        builder.assert_exact_build_all_output(changed_corpus)

    changed_manifest = copy.deepcopy(manifest)
    changed_manifest["builder_version"] = "substituted"
    with pytest.raises(ValueError, match="r3n6_manifest_not_exact_build_output"):
        builder.assert_exact_build_all_manifest(changed_manifest)


def test_split_counts_and_expected_behavior_enum_fail_closed(corpus):
    missing_row = copy.deepcopy(corpus)
    missing_row["OOV_CHALLENGE"].pop()
    with pytest.raises(ValueError, match="r3n6_split_count_mismatch:OOV_CHALLENGE"):
        builder.manifest_for(missing_row)

    unknown_behavior = copy.deepcopy(corpus)
    unknown_behavior["DEVELOPMENT"][0]["expected_behavior"] = "UNDECLARED_FALLBACK"
    with pytest.raises(ValueError, match="unknown_expected_behavior:DEVELOPMENT:0"):
        builder.manifest_for(unknown_behavior)


def test_write_requires_explicit_output_directory():
    with pytest.raises(TypeError):
        builder.write_all()  # type: ignore[call-arg]


def test_canonical_write_requires_explicit_authority(monkeypatch):
    monkeypatch.delenv(builder.AUTHORIZE_ENV, raising=False)
    with pytest.raises(PermissionError):
        builder.write_all(builder.OUT)


def test_explicit_noncanonical_write_uses_only_requested_tmp_path(corpus, monkeypatch, tmp_path):
    destination = tmp_path / "r3n6-output"
    monkeypatch.setattr(builder, "build_all", lambda: corpus)
    manifest = builder.write_all(destination)

    expected_files = {"MANIFEST.json", *builder.SPLIT_FILES.values()}
    assert {path.name for path in destination.iterdir()} == expected_files
    assert json.loads((destination / "MANIFEST.json").read_text(encoding="utf-8")) == manifest
    assert all(path.is_file() for path in (destination / name for name in expected_files))
    assert destination == Path(destination)
