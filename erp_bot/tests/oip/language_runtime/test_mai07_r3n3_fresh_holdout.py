"""MAI-07R3N3 fresh-holdout identity-invariant corrective — FAILED_HOLDOUT_QUALITY governance tests.

Never hardcode private R3M/R3N2 case source texts. Load authority via JSON for counts only;
text-based checks use synthetic strings. Do not regenerate predictions or rerun holdout.
Do not repair R3N3 in-place — verdict remains FAILED_HOLDOUT_QUALITY.
Do not read R3N2 or R3N3 prediction JSONL case surfaces.
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
from erp_bot.src.oip.modules.language_runtime.transliteration.application.build_mai07r3n3_pack import (
    ALLOWED_FILES,
    check_existing,
    check_twice,
)
from erp_bot.src.oip.modules.language_runtime.transliteration.application.eval_mai07_r3n3 import (
    AUTHORIZE_ENV,
    CHAIN_PATH,
    LOCKED_PATH,
    OUT as EVAL_OUT,
    RC_ID,
    load_thresholds,
    score_split,
)
from erp_bot.src.oip.modules.language_runtime.transliteration.application.mai07_r3n3_candidate_runtime import (
    CANDIDATE_POLICY_VERSION,
    CANDIDATE_RUNTIME_VERSION,
    DEFAULT_ACTIVE,
    PARENT_FAILED_R3N2_LOCK_SEMANTIC,
    PARENT_FAILED_R3N2_PACK_HASH,
    PARENT_FAILED_R3N2_RUNTIME_VERSION,
    PARENT_FAILED_R3N2_VERDICT,
    PARENT_RESOURCE_HASH,
    PARENT_RUNTIME_VERSION,
    R3N_INTEGRITY_CLOSURE_SEMANTIC,
    assert_active_default_immutable,
    analyze_language_r3n3,
    candidate_identity_card,
    load_r3n3_resources,
    transliterate_r3n3,
)
from erp_bot.src.oip.modules.language_runtime.transliteration.application.r3n3_candidate_finalization import (
    FINALIZER_VERSION,
    POLICY_VERSION,
    apply_finalizer_twice_idempotent,
    construct_exact_identity,
    finalize_candidates_r3n3,
    is_exact_identity,
)
from erp_bot.src.oip.modules.language_runtime.transliteration.application.r3n3_scoring_contracts import (
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
OUT = REPO / "evals/mai07_r3n3_fresh_holdout"
assert OUT == EVAL_OUT
R3N2_OUT = REPO / "evals/mai07_r3n2_fresh_holdout"
R3N_OUT = REPO / "evals/mai07_r3n_policy_conformance"
R3N_CLOSURE_DIR = REPO / "evals/mai07_r3n_integrity_closure"
APP_DIR = (
    REPO
    / "erp_bot/src/oip/modules/language_runtime/transliteration/application"
)
XL_ROOT = REPO / "erp_bot/src/oip/modules/language_runtime/transliteration"
SOURCE_PACK = XL_ROOT / "sealed_packs" / PARENT_RUNTIME_VERSION
CANDIDATE_PACK = XL_ROOT / "sealed_packs" / CANDIDATE_RUNTIME_VERSION
PARENT_FAILED_PACK = XL_ROOT / "sealed_packs" / PARENT_FAILED_R3N2_RUNTIME_VERSION

EXPECTED_R3N_INTEGRITY_SEMANTIC = (
    "fccbbcfbb7fbf9d816cbdc9278c8754964b5b7efcd6e499469e6e1701873ffae"
)
EXPECTED_PACK_CONTENT_HASH = (
    "1268527c5c5d99e036628dc104340dafe297afadf9938a310a099a38f825c0e7"
)
EXPECTED_LOCK_SEMANTIC = (
    "0aaefd824eec3b56a70f6846b29ecc603e9db85b3186e3264eee705f3d16c59b"
)
EXPECTED_PARENT_HOLDOUT_PRED_SHA = (
    "dc1e5162f03e6b480877c01c5baa0417b41fc742eaa2af74d81c81c00c25143a"
)

R3N3_RUNTIME_MODULES = tuple(sorted(APP_DIR.glob("*r3n3*.py"))) + (
    APP_DIR / "build_mai07r3n3_pack.py",
)


def _load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def _case_ids(path: Path) -> set[str]:
    ids: set[str] = set()
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.strip():
            ids.add(json.loads(line)["case_id"])
    return ids


def _r3n3_resources():
    return load_r3n3_resources()


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
# 1. R3N2 failed/consumed parent authority + aggregate-only proof
# ---------------------------------------------------------------------------


def test_r3n2_failed_parent_consumed_and_aggregate_only_proof():
    locked = _load_json(LOCKED_PATH)
    lineage = locked["parent_failed_r3n2_lineage"]
    assert lineage["runtime_version"] == PARENT_FAILED_R3N2_RUNTIME_VERSION
    assert lineage["pack_hash"] == PARENT_FAILED_R3N2_PACK_HASH
    assert lineage["lock_semantic_sha256"] == PARENT_FAILED_R3N2_LOCK_SEMANTIC
    assert lineage["verdict"] == PARENT_FAILED_R3N2_VERDICT
    assert lineage["consumed"] is True
    assert lineage["candidate_promoted"] is False

    r3n2_chain = _load_json(R3N2_OUT / "MAI_07R3N2_FRESH_HOLDOUT_RELEASE_CANDIDATE_001.CHAIN_MANIFEST.json")
    assert r3n2_chain["consumed"] is True
    assert r3n2_chain["verdict"] == "FAILED_HOLDOUT_QUALITY"

    proof = _load_json(OUT / "R3N3_AGGREGATE_ONLY_INPUT_PROOF.json")
    assert proof["prediction_jsonl_opened"] is False
    assert proof["r3n2_reports_opened"] is False
    assert proof["r3n2_blocked_row_count"] >= 2600
    assert "evals/mai07_r3n2_fresh_holdout/**/*predictions*.jsonl" in proof["prohibited_patterns"]

    assert locked["r3n_integrity_closure_semantic"] == EXPECTED_R3N_INTEGRITY_SEMANTIC
    assert locked["r3n_integrity_closure_semantic"] == R3N_INTEGRITY_CLOSURE_SEMANTIC


# ---------------------------------------------------------------------------
# 2–3. Candidate version uniqueness / active default unchanged
# ---------------------------------------------------------------------------


def test_candidate_version_unique_from_failed_r3n2_parent():
    assert CANDIDATE_RUNTIME_VERSION == "mai-07.1.8-r3n3-identityinv"
    assert CANDIDATE_POLICY_VERSION == "mai-07-r3n3.1.0.0"
    assert PARENT_FAILED_R3N2_RUNTIME_VERSION == "mai-07.1.7-r3n2-freshholdout"
    assert CANDIDATE_RUNTIME_VERSION != PARENT_FAILED_R3N2_RUNTIME_VERSION
    card = candidate_identity_card()
    assert card["candidate_runtime_version"] == CANDIDATE_RUNTIME_VERSION
    locked = _load_json(LOCKED_PATH)
    assert locked["resource_pack_version"] == CANDIDATE_RUNTIME_VERSION
    assert locked["parent_failed_r3n2_lineage"]["runtime_version"] == PARENT_FAILED_R3N2_RUNTIME_VERSION
    assert locked["parent_failed_r3n2_lineage"]["pack_hash"] == PARENT_FAILED_R3N2_PACK_HASH


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
    locked = _load_json(LOCKED_PATH)
    assert locked["runtime_version"] == PARENT_RUNTIME_VERSION
    assert locked["active_default_pack_version_unchanged"] == PARENT_RUNTIME_VERSION
    assert locked["overlay_enabled"] is False


# ---------------------------------------------------------------------------
# 4. Explicit candidate activation
# ---------------------------------------------------------------------------


def test_candidate_explicit_activation_only():
    assert DEFAULT_ACTIVE is False
    res = _r3n3_resources()
    assert res is not None
    card = candidate_identity_card()
    assert card["activation_method"] == "explicit_load_resources_resources_dir_plus_r3n3_factory"


# ---------------------------------------------------------------------------
# 5–8. Freshness firewall — zero overlap with R3N2/R3N holdout
# ---------------------------------------------------------------------------


def test_freshness_firewall_proof_passed_zero_r3n2_r3n_overlap():
    fw = _load_json(OUT / "FRESHNESS_FIREWALL.json")
    assert fw["proof_passed"] is True
    zero = fw["zero_overlap_proofs"]
    assert zero["r3n2_case_id_intersection_count"] == 0
    assert zero["r3n2_normalized_text_hash_intersection_count"] == 0
    assert zero["r3n2_skeleton_hash_intersection_count"] == 0
    assert zero["r3n2_template_family_intersection_count"] == 0
    assert zero["r3n_case_id_intersection_count"] == 0
    assert zero["r3n_normalized_text_hash_intersection_count"] == 0
    assert zero["dev_holdout_case_id_disjoint"] is True
    assert zero["dev_holdout_text_hash_disjoint"] is True
    assert zero["dev_holdout_family_disjoint"] is True

    r3n2_holdout_ids = _case_ids(R3N2_OUT / "holdout_validation.jsonl")
    r3n3_holdout_ids = _case_ids(OUT / "holdout_validation.jsonl")
    assert r3n2_holdout_ids.isdisjoint(r3n3_holdout_ids)

    r3n_holdout_ids = _case_ids(R3N_OUT / "holdout_validation.jsonl")
    assert r3n_holdout_ids.isdisjoint(r3n3_holdout_ids)

    r3n3_dev_ids = _case_ids(OUT / "development.jsonl")
    assert r3n3_dev_ids.isdisjoint(r3n3_holdout_ids)
    assert r3n3_dev_ids.isdisjoint(r3n2_holdout_ids)


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
# 11–14. R3N3 finalizer unit tests (synthetic only — no holdout cases)
# ---------------------------------------------------------------------------


def test_construct_exact_identity_matches_raw_surface():
    raw = "SKU-44102-r3n3"
    ident = construct_exact_identity(raw)
    assert ident.surface == raw
    assert ident.is_identity is True
    assert ident.kind == CandidateKind.IDENTITY
    assert is_exact_identity(ident, raw)
    assert "R3N3_EXACT_IDENTITY" in ident.reason_codes


def test_identity_survives_cap_when_devanagari_also_reserved():
    """Synthetic cap-pressure: legacy-style list ends with backfilled identity; R3N3 must keep it."""
    raw = "captest-r3n3-001"
    ranked = [
        _synthetic_candidate("alt1", rank=2),
        _synthetic_candidate("alt2", rank=3),
        _synthetic_candidate("alt3", rank=4),
        _synthetic_candidate("alt4", rank=5),
        _synthetic_candidate("खर्च", rank=6, kind=CandidateKind.LEXICAL),
        _synthetic_candidate(raw, is_identity=True, rank=7),
    ]
    out, truncated, diag = finalize_candidates_r3n3(
        ranked, max_candidates=5, raw_surface=raw
    )
    assert diag["postcondition_ok"] is True
    assert len(out) <= 5
    idents = [c for c in out if is_exact_identity(c, raw)]
    assert len(idents) == 1
    assert any(
        (not c.is_identity)
        and (c.script == CandidateScript.DEVANAGARI or any(0x0900 <= ord(ch) <= 0x097F for ch in c.surface))
        for c in out
    )
    assert truncated is True


def test_apply_finalizer_twice_idempotent_helper():
    raw = "idemp-r3n3-002"
    ranked = [
        _synthetic_candidate("खर्च", rank=1),
        _synthetic_candidate("alt-a", rank=2),
        _synthetic_candidate(raw, is_identity=True, rank=3),
    ]
    assert apply_finalizer_twice_idempotent(ranked, raw_surface=raw, max_candidates=5)


def test_finalizer_version_and_policy_constants():
    assert FINALIZER_VERSION == "mai-07-r3n3.finalizer.1.0.0"
    assert POLICY_VERSION == "mai-07-r3n3.1.0.0"
    locked = _load_json(LOCKED_PATH)
    assert locked["finalizer_version"] == FINALIZER_VERSION


# ---------------------------------------------------------------------------
# 15–26. Runtime unit checks via transliterate_r3n3 (synthetic only)
# ---------------------------------------------------------------------------


def test_identity_retention_synthetic_romanized_and_english():
    res = _r3n3_resources()
    eng_bundle = transliterate_r3n3("please review the payment status today", resources=res)
    payment = next(s for s in eng_bundle.span_results if s.raw_span.original_text.lower() == "payment")
    assert payment.candidates
    assert payment.candidates[0].is_identity is True

    rom_bundle = transliterate_r3n3("aaja kharcha hernu milau", resources=res)
    kharcha = next(s for s in rom_bundle.span_results if s.raw_span.original_text.lower() == "kharcha")
    assert kharcha.candidates
    assert any(c.is_identity for c in kharcha.candidates)


def test_acronym_vat_identity():
    res = _r3n3_resources()
    text = "please verify VAT amount before posting"
    bundle = transliterate_r3n3(text, resources=res)
    vat = next(s for s in bundle.span_results if s.raw_span.original_text == "VAT")
    assert vat.candidates
    assert vat.candidates[0].is_identity is True


def test_structural_identifier_sku_coalesce():
    res = _r3n3_resources()
    text = "please match SKU-44102 before posting"
    frame = analyze_language_r3n3(text)
    id_anns = [a for a in frame.span_annotations if a.original_text == "SKU-44102"]
    assert id_anns
    assert id_anns[0].language_form == LanguageForm.IDENTIFIER_OR_CODE.value
    bundle = transliterate_r3n3(text, resources=res)
    spans = [s for s in bundle.span_results if s.raw_span.original_text == "SKU-44102"]
    assert spans and spans[0].candidates
    assert spans[0].candidates[0].is_identity is True


def test_english_form_alone_insufficient():
    res = _r3n3_resources()
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
    res = _r3n3_resources()
    text = (
        "please review ledger voucher payment supplier customer discount "
        "commission statement reconcile opening closing export import"
    )
    bundle = transliterate_r3n3(text, resources=res)
    assert MAX_CANDIDATES_PER_SPAN == 5
    for span in bundle.span_results:
        assert len(span.candidates) <= 5


def test_determinism_same_input_twice():
    res = _r3n3_resources()
    text = "please review the payment status and aaja kharcha hernu"
    a = transliterate_r3n3(text, resources=res)
    b = transliterate_r3n3(text, resources=res)
    flags_a = [
        (s.raw_span.original_text, bool(s.candidates and s.candidates[0].is_identity))
        for s in a.span_results
    ]
    flags_b = [
        (s.raw_span.original_text, bool(s.candidates and s.candidates[0].is_identity))
        for s in b.span_results
    ]
    assert flags_a == flags_b


# ---------------------------------------------------------------------------
# 27. Scorer/threshold/population hash binding in LOCKED_NOT_RUN
# ---------------------------------------------------------------------------


def test_lock_binds_scorer_threshold_population_hashes():
    locked = _load_json(LOCKED_PATH)
    assert locked["status"] == "LOCKED_NOT_RUN"
    assert locked["manifest_sha256"] == EXPECTED_LOCK_SEMANTIC
    assert locked["rc_manifest_semantic_sha256"] == EXPECTED_LOCK_SEMANTIC
    assert locked["resource_content_sha256"] == EXPECTED_PACK_CONTENT_HASH
    for key in (
        "threshold_manifest_sha256",
        "population_definition_hash",
        "scorer_canonical_source_sha256",
        "scorer_audit_source_sha256",
        "evaluator_source_sha256",
        "policy_config_sha256",
        "scoring_contract_sha256",
        "finalizer_source_sha256",
    ):
        val = locked.get(key)
        assert isinstance(val, str) and len(val) == 64
    assert locked["scorer_version"] == "mai-07-r3n3.scorer.1.0.0"
    assert locked["scoring_contract_version"] == "mai-07-r3n3.contract.1.0.0"
    thresholds = load_thresholds()
    assert locked["threshold_manifest"]["threshold_id"] == thresholds["threshold_id"]


# ---------------------------------------------------------------------------
# 28. Canonical/audit agreement on development
# ---------------------------------------------------------------------------


def test_canonical_audit_agreement_development():
    result = score_split("DEVELOPMENT", write=False)
    assert result["agreement"]["ok"] is True
    assert result["canonical"]["ok"] is True or result["ok"] is True
    dev_report = _load_json(OUT / "reports/development_score_report.json")
    assert dev_report["agreement"]["ok"] is True
    assert dev_report["ok"] is True


# ---------------------------------------------------------------------------
# 29. Parent predictions file exists with hashes
# ---------------------------------------------------------------------------


def test_parent_holdout_predictions_exist_with_hashes():
    chain = _load_json(CHAIN_PATH)
    parent_path = REPO / chain["parent_holdout_predictions_path"]
    assert parent_path.is_file()
    assert chain["parent_holdout_predictions_sha256"] == EXPECTED_PARENT_HOLDOUT_PRED_SHA
    assert sha256_file(parent_path) == EXPECTED_PARENT_HOLDOUT_PRED_SHA


# ---------------------------------------------------------------------------
# 30–31. Seal dual-build via check_twice
# ---------------------------------------------------------------------------


def test_pack_check_existing_and_dual_build():
    existing = check_existing()
    assert existing["ok"] is True
    assert existing["pack_version"] == CANDIDATE_RUNTIME_VERSION
    assert existing["content_hash"] == EXPECTED_PACK_CONTENT_HASH
    twice = check_twice()
    assert twice["ok"] is True
    assert twice["dual_build_identical"] is True
    assert twice["resource_content_sha256"] == EXPECTED_PACK_CONTENT_HASH
    assert twice["dest_touched"] is False


# ---------------------------------------------------------------------------
# 32–33. Physical lock before holdout / one consumed attempt
# ---------------------------------------------------------------------------


def test_lock_before_holdout_attempt_consumed():
    assert LOCKED_PATH.is_file()
    assert CHAIN_PATH.is_file()
    assert RC_ID == "MAI_07R3N3_FRESH_HOLDOUT_RELEASE_CANDIDATE_001"
    locked = _load_json(LOCKED_PATH)
    assert locked["locked_before_holdout"] is True
    assert locked["locked"] is True
    chain = _load_json(CHAIN_PATH)
    assert chain["rc_id"] == RC_ID
    assert chain["consumed"] is True
    assert chain["verdict"] == "FAILED_HOLDOUT_QUALITY"
    attempt = _load_json(OUT / "MAI_07R3N3_HOLDOUT_ATTEMPT_001.json")
    assert attempt["status"] == "COMPLETED"
    assert attempt["prohibited_rerun"] is True


# ---------------------------------------------------------------------------
# 34. No second RC after failure
# ---------------------------------------------------------------------------


def test_no_second_rc_after_failure():
    rc_files = list(OUT.glob("MAI_07R3N3_FRESH_HOLDOUT_RELEASE_CANDIDATE_*.LOCKED_NOT_RUN.json"))
    assert len(rc_files) == 1
    assert rc_files[0].name.startswith("MAI_07R3N3_FRESH_HOLDOUT_RELEASE_CANDIDATE_001")
    assert not (OUT / "MAI_07R3N3_FRESH_HOLDOUT_RELEASE_CANDIDATE_002.LOCKED_NOT_RUN.json").exists()


# ---------------------------------------------------------------------------
# 35. Tests cannot mutate lock
# ---------------------------------------------------------------------------


def test_cannot_mutate_lock_without_authorize(monkeypatch: pytest.MonkeyPatch):
    lock_sha_before = sha256_file(LOCKED_PATH)
    monkeypatch.delenv(AUTHORIZE_ENV, raising=False)
    assert os.environ.get(AUTHORIZE_ENV) != "1"
    with pytest.raises(PermissionError):
        score_split("HOLDOUT_VALIDATION", write=True)
    assert sha256_file(LOCKED_PATH) == lock_sha_before


# ---------------------------------------------------------------------------
# 36. Frozen-data firewall — no docs/mokxya-ai/reviews imports in r3n3 runtime
# ---------------------------------------------------------------------------


def test_frozen_data_firewall_r3n3_runtime_no_eval_or_review_imports():
    forbidden_substr = ("evals", "docs.mokxya", "mokxya_ai.reviews", "reviews.mai07")
    runtime_only = APP_DIR / "mai07_r3n3_candidate_runtime.py"
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


def test_no_v3src_ids_in_r3n3_runtime_modules():
    fw = _load_json(OUT / "FRESHNESS_FIREWALL.json")
    private_ids = set(fw.get("r3m_corrective_source_ids") or [])
    assert private_ids
    runtime_paths = [
        APP_DIR / "mai07_r3n3_candidate_runtime.py",
        APP_DIR / "r3n3_candidate_finalization.py",
        APP_DIR / "build_mai07r3n3_pack.py",
        APP_DIR / "r3n3_scoring_contracts.py",
        APP_DIR / "eval_mai07_r3n3_canonical_scorer.py",
        APP_DIR / "eval_mai07_r3n3_audit_scorer.py",
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
# 39. No accounting imports in r3n3 modules
# ---------------------------------------------------------------------------


def test_no_accounting_imports_in_r3n3_modules():
    for path in R3N3_RUNTIME_MODULES:
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
# 40–41. Governance flags / MAI-08 NOT_STARTED
# ---------------------------------------------------------------------------


def test_governance_flags_and_mai08_not_started():
    qual_path = OUT / f"{RC_ID}.QUALIFICATION_RESULT.json"
    qual = _load_json(qual_path)
    assert qual["QUALITY_GATES_PASSED"] is False
    assert qual["LINGUIST_APPROVED"] is False
    assert qual["PRODUCTION_APPROVED"] is False
    assert qual["candidate_promoted"] is False
    assert qual["MAI-08"] == "NOT_STARTED"
    assert qual["MAI-07"] == "NEEDS_CORRECTIVE_WORK"
    assert qual["engineering_verdict"] == "FAILED_HOLDOUT_QUALITY"
    assert qual["status"] == "FAILED_HOLDOUT_QUALITY"
    assert qual["parent_lock_semantic_sha256"] == EXPECTED_LOCK_SEMANTIC
    ledger = _load_json(REPO / "docs/mokxya-ai/MAI_PHASE_LEDGER.json")
    phase = next(p for p in ledger["phases"] if p["id"] == "MAI-08")
    assert phase["status"] == "NOT_STARTED"


# ---------------------------------------------------------------------------
# 42. Property — 10000 seeded synthetic finalize_candidates_r3n3 lists
# ---------------------------------------------------------------------------


def test_property_10000_seeded_finalize_candidates_r3n3():
    rng = random.Random(20260718)
    dev_surfaces = ("खर्च", "भुक्तानी", "लेखा", "नाफा", "हानि", "कर", "बिल")
    latin_pool = string.ascii_lowercase + string.digits + "-"
    ok = 0
    for i in range(10000):
        raw = f"tok{i:05d}-" + "".join(rng.choice(latin_pool) for _ in range(rng.randint(2, 8)))
        n = rng.randint(1, 12)
        ranked: list[TransliterationCandidateV1] = []
        for j in range(n):
            if rng.random() < 0.15 and j == n - 1:
                ranked.append(_synthetic_candidate(raw, is_identity=True, rank=j + 1))
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
        out, _, diag = finalize_candidates_r3n3(ranked, max_candidates=cap, raw_surface=raw)
        assert len(out) <= cap
        idents = [c for c in out if is_exact_identity(c, raw)]
        assert len(idents) == 1
        assert idents[0].surface == raw
        assert apply_finalizer_twice_idempotent(out, raw_surface=raw, max_candidates=cap)
        if diag["postcondition_ok"]:
            surfaces = [c.surface for c in out]
            assert len(surfaces) == len(set(surfaces))
        ok += 1
    assert ok == 10000


# ---------------------------------------------------------------------------
# 43. Verdict FAILED_HOLDOUT_QUALITY; supporting splits passed; failed gates
# ---------------------------------------------------------------------------


def test_verdict_failed_holdout_quality_not_pass():
    qual = _load_json(OUT / f"{RC_ID}.QUALIFICATION_RESULT.json")
    chain = _load_json(CHAIN_PATH)
    assert qual["engineering_verdict"] == "FAILED_HOLDOUT_QUALITY"
    assert qual["gate_all_pass"] is False
    assert chain["verdict"] == "FAILED_HOLDOUT_QUALITY"
    assert qual["engineering_verdict"] != "PASSED_CORRECTIVE_RC"
    assert qual["engineering_verdict"] != "PASSED_FRESH_HOLDOUT_CORRECTIVE_RC"

    metrics = qual["metrics_summary"]
    assert metrics["identity_retention"]["numerator"] == 288
    assert metrics["identity_retention"]["denominator"] == 300
    assert metrics["exact_raw_identity"]["numerator"] == 288
    assert metrics["exact_raw_identity"]["denominator"] == 300
    assert metrics["exactly_one_identity"]["numerator"] == 288
    assert metrics["exactly_one_identity"]["denominator"] == 300
    assert metrics["identity_invariant_analogue"]["numerator"] == 238
    assert metrics["identity_invariant_analogue"]["denominator"] == 250
    assert metrics["cap_pressure_identity_retention"]["numerator"] == 238
    assert metrics["cap_pressure_identity_retention"]["denominator"] == 250
    assert metrics["finalizer_idempotence"]["numerator"] == 1188
    assert metrics["finalizer_idempotence"]["denominator"] == 1200
    assert metrics["english_identity_top1"]["numerator"] == 325
    assert metrics["false_devanagari_on_english"]["numerator"] == 0
    assert metrics["romanized_script_at_5"]["numerator"] == 200
    assert metrics["acronym_identity_top1"]["numerator"] == 100
    assert metrics["identifier_identity_top1"]["numerator"] == 100
    assert metrics["protected_identity"]["numerator"] == 100

    holdout_report = _load_json(OUT / "reports/holdout_validation_score_report.json")
    assert holdout_report["ok"] is False
    for gate in (
        "identity_retention",
        "exact_raw_identity",
        "exactly_one_identity",
        "identity_invariant_analogue",
        "cap_pressure_identity_retention",
        "finalizer_idempotence",
    ):
        assert gate in holdout_report["canonical"]["failed_gates"]

    mono = _load_json(OUT / "reports/monotonic_regression_score_report.json")
    assert mono["ok"] is False
    assert mono["canonical"]["failed_gates"] == ["finalizer_idempotence"]

    for split in (
        "context_counterfactual",
        "oov_challenge",
        "safety_challenge",
        "identity_cap_pressure_challenge",
    ):
        report = _load_json(OUT / "reports" / f"{split}_score_report.json")
        assert report["ok"] is True, split

    imm = _load_json(OUT / "reports/IMMUTABILITY_REPORT.json")
    assert imm["candidate_promoted"] is False
    assert imm["active_ok"] is True
    assert imm["parent_resource_hash"] == PARENT_RESOURCE_HASH
