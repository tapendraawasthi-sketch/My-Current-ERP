"""MAI-07R3B review-import and Option A policy-lock tests.

Governance only — not a frozen quality pass, not linguist/production approval.
"""

from __future__ import annotations

import copy
import csv
import hashlib
import json
from pathlib import Path

import pytest

from src.oip.modules.language_runtime.transliteration import (
    ENABLE_PROMOTION_OVERLAY,
    RUNTIME_VERSION,
)
from src.oip.modules.language_runtime.transliteration.application.eval_metric_definitions import (
    FROZEN_DATASET_HASH,
    FROZEN_RESOURCE_HASH,
    FROZEN_RUNTIME_SEMANTIC_HASH,
)
from src.oip.modules.language_runtime.transliteration.application.import_mai07r3b_reviews import (
    ADR_STATUS,
    BULK_MAPPING,
    EXPECTED_COUNTS,
    EXPECTED_HASHES,
    OFFICIAL_B_COUNTS,
    PRODUCT_POLICY,
    SCHEMA_ID,
    Mai07R3BImportError,
    RoundAEntry,
    RoundBEntry,
    apply_option_a_identity_policy,
    assert_mapping_not_for_runtime_or_training,
    assert_runtime_sources_do_not_consume_mapping,
    build_adjudicated_cases,
    compute_import_semantic_hash,
    import_and_validate,
    load_blind_mapping,
    load_completed_import,
    load_review_schema,
    official_acceptability_counts,
    parse_import_object,
    parse_mapping_entries,
    parse_round_b_entry,
    population_bucket_from_round_a,
    reject_round_b_overwrite_round_a,
    sha256_file,
    validate_cardinality_and_indices,
    v2_dataset_plan,
    verify_parent_artifacts,
)
from src.oip.modules.language_runtime.transliteration.infrastructure import (
    resource_repository as xlrr,
)

REPO = Path(__file__).resolve().parents[4]
REVIEW = REPO / "docs/mokxya-ai/reviews/mai07r3"


@pytest.fixture(scope="module")
def schema():
    return load_review_schema(REVIEW)


@pytest.fixture(scope="module")
def report():
    r = import_and_validate(REPO)
    assert r.ok, r.errors
    return r


def test_package_and_source_hashes_exact():
    hashes = verify_parent_artifacts(REVIEW)
    assert hashes["round_a_locked"] == EXPECTED_HASHES["round_a_locked"]
    assert hashes["round_b_broad_locked"] == EXPECTED_HASHES["round_b_broad_locked"]
    assert hashes["round_b_official"] == EXPECTED_HASHES["round_b_official"]
    assert hashes["blind_mapping"] == EXPECTED_HASHES["blind_mapping"]
    assert hashes["review_schema"] == EXPECTED_HASHES["review_schema"]
    assert hashes["import_completed"] == EXPECTED_HASHES["import_completed"]
    assert hashes["bulk_decision"] == EXPECTED_HASHES["bulk_decision"]
    assert hashes["evaluation_semantics_v2"] == EXPECTED_HASHES["evaluation_semantics_v2"]
    assert hashes["unblinded_adjudication"] == EXPECTED_HASHES["unblinded_adjudication"]


def test_cardinality_149_263_149_49(report):
    assert report.counts["round_a"] == 149
    assert report.counts["round_b"] == 263
    assert report.counts["mapping"] == 149
    assert report.counts["conflicts"] == 49
    assert report.counts == {
        "round_a": EXPECTED_COUNTS["round_a"],
        "round_b": EXPECTED_COUNTS["round_b"],
        "mapping": EXPECTED_COUNTS["mapping"],
        "conflicts": EXPECTED_COUNTS["conflicts"],
        "adjudicated": 149,
    }


def test_duplicate_and_missing_review_ids_rejected(schema):
    mapping = parse_mapping_entries(load_blind_mapping(REVIEW))
    obj = load_completed_import(REVIEW / "MAI_07R3_REVIEW_IMPORT_COMPLETED.jsonl", schema)
    # duplicate Round A
    bad_a = list(obj.round_a) + [obj.round_a[0]]
    with pytest.raises(Mai07R3BImportError, match="duplicate Round A"):
        from src.oip.modules.language_runtime.transliteration.application.import_mai07r3b_reviews import (
            ReviewImportObject,
        )

        validate_cardinality_and_indices(
            ReviewImportObject(schema=SCHEMA_ID, round_a=tuple(bad_a), round_b=obj.round_b),
            mapping,
            enforce_expected_totals=False,
        )
    # missing Round A id referenced by Round B
    truncated = obj.round_a[1:]
    with pytest.raises(Mai07R3BImportError):
        from src.oip.modules.language_runtime.transliteration.application.import_mai07r3b_reviews import (
            ReviewImportObject,
        )

        validate_cardinality_and_indices(
            ReviewImportObject(
                schema=SCHEMA_ID, round_a=tuple(truncated), round_b=obj.round_b
            ),
            mapping,
            enforce_expected_totals=False,
        )


def test_duplicate_and_noncontiguous_candidate_indices_rejected(schema):
    mapping = parse_mapping_entries(load_blind_mapping(REVIEW))
    obj = load_completed_import(REVIEW / "MAI_07R3_REVIEW_IMPORT_COMPLETED.jsonl", schema)
    from src.oip.modules.language_runtime.transliteration.application.import_mai07r3b_reviews import (
        ReviewImportObject,
    )

    dup = list(obj.round_b) + [obj.round_b[0]]
    with pytest.raises(Mai07R3BImportError, match="duplicate Round B"):
        validate_cardinality_and_indices(
            ReviewImportObject(schema=SCHEMA_ID, round_a=obj.round_a, round_b=tuple(dup)),
            mapping,
            enforce_expected_totals=False,
        )
    # force non-contiguous indices for one review
    target_rid = obj.round_b[0].review_id
    others = [b for b in obj.round_b if b.review_id != target_rid]
    broken = others + [
        RoundBEntry(target_rid, 0, "ACCEPTABLE_PREFERRED"),
        RoundBEntry(target_rid, 2, "ACCEPTABLE_PREFERRED"),
    ]
    with pytest.raises(Mai07R3BImportError, match="non-contiguous"):
        validate_cardinality_and_indices(
            ReviewImportObject(
                schema=SCHEMA_ID, round_a=obj.round_a, round_b=tuple(broken)
            ),
            mapping,
            enforce_expected_totals=False,
        )


def test_candidate_count_mismatch_against_order_indices(schema):
    mapping = list(parse_mapping_entries(load_blind_mapping(REVIEW)))
    obj = load_completed_import(REVIEW / "MAI_07R3_REVIEW_IMPORT_COMPLETED.jsonl", schema)
    from src.oip.modules.language_runtime.transliteration.application.import_mai07r3b_reviews import (
        MappingEntry,
        ReviewImportObject,
    )

    m0 = mapping[0]
    mapping[0] = MappingEntry(
        review_id=m0.review_id,
        case_id=m0.case_id,
        candidate_order_indices=m0.candidate_order_indices + (99,),
    )
    with pytest.raises(Mai07R3BImportError, match="cardinality mismatch"):
        validate_cardinality_and_indices(
            ReviewImportObject(
                schema=SCHEMA_ID, round_a=obj.round_a, round_b=obj.round_b
            ),
            tuple(mapping),
            enforce_expected_totals=False,
        )


def test_official_and_invalid_enums(schema):
    for label in (
        "ACCEPTABLE_PREFERRED",
        "ACCEPTABLE_ALTERNATIVE",
        "UNNATURAL_BUT_POSSIBLE",
        "INCORRECT",
        "CANNOT_DECIDE",
    ):
        parse_round_b_entry(
            {"review_id": "R3A-X", "candidate_index": 0, "acceptability": label},
            schema,
        )
    with pytest.raises(Mai07R3BImportError, match="invalid enum"):
        parse_round_b_entry(
            {"review_id": "R3A-X", "candidate_index": 0, "acceptability": "ACCEPTABLE"},
            schema,
        )
    with pytest.raises(Mai07R3BImportError, match="invalid enum"):
        parse_import_object(
            {
                "schema": SCHEMA_ID,
                "round_a": [
                    {
                        "review_id": "R3A-X",
                        "span_class": "NOT_A_CLASS",
                        "preferred_rank_policy": "LATIN_IDENTITY_REQUIRED",
                        "devanagari_retention": "OPTIONAL",
                        "confidence": "HIGH",
                        "reasoning": "x",
                    }
                ],
                "round_b": [],
            },
            schema,
        )


def test_mechanical_mapping_counts_223_36_4(report):
    assert report.official_b_counts == OFFICIAL_B_COUNTS
    assert report.official_b_counts["ACCEPTABLE_PREFERRED"] == 223
    assert report.official_b_counts["UNNATURAL_BUT_POSSIBLE"] == 36
    assert report.official_b_counts["CANNOT_DECIDE"] == 4
    decision = json.loads(
        (REVIEW / "MAI_07R3_BULK_SCHEMA_MAPPING_DECISION.json").read_text(encoding="utf-8")
    )
    assert decision["mapping"] == BULK_MAPPING
    assert decision["provenance"] == "EXPLICIT_USER_AUTHORIZED_BULK_SCHEMA_MAPPING"


def test_cannot_decide_preservation(report):
    assert report.official_b_counts["CANNOT_DECIDE"] == 4
    rows = list(
        csv.DictReader(
            (REVIEW / "MAI_07R3_ROUND_B_OFFICIAL_RESPONSES_LOCKED.csv").open(
                encoding="utf-8-sig"
            )
        )
    )
    cannot = [r for r in rows if r["acceptability"] == "CANNOT_DECIDE"]
    assert len(cannot) == 4
    # Broad three-label source also has 4 CANNOT_DECIDE
    broad = list(
        csv.DictReader(
            (REVIEW / "MAI_07R3_ROUND_B_RESPONSES_LOCKED.csv").open(encoding="utf-8-sig")
        )
    )
    assert sum(1 for r in broad if r["acceptability"] == "CANNOT_DECIDE") == 4


def test_round_b_cannot_overwrite_round_a(schema):
    obj = load_completed_import(REVIEW / "MAI_07R3_REVIEW_IMPORT_COMPLETED.jsonl", schema)
    reject_round_b_overwrite_round_a(obj)  # structural ok
    with pytest.raises(Mai07R3BImportError, match="cannot overwrite Round A"):
        reject_round_b_overwrite_round_a(
            obj, attempted_override={"R3A-X": "DEVANAGARI_TARGET_REQUIRED"}
        )
    # Round A remains sole population authority
    a = obj.round_a[0]
    assert population_bucket_from_round_a(a.preferred_rank_policy) in {
        "TRANSLITERATION_REQUIRED",
        "IDENTITY_REQUIRED",
        "TRANSLITERATION_OPTIONAL",
        "HUMAN_REVIEW_REQUIRED",
    }


def test_multiple_preferred_do_not_become_unique_top1_gold(report):
    multi = [
        c
        for c in report.adjudicated_cases
        if "MULTIPLE_BULK_MAPPED_PREFERRED_CANDIDATES" in c.issues
    ]
    assert len(multi) >= 1
    # Bulk-mapped multiples are never silently collapsed when >1 role-compatible preferred
    for case in multi:
        role_ok = [x for x in case.candidates if x.top1_eligible]
        if len(role_ok) > 1:
            assert case.unique_top1_gold_eligible is False
            assert case.unique_top1_source_candidate_index is None
            assert case.ambiguity_reason is not None


def test_optional_devanagari_excluded_from_required_target_top1():
    a = RoundAEntry(
        review_id="R3A-OPT",
        span_class="PROPER_NAME_OR_ENTITY",
        preferred_rank_policy="LATIN_IDENTITY_PREFERRED_TARGET_OPTIONAL",
        devanagari_retention="OPTIONAL",
        confidence="HIGH",
        reasoning="name",
    )
    pol = apply_option_a_identity_policy(a, surface="Ram")
    assert pol["evaluation_policy_bucket"] == "TRANSLITERATION_OPTIONAL"
    assert pol["optional_devanagari_excluded_from_required_top1"] is True
    assert population_bucket_from_round_a(a.preferred_rank_policy) == "TRANSLITERATION_OPTIONAL"


def test_english_name_identity_safety_option_a():
    eng = RoundAEntry(
        "R3A-E",
        "ENGLISH_TERM",
        "LATIN_IDENTITY_REQUIRED",
        "OPTIONAL",
        "HIGH",
        "english",
    )
    name = RoundAEntry(
        "R3A-N",
        "PROPER_NAME_OR_ENTITY",
        "LATIN_IDENTITY_REQUIRED",
        "OPTIONAL",
        "HIGH",
        "name",
    )
    pe = apply_option_a_identity_policy(eng, surface="bank")
    pn = apply_option_a_identity_policy(name, surface="Sita")
    assert pe["identity_safety_authoritative"] is True
    assert pn["identity_safety_authoritative"] is True
    assert pe["evaluation_policy_bucket"] == "IDENTITY_REQUIRED"
    assert pe["linguist_approved"] is False
    assert pe["production_approved"] is False
    assert pe["product_policy"] == PRODUCT_POLICY


def test_mapping_cannot_enter_runtime_training_or_reviewer_ui():
    assert_runtime_sources_do_not_consume_mapping(REPO)
    with pytest.raises(Mai07R3BImportError, match="runtime/training"):
        assert_mapping_not_for_runtime_or_training(
            REPO
            / "erp_bot/src/oip/modules/language_runtime/transliteration/resources/MAI_07R3_BLIND_MAPPING.json"
        )
    # Canonical review-docs location is permitted for adjudication import.
    assert_mapping_not_for_runtime_or_training(REVIEW / "MAI_07R3_BLIND_MAPPING.json")
    mapping = load_blind_mapping(REVIEW)
    assert mapping["use"] == "adjudication_import_only"
    # Reviewer-facing templates must not embed case_id
    a_text = (REVIEW / "MAI_07R3_ROUND_A_REVIEW.csv").read_text(encoding="utf-8")
    for e in mapping["entries"][:20]:
        assert e["case_id"] not in a_text


def test_no_professional_linguist_or_production_approval_inferred(report, schema):
    assert report.policy["linguist_approved"] is False
    assert report.policy["production_approved"] is False
    assert report.policy["quality_gates_passed"] is False
    assert report.policy["row_by_row_five_label_review_performed"] is False
    with pytest.raises(Mai07R3BImportError, match="professional_linguist"):
        parse_import_object(
            {
                "schema": SCHEMA_ID,
                "professional_linguist_adjudication": True,
                "round_a": [],
                "round_b": [],
            },
            schema,
        )
    with pytest.raises(Mai07R3BImportError, match="linguist/production"):
        parse_import_object(
            {
                "schema": SCHEMA_ID,
                "production_approved": True,
                "round_a": [],
                "round_b": [],
            },
            schema,
        )


def test_frozen_v1_files_and_hashes_byte_identical():
    man_path = REPO / "evals/mai07/manifests/MAI_07_ROMANIZED_TRANSLITERATION_V1.manifest.json"
    man = json.loads(man_path.read_text(encoding="utf-8"))
    h = hashlib.sha256()
    for f in sorted(man["files"], key=lambda x: x["suite_id"]):
        h.update(f["suite_id"].encode())
        h.update(b"\0")
        h.update((REPO / f["path"]).read_bytes())
    assert h.hexdigest() == FROZEN_DATASET_HASH == man["dataset_hash"]
    assert man["dataset_hash"] == EXPECTED_HASHES["frozen_v1_dataset"]
    # R3B itself does not build V2; R3C may freeze V2 later with V1 parent lineage.
    plan = v2_dataset_plan()
    assert plan["parent_dataset_hash"] == EXPECTED_HASHES["frozen_v1_dataset"]
    v2 = REPO / "evals/mai07/manifests/MAI_07_ROMANIZED_TRANSLITERATION_V2.manifest.json"
    if v2.exists():
        v2m = json.loads(v2.read_text(encoding="utf-8"))
        assert v2m["parent_dataset_hash"] == EXPECTED_HASHES["frozen_v1_dataset"]
        assert v2m["prohibited_for_training"] is True
    else:
        assert plan["status"] == "PLANNED_NOT_BUILT_IN_R3B"


def test_deterministic_reimport_identical_semantic_hash(report):
    r2 = import_and_validate(REPO)
    assert r2.ok
    assert r2.import_semantic_hash == report.import_semantic_hash
    assert len(r2.import_semantic_hash) == 64


def test_active_runtime_still_prer1_and_overlay_disabled():
    """R3B sealed under pre-R1; R3D may advance active runtime while preserving parent hashes."""
    assert ENABLE_PROMOTION_OVERLAY is False
    assert RUNTIME_VERSION.startswith("mai-07.")
    man = json.loads((xlrr.RESOURCES_DIR / "manifest.json").read_text(encoding="utf-8"))
    assert man["prior_content_hash_mai0710"] == FROZEN_RESOURCE_HASH
    assert FROZEN_RESOURCE_HASH == EXPECTED_HASHES["active_resource"]
    assert FROZEN_RUNTIME_SEMANTIC_HASH == EXPECTED_HASHES["active_semantic"]
    assert "promotion_overlay_config.json" not in man["files"]


def test_adr_status_and_ledger_flags_after_docs_update():
    # Docs are updated in the same phase; assert contracts the importer expects.
    assert ADR_STATUS == "PRODUCT_POLICY_APPROVED_IMPLEMENTATION_PENDING"
    assert PRODUCT_POLICY == "OPTION_A_CONSERVATIVE_IDENTITY_POLICY"


def test_official_counts_via_counter_helper(schema):
    obj = load_completed_import(REVIEW / "MAI_07R3_REVIEW_IMPORT_COMPLETED.jsonl", schema)
    assert official_acceptability_counts(obj.round_b) == OFFICIAL_B_COUNTS


def test_build_adjudicated_ambiguity_explicit_for_multi_role_compatible():
    from src.oip.modules.language_runtime.transliteration.application.import_mai07r3b_reviews import (
        MappingEntry,
        ReviewImportObject,
    )

    a = RoundAEntry(
        "R3A-T",
        "ROMANIZED_NEPALI",
        "DEVANAGARI_TARGET_REQUIRED",
        "REQUIRED",
        "HIGH",
        "np",
    )
    b = (
        RoundBEntry("R3A-T", 0, "ACCEPTABLE_PREFERRED"),
        RoundBEntry("R3A-T", 1, "ACCEPTABLE_PREFERRED"),
    )
    mapping = (
        MappingEntry("R3A-T", "case_t", (0, 1)),
    )
    surfaces = {("R3A-T", 0): "नमस्ते", ("R3A-T", 1): "नमस्कार"}
    cases = build_adjudicated_cases(
        ReviewImportObject(SCHEMA_ID, (a,), b),
        mapping,
        candidate_surfaces=surfaces,
    )
    assert len(cases) == 1
    assert cases[0].unique_top1_gold_eligible is False
    assert cases[0].unique_top1_source_candidate_index is None
    assert cases[0].ambiguity_reason in {
        "MULTIPLE_BULK_MAPPED_PREFERRED_CANDIDATES",
        "MULTIPLE_ROLE_COMPATIBLE_PREFERRED",
    }


def test_hash_mismatch_fail_closed(tmp_path, schema):
    bad = tmp_path / "MAI_07R3_REVIEW_IMPORT_COMPLETED.jsonl"
    bad.write_text('{"schema":"mai07r3_review_import_v1","round_a":[],"round_b":[]}\n')
    with pytest.raises(Mai07R3BImportError, match="hash mismatch"):
        load_completed_import(bad, schema)


def test_import_sha_of_persisted_completed_file():
    assert (
        sha256_file(REVIEW / "MAI_07R3_REVIEW_IMPORT_COMPLETED.jsonl")
        == EXPECTED_HASHES["import_completed"]
    )
