"""MAI-07R3M-CLOSURE — Tier-1 set reconciliation and code-corrective authority tests."""

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
from src.oip.modules.language_runtime.transliteration.application.mai07_r3ja_v3_firewall import (
    REPO,
)
from src.oip.modules.language_runtime.transliteration.application.mai07_r3l_runtime_conformance_diagnostic import (
    DEFAULT_OUT as R3L_OUT,
)
from src.oip.modules.language_runtime.transliteration.application.mai07_r3m_audit_set_reconciliation import (
    audit_recompute_sets,
    run_audit_agreement,
)
from src.oip.modules.language_runtime.transliteration.application.mai07_r3m_policy_mismatch_triage import (
    DEFAULT_OUT as R3M_OUT,
    EXPECTED_R3L_SEM,
    EXPECTED_RESOURCE,
    EXPECTED_RUNTIME,
    OFFICIAL_INBOX,
    Mai07R3MTriageError,
    assert_official_inbox_empty,
    reject_ambiguous_tier1_reason_prose,
)
from src.oip.modules.language_runtime.transliteration.application.mai07_r3m_tier1_set_reconciliation import (
    CLOSURE_OUT,
    EXPECTED_R3M_SEM,
    Mai07R3MClosureError,
    prove_code_corrective_authority,
    prove_deterministic_closure,
    recompute_r3l_metric_sets,
    recompute_tier1_sets,
    run_closure,
    validate_reason_report_table,
)
from src.oip.modules.language_runtime.transliteration.infrastructure import (
    resource_repository as xlrr,
)

HEX64 = re.compile(r"^[0-9a-f]{64}$")
APP = (
    REPO
    / "erp_bot/src/oip/modules/language_runtime/transliteration/application"
)
CLOSURE_MODULES = (
    "mai07_r3m_tier1_set_reconciliation.py",
    "mai07_r3m_audit_set_reconciliation.py",
)


def _load_jsonl(path: Path) -> list[dict]:
    return [json.loads(ln) for ln in path.read_text(encoding="utf-8").splitlines() if ln.strip()]


def test_01_r3l_r3m_input_semantic_hashes():
    r3l = json.loads((R3L_OUT / "SEMANTIC_HASH.json").read_text(encoding="utf-8"))["semantic_hash"]
    r3m = json.loads((R3M_OUT / "SEMANTIC_HASH.json").read_text(encoding="utf-8"))["semantic_hash"]
    assert r3l == EXPECTED_R3L_SEM
    assert r3m == EXPECTED_R3M_SEM
    assert HEX64.match(r3l) and HEX64.match(r3m)


def test_02_03_04_05_english_identity_sets():
    m = recompute_r3l_metric_sets()
    assert m["cardinalities"]["E"] == 241
    assert m["cardinalities"]["I"] == 8
    assert m["cardinalities"]["D"] == 5
    assert m["D_subset_I"] is True
    assert set(m["D"]).issubset(set(m["I"]))


def test_06_07_08_tier1_primary_secondary():
    t = recompute_tier1_sets()
    assert t["cardinalities"]["T"] == 8
    assert t["union_equals_T"] is True
    assert t["primary_reason_counts"]["FALSE_FORCED_DEVANAGARI_TOP1"] == 5
    assert t["primary_reason_counts"]["ABSTAIN_FORCE_TRANSLITERATED"] == 3
    assert sum(t["primary_reason_counts"].values()) == 8
    assert t["secondary_reason_occurrence_counts"]["IDENTITY_NOT_TOP1"] == 5
    assert t["secondary_reason_occurrence_counts"]["FALSE_FORCED_DEVANAGARI_TOP1"] == 3
    assert t["occurrence_reason_counts"]["FALSE_FORCED_DEVANAGARI_TOP1"] == 8
    assert t["occurrence_reason_counts"]["FALSE_FORCED_DEVANAGARI_TOP1"] != t["primary_reason_counts"][
        "FALSE_FORCED_DEVANAGARI_TOP1"
    ]


def test_09_abstain_force_set_reconciliation():
    m = recompute_r3l_metric_sets()
    t = recompute_tier1_sets()
    A = set(t["A"])
    assert len(A) == 3
    assert A.isdisjoint(set(m["D"]))
    assert A.isdisjoint(set(t["I_reason"]))
    assert A.issubset(set(t["D_reason"]))
    for mid in t["membership"]:
        if mid["source_item_id"] in A:
            assert mid["behavior_class"] == "ABSTAIN"
            assert mid["primary_reason"] == "ABSTAIN_FORCE_TRANSLITERATED"
            assert "FALSE_FORCED_DEVANAGARI_TOP1" in mid["secondary_reasons"]


def test_10_no_unique_occurrence_confusion():
    table = json.loads(
        (CLOSURE_OUT / "R3M_TIER1_PRIMARY_REASON_TABLE.json").read_text(encoding="utf-8")
    )
    validate_reason_report_table(table, tier_population=set(recompute_tier1_sets()["T"]))
    bad_exceed = {
        "reasons": [
            {
                "reason_code": "FALSE_FORCED_DEVANAGARI_TOP1",
                "counting_unit": {"unique_case_count": "x"},
                "unique_case_count": 9,
                "primary_reason_case_count": 5,
                "secondary_reason_occurrence_count": 3,
                "overlap_count": 3,
                "union_case_count": 8,
                "primary_case_ids": ["a", "b", "c", "d", "e"],
            }
        ],
        "union_case_count": 8,
    }
    with pytest.raises(Mai07R3MClosureError, match="subset_exceeds_parent"):
        validate_reason_report_table(bad_exceed, tier_population=set(recompute_tier1_sets()["T"]))
    bad_unit = {
        "reasons": [
            {
                "reason_code": "X",
                "unique_case_count": 1,
                "primary_reason_case_count": 1,
                "secondary_reason_occurrence_count": 0,
                "overlap_count": 0,
                "union_case_count": 8,
                "primary_case_ids": ["only"],
            }
        ]
    }
    with pytest.raises(Mai07R3MClosureError, match="reason_counts_without_counting_unit"):
        validate_reason_report_table(bad_unit, tier_population=set(recompute_tier1_sets()["T"]))


def test_11_canonical_audit_exact_agreement():
    m = recompute_r3l_metric_sets()
    t = recompute_tier1_sets()
    code = prove_code_corrective_authority()
    agr = run_audit_agreement(t, m, code["eligible_ids"])
    assert agr["ok"] is True
    audit = audit_recompute_sets()
    assert audit["T"] == t["T"]
    assert audit["A"] == t["A"]
    assert audit["D_reason"] == t["D_reason"]
    assert audit["I_reason"] == t["I_reason"]
    assert audit["Q"] == code["eligible_ids"]
    assert audit["primary_counts"] == t["primary_reason_counts"]
    assert audit["secondary_counts"] == t["secondary_reason_occurrence_counts"]


def test_12_13_14_15_code_queue_eligibility():
    code = prove_code_corrective_authority()
    assert code["queue_count_recorded"] == 9
    assert code["eligible_count"] == 9
    assert len(code["eligible_ids"]) == len(set(code["eligible_ids"])) == 9
    assert code["heuristic_alone_cannot_enter"] is True
    assert code["resource_queue_count"] == 0
    assert code["lane_distribution"] == {
        "ACRONYM_OR_IDENTIFIER_PROTECTION": 1,
        "ENGLISH_IDENTITY_GUARD": 5,
        "IDENTITY_CANDIDATE_INVARIANT": 3,
    }
    for p in code["proofs"]:
        assert p["eligible"] is True
        assert p["checks"]["not_selected_solely_from_HEURISTIC_V1"] is True
        assert p["checks"]["user_accepted_accounting_content_map"] is True


def test_16_17_18_19_no_runtime_resource_frozen_inbox():
    assert_official_inbox_empty()
    before = xlrr.validate_resources()["content_hash"]
    run_closure(write=False)
    assert xlrr.validate_resources()["content_hash"] == before == EXPECTED_RESOURCE
    for name in CLOSURE_MODULES:
        tree = ast.parse((APP / name).read_text(encoding="utf-8"))
        imports = []
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                imports.extend(a.name for a in node.names)
            elif isinstance(node, ast.ImportFrom) and node.module:
                imports.append(node.module)
        blob = " ".join(imports).lower()
        assert "openai" not in blob and "anthropic" not in blob
        assert "eval_mai07_r3e" not in blob
        assert "eval_mai07_r3g" not in blob
        assert "build_mai07r3c_dataset_v2" not in blob
        assert "transliteration_service" not in blob
    hits = (
        list(OFFICIAL_INBOX.rglob("*.xlsx")) + list(OFFICIAL_INBOX.rglob("*.xlsm"))
        if OFFICIAL_INBOX.exists()
        else []
    )
    assert hits == []


def test_20_21_governance_and_mai08():
    notice = json.loads(
        (CLOSURE_OUT / "R3M_CLOSURE_CORRECTION_NOTICE.json").read_text(encoding="utf-8")
    )
    gov = notice["governance"]
    assert gov["quality_gates_passed"] is False
    assert gov["linguist_approved"] is False
    assert gov["production_approved"] is False
    assert gov["round_b_authorized"] is False
    assert gov["frozen_v3_quality_gate_authorized"] is False
    assert gov["prohibited_for_training"] is True
    ledger = json.loads((REPO / "docs/mokxya-ai/MAI_PHASE_LEDGER.json").read_text(encoding="utf-8"))
    mai08 = next(p for p in ledger["phases"] if p["id"] == "MAI-08")
    assert mai08["status"] == "NOT_STARTED"
    assert RUNTIME_VERSION == EXPECTED_RUNTIME
    assert ENABLE_PROMOTION_OVERLAY is False


def test_22_dual_isolated_closure_builds_identical(tmp_path: Path):
    proof = prove_deterministic_closure(tmp_path / "det")
    assert proof["ok"] is True
    assert HEX64.match(proof["closure_semantic_hash"])
    on_disk = json.loads(
        (CLOSURE_OUT / "R3M_CLOSURE_SEMANTIC_HASH.json").read_text(encoding="utf-8")
    )["closure_semantic_hash"]
    assert proof["closure_semantic_hash"] == on_disk


def test_23_24_historical_hashes_preserved_report_only():
    result = run_closure(write=False)
    assert result["defect_scope"] == "REPORT_ONLY"
    assert result["verdict"] == "PASSED_CLOSURE"
    assert result["r3l_semantic_sha256"] == EXPECTED_R3L_SEM
    assert result["r3m_semantic_sha256"] == EXPECTED_R3M_SEM
    assert result["correction_notice"]["queues_unchanged"] is True
    assert result["correction_notice"]["supersession"] is None
    assert result["defect_scope"] != "CANONICAL_TRIAGE_DEFECT"
    with pytest.raises(Mai07R3MTriageError, match="ambiguous_tier1_reason_prose"):
        reject_ambiguous_tier1_reason_prose(
            "Tier-1 reason composition | FALSE_FORCED_DEVANAGARI_TOP1×8; "
            "IDENTITY_NOT_TOP1×5; ABSTAIN_FORCE_TRANSLITERATED×3"
        )
    reject_ambiguous_tier1_reason_prose(
        "primary_reason FALSE_FORCED_DEVANAGARI_TOP1×5; "
        "occurrence FALSE_FORCED_DEVANAGARI_TOP1×8; counting_unit documented"
    )


def test_closure_artifacts_exist_and_private():
    required = [
        "R3M_TIER1_SET_RECONCILIATION.json",
        "R3M_TIER1_PRIMARY_REASON_TABLE.json",
        "R3M_TIER1_SECONDARY_REASON_TABLE.json",
        "R3M_TIER1_PRIVATE_CASE_MEMBERSHIP.jsonl",
        "R3M_CODE_CORRECTIVE_AUTHORITY.json",
        "R3M_CODE_CORRECTIVE_PRIVATE_CASES.jsonl",
        "R3M_CLOSURE_CORRECTION_NOTICE.json",
        "R3M_CLOSURE_IMMUTABILITY_REPORT.json",
        "R3M_CLOSURE_SEMANTIC_HASH.json",
    ]
    for name in required:
        assert (CLOSURE_OUT / name).is_file(), name
    private = _load_jsonl(CLOSURE_OUT / "R3M_TIER1_PRIVATE_CASE_MEMBERSHIP.jsonl")
    membership_ids = {r["source_item_id"] for r in private}
    closure_report = (
        REPO / "docs/mokxya-ai/MAI_07_R3M_TIER1_AND_CORRECTIVE_AUTHORITY_CLOSURE_REPORT.md"
    )
    assert closure_report.is_file()
    text = closure_report.read_text(encoding="utf-8")
    for sid in membership_ids:
        assert sid not in text
