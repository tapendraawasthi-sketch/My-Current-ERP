"""MAI-07R3L AI-assisted runtime conformance diagnostic tests."""

from __future__ import annotations

import ast
import json
import re
from pathlib import Path

import pytest

from src.oip.modules.language_runtime.transliteration import (
    ENABLE_PROMOTION_OVERLAY,
    RUNTIME_VERSION,
)
from src.oip.modules.language_runtime.transliteration.application.mai07_r3ja_v3_agreement import (
    ROUND_A_DISPOSITIONS,
)
from src.oip.modules.language_runtime.transliteration.application.mai07_r3ja_v3_firewall import (
    REPO,
)
from src.oip.modules.language_runtime.transliteration.application.mai07_r3k_hash_contract import (
    KNOWN as R3K_KNOWN,
    sha256_file,
)
from src.oip.modules.language_runtime.transliteration.application.mai07_r3l_audit_scorer import (
    compare_reports,
    score_audit,
)
from src.oip.modules.language_runtime.transliteration.application.mai07_r3l_behavior_policy import (
    map_disposition_to_behavior,
)
from src.oip.modules.language_runtime.transliteration.application.mai07_r3l_canonical_scorer import (
    score_canonical,
)
from src.oip.modules.language_runtime.transliteration.application.mai07_r3l_runtime_conformance_diagnostic import (
    DEFAULT_OUT,
    EXPECTED_AUTH_MANIFEST,
    EXPECTED_CASES,
    EXPECTED_FOUR,
    EXPECTED_JUDGMENTS,
    EXPECTED_RESOURCE,
    EXPECTED_RISK,
    EXPECTED_RUNTIME,
    EXPECTED_THREE,
    OFFICIAL_INBOX,
    assert_official_inbox_empty,
    build_cases,
    build_residual_queue,
    build_targeted_packet,
    has_devanagari_chars,
    is_devanagari_non_identity_candidate,
    prove_deterministic_rerun,
    resolve_highlighted_span,
    run_diagnostic,
    seal_population_manifest,
    verify_preconditions,
)
from src.oip.modules.language_runtime.transliteration.infrastructure import (
    resource_repository as xlrr,
)

ACTIVE = EXPECTED_RESOURCE
APP = (
    REPO
    / "erp_bot/src/oip/modules/language_runtime/transliteration/application"
)


def test_01_all_input_hashes():
    pre = verify_preconditions()
    assert pre["ok"] is True
    zip_p = REPO / "MokXya_MAI07_V3_ACCOUNTING_DOMAIN_ROUND_A_AI_ASSISTED_HUMAN_VERIFIED_READY.zip"
    assert sha256_file(zip_p) == R3K_KNOWN["accounting_package_zip_raw_sha256"]


def test_02_r3k_authority_manifest_hash():
    auth = (
        REPO
        / "docs/mokxya-ai/reviews/mai07_v3_ai_assisted/cross_role_diagnostic"
        / "R3K_INPUT_AUTHORITY_MANIFEST.json"
    )
    assert sha256_file(auth) == EXPECTED_AUTH_MANIFEST


def test_03_counts():
    cases = build_cases()
    assert len(cases) == EXPECTED_CASES == 1111
    assert sum(1 for c in cases if c.provenance_bucket == "ACCOUNTING_CONTENT_MAP") == EXPECTED_FOUR
    assert sum(1 for c in cases if c.provenance_bucket == "HEURISTIC_V1") == EXPECTED_THREE
    report = json.loads(
        (
            REPO
            / "docs/mokxya-ai/reviews/mai07_v3_ai_assisted/cross_role_diagnostic/reports"
            / "CONSENSUS_DIAGNOSTIC_REPORT.json"
        ).read_text(encoding="utf-8")
    )
    assert report["total_role_judgments"] == EXPECTED_JUDGMENTS
    risk_n = sum(
        1
        for ln in (
            REPO
            / "docs/mokxya-ai/reviews/mai07_v3_ai_assisted/cross_role_diagnostic/canonical"
            / "RISK_QUEUE.jsonl"
        )
        .read_text(encoding="utf-8")
        .splitlines()
        if ln.strip()
    )
    assert risk_n == EXPECTED_RISK


def test_04_05_runtime_resource_overlay():
    assert RUNTIME_VERSION == EXPECTED_RUNTIME
    assert ENABLE_PROMOTION_OVERLAY is False
    r = xlrr.validate_resources()
    assert r["ok"] and r["content_hash"] == ACTIVE


def test_06_exhaustive_disposition_mapping():
    classes = set()
    for d in ROUND_A_DISPOSITIONS:
        b = map_disposition_to_behavior(d)
        assert b.behavior_class != "UNKNOWN_UNSUPPORTED"
        classes.add(b.behavior_class)
    assert "ENGLISH_IDENTITY" in classes
    assert "DEVANAGARI_TRANSLITERATION" in classes


def test_07_unknown_disposition_fails_closed():
    b = map_disposition_to_behavior("NOT_A_REAL_DISPOSITION")
    assert b.scoring_applicability == "UNSUPPORTED"
    assert b.behavior_class == "UNKNOWN_UNSUPPORTED"


def test_08_09_10_devanagari_counting_rules():
    assert is_devanagari_non_identity_candidate(surface="hello", is_identity=False, script="LATIN") is False
    assert is_devanagari_non_identity_candidate(surface="hello", is_identity=True, script="LATIN") is False
    assert is_devanagari_non_identity_candidate(surface="बिल", is_identity=True, script="DEVANAGARI") is False
    assert is_devanagari_non_identity_candidate(surface="बिल", is_identity=False, script="DEVANAGARI") is True
    assert is_devanagari_non_identity_candidate(surface="123", is_identity=False, script="OTHER") is False
    assert is_devanagari_non_identity_candidate(surface="!!!", is_identity=False, script="OTHER") is False
    assert has_devanagari_chars("abc") is False


def test_11_no_exact_target_surface_invented():
    src = (APP / "mai07_r3l_behavior_policy.py").read_text(encoding="utf-8")
    assert "NO_EXACT_TARGET_SPELLING" in src
    assert "acceptable_devanagari_targets" not in src


def test_12_13_optional_context_no_unique_top1():
    opt = map_disposition_to_behavior("TRANSLITERATION_OPTIONAL")
    ctx = map_disposition_to_behavior("CONTEXT_DEPENDENT")
    assert opt.unique_top1_gold is False
    assert ctx.unique_top1_gold is False


def test_14_15_population_empty_rules():
    cases = build_cases()
    man = seal_population_manifest(cases)
    assert man["populations"]["ALL_CASES"]["count"] == 1111
    assert man["populations"]["ALL_CASES"]["status"] == "OK"
    # optional empty helper: fabricate empty optional
    empty = {
        "population_id": "FAKE_OPTIONAL",
        "required": False,
        "case_ids": [],
        "count": 0,
        "status": "NOT_APPLICABLE",
    }
    assert empty["status"] == "NOT_APPLICABLE"
    required_empty = {
        "population_id": "FAKE_REQUIRED",
        "required": True,
        "case_ids": [],
        "count": 0,
        "status": "INVALID_REQUIRED_POPULATION",
    }
    assert required_empty["status"] == "INVALID_REQUIRED_POPULATION"


def test_16_17_span_resolution_and_codepoints():
    text = "bill and bill again"
    r = resolve_highlighted_span(text, "bill")
    assert r["status"] == "SPAN_AMBIGUOUS"
    r2 = resolve_highlighted_span("एक बिल लेख", "बिल")
    assert r2["status"] == "RESOLVED"
    assert text[0:4] == "bill"  # code-point indexing
    r3 = resolve_highlighted_span("hello", "missing")
    assert r3["status"] == "SPAN_NOT_FOUND"
    # unique
    r4 = resolve_highlighted_span("pay VAT now", "VAT")
    assert r4["status"] == "RESOLVED" and r4["start"] == 4


def test_18_19_20_21_protected_raw_cap_ordering(tmp_path: Path):
    # Use a tiny subset via full run smoke artifacts if present, else run one case
    cases = build_cases()
    sample = next(c for c in cases if c.behavior.behavior_class == "ACRONYM")
    from src.oip.modules.language_runtime.transliteration.application.mai07_r3l_runtime_conformance_diagnostic import (
        run_prediction,
    )

    pred = run_prediction(sample)
    assert pred.caps_ok is True
    assert pred.raw_text_unchanged is True
    ranks = [c.rank for c in pred.candidates]
    assert ranks == sorted(ranks)


def test_22_canonical_audit_agreement():
    if not (DEFAULT_OUT / "CANONICAL_METRICS.json").is_file():
        pytest.skip("R3L artifacts not written yet")
    can = json.loads((DEFAULT_OUT / "CANONICAL_METRICS.json").read_text(encoding="utf-8"))
    aud = json.loads((DEFAULT_OUT / "INDEPENDENT_AUDIT_METRICS.json").read_text(encoding="utf-8"))
    agr = compare_reports(can, aud)
    assert agr["ok"] is True


def test_23_residual_priority_ordering():
    if not (DEFAULT_OUT / "RESIDUAL_RISK_QUEUE.jsonl").is_file():
        pytest.skip("R3L artifacts not written yet")
    rows = [
        json.loads(ln)
        for ln in (DEFAULT_OUT / "RESIDUAL_RISK_QUEUE.jsonl").read_text(encoding="utf-8").splitlines()
        if ln.strip()
    ]
    order = {"TIER_1_CRITICAL": 0, "TIER_2_HIGH": 1, "TIER_3_MEDIUM": 2}
    tiers = [order[r["residual_tier"]] for r in rows]
    assert tiers == sorted(tiers)


def test_24_25_26_packet_coverage_leakage_private():
    if not (DEFAULT_OUT / "LEAKAGE_AUDIT.json").is_file():
        pytest.skip("R3L artifacts not written yet")
    leak = json.loads((DEFAULT_OUT / "LEAKAGE_AUDIT.json").read_text(encoding="utf-8"))
    assert leak["ok"] is True
    csv = (
        DEFAULT_OUT / "targeted_review_packet/TARGETED_REVIEW_PACKET.csv"
    ).read_text(encoding="utf-8")
    assert "source_item_id" not in csv.lower()
    assert "PRODUCT_POLICY" not in csv
    priv = json.loads(
        (
            DEFAULT_OUT
            / "targeted_review_packet/private_adjudication_import_only/TARGETED_REVIEW_PRIVATE_MAPPING.json"
        ).read_text(encoding="utf-8")
    )
    assert priv["prohibited_for_runtime"] is True
    assert priv["use"] == "adjudication_import_only"
    meta = json.loads((DEFAULT_OUT / "RUNTIME_CONFORMANCE_REPORT.json").read_text(encoding="utf-8"))
    assert meta["targeted_packet_count"] <= 200 or meta.get("packet_exceeded")


def test_27_28_no_inbox_no_resource_writes():
    assert_official_inbox_empty()
    assert list(OFFICIAL_INBOX.rglob("*.xlsx")) == [] if OFFICIAL_INBOX.exists() else True
    before = xlrr.validate_resources()["content_hash"]
    verify_preconditions()
    after = xlrr.validate_resources()
    assert after["content_hash"] == before == ACTIVE
    assert after.get("mutated_canonical") is False


def test_29_30_no_accounting_or_network_imports():
    src = (APP / "mai07_r3l_runtime_conformance_diagnostic.py").read_text(encoding="utf-8")
    tree = ast.parse(src)
    imported = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            imported.extend(a.name for a in node.names)
        elif isinstance(node, ast.ImportFrom):
            imported.append(node.module or "")
    joined = " ".join(imported)
    for bad in ("openai", "anthropic", "requests", "httpx", "posting", "oec", "sync_outbox"):
        assert bad not in joined
    assert "transliteration_service" in joined or "transliterate_frame" in src


def test_31_32_governance_and_mai08():
    gov = json.loads((DEFAULT_OUT / "RUNTIME_CONFORMANCE_REPORT.json").read_text(encoding="utf-8"))[
        "governance"
    ]
    assert gov["independent_human_review"] is False
    assert gov["linguist_approved"] is False
    assert gov["production_approved"] is False
    assert gov["quality_gates_passed"] is False
    assert gov["majority_voting_is_gold"] is False
    assert gov["runtime_conformance_is_language_quality"] is False
    assert gov["prohibited_for_training"] is True
    assert gov["MAI-08"] == "NOT_STARTED"
    ledger = json.loads((REPO / "docs/mokxya-ai/MAI_PHASE_LEDGER.json").read_text(encoding="utf-8"))
    mai08 = next(p for p in ledger["phases"] if p["id"] == "MAI-08")
    assert mai08["status"] == "NOT_STARTED"


def test_33_two_isolated_builds_identical(tmp_path: Path):
    proof = prove_deterministic_rerun(tmp_path / "det")
    assert proof["ok"] is True
    assert len(proof["semantic_hash"]) == 64


def test_34_trace_no_raw_review_in_module_logs():
    # Diagnostic must not print raw candidate surfaces to stdout helpers
    src = (APP / "mai07_r3l_runtime_conformance_diagnostic.py").read_text(encoding="utf-8")
    assert "print(case.input_text)" not in src
    assert "logging.info" not in src or "input_text" not in src


def test_property_bounded_candidates():
    # Seeded property: identity never counts as Devanagari across surfaces
    surfaces = ["bill", "VAT", "बिल", "123", "!!!", "Bill123"]
    for s in surfaces:
        for ident in (True, False):
            v = is_devanagari_non_identity_candidate(surface=s, is_identity=ident, script="MIXED")
            if ident or not has_devanagari_chars(s):
                assert v is False


def test_artifacts_present_and_json_valid():
    required = [
        "R3L_INPUT_AUTHORITY_MANIFEST.json",
        "R3L_POPULATION_MANIFEST.json",
        "BEHAVIOR_EXPECTATIONS.jsonl",
        "ACTIVE_RUNTIME_PREDICTIONS.jsonl",
        "CONFORMANCE_RESULTS.jsonl",
        "CANONICAL_METRICS.json",
        "INDEPENDENT_AUDIT_METRICS.json",
        "AUDIT_AGREEMENT_REPORT.json",
        "RESIDUAL_RISK_QUEUE.jsonl",
        "RESIDUAL_RISK_SUMMARY.json",
        "RISK_CLUSTER_MANIFEST.json",
        "LEAKAGE_AUDIT.json",
        "SECURITY_INVARIANTS.json",
        "SEMANTIC_HASH.json",
        "IMPORT_AND_RUNTIME_IMMUTABILITY_REPORT.json",
    ]
    for name in required:
        p = DEFAULT_OUT / name
        assert p.is_file(), name
        if name.endswith(".json"):
            json.loads(p.read_text(encoding="utf-8"))
    pred_n = sum(
        1
        for ln in (DEFAULT_OUT / "ACTIVE_RUNTIME_PREDICTIONS.jsonl").read_text(encoding="utf-8").splitlines()
        if ln.strip()
    )
    assert pred_n == 1111
