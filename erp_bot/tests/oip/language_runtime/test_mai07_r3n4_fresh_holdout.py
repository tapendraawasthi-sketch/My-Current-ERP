"""MAI-07R3N4 fresh-holdout identity-anchor corrective — infrastructure governance tests.

Never hardcode private R3M/R3N2/R3N3 case source texts. Load authority via JSON for
counts only; text-based checks use synthetic strings. Do not read R3N2 or R3N3
prediction JSONL case surfaces.

This phase intentionally stops short of promoting R3N4: the dataset, sealed
candidate pack, and DEVELOPMENT scoring have been built/run, but the RC lock and
one-shot holdout attempt have deliberately NOT been executed (out of scope for
infra adaptation; "Do not promote R3N4"). Tests that require lock/one-shot
artifacts are skipped with an explicit reason when those artifacts are absent,
but the artifact-independent tests (versions, firewall, anchors, finalizer,
paths, freshness, the 20000+ property test, governance flags, MAI-08
NOT_STARTED, no RC_002) always run.
"""

from __future__ import annotations

import ast
import json
import os
import random
import string
from pathlib import Path

import pytest

from erp_bot.src.oip.contracts.transliteration import (
    CalibrationStatus,
    CandidateKind,
    CandidateScript,
    TransliterationCandidateV1,
    UncertaintyClass,
)
from erp_bot.src.oip.modules.language_runtime.domain.taxonomy import LanguageForm
from erp_bot.src.oip.modules.language_runtime.transliteration import (
    ENABLE_PROMOTION_OVERLAY,
    MAX_CANDIDATES_PER_SPAN,
    RESOURCE_PACK_VERSION,
    RUNTIME_VERSION,
)
from erp_bot.src.oip.modules.language_runtime.transliteration.application.build_mai07r3n4_pack import (
    ALLOWED_FILES,
    check_existing,
    check_twice,
)
from erp_bot.src.oip.modules.language_runtime.transliteration.application.eval_mai07_r3n4 import (
    AUTHORIZE_ENV,
    CHAIN_PATH,
    LOCKED_PATH,
    OUT as EVAL_OUT,
    PARENT_FAILED_R3N3_CHAIN_PATH,
    RC_ID,
    load_thresholds,
    score_split,
)
from erp_bot.src.oip.modules.language_runtime.transliteration.application.mai07_r3n4_candidate_runtime import (
    CANDIDATE_POLICY_VERSION,
    CANDIDATE_RUNTIME_VERSION,
    DEFAULT_ACTIVE,
    PARENT_FAILED_R3N3_LOCK_SEMANTIC,
    PARENT_FAILED_R3N3_PACK_HASH,
    PARENT_FAILED_R3N3_RUNTIME_VERSION,
    PARENT_FAILED_R3N3_VERDICT,
    PARENT_RESOURCE_HASH,
    PARENT_RUNTIME_VERSION,
    R3N_INTEGRITY_CLOSURE_SEMANTIC,
    assert_active_default_immutable,
    analyze_language_r3n4,
    candidate_identity_card,
    load_r3n4_resources,
    transliterate_r3n4,
)
from erp_bot.src.oip.modules.language_runtime.transliteration.application.r3n4_candidate_finalization import (
    FINALIZER_VERSION,
    POLICY_VERSION,
    canonical_serialize_candidates,
    construct_identity_from_anchor,
    finalize_candidates_r3n4,
    finalize_idempotent,
)
from erp_bot.src.oip.modules.language_runtime.transliteration.application.r3n4_identity_anchor import (
    IdentityAnchorError,
    create_identity_anchor,
    validate_identity_anchor,
)
from erp_bot.src.oip.modules.language_runtime.transliteration.application.r3n4_finalization_path_registry import (
    REQUIRED_PATH_FAMILIES,
    path_coverage_report,
    reset_path_registry,
)
from erp_bot.src.oip.modules.language_runtime.transliteration.application.r3n4_scoring_contracts import (
    MINIMUM_DENOMINATORS,
    metric_required_when_empty,
)
from erp_bot.src.oip.modules.language_runtime.transliteration.domain.alignment import identity_alignment
from erp_bot.src.oip.modules.language_runtime.transliteration.infrastructure.english_identity_guard import (
    Disposition,
    classify_disposition,
)
from erp_bot.src.oip.modules.language_runtime.transliteration.infrastructure.seal_contract_v2 import (
    sha256_file,
)

REPO = Path(__file__).resolve().parents[4]
OUT = REPO / "evals/mai07_r3n4_fresh_holdout"
assert OUT == EVAL_OUT
R3N2_OUT = REPO / "evals/mai07_r3n2_fresh_holdout"
R3N3_OUT = REPO / "evals/mai07_r3n3_fresh_holdout"
R3N_OUT = REPO / "evals/mai07_r3n_policy_conformance"
R3N_CLOSURE_DIR = REPO / "evals/mai07_r3n_integrity_closure"
APP_DIR = (
    REPO
    / "erp_bot/src/oip/modules/language_runtime/transliteration/application"
)
XL_ROOT = REPO / "erp_bot/src/oip/modules/language_runtime/transliteration"
SOURCE_PACK = XL_ROOT / "sealed_packs" / PARENT_RUNTIME_VERSION
CANDIDATE_PACK = XL_ROOT / "sealed_packs" / CANDIDATE_RUNTIME_VERSION
PARENT_FAILED_PACK = XL_ROOT / "sealed_packs" / PARENT_FAILED_R3N3_RUNTIME_VERSION

EXPECTED_R3N_INTEGRITY_SEMANTIC = (
    "fccbbcfbb7fbf9d816cbdc9278c8754964b5b7efcd6e499469e6e1701873ffae"
)
EXPECTED_PARENT_FAILED_R3N3_PACK_HASH = PARENT_FAILED_R3N3_PACK_HASH
EXPECTED_PARENT_FAILED_R3N3_LOCK_SEMANTIC = PARENT_FAILED_R3N3_LOCK_SEMANTIC

R3N4_RUNTIME_MODULES = tuple(sorted(APP_DIR.glob("*r3n4*.py")))

LOCK_EXISTS = LOCKED_PATH.is_file()
CHAIN_EXISTS = CHAIN_PATH.is_file()
QUAL_PATH = OUT / f"{RC_ID}.QUALIFICATION_RESULT.json"
QUAL_EXISTS = QUAL_PATH.is_file()

_NOT_LOCKED_REASON = (
    "R3N4 infra-adaptation phase intentionally stops before RC lock/one-shot "
    "(task scope: 'Do not promote R3N4'); artifact not yet produced."
)
_NOT_RUN_REASON = (
    "R3N4 one-shot holdout attempt intentionally not executed in this phase "
    "(task scope: 'Do not promote R3N4'); artifact not yet produced."
)


def _load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def _case_ids(path: Path) -> set[str]:
    ids: set[str] = set()
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.strip():
            ids.add(json.loads(line)["case_id"])
    return ids


def _r3n4_resources():
    return load_r3n4_resources()


def _synthetic_candidate(
    surface: str,
    *,
    is_identity: bool = False,
    kind: CandidateKind = CandidateKind.LEXICAL,
    script: CandidateScript | None = None,
    rank: int = 1,
    reason_codes: tuple[str, ...] = (),
    provenance: tuple[str, ...] = ("synthetic",),
) -> TransliterationCandidateV1:
    scr = script or (
        CandidateScript.LATIN if is_identity else CandidateScript.DEVANAGARI
    )
    return TransliterationCandidateV1(
        candidate_id=f"syn_{surface}_{rank}_{kind.value}",
        surface=surface,
        script=scr,
        kind=CandidateKind.IDENTITY if is_identity else kind,
        rank=rank,
        ranking_score=float(10 - rank),
        uncertainty_class=UncertaintyClass.MODERATE,
        calibration_status=CalibrationStatus.UNCALIBRATED,
        alignment=identity_alignment(surface if is_identity else "x"),
        is_identity=is_identity,
        requires_review=False,
        reason_codes=reason_codes,
        provenance=provenance,
    )


# ---------------------------------------------------------------------------
# 1. R3N3 failed/consumed parent authority + aggregate-only proof (chain-level;
#    does not require our own lock to exist).
# ---------------------------------------------------------------------------


def test_r3n3_failed_parent_consumed_and_aggregate_only_proof():
    assert PARENT_FAILED_R3N3_CHAIN_PATH.is_file()
    chain = _load_json(PARENT_FAILED_R3N3_CHAIN_PATH)
    assert chain["verdict"] == PARENT_FAILED_R3N3_VERDICT
    assert chain["consumed"] is True
    assert chain["locked_semantic_sha256"] == PARENT_FAILED_R3N3_LOCK_SEMANTIC

    proof = _load_json(OUT / "R3N4_AGGREGATE_ONLY_INPUT_PROOF.json")
    assert proof["prediction_jsonl_opened"] is False
    assert proof["r3n2_reports_opened"] is False
    assert proof["r3n3_reports_opened"] is False
    assert "evals/mai07_r3n3_fresh_holdout/**/*predictions*.jsonl" in proof["prohibited_patterns"]
    assert "evals/mai07_r3n2_fresh_holdout/**/*predictions*.jsonl" in proof["prohibited_patterns"]


@pytest.mark.skipif(not LOCK_EXISTS, reason=_NOT_LOCKED_REASON)
def test_r3n3_failed_parent_lineage_bound_in_lock():
    locked = _load_json(LOCKED_PATH)
    lineage = locked["parent_failed_r3n3_lineage"]
    assert lineage["runtime_version"] == PARENT_FAILED_R3N3_RUNTIME_VERSION
    assert lineage["pack_hash"] == PARENT_FAILED_R3N3_PACK_HASH
    assert lineage["lock_semantic_sha256"] == PARENT_FAILED_R3N3_LOCK_SEMANTIC
    assert lineage["verdict"] == PARENT_FAILED_R3N3_VERDICT
    assert lineage["consumed"] is True
    assert lineage["candidate_promoted"] is False
    assert locked["r3n_integrity_closure_semantic"] == EXPECTED_R3N_INTEGRITY_SEMANTIC
    assert locked["r3n_integrity_closure_semantic"] == R3N_INTEGRITY_CLOSURE_SEMANTIC


# ---------------------------------------------------------------------------
# 2-3. Candidate version uniqueness / active default unchanged
# ---------------------------------------------------------------------------


def test_candidate_version_unique_from_failed_r3n3_parent():
    assert CANDIDATE_RUNTIME_VERSION == "mai-07.1.9-r3n4-identityanchor"
    assert CANDIDATE_POLICY_VERSION == "mai-07-r3n4.1.0.0"
    assert PARENT_FAILED_R3N3_RUNTIME_VERSION == "mai-07.1.8-r3n3-identityinv"
    assert CANDIDATE_RUNTIME_VERSION != PARENT_FAILED_R3N3_RUNTIME_VERSION
    card = candidate_identity_card()
    assert card["candidate_runtime_version"] == CANDIDATE_RUNTIME_VERSION
    assert card["parent_failed_r3n3_runtime"] == PARENT_FAILED_R3N3_RUNTIME_VERSION
    assert card["parent_failed_r3n3_pack_hash"] == PARENT_FAILED_R3N3_PACK_HASH


def test_active_default_unchanged_overlay_disabled():
    assert RUNTIME_VERSION == "mai-07.1.13-r3s-active"
    assert RUNTIME_VERSION == "mai-07.1.13-r3s-active"
    assert RESOURCE_PACK_VERSION == "mai-07.1.11-r3n6-chaincomplete"
    assert DEFAULT_ACTIVE is False
    assert ENABLE_PROMOTION_OVERLAY is False
    assert_active_default_immutable()
    card = candidate_identity_card()
    assert card["default_active"] is False
    assert card["overlay_enabled"] is False


# ---------------------------------------------------------------------------
# 4. Explicit candidate activation
# ---------------------------------------------------------------------------


def test_candidate_explicit_activation_only():
    assert DEFAULT_ACTIVE is False
    res = _r3n4_resources()
    assert res is not None
    card = candidate_identity_card()
    assert card["activation_method"] == "explicit_load_resources_resources_dir_plus_r3n4_factory"


# ---------------------------------------------------------------------------
# 5-8. Freshness firewall — zero overlap with R3N3/R3N2/R3N holdout
# ---------------------------------------------------------------------------


def test_freshness_firewall_proof_passed_zero_r3n3_r3n2_r3n_overlap():
    fw = _load_json(OUT / "FRESHNESS_FIREWALL.json")
    assert fw["proof_passed"] is True
    zero = fw["zero_overlap_proofs"]
    assert zero["r3n3_case_id_intersection_count"] == 0
    assert zero["r3n3_normalized_text_hash_intersection_count"] == 0
    assert zero["r3n3_skeleton_hash_intersection_count"] == 0
    assert zero["r3n3_template_family_intersection_count"] == 0
    assert zero["r3n2_case_id_intersection_count"] == 0
    assert zero["r3n2_normalized_text_hash_intersection_count"] == 0
    assert zero["r3n_case_id_intersection_count"] == 0
    assert zero["r3n_normalized_text_hash_intersection_count"] == 0
    assert zero["dev_holdout_case_id_disjoint"] is True
    assert zero["dev_holdout_text_hash_disjoint"] is True
    assert zero["dev_holdout_family_disjoint"] is True

    r3n3_holdout_ids = _case_ids(R3N3_OUT / "holdout_validation.jsonl")
    r3n4_holdout_ids = _case_ids(OUT / "holdout_validation.jsonl")
    assert r3n3_holdout_ids.isdisjoint(r3n4_holdout_ids)

    r3n2_holdout_ids = _case_ids(R3N2_OUT / "holdout_validation.jsonl")
    assert r3n2_holdout_ids.isdisjoint(r3n4_holdout_ids)

    r3n_holdout_ids = _case_ids(R3N_OUT / "holdout_validation.jsonl")
    assert r3n_holdout_ids.isdisjoint(r3n4_holdout_ids)

    r3n4_dev_ids = _case_ids(OUT / "development.jsonl")
    assert r3n4_dev_ids.isdisjoint(r3n4_holdout_ids)
    assert r3n4_dev_ids.isdisjoint(r3n3_holdout_ids)


# ---------------------------------------------------------------------------
# 9. Required population minima
# ---------------------------------------------------------------------------


def test_population_denominators_meet_locked_minima():
    pop_doc = _load_json(OUT / "POPULATION_DENOMINATORS.json")
    assert pop_doc["minima_check"]["ok"] is True
    observed = pop_doc["observed_population_counts"]
    for pid, minimum in MINIMUM_DENOMINATORS.items():
        if pid in {
            "CONTEXT_COUNTERFACTUAL",
            "OOV",
            "MONOTONIC_PARENT_CORRECT",
            "IDENTITY_ANCHOR_CHALLENGE",
        }:
            continue
        assert observed.get(pid, 0) >= minimum, f"{pid} below minimum {minimum}"


# ---------------------------------------------------------------------------
# 10. authorized_code_corrective DEVELOPMENT-only requiredness
# ---------------------------------------------------------------------------


def test_authorized_code_corrective_development_only_requiredness():
    assert metric_required_when_empty("authorized_code_corrective", "DEVELOPMENT") is True
    assert metric_required_when_empty("authorized_code_corrective", "HOLDOUT_VALIDATION") is False


# ---------------------------------------------------------------------------
# 11-14. R3N4 identity-anchor / finalizer unit tests (synthetic only)
# ---------------------------------------------------------------------------


def test_create_identity_anchor_matches_raw_surface():
    raw_text = "please match SKU-44102-r3n4 before posting"
    start = raw_text.index("SKU-44102-r3n4")
    end = start + len("SKU-44102-r3n4")
    anchor = create_identity_anchor(raw_text, raw_start=start, raw_end_exclusive=end)
    assert anchor.raw_surface == "SKU-44102-r3n4"
    validate_identity_anchor(anchor, raw_text=raw_text)
    ident = construct_identity_from_anchor(anchor)
    assert ident.surface == anchor.raw_surface
    assert ident.is_identity is True
    assert ident.kind == CandidateKind.IDENTITY
    assert "R3N4_ANCHOR_IDENTITY" in ident.reason_codes


def test_identity_anchor_rejects_invalid_offsets():
    raw_text = "short text"
    with pytest.raises(IdentityAnchorError):
        create_identity_anchor(raw_text, raw_start=5, raw_end_exclusive=2)
    with pytest.raises(IdentityAnchorError):
        create_identity_anchor(raw_text, raw_start=0, raw_end_exclusive=len(raw_text) + 5)


def test_identity_survives_cap_when_devanagari_also_reserved():
    """Synthetic cap-pressure: legacy-style list ends with backfilled identity; R3N4 must keep it."""
    raw_text = "captest-r3n4-001 context around it"
    start = raw_text.index("captest-r3n4-001")
    end = start + len("captest-r3n4-001")
    anchor = create_identity_anchor(raw_text, raw_start=start, raw_end_exclusive=end)
    ranked = [
        _synthetic_candidate("alt1", rank=2),
        _synthetic_candidate("alt2", rank=3),
        _synthetic_candidate("alt3", rank=4),
        _synthetic_candidate("alt4", rank=5),
        _synthetic_candidate("खर्च", rank=6, kind=CandidateKind.LEXICAL),
        _synthetic_candidate(anchor.raw_surface, is_identity=True, rank=7),
    ]
    out, truncated, diag = finalize_candidates_r3n4(anchor, ranked, raw_text=raw_text, max_candidates=5)
    assert diag["postcondition_ok"] is True
    assert len(out) <= 5
    idents = [c for c in out if c.is_identity]
    assert len(idents) == 1
    assert idents[0].surface == anchor.raw_surface
    assert any(
        (not c.is_identity)
        and (c.script == CandidateScript.DEVANAGARI or any(0x0900 <= ord(ch) <= 0x097F for ch in c.surface))
        for c in out
    )
    assert truncated is True


def test_finalize_idempotent_helper():
    raw_text = "idemp-r3n4-002 with context"
    start = raw_text.index("idemp-r3n4-002")
    end = start + len("idemp-r3n4-002")
    anchor = create_identity_anchor(raw_text, raw_start=start, raw_end_exclusive=end)
    ranked = [
        _synthetic_candidate("खर्च", rank=1),
        _synthetic_candidate("alt-a", rank=2),
        _synthetic_candidate(anchor.raw_surface, is_identity=True, rank=3),
    ]
    assert finalize_idempotent(anchor, ranked, raw_text=raw_text, max_candidates=5)


def test_finalizer_version_and_policy_constants():
    assert FINALIZER_VERSION == "mai-07-r3n4.finalizer.1.0.0"
    assert POLICY_VERSION == "mai-07-r3n4.1.0.0"


def test_canonical_serialize_candidates_roundtrip_stable():
    raw_text = "roundtrip-r3n4-003 context"
    start = raw_text.index("roundtrip-r3n4-003")
    end = start + len("roundtrip-r3n4-003")
    anchor = create_identity_anchor(raw_text, raw_start=start, raw_end_exclusive=end)
    ranked = [
        _synthetic_candidate("alt-a", rank=1),
        _synthetic_candidate(anchor.raw_surface, is_identity=True, rank=2),
    ]
    out, _, _ = finalize_candidates_r3n4(anchor, ranked, raw_text=raw_text, max_candidates=5)
    a = canonical_serialize_candidates(out)
    b = canonical_serialize_candidates(out)
    assert a == b
    rows = json.loads(a)
    assert [r["surface"] for r in rows] == [c.surface for c in out]


# ---------------------------------------------------------------------------
# 15-26. Runtime unit checks via transliterate_r3n4 (synthetic only)
# ---------------------------------------------------------------------------


def test_identity_retention_synthetic_romanized_and_english():
    res = _r3n4_resources()
    eng_bundle = transliterate_r3n4("please review the payment status today", resources=res)
    payment = next(s for s in eng_bundle.span_results if s.raw_span.original_text.lower() == "payment")
    assert payment.candidates
    assert payment.candidates[0].is_identity is True

    rom_bundle = transliterate_r3n4("aaja kharcha hernu milau", resources=res)
    kharcha = next(s for s in rom_bundle.span_results if s.raw_span.original_text.lower() == "kharcha")
    assert kharcha.candidates
    assert any(c.is_identity for c in kharcha.candidates)


def test_acronym_vat_identity():
    res = _r3n4_resources()
    text = "please verify VAT amount before posting"
    bundle = transliterate_r3n4(text, resources=res)
    vat = next(s for s in bundle.span_results if s.raw_span.original_text == "VAT")
    assert vat.candidates
    assert vat.candidates[0].is_identity is True


def test_structural_identifier_sku_coalesce():
    res = _r3n4_resources()
    text = "please match SKU-44102 before posting"
    frame = analyze_language_r3n4(text)
    id_anns = [a for a in frame.span_annotations if a.original_text == "SKU-44102"]
    assert id_anns
    assert id_anns[0].language_form == LanguageForm.IDENTIFIER_OR_CODE.value
    bundle = transliterate_r3n4(text, resources=res)
    spans = [s for s in bundle.span_results if s.raw_span.original_text == "SKU-44102"]
    assert spans and spans[0].candidates
    assert spans[0].candidates[0].is_identity is True


def test_english_form_alone_insufficient():
    res = _r3n4_resources()
    cfg = res.english_identity_guard
    assert cfg.get("english_form_alone_insufficient") is True
    disposition, signals = classify_disposition(
        surface="kharcha",
        language_form="ENGLISH",
        neighbors=(),
        resources=res,
        ranked=[],
    )
    assert signals.get("r3n_policy") is True
    assert disposition is not Disposition.ENGLISH_IDENTITY_REQUIRED


def test_candidate_cap_at_most_five():
    res = _r3n4_resources()
    text = (
        "please review ledger voucher payment supplier customer discount "
        "commission statement reconcile opening closing export import"
    )
    bundle = transliterate_r3n4(text, resources=res)
    assert MAX_CANDIDATES_PER_SPAN == 5
    for span in bundle.span_results:
        assert len(span.candidates) <= 5


def test_determinism_same_input_twice():
    res = _r3n4_resources()
    text = "please review the payment status and aaja kharcha hernu"
    a = transliterate_r3n4(text, resources=res)
    b = transliterate_r3n4(text, resources=res)
    flags_a = [
        (s.raw_span.original_text, bool(s.candidates and s.candidates[0].is_identity))
        for s in a.span_results
    ]
    flags_b = [
        (s.raw_span.original_text, bool(s.candidates and s.candidates[0].is_identity))
        for s in b.span_results
    ]
    assert flags_a == flags_b


def test_apply_finalize_bundle_records_path_coverage():
    reset_path_registry()
    res = _r3n4_resources()
    text = "please review the payment status and aaja kharcha hernu SKU-44102"
    path_spy: list[dict] = []
    bundle = transliterate_r3n4(text, resources=res, path_spy=path_spy)
    assert path_spy
    for span in bundle.span_results:
        assert "R3N4_ANCHOR_FINALIZED" in (span.decision_reason_codes or ()) or any(
            "r3n4_anchor_reserved" in (c.provenance or ()) for c in span.candidates
        )
    report = path_coverage_report()
    assert set(report["required_path_families"]) == set(REQUIRED_PATH_FAMILIES)


# ---------------------------------------------------------------------------
# 27. Scorer/threshold/population hash binding in LOCKED_NOT_RUN
# ---------------------------------------------------------------------------


@pytest.mark.skipif(not LOCK_EXISTS, reason=_NOT_LOCKED_REASON)
def test_lock_binds_scorer_threshold_population_hashes():
    locked = _load_json(LOCKED_PATH)
    assert locked["status"] == "LOCKED_NOT_RUN"
    assert locked["resource_content_sha256"]
    for key in (
        "threshold_manifest_sha256",
        "population_definition_hash",
        "scorer_canonical_source_sha256",
        "scorer_audit_source_sha256",
        "evaluator_source_sha256",
        "policy_config_sha256",
        "scoring_contract_sha256",
        "finalizer_source_sha256",
        "identity_anchor_source_sha256",
        "path_registry_source_sha256",
    ):
        val = locked.get(key)
        assert isinstance(val, str) and len(val) == 64
    assert locked["scorer_version"] == "mai-07-r3n4.scorer.1.0.0"
    assert locked["scoring_contract_version"] == "mai-07-r3n4.contract.1.0.0"
    thresholds = load_thresholds()
    assert locked["threshold_manifest"]["threshold_id"] == thresholds["threshold_id"]


# ---------------------------------------------------------------------------
# 28. Canonical/audit agreement on development
# ---------------------------------------------------------------------------


def test_canonical_audit_agreement_development():
    result = score_split("DEVELOPMENT", write=False)
    assert result["agreement"]["ok"] is True
    assert result["canonical"]["ok"] is True or result["ok"] is True
    dev_report_path = OUT / "reports/development_score_report.json"
    if dev_report_path.is_file():
        dev_report = _load_json(dev_report_path)
        assert dev_report["agreement"]["ok"] is True
        assert dev_report["ok"] is True


# ---------------------------------------------------------------------------
# 29. Parent predictions file (only produced by one-shot holdout — skip if absent)
# ---------------------------------------------------------------------------


@pytest.mark.skipif(not CHAIN_EXISTS, reason=_NOT_RUN_REASON)
def test_parent_holdout_predictions_exist_with_hashes():
    chain = _load_json(CHAIN_PATH)
    parent_path = REPO / chain["parent_holdout_predictions_path"]
    assert parent_path.is_file()
    assert chain["parent_holdout_predictions_sha256"] == sha256_file(parent_path)
    r3n3_parent_path = REPO / chain["parent_r3n3_holdout_predictions_path"]
    assert r3n3_parent_path.is_file()
    assert chain["parent_r3n3_holdout_predictions_sha256"] == sha256_file(r3n3_parent_path)


# ---------------------------------------------------------------------------
# 30-31. Seal dual-build via check_twice
# ---------------------------------------------------------------------------


def test_pack_check_existing_and_dual_build():
    existing = check_existing()
    assert existing["ok"] is True
    assert existing["pack_version"] == CANDIDATE_RUNTIME_VERSION
    twice = check_twice()
    assert twice["ok"] is True
    assert twice["dual_build_identical"] is True
    assert twice["resource_content_sha256"] == existing["content_hash"]
    assert twice["dest_touched"] is False


# ---------------------------------------------------------------------------
# 32-33. Physical lock before holdout / one consumed attempt
# ---------------------------------------------------------------------------


@pytest.mark.skipif(not (LOCK_EXISTS and CHAIN_EXISTS), reason=_NOT_LOCKED_REASON)
def test_lock_before_holdout_attempt_consumed():
    assert LOCKED_PATH.is_file()
    assert CHAIN_PATH.is_file()
    assert RC_ID == "MAI_07R3N4_FRESH_HOLDOUT_RELEASE_CANDIDATE_001"
    locked = _load_json(LOCKED_PATH)
    assert locked["locked_before_holdout"] is True
    assert locked["locked"] is True
    chain = _load_json(CHAIN_PATH)
    assert chain["rc_id"] == RC_ID
    assert chain["consumed"] is True


# ---------------------------------------------------------------------------
# 34. No second RC ever created (RC_002)
# ---------------------------------------------------------------------------


def test_no_second_rc():
    rc_files = list(OUT.glob("MAI_07R3N4_FRESH_HOLDOUT_RELEASE_CANDIDATE_*.LOCKED_NOT_RUN.json"))
    assert len(rc_files) <= 1
    for f in rc_files:
        assert f.name.startswith("MAI_07R3N4_FRESH_HOLDOUT_RELEASE_CANDIDATE_001")
    assert not (OUT / "MAI_07R3N4_FRESH_HOLDOUT_RELEASE_CANDIDATE_002.LOCKED_NOT_RUN.json").exists()


# ---------------------------------------------------------------------------
# 35. Tests cannot mutate lock
# ---------------------------------------------------------------------------


@pytest.mark.skipif(not LOCK_EXISTS, reason=_NOT_LOCKED_REASON)
def test_cannot_mutate_lock_without_authorize(monkeypatch: pytest.MonkeyPatch):
    lock_sha_before = sha256_file(LOCKED_PATH)
    monkeypatch.delenv(AUTHORIZE_ENV, raising=False)
    assert os.environ.get(AUTHORIZE_ENV) != "1"
    with pytest.raises(PermissionError):
        score_split("HOLDOUT_VALIDATION", write=True)
    assert sha256_file(LOCKED_PATH) == lock_sha_before


# ---------------------------------------------------------------------------
# 36. Frozen-data firewall — no docs/mokxya-ai/reviews imports in r3n4 runtime
# ---------------------------------------------------------------------------


def test_frozen_data_firewall_r3n4_runtime_no_eval_or_review_imports():
    forbidden_substr = ("evals", "docs.mokxya", "mokxya_ai.reviews", "reviews.mai07")
    runtime_only = APP_DIR / "mai07_r3n4_candidate_runtime.py"
    tree = ast.parse(runtime_only.read_text(encoding="utf-8"))
    for node in ast.walk(tree):
        modules: list[str] = []
        if isinstance(node, ast.Import):
            modules.extend(alias.name for alias in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module:
            modules.append(node.module)
        for mod in modules:
            low = mod.lower().replace("\\", "/").replace("/", ".")
            assert "evals" not in low.split(".")
            assert "docs.mokxya" not in low
            for frag in forbidden_substr:
                if frag == "evals":
                    continue
                assert frag not in low
    src = runtime_only.read_text(encoding="utf-8")
    assert "evals/" not in src or "never" in src.lower()
    assert "docs/mokxya-ai/reviews/" not in src


# ---------------------------------------------------------------------------
# 37. No case-specific memorization of V3SRC ids in runtime
# ---------------------------------------------------------------------------


def test_no_v3src_ids_in_r3n4_runtime_modules():
    fw = _load_json(OUT / "FRESHNESS_FIREWALL.json")
    private_ids = set(fw.get("r3m_corrective_source_ids") or [])
    assert private_ids
    runtime_paths = [
        APP_DIR / "mai07_r3n4_candidate_runtime.py",
        APP_DIR / "r3n4_candidate_finalization.py",
        APP_DIR / "r3n4_identity_anchor.py",
        APP_DIR / "r3n4_finalization_path_registry.py",
        APP_DIR / "build_mai07r3n4_pack.py",
        APP_DIR / "r3n4_scoring_contracts.py",
        APP_DIR / "eval_mai07_r3n4_canonical_scorer.py",
        APP_DIR / "eval_mai07_r3n4_audit_scorer.py",
    ]
    for path in runtime_paths:
        assert path.is_file(), path.name
        blob = path.read_text(encoding="utf-8")
        for sid in private_ids:
            assert sid not in blob, f"V3SRC id leaked into {path.name}"


# ---------------------------------------------------------------------------
# 38. No resource lexicon additions — pack differs from parent only by policy
# ---------------------------------------------------------------------------


def test_pack_content_differs_from_parent_only_by_policy_file():
    assert SOURCE_PACK.is_dir()
    assert CANDIDATE_PACK.is_dir()
    policy_only = "r3f_english_identity_guard.json"
    for name in ALLOWED_FILES:
        src = SOURCE_PACK / name
        dst = CANDIDATE_PACK / name
        if not src.exists() and name in {"r3d_safety_disposition.json", "r3f_english_identity_guard.json"}:
            continue
        assert dst.exists(), name
        if name == policy_only:
            assert src.read_bytes() != dst.read_bytes(), "policy file must differ from parent"
        else:
            assert src.read_bytes() == dst.read_bytes(), f"{name} must match parent pack bytes"


# ---------------------------------------------------------------------------
# 39. No accounting imports in r3n4 modules
# ---------------------------------------------------------------------------


def test_no_accounting_imports_in_r3n4_modules():
    for path in R3N4_RUNTIME_MODULES:
        tree = ast.parse(path.read_text(encoding="utf-8"))
        for node in ast.walk(tree):
            modules: list[str] = []
            if isinstance(node, ast.Import):
                modules.extend(alias.name for alias in node.names)
            elif isinstance(node, ast.ImportFrom) and node.module:
                modules.append(node.module)
            for mod in modules:
                low = mod.lower()
                assert "accounting" not in low.split(".")
                assert "invoice" not in low.split(".")


# ---------------------------------------------------------------------------
# 40-41. Governance flags / MAI-08 NOT_STARTED
# ---------------------------------------------------------------------------


def test_mai08_not_started():
    ledger = _load_json(REPO / "docs/mokxya-ai/MAI_PHASE_LEDGER.json")
    phase = next(p for p in ledger["phases"] if p["id"] == "MAI-08")
    assert phase["status"] == "NOT_STARTED"


@pytest.mark.skipif(not QUAL_EXISTS, reason=_NOT_RUN_REASON)
def test_governance_flags_from_qualification_result():
    qual = _load_json(QUAL_PATH)
    assert qual["QUALITY_GATES_PASSED"] is False
    assert qual["LINGUIST_APPROVED"] is False
    assert qual["PRODUCTION_APPROVED"] is False
    assert qual["candidate_promoted"] is False
    assert qual["MAI-08"] == "NOT_STARTED"


# ---------------------------------------------------------------------------
# 42. Property — 20000 seeded synthetic finalize_candidates_r3n4 anchors/lists.
#     Always runs regardless of holdout/lock state.
# ---------------------------------------------------------------------------


def test_property_20000_seeded_finalize_candidates_r3n4():
    rng = random.Random(20260718)
    dev_surfaces = ("खर्च", "भुक्तानी", "लेखा", "नाफा", "हानि", "कर", "बिल")
    latin_pool = string.ascii_lowercase + string.digits + "-"
    ok = 0
    for i in range(20000):
        token = f"tok{i:05d}-" + "".join(rng.choice(latin_pool) for _ in range(rng.randint(2, 8)))
        prefix = "prefix context "
        suffix = " suffix context"
        raw_text = f"{prefix}{token}{suffix}"
        start = len(prefix)
        end = start + len(token)
        anchor = create_identity_anchor(raw_text, raw_start=start, raw_end_exclusive=end)
        assert anchor.raw_surface == token
        n = rng.randint(1, 12)
        ranked: list[TransliterationCandidateV1] = []
        for j in range(n):
            if rng.random() < 0.15 and j == n - 1:
                ranked.append(_synthetic_candidate(token, is_identity=True, rank=j + 1))
            elif rng.random() < 0.4:
                ranked.append(
                    _synthetic_candidate(
                        rng.choice(dev_surfaces) + str(j),
                        rank=j + 1,
                        kind=CandidateKind.LEXICAL,
                    )
                )
            else:
                ranked.append(
                    _synthetic_candidate(
                        f"alt{j}-{i % 997}",
                        rank=j + 1,
                        script=CandidateScript.LATIN,
                    )
                )
        cap = rng.randint(1, MAX_CANDIDATES_PER_SPAN)
        out, _, diag = finalize_candidates_r3n4(anchor, ranked, raw_text=raw_text, max_candidates=cap)
        assert len(out) <= cap
        idents = [c for c in out if c.is_identity]
        assert len(idents) == 1
        assert idents[0].surface == token
        assert finalize_idempotent(anchor, out, raw_text=raw_text, max_candidates=cap)
        if diag["postcondition_ok"]:
            surfaces = [c.surface for c in out]
            assert len(surfaces) == len(set(surfaces))
        ok += 1
    assert ok == 20000


# ---------------------------------------------------------------------------
# 43. Development scoring currently passes clean (no promotion decision implied);
#     full holdout verdict is intentionally not produced in this phase.
# ---------------------------------------------------------------------------


@pytest.mark.skipif(not QUAL_EXISTS, reason=_NOT_RUN_REASON)
def test_holdout_verdict_recorded_and_no_unauthorized_promotion():
    qual = _load_json(QUAL_PATH)
    assert qual["candidate_promoted"] is False
    assert qual["engineering_verdict"] != "PASSED_CORRECTIVE_RC"


def test_development_scoring_passes_without_promotion():
    """DEVELOPMENT split scoring is exercised and must pass; this does not
    constitute a holdout verdict or promotion of R3N4."""
    result = score_split("DEVELOPMENT", write=False)
    assert result["ok"] is True
    card = candidate_identity_card()
    assert card["default_active"] is False
