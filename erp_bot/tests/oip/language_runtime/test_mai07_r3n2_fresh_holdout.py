"""MAI-07R3N2 fresh-holdout policy-conformance — FAILED_HOLDOUT_QUALITY governance tests.

Never hardcode private R3M case source texts. Load authority via JSON for counts only;
text-based checks use synthetic strings. Do not regenerate predictions or rerun holdout.
Do not repair R3N2 in-place — verdict remains FAILED_HOLDOUT_QUALITY.
"""

from __future__ import annotations

import ast
import json
import os
import random
import string
from pathlib import Path

import pytest

from erp_bot.src.oip.modules.language_runtime.domain.taxonomy import LanguageForm
from erp_bot.src.oip.modules.language_runtime.transliteration import (
    ENABLE_PROMOTION_OVERLAY,
    MAX_CANDIDATES_PER_SPAN,
    RESOURCE_PACK_VERSION,
    RUNTIME_VERSION,
)
from erp_bot.src.oip.modules.language_runtime.transliteration.application.build_mai07r3n2_pack import (
    ALLOWED_FILES,
    check_existing,
    check_twice,
)
from erp_bot.src.oip.modules.language_runtime.transliteration.application.eval_mai07_r3n2 import (
    AUTHORIZE_ENV,
    CHAIN_PATH,
    LOCKED_PATH,
    OUT as EVAL_OUT,
    RC_ID,
    load_thresholds,
    score_split,
)
from erp_bot.src.oip.modules.language_runtime.transliteration.application.mai07_r3n2_candidate_runtime import (
    CANDIDATE_POLICY_VERSION,
    CANDIDATE_RUNTIME_VERSION,
    DEFAULT_ACTIVE,
    INVALIDATED_R3N_PACK_HASH,
    INVALIDATED_R3N_RUNTIME_VERSION,
    PARENT_RESOURCE_HASH,
    PARENT_RUNTIME_VERSION,
    R3M_CLOSURE_SEMANTIC,
    R3N_INTEGRITY_CLOSURE_SEMANTIC,
    assert_active_default_immutable,
    analyze_language_r3n2,
    candidate_identity_card,
    load_r3n2_resources,
    transliterate_r3n2,
)
from erp_bot.src.oip.modules.language_runtime.transliteration.application.r3n2_scoring_contracts import (
    MINIMUM_DENOMINATORS,
    metric_required_when_empty,
)
from erp_bot.src.oip.modules.language_runtime.transliteration.infrastructure.english_identity_guard import (
    Disposition,
    classify_disposition,
)
from erp_bot.src.oip.modules.language_runtime.transliteration.infrastructure.seal_contract_v2 import (
    sha256_file,
)

REPO = Path(__file__).resolve().parents[4]
OUT = REPO / "evals/mai07_r3n2_fresh_holdout"
assert OUT == EVAL_OUT
R3N_OUT = REPO / "evals/mai07_r3n_policy_conformance"
R3N_CLOSURE_DIR = REPO / "evals/mai07_r3n_integrity_closure"
APP_DIR = (
    REPO
    / "erp_bot/src/oip/modules/language_runtime/transliteration/application"
)
XL_ROOT = REPO / "erp_bot/src/oip/modules/language_runtime/transliteration"
SOURCE_PACK = XL_ROOT / "sealed_packs" / PARENT_RUNTIME_VERSION
CANDIDATE_PACK = XL_ROOT / "sealed_packs" / CANDIDATE_RUNTIME_VERSION
INVALIDATED_PACK = XL_ROOT / "sealed_packs" / INVALIDATED_R3N_RUNTIME_VERSION

EXPECTED_R3N_INTEGRITY_SEMANTIC = (
    "fccbbcfbb7fbf9d816cbdc9278c8754964b5b7efcd6e499469e6e1701873ffae"
)
EXPECTED_PACK_CONTENT_HASH = (
    "170610284993061dd93efc3150f09f03ac2f1e3d69052c964cbe7c3aab61c1f3"
)
EXPECTED_LOCK_SEMANTIC = (
    "25f9eac74b8c9331a474c54ef2bb723157789aba00cab7bb8194dbb6b999c710"
)
EXPECTED_PARENT_HOLDOUT_PRED_SHA = (
    "324097d855f11ae1273d97fa29ab8042e7af1d0e696f6b19424a97c6254194b7"
)

R3N2_RUNTIME_MODULES = tuple(sorted(APP_DIR.glob("*r3n2*.py"))) + (
    APP_DIR / "build_mai07r3n2_pack.py",
)


def _load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def _case_ids(path: Path) -> set[str]:
    ids: set[str] = set()
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.strip():
            ids.add(json.loads(line)["case_id"])
    return ids


def _r3n2_resources():
    return load_r3n2_resources()


# ---------------------------------------------------------------------------
# 1. R3N invalidation authority preserved
# ---------------------------------------------------------------------------


def test_r3n_invalidation_sidecar_and_integrity_semantic():
    semantic_path = R3N_CLOSURE_DIR / "SEMANTIC_HASH.json"
    assert semantic_path.is_file()
    semantic = _load_json(semantic_path)
    assert semantic["semantic_sha256"] == EXPECTED_R3N_INTEGRITY_SEMANTIC
    assert semantic["semantic_sha256"] == R3N_INTEGRITY_CLOSURE_SEMANTIC

    sidecar_paths = (
        R3N_CLOSURE_DIR / "HISTORICAL_INVALIDATION_SIDECAR.json",
        R3N_OUT
        / "MAI_07R3N_POLICY_CONFORMANCE_RELEASE_CANDIDATE_002.HISTORICAL_INVALIDATION_SIDECAR.json",
    )
    found = [p for p in sidecar_paths if p.is_file()]
    assert found, "R3N invalidation sidecar must exist"
    sidecar = _load_json(found[0])
    assert sidecar["invalidation_verdict"] == "INVALIDATED_HOLDOUT_CONTAMINATION_NEW_RC_REQUIRED"
    assert sidecar["passed_corrective_rc_withdrawn"] is True

    locked = _load_json(LOCKED_PATH)
    assert locked["r3n_integrity_closure_semantic"] == EXPECTED_R3N_INTEGRITY_SEMANTIC
    assert locked["r3m_closure_semantic"] == R3M_CLOSURE_SEMANTIC


# ---------------------------------------------------------------------------
# 2–3. Candidate version uniqueness / active default unchanged
# ---------------------------------------------------------------------------


def test_candidate_version_unique_from_invalidated_parent():
    assert CANDIDATE_RUNTIME_VERSION == "mai-07.1.7-r3n2-freshholdout"
    assert CANDIDATE_POLICY_VERSION == "mai-07-r3n2.1.0.0"
    assert INVALIDATED_R3N_RUNTIME_VERSION == "mai-07.1.6-r3n-policyconf"
    assert CANDIDATE_RUNTIME_VERSION != INVALIDATED_R3N_RUNTIME_VERSION
    card = candidate_identity_card()
    assert card["candidate_runtime_version"] == CANDIDATE_RUNTIME_VERSION
    locked = _load_json(LOCKED_PATH)
    assert locked["resource_pack_version"] == CANDIDATE_RUNTIME_VERSION
    assert locked["invalidated_parent_lineage"]["runtime_version"] == INVALIDATED_R3N_RUNTIME_VERSION
    assert locked["invalidated_parent_lineage"]["pack_hash"] == INVALIDATED_R3N_PACK_HASH


def test_active_default_unchanged_overlay_disabled():
    assert RUNTIME_VERSION == "mai-07.1.3-r3f-sealnew"
    assert RUNTIME_VERSION == PARENT_RUNTIME_VERSION
    assert RESOURCE_PACK_VERSION == PARENT_RUNTIME_VERSION
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
    res = _r3n2_resources()
    assert res is not None
    card = candidate_identity_card()
    assert card["activation_method"] == "explicit_load_resources_resources_dir_plus_r3n2_factory"


# ---------------------------------------------------------------------------
# 5–8. Freshness firewall — zero overlap with R3N holdout
# ---------------------------------------------------------------------------


def test_freshness_firewall_zero_case_id_text_family_overlap_with_r3n():
    fw = _load_json(OUT / "FRESHNESS_FIREWALL.json")
    assert fw["proof_passed"] is True
    zero = fw["zero_overlap_proofs"]
    assert zero["case_id_intersection_empty"] is True
    assert zero["case_id_intersection"] == []
    assert zero["normalized_text_intersection_empty"] is True
    assert zero["normalized_text_intersection_count"] == 0
    assert zero["template_family_intersection_empty"] is True
    assert zero["template_family_intersection"] == []
    assert zero["dev_holdout_case_id_disjoint"] is True
    assert zero["dev_holdout_text_disjoint"] is True
    assert zero["dev_holdout_family_disjoint"] is True
    assert zero["skeleton_intersection_empty"] is True

    r3n_holdout_ids = _case_ids(R3N_OUT / "holdout_validation.jsonl")
    r3n2_holdout_ids = _case_ids(OUT / "holdout_validation.jsonl")
    assert r3n_holdout_ids.isdisjoint(r3n2_holdout_ids)

    r3n_dev_ids = _case_ids(R3N_OUT / "development.jsonl")
    r3n2_dev_ids = _case_ids(OUT / "development.jsonl")
    assert r3n_dev_ids.isdisjoint(r3n2_holdout_ids)
    assert r3n2_dev_ids.isdisjoint(r3n_holdout_ids)


# ---------------------------------------------------------------------------
# 9. Required population minima
# ---------------------------------------------------------------------------


def test_population_denominators_meet_locked_minima():
    pop_doc = _load_json(OUT / "POPULATION_DENOMINATORS.json")
    assert pop_doc["minima_check"]["ok"] is True
    observed = pop_doc["observed_population_counts"]
    for pid, minimum in MINIMUM_DENOMINATORS.items():
        if pid in {"CONTEXT_COUNTERFACTUAL", "OOV", "MONOTONIC_PARENT_CORRECT"}:
            continue
        assert observed.get(pid, 0) >= minimum, f"{pid} below minimum {minimum}"


# ---------------------------------------------------------------------------
# 10. authorized_code_corrective DEVELOPMENT-only requiredness
# ---------------------------------------------------------------------------


def test_authorized_code_corrective_development_only_requiredness():
    assert metric_required_when_empty("authorized_code_corrective", "DEVELOPMENT") is True
    assert metric_required_when_empty("authorized_code_corrective", "HOLDOUT_VALIDATION") is False


# ---------------------------------------------------------------------------
# 11–22. Runtime unit checks via transliterate_r3n2 (synthetic only)
# ---------------------------------------------------------------------------


def test_identity_retention_synthetic_romanized_and_english():
    res = _r3n2_resources()
    eng_bundle = transliterate_r3n2("please review the payment status today", resources=res)
    payment = next(s for s in eng_bundle.span_results if s.raw_span.original_text.lower() == "payment")
    assert payment.candidates
    assert payment.candidates[0].is_identity is True

    rom_bundle = transliterate_r3n2("aaja kharcha hernu milau", resources=res)
    kharcha = next(s for s in rom_bundle.span_results if s.raw_span.original_text.lower() == "kharcha")
    assert kharcha.candidates
    assert any(c.is_identity for c in kharcha.candidates)


def test_acronym_vat_identity():
    res = _r3n2_resources()
    text = "please verify VAT amount before posting"
    bundle = transliterate_r3n2(text, resources=res)
    vat = next(s for s in bundle.span_results if s.raw_span.original_text == "VAT")
    assert vat.candidates
    assert vat.candidates[0].is_identity is True


def test_structural_identifier_sku_coalesce():
    res = _r3n2_resources()
    text = "please match SKU-44102 before posting"
    frame = analyze_language_r3n2(text)
    id_anns = [a for a in frame.span_annotations if a.original_text == "SKU-44102"]
    assert id_anns
    assert id_anns[0].language_form == LanguageForm.IDENTIFIER_OR_CODE.value
    bundle = transliterate_r3n2(text, resources=res)
    spans = [s for s in bundle.span_results if s.raw_span.original_text == "SKU-44102"]
    assert spans and spans[0].candidates
    assert spans[0].candidates[0].is_identity is True


def test_ordinary_romanized_not_acronym():
    res = _r3n2_resources()
    text = "ram le kaam garyo aaja"
    frame = analyze_language_r3n2(text)
    ram = next(a for a in frame.span_annotations if a.original_text.lower() == "ram")
    assert ram.language_form != LanguageForm.IDENTIFIER_OR_CODE.value
    assert "ACRONYM" not in (ram.language_form or "")
    assert not ram.protected_reason


def test_english_form_alone_insufficient():
    res = _r3n2_resources()
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


def test_decisive_english_identity():
    res = _r3n2_resources()
    text = "please confirm the invoice total amount is correct"
    bundle = transliterate_r3n2(text, resources=res)
    invoice = next(s for s in bundle.span_results if s.raw_span.original_text.lower() == "invoice")
    assert invoice.candidates
    assert invoice.candidates[0].is_identity is True


def test_strong_romanized_prefers_target_not_english_form_alone():
    res = _r3n2_resources()
    bundle = transliterate_r3n2("aaja kharcha hernu", resources=res)
    kharcha = next(s for s in bundle.span_results if s.raw_span.original_text.lower() == "kharcha")
    assert kharcha.candidates
    assert kharcha.candidates[0].is_identity is False


def test_shared_conservative_no_forced_harm():
    res = _r3n2_resources()
    text = "yo kharcha confirm garnu hola maybe"
    bundle = transliterate_r3n2(text, resources=res)
    reconstructed = "".join(s.raw_span.original_text for s in bundle.span_results)
    assert reconstructed == text
    assert all(len(s.candidates) <= MAX_CANDIDATES_PER_SPAN for s in bundle.span_results)


def test_protected_precedence_raw_immutability():
    text = "please match SKU-44102 before posting r3n2raw"
    frame = analyze_language_r3n2(text)
    assert frame.raw_text == text
    res = _r3n2_resources()
    bundle = transliterate_r3n2(text, resources=res)
    reconstructed = "".join(s.raw_span.original_text for s in bundle.span_results)
    assert reconstructed == text
    assert bundle.matching_view == "RAW"


def test_unicode_code_point_offsets_cover_exactly():
    text = "aaja खर्च hernu SKU-44102 confirm"
    frame = analyze_language_r3n2(text)
    assert frame.offset_unit == "UNICODE_CODE_POINT"
    covered = sum(a.end_offset - a.start_offset for a in frame.span_annotations)
    assert covered == len(text)
    res = _r3n2_resources()
    bundle = transliterate_r3n2(text, resources=res)
    assert all(s.raw_span.offset_unit == "UNICODE_CODE_POINT" for s in bundle.span_results)


def test_candidate_cap_at_most_five():
    res = _r3n2_resources()
    text = (
        "please review ledger voucher payment supplier customer discount "
        "commission statement reconcile opening closing export import"
    )
    bundle = transliterate_r3n2(text, resources=res)
    assert MAX_CANDIDATES_PER_SPAN == 5
    for span in bundle.span_results:
        assert len(span.candidates) <= 5


def test_determinism_same_input_twice():
    res = _r3n2_resources()
    text = "please review the payment status and aaja kharcha hernu"
    a = transliterate_r3n2(text, resources=res)
    b = transliterate_r3n2(text, resources=res)
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
# 23. Scorer/threshold/population hash binding in LOCKED_NOT_RUN
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
    ):
        val = locked.get(key)
        assert isinstance(val, str) and len(val) == 64
    assert locked["scorer_version"] == "mai-07-r3n2.scorer.1.0.0"
    assert locked["scoring_contract_version"] == "mai-07-r3n2.contract.1.0.0"
    thresholds = load_thresholds()
    assert locked["threshold_manifest"]["threshold_id"] == thresholds["threshold_id"]


# ---------------------------------------------------------------------------
# 24. Canonical/audit agreement on development
# ---------------------------------------------------------------------------


def test_canonical_audit_agreement_development():
    result = score_split("DEVELOPMENT", write=False)
    assert result["agreement"]["ok"] is True
    assert result["canonical"]["ok"] is True or result["ok"] is True
    dev_report = _load_json(OUT / "reports/development_score_report.json")
    assert dev_report["agreement"]["ok"] is True
    assert dev_report["ok"] is True


# ---------------------------------------------------------------------------
# 25. Parent predictions file exists with hashes
# ---------------------------------------------------------------------------


def test_parent_holdout_predictions_exist_with_hashes():
    chain = _load_json(CHAIN_PATH)
    parent_path = REPO / chain["parent_holdout_predictions_path"]
    assert parent_path.is_file()
    assert chain["parent_holdout_predictions_sha256"] == EXPECTED_PARENT_HOLDOUT_PRED_SHA
    assert sha256_file(parent_path) == EXPECTED_PARENT_HOLDOUT_PRED_SHA


# ---------------------------------------------------------------------------
# 26–27. Seal dual-build via check_twice
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
# 28–29. Physical lock before holdout / one consumed attempt
# ---------------------------------------------------------------------------


def test_lock_before_holdout_attempt_consumed():
    assert LOCKED_PATH.is_file()
    assert CHAIN_PATH.is_file()
    assert RC_ID == "MAI_07R3N2_FRESH_HOLDOUT_RELEASE_CANDIDATE_001"
    locked = _load_json(LOCKED_PATH)
    assert locked["locked_before_holdout"] is True
    assert locked["locked"] is True
    chain = _load_json(CHAIN_PATH)
    assert chain["rc_id"] == RC_ID
    assert chain["consumed"] is True
    assert chain["verdict"] == "FAILED_HOLDOUT_QUALITY"
    attempt = _load_json(OUT / "MAI_07R3N2_HOLDOUT_ATTEMPT_001.json")
    assert attempt["status"] == "COMPLETED"
    assert attempt["prohibited_rerun"] is True


# ---------------------------------------------------------------------------
# 30. No second RC after failure
# ---------------------------------------------------------------------------


def test_no_second_rc_after_failure():
    rc_files = list(OUT.glob("MAI_07R3N2_FRESH_HOLDOUT_RELEASE_CANDIDATE_*.LOCKED_NOT_RUN.json"))
    assert len(rc_files) == 1
    assert rc_files[0].name.startswith("MAI_07R3N2_FRESH_HOLDOUT_RELEASE_CANDIDATE_001")
    assert not (OUT / "MAI_07R3N2_FRESH_HOLDOUT_RELEASE_CANDIDATE_002.LOCKED_NOT_RUN.json").exists()


# ---------------------------------------------------------------------------
# 31. Tests cannot mutate lock
# ---------------------------------------------------------------------------


def test_cannot_mutate_lock_without_authorize(monkeypatch: pytest.MonkeyPatch):
    lock_sha_before = sha256_file(LOCKED_PATH)
    monkeypatch.delenv(AUTHORIZE_ENV, raising=False)
    assert os.environ.get(AUTHORIZE_ENV) != "1"
    with pytest.raises(PermissionError):
        score_split("HOLDOUT_VALIDATION", write=True)
    assert sha256_file(LOCKED_PATH) == lock_sha_before


# ---------------------------------------------------------------------------
# 32. Frozen-data firewall — no docs/mokxya-ai/reviews imports in r3n2 runtime
# ---------------------------------------------------------------------------


def test_frozen_data_firewall_r3n2_runtime_no_eval_or_review_imports():
    forbidden_substr = ("evals", "docs.mokxya", "mokxya_ai.reviews", "reviews.mai07")
    runtime_only = APP_DIR / "mai07_r3n2_candidate_runtime.py"
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
# 33. No case-specific memorization of V3SRC ids in runtime
# ---------------------------------------------------------------------------


def test_no_v3src_ids_in_r3n2_runtime_modules():
    fw = _load_json(OUT / "FRESHNESS_FIREWALL.json")
    private_ids = set(fw.get("r3m_corrective_source_ids") or [])
    assert private_ids
    runtime_paths = [
        APP_DIR / "mai07_r3n2_candidate_runtime.py",
        APP_DIR / "build_mai07r3n2_pack.py",
        APP_DIR / "r3n2_scoring_contracts.py",
        APP_DIR / "eval_mai07_r3n2_canonical_scorer.py",
        APP_DIR / "eval_mai07_r3n2_audit_scorer.py",
    ]
    for path in runtime_paths:
        assert path.is_file(), path.name
        blob = path.read_text(encoding="utf-8")
        for sid in private_ids:
            assert sid not in blob, f"V3SRC id leaked into {path.name}"


# ---------------------------------------------------------------------------
# 34. No resource lexicon additions — pack differs from parent only by policy
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
# 35. No accounting imports in r3n2 modules
# ---------------------------------------------------------------------------


def test_no_accounting_imports_in_r3n2_modules():
    for path in R3N2_RUNTIME_MODULES:
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
# 36–37. Governance flags / MAI-08 NOT_STARTED
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
    ledger = _load_json(REPO / "docs/mokxya-ai/MAI_PHASE_LEDGER.json")
    phase = next(p for p in ledger["phases"] if p["id"] == "MAI-08")
    assert phase["status"] == "NOT_STARTED"


# ---------------------------------------------------------------------------
# 38. Property — 3000 seeded synthetic strings
# ---------------------------------------------------------------------------


def test_property_3000_seeded_synthetic_strings():
    res = _r3n2_resources()
    rng = random.Random(20260718)
    alphabet = string.ascii_letters + string.digits + "-"
    ok = 0
    for i in range(3000):
        length = rng.randint(3, 24)
        token = "".join(rng.choice(alphabet) for _ in range(length))
        if token.strip("-") == "":
            token = f"x{i}y"
        text = f"please check {token} once r3n2prop{i:04d}"
        bundle = transliterate_r3n2(text, resources=res)
        assert bundle is not None
        reconstructed = "".join(s.raw_span.original_text for s in bundle.span_results)
        assert reconstructed == text
        assert all(len(s.candidates) <= 5 for s in bundle.span_results)
        ok += 1
    assert ok == 3000


# ---------------------------------------------------------------------------
# 39. Verdict FAILED_HOLDOUT_QUALITY; supporting splits passed; failed gates
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
    assert metrics["identity_retention"]["numerator"] == 148
    assert metrics["identity_retention"]["denominator"] == 150
    assert metrics["identity_invariant_analogue"]["numerator"] == 98
    assert metrics["identity_invariant_analogue"]["denominator"] == 100
    assert metrics["english_identity_top1"]["numerator"] == 275
    assert metrics["romanized_script_at_5"]["numerator"] == 200
    assert metrics["acronym_identity_top1"]["numerator"] == 100
    assert metrics["identifier_identity_top1"]["numerator"] == 100
    assert metrics["protected_identity"]["numerator"] == 100

    holdout_report = _load_json(OUT / "reports/holdout_validation_score_report.json")
    assert holdout_report["ok"] is False
    assert "identity_retention" in holdout_report["canonical"]["failed_gates"]
    assert "identity_invariant_analogue" in holdout_report["canonical"]["failed_gates"]

    for split in (
        "monotonic_regression",
        "oov_challenge",
        "context_counterfactual",
        "safety_challenge",
    ):
        report = _load_json(OUT / "reports" / f"{split}_score_report.json")
        assert report["ok"] is True, split

    imm = _load_json(OUT / "reports/IMMUTABILITY_REPORT.json")
    assert imm["candidate_promoted"] is False
    assert imm["active_ok"] is True
    assert imm["parent_resource_hash"] == PARENT_RESOURCE_HASH
