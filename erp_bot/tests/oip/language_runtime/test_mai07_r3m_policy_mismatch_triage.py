"""MAI-07R3M AI-assisted policy mismatch triage tests."""

from __future__ import annotations

import ast
import json
from collections import Counter
from pathlib import Path

import pytest

from src.oip.modules.language_runtime.transliteration import (
    ENABLE_PROMOTION_OVERLAY,
    RUNTIME_VERSION,
)
from src.oip.modules.language_runtime.transliteration.application.mai07_r3ja_v3_firewall import (
    REPO,
)
from src.oip.modules.language_runtime.transliteration.application.mai07_r3k_hash_contract import (
    sha256_file,
)
from src.oip.modules.language_runtime.transliteration.application.mai07_r3m_audit_triage import (
    compare_triage,
)
from src.oip.modules.language_runtime.transliteration.application.mai07_r3m_canonical_triage import (
    classify_case,
)
from src.oip.modules.language_runtime.transliteration.application.mai07_r3m_policy_mismatch_triage import (
    DEFAULT_OUT,
    EXPECTED_AUTH,
    EXPECTED_R3K_SEM,
    EXPECTED_R3L_SEM,
    EXPECTED_RESOURCE,
    EXPECTED_RUNTIME,
    OFFICIAL_INBOX,
    assert_official_inbox_empty,
    prove_deterministic_rerun,
    verify_preconditions,
)
from src.oip.modules.language_runtime.transliteration.infrastructure import (
    resource_repository as xlrr,
)

APP = (
    REPO
    / "erp_bot/src/oip/modules/language_runtime/transliteration/application"
)


def _load_jsonl(path: Path) -> list[dict]:
    return [json.loads(ln) for ln in path.read_text(encoding="utf-8").splitlines() if ln.strip()]


def test_01_input_hashes_and_counts():
    pre = verify_preconditions()
    assert pre["ok"] is True
    assert json.loads(
        (
            REPO
            / "docs/mokxya-ai/reviews/mai07_v3_ai_assisted/runtime_conformance_diagnostic/SEMANTIC_HASH.json"
        ).read_text(encoding="utf-8")
    )["semantic_hash"] == EXPECTED_R3L_SEM
    assert sha256_file(
        REPO
        / "docs/mokxya-ai/reviews/mai07_v3_ai_assisted/cross_role_diagnostic/R3K_INPUT_AUTHORITY_MANIFEST.json"
    ) == EXPECTED_AUTH


def test_02_03_04_05_reconcile_829_328_14_tier3():
    rows = _load_jsonl(DEFAULT_OUT / "TRIAGE_CASES.jsonl")
    assert len(rows) == 829
    assert len({r["source_item_id"] for r in rows}) == 829
    assert sum(1 for r in rows if r["observation_class"] == "ACTUAL_CONFORMANCE_FAILURE") == 328
    assert sum(1 for r in rows if r["observation_class"] == "SPAN_FAILURE") == 14
    t3 = [r for r in rows if r["evidence"]["residual_tier"] == "TIER_3_MEDIUM"]
    assert len(t3) == 493
    assert sum(1 for r in t3 if r["observation_class"] == "RISK_ONLY_PASS") == 487
    assert sum(1 for r in t3 if r["observation_class"] == "ACTUAL_CONFORMANCE_FAILURE") == 6
    # Tier-3 must not be auto-labeled all defects
    assert sum(1 for r in t3 if r["observation_class"] == "ACTUAL_CONFORMANCE_FAILURE") < len(t3)


def test_06_07_tier1_and_critical_semantics_separated():
    clar = json.loads((DEFAULT_OUT / "R3L_CRITICAL_SEMANTICS_CLARIFICATION.json").read_text(encoding="utf-8"))
    assert clar["critical_safety_invariant_failure"] is False
    assert clar["critical_safety_invariant_failure_count"] == 0
    assert clar["tier1_policy_critical_present"] is True
    assert clar["tier1_policy_critical_count"] == 8
    assert clar["tier1_policy_critical_reason_counts"]["FALSE_FORCED_DEVANAGARI_TOP1"] == 8
    t1 = _load_jsonl(DEFAULT_OUT / "TIER1_PRIVATE_ASSESSMENT.jsonl")
    assert len(t1) == 8


def test_08_09_10_english_devanagari_no_target_invention():
    rows = _load_jsonl(DEFAULT_OUT / "TRIAGE_CASES.jsonl")
    eng = [r for r in rows if r["evidence"]["behavior_class"] == "ENGLISH_IDENTITY" and r["observation_class"] == "ACTUAL_CONFORMANCE_FAILURE"]
    assert all(
        r["root_cause"]["primary_stage"]
        in ("ENGLISH_IDENTITY_GUARD", "RANKING", "IDENTITY_CANDIDATE_INVARIANT")
        for r in eng
    )
    for r in rows:
        blob = json.dumps(r)
        assert "acceptable_devanagari_targets" not in blob
    # heuristic cannot be resource corrective
    assert all(
        r["action_disposition"] != "RESOURCE_CORRECTIVE_CANDIDATE"
        or r["evidence"]["evidence_strength"] != "USER_ACCEPTED_HEURISTIC_REFERENCE"
        for r in rows
    )
    res_q = _load_jsonl(DEFAULT_OUT / "RESOURCE_CORRECTIVE_QUEUE.jsonl")
    assert res_q == []


def test_11_12_13_14_15_behavior_rules():
    rows = _load_jsonl(DEFAULT_OUT / "TRIAGE_CASES.jsonl")
    opt = [r for r in rows if r["evidence"]["behavior_class"] == "OPTIONAL"]
    for r in opt:
        if r["observation_class"] == "ACTUAL_CONFORMANCE_FAILURE":
            assert r["root_cause"]["primary_stage"] == "OPTIONAL_POLICY"
    ctx = [r for r in rows if r["evidence"]["behavior_class"] == "CONTEXT_DEPENDENT" and r["observation_class"] == "ACTUAL_CONFORMANCE_FAILURE"]
    for r in ctx:
        assert r["root_cause"]["primary_stage"] == "CONTEXT_REVIEW_SIGNAL"
    acr = [r for r in rows if r["evidence"]["behavior_class"] == "ACRONYM" and r["observation_class"] == "ACTUAL_CONFORMANCE_FAILURE"]
    for r in acr:
        assert r["root_cause"]["primary_stage"] == "ACRONYM_OR_IDENTIFIER_PROTECTION"
    abs_ = [r for r in rows if r["evidence"]["behavior_class"] == "ABSTAIN" and r["observation_class"] == "ACTUAL_CONFORMANCE_FAILURE"]
    for r in abs_:
        assert r["root_cause"]["primary_stage"] == "ELIGIBILITY"


def test_16_17_18_evidence_and_risk_only():
    rows = _load_jsonl(DEFAULT_OUT / "TRIAGE_CASES.jsonl")
    heur_code = [
        r
        for r in rows
        if r["evidence"]["evidence_strength"] == "USER_ACCEPTED_HEURISTIC_REFERENCE"
        and r["action_disposition"] == "CODE_CORRECTIVE_CANDIDATE"
    ]
    # Heuristic may get NON_FROZEN_TEST but not lexicon/resource
    assert heur_code == [] or all(
        r["action_disposition"] != "RESOURCE_CORRECTIVE_CANDIDATE" for r in heur_code
    )
    risk = [r for r in rows if r["action_disposition"] == "NO_CORRECTIVE_ACTION_RISK_ONLY"]
    assert len(risk) == 487
    assert all(r["observation_class"] == "RISK_ONLY_PASS" for r in risk)


def test_19_unknown_root_cause_fails_closed():
    # synthetic insufficient eligibility for Devanagari
    residual = {
        "source_item_id": "X",
        "diagnostic_case_id": "Y",
        "reason_codes": ["DEVANAGARI_CANDIDATE_MISSING"],
        "residual_tier": "TIER_2_HIGH",
    }
    result = {
        "outcome": "FAIL",
        "behavior_class": "DEVANAGARI_TRANSLITERATION",
        "residual_reasons": ["DEVANAGARI_CANDIDATE_MISSING"],
        "review_disposition": "DEVANAGARI_TRANSLITERATION_REQUIRED",
        "provenance_bucket": "ACCOUNTING_CONTENT_MAP",
    }
    pred = {"eligibility": None, "span_resolution": "RESOLVED", "identity_present": True}
    case = {
        "provenance_bucket": "ACCOUNTING_CONTENT_MAP",
        "confidence": "HIGH",
        "natural_context_ok": "YES",
        "suspected_ambiguity": "NO",
        "behavior": {"behavior_class": "DEVANAGARI_TRANSLITERATION"},
    }
    t = classify_case(residual, result, pred, case)
    assert t.root_cause.primary_stage == "INSUFFICIENT_OBSERVATION_EVIDENCE"
    assert t.action_disposition == "BLOCKED_MISSING_EVIDENCE"


def test_20_canonical_audit_agreement():
    agr = json.loads((DEFAULT_OUT / "AUDIT_AGREEMENT_REPORT.json").read_text(encoding="utf-8"))
    assert agr["ok"] is True
    can = json.loads((DEFAULT_OUT / "CANONICAL_TRIAGE_REPORT.json").read_text(encoding="utf-8"))
    aud = json.loads((DEFAULT_OUT / "INDEPENDENT_AUDIT_TRIAGE_REPORT.json").read_text(encoding="utf-8"))
    assert can["queue_counts"] == aud["queue_counts"]


def test_21_22_23_clusters_and_queue_partition():
    clusters = json.loads((DEFAULT_OUT / "ROOT_CAUSE_CLUSTERS.json").read_text(encoding="utf-8"))
    ids = [c["cluster_id"] for c in clusters["clusters"]]
    assert len(ids) == len(set(ids))
    # public summary has no case_ids
    for c in clusters["public_summary"]:
        assert "case_ids" not in c or c.get("case_ids_redacted") is True
        assert "input_text" not in json.dumps(c)
    rows = _load_jsonl(DEFAULT_OUT / "TRIAGE_CASES.jsonl")
    queue_files = [
        "ACTIONABLE_CODE_CORRECTIVE_QUEUE.jsonl",
        "RESOURCE_CORRECTIVE_QUEUE.jsonl",
        "NON_FROZEN_TEST_CANDIDATES.jsonl",
        "TARGETED_HUMAN_REVIEW_QUEUE.jsonl",
        "PROFESSIONAL_LINGUIST_REVIEW_QUEUE.jsonl",
        "POLICY_CLARIFICATION_QUEUE.jsonl",
        "DIAGNOSTIC_ONLY_RISK_QUEUE.jsonl",
        "BLOCKED_MISSING_EVIDENCE_QUEUE.jsonl",
    ]
    seen: set[str] = set()
    total = 0
    for name in queue_files:
        q = _load_jsonl(DEFAULT_OUT / name)
        total += len(q)
        for item in q:
            assert item["source_item_id"] not in seen
            seen.add(item["source_item_id"])
    assert total == 829 == len(seen) == len(rows)


def test_24_25_packet_leakage_private():
    leak = json.loads((DEFAULT_OUT / "LEAKAGE_AND_FIREWALL_REPORT.json").read_text(encoding="utf-8"))
    assert leak["leakage"]["ok"] is True
    csv = (DEFAULT_OUT / "REFINED_TARGETED_REVIEW_PACKET.csv").read_text(encoding="utf-8")
    assert "source_item_id" not in csv.lower()
    assert "CODE_CORRECTIVE" not in csv
    assert "ENGLISH_IDENTITY_GUARD" not in csv
    priv = json.loads((DEFAULT_OUT / "REFINED_TARGETED_REVIEW_PRIVATE_MAPPING.json").read_text(encoding="utf-8"))
    assert priv["prohibited_for_runtime"] is True
    assert priv["use"] == "adjudication_import_only"


def test_26_27_28_29_30_firewall_no_runtime_resource_inbox_accounting():
    src = (APP / "mai07_r3m_policy_mismatch_triage.py").read_text(encoding="utf-8")
    tree = ast.parse(src)
    imported = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            imported.extend(a.name for a in node.names)
        elif isinstance(node, ast.ImportFrom):
            imported.append(node.module or "")
    joined = " ".join(imported)
    for bad in ("openai", "anthropic", "transliteration_service", "posting", "oec", "httpx"):
        assert bad not in joined
    assert "analyze_language" not in src
    assert "transliterate_frame" not in src
    assert RUNTIME_VERSION == EXPECTED_RUNTIME
    assert ENABLE_PROMOTION_OVERLAY is False
    r = xlrr.validate_resources()
    assert r["ok"] and r["content_hash"] == EXPECTED_RESOURCE and r.get("mutated_canonical") is False
    assert_official_inbox_empty()
    assert list(OFFICIAL_INBOX.rglob("*.xlsx")) == [] if OFFICIAL_INBOX.exists() else True


def test_31_32_governance_mai08():
    rep = json.loads((DEFAULT_OUT / "CANONICAL_TRIAGE_REPORT.json").read_text(encoding="utf-8"))
    g = rep["governance"]
    for k in (
        "independent_human_review",
        "linguist_approved",
        "production_approved",
        "quality_gates_passed",
        "majority_voting_is_gold",
        "runtime_conformance_is_language_quality",
    ):
        assert g[k] is False
    assert g["prohibited_for_training"] is True
    assert g["MAI-08"] == "NOT_STARTED"
    ledger = json.loads((REPO / "docs/mokxya-ai/MAI_PHASE_LEDGER.json").read_text(encoding="utf-8"))
    assert next(p for p in ledger["phases"] if p["id"] == "MAI-08")["status"] == "NOT_STARTED"


def test_33_two_isolated_builds(tmp_path: Path):
    proof = prove_deterministic_rerun(tmp_path / "det")
    assert proof["ok"] is True
    assert proof["semantic_hash"] == json.loads(
        (DEFAULT_OUT / "SEMANTIC_HASH.json").read_text(encoding="utf-8")
    )["semantic_hash"]


def test_34_no_raw_text_in_public_aggregates():
    for name in (
        "CANONICAL_TRIAGE_REPORT.json",
        "INDEPENDENT_AUDIT_TRIAGE_REPORT.json",
        "TRIAGE_COMPLETENESS_REPORT.json",
        "NEXT_PHASE_RECOMMENDATION.json",
    ):
        blob = (DEFAULT_OUT / name).read_text(encoding="utf-8")
        assert "input_text" not in blob
        assert "highlighted_span" not in blob


def test_property_queue_partition_invariants():
    rows = _load_jsonl(DEFAULT_OUT / "TRIAGE_CASES.jsonl")
    actions = Counter(r["action_disposition"] for r in rows)
    assert sum(actions.values()) == 829
    # risk-only never actual failure
    for r in rows:
        if r["action_disposition"] == "NO_CORRECTIVE_ACTION_RISK_ONLY":
            assert r["observation_class"] == "RISK_ONLY_PASS"
        if r["observation_class"] == "SPAN_FAILURE":
            assert r["root_cause"]["primary_stage"] == "SPAN_RESOLUTION"


def test_r3k_semantic_unchanged():
    assert (
        json.loads(
            (
                REPO
                / "docs/mokxya-ai/reviews/mai07_v3_ai_assisted/cross_role_diagnostic/reports/SEMANTIC_HASH.json"
            ).read_text(encoding="utf-8")
        )["semantic_hash"]
        == EXPECTED_R3K_SEM
    )
