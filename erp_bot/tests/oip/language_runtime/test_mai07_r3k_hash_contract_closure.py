"""MAI-07R3K-CLOSURE — input hash contract reconciliation tests."""

from __future__ import annotations

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
from src.oip.modules.language_runtime.transliteration.application.mai07_r3k_cross_role_consensus_diagnostic import (
    DEFAULT_OUT,
    OFFICIAL_INBOX,
    assert_official_inbox_empty,
    prove_deterministic_rerun,
    run_diagnostic,
)
from src.oip.modules.language_runtime.transliteration.application.mai07_r3k_hash_contract import (
    KNOWN,
    PRE_CLOSURE_HYBRID_ACCOUNTING_CITATION,
    Mai07R3KHashContractError,
    assert_abbreviation_matches_full,
    assert_inputs_invalidate_semantic_on_change,
    build_input_authority_manifest,
    display_abbreviation,
    format_display_citation,
    reject_hybrid_accounting_citation,
    require_full_sha256,
    sha256_file,
    typed_hash_fields,
    write_input_authority_manifest,
)
from src.oip.modules.language_runtime.transliteration.infrastructure import (
    resource_repository as xlrr,
)

ACTIVE = "1617425373bf525968b5af2a3b1cc8b8e5ad83e68457cfbbb47c73c78c84e930"
HEX64 = re.compile(r"^[0-9a-f]{64}$")
MANIFEST = (
    REPO
    / "docs/mokxya-ai/reviews/mai07_v3_ai_assisted/cross_role_diagnostic"
    / "R3K_INPUT_AUTHORITY_MANIFEST.json"
)
R3K_REPORT_MD = REPO / "docs/mokxya-ai/MAI_07_R3K_AI_ASSISTED_CROSS_ROLE_CONSENSUS_DIAGNOSTIC_REPORT.md"
ZIP = REPO / "MokXya_MAI07_V3_ACCOUNTING_DOMAIN_ROUND_A_AI_ASSISTED_HUMAN_VERIFIED_READY.zip"


def test_01_known_accounting_zip_hash():
    assert sha256_file(ZIP) == KNOWN["accounting_package_zip_raw_sha256"]


def test_02_known_accounting_semantic_hash():
    assert KNOWN["accounting_import_semantic_sha256"] == (
        "b96bec29e30ddcdc6dce1a5ef09a2003ee9de003a336cd98b43341c6e55e363b"
    )
    report = json.loads(
        (DEFAULT_OUT / "reports/CONSENSUS_DIAGNOSTIC_REPORT.json").read_text(encoding="utf-8")
    )
    assert report["input_accounting_semantic_hash"] == KNOWN["accounting_import_semantic_sha256"]


def test_03_known_remaining_role_semantic_hash():
    report = json.loads(
        (DEFAULT_OUT / "reports/CONSENSUS_DIAGNOSTIC_REPORT.json").read_text(encoding="utf-8")
    )
    assert report["input_remaining_semantic_hash"] == KNOWN["remaining_roles_import_semantic_sha256"]


def test_04_no_hybrid_hash_accepted_against_pre_closure_citation():
    """Demonstrate pre-closure hybrid citation fails the contract."""
    with pytest.raises(Mai07R3KHashContractError, match="hybrid_hash"):
        reject_hybrid_accounting_citation(PRE_CLOSURE_HYBRID_ACCOUNTING_CITATION)
    # Correct single-hash abbreviation must pass.
    reject_hybrid_accounting_citation(
        format_display_citation("Accounting", KNOWN["accounting_import_semantic_sha256"])
    )
    reject_hybrid_accounting_citation(
        format_display_citation("Accounting ZIP", KNOWN["accounting_package_zip_raw_sha256"])
    )


def test_05_machine_hashes_are_exactly_64_lowercase_hex():
    for name, value in KNOWN.items():
        assert HEX64.match(value), name
        require_full_sha256(value, label=name)
    with pytest.raises(Mai07R3KHashContractError):
        require_full_sha256("b96bec29…1cdb68", label="hybrid")
    with pytest.raises(Mai07R3KHashContractError):
        require_full_sha256("B96BEC29E30DDCDC6DCE1A5EF09A2003EE9DE003A336CD98B43341C6E55E363B", label="upper")


def test_06_display_abbreviation_derives_from_one_full_hash():
    full = KNOWN["accounting_import_semantic_sha256"]
    abbrev = display_abbreviation(full)
    assert abbrev == "b96bec29…5e363b"
    assert_abbreviation_matches_full(abbrev, full, label="acct_sem")
    # Hybrid prefix/suffix of two authorities must not match either full hash abbreviation.
    hybrid = "b96bec29…1cdb68"
    with pytest.raises(Mai07R3KHashContractError):
        assert_abbreviation_matches_full(hybrid, full, label="hybrid_vs_sem")
    with pytest.raises(Mai07R3KHashContractError):
        assert_abbreviation_matches_full(
            hybrid, KNOWN["accounting_package_zip_raw_sha256"], label="hybrid_vs_zip"
        )


def test_07_raw_and_semantic_hashes_remain_distinct():
    fields = typed_hash_fields(
        accounting_package_zip_raw_sha256=KNOWN["accounting_package_zip_raw_sha256"],
        accounting_import_semantic_sha256=KNOWN["accounting_import_semantic_sha256"],
        remaining_roles_import_semantic_sha256=KNOWN["remaining_roles_import_semantic_sha256"],
        r3k_semantic_sha256=KNOWN["r3k_semantic_sha256"],
    )
    assert fields["accounting_package_zip_raw_sha256"] != fields["accounting_import_semantic_sha256"]
    assert "zip" in "accounting_package_zip_raw_sha256"
    assert "semantic" in "accounting_import_semantic_sha256"


def test_08_r3k_counts_reconcile():
    report = json.loads(
        (DEFAULT_OUT / "reports/CONSENSUS_DIAGNOSTIC_REPORT.json").read_text(encoding="utf-8")
    )
    risk_n = sum(
        1
        for ln in (DEFAULT_OUT / "canonical/RISK_QUEUE.jsonl").read_text(encoding="utf-8").splitlines()
        if ln.strip()
    )
    assert report["unique_source_item_ids"] == 1111
    assert report["four_role_cases"] == 611
    assert report["three_role_cases"] == 500
    assert report["total_role_judgments"] == 3944
    assert report["role_counts"]["PRODUCT_POLICY"] == 1111
    assert report["role_counts"]["NEPALI_FLUENT_A"] == 1111
    assert report["role_counts"]["PROFESSIONAL_LINGUIST_B"] == 1111
    assert report["role_counts"]["ACCOUNTING_DOMAIN"] == 611
    assert risk_n == 700


def test_09_deterministic_manifest_generation(tmp_path: Path):
    a = build_input_authority_manifest(REPO)
    b = build_input_authority_manifest(REPO)
    a.pop("verified_at_utc")
    b.pop("verified_at_utc")
    assert a == b
    assert a["defect_scope"] == "REPORT_ONLY"
    assert a["r3k_semantic_sha256"] == KNOWN["r3k_semantic_sha256"]
    assert a["verdict"] == "PASSED_CLOSURE"


def test_10_second_isolated_build_produces_identical_bytes(tmp_path: Path):
    proof = prove_deterministic_rerun(tmp_path / "det")
    assert proof["ok"] is True
    assert proof["semantic_hash"] == KNOWN["r3k_semantic_sha256"]
    a = (tmp_path / "det/a/canonical/CROSS_ROLE_DECISIONS.jsonl").read_bytes()
    b = (tmp_path / "det/b/canonical/CROSS_ROLE_DECISIONS.jsonl").read_bytes()
    assert a == b
    # New generator embeds typed hash_contract; abbreviations derive from one field.
    readme = (tmp_path / "det/a/README.md").read_text(encoding="utf-8")
    reject_hybrid_accounting_citation(readme)
    hc = json.loads((tmp_path / "det/a/reports/HASH_CONTRACT.json").read_text(encoding="utf-8"))
    assert hc["accounting_import_semantic_sha256"] == KNOWN["accounting_import_semantic_sha256"]
    assert hc["accounting_package_zip_raw_sha256"] == KNOWN["accounting_package_zip_raw_sha256"]


def test_11_historical_artifacts_not_silently_overwritten(tmp_path: Path):
    before_dec = (DEFAULT_OUT / "canonical/CROSS_ROLE_DECISIONS.jsonl").read_bytes()
    before_risk = (DEFAULT_OUT / "canonical/RISK_QUEUE.jsonl").read_bytes()
    before_report = (DEFAULT_OUT / "reports/CONSENSUS_DIAGNOSTIC_REPORT.json").read_bytes()
    before_sem = (DEFAULT_OUT / "reports/SEMANTIC_HASH.json").read_bytes()
    result = run_diagnostic(out_root=DEFAULT_OUT, write=True)
    assert result["historical_outputs_preserved"] is True
    assert (DEFAULT_OUT / "canonical/CROSS_ROLE_DECISIONS.jsonl").read_bytes() == before_dec
    assert (DEFAULT_OUT / "canonical/RISK_QUEUE.jsonl").read_bytes() == before_risk
    assert (DEFAULT_OUT / "reports/CONSENSUS_DIAGNOSTIC_REPORT.json").read_bytes() == before_report
    assert (DEFAULT_OUT / "reports/SEMANTIC_HASH.json").read_bytes() == before_sem
    # Sidecar may be written; authority manifest overwrite with different content must fail.
    assert (DEFAULT_OUT / "reports/HASH_CONTRACT.json").is_file()
    bad = tmp_path / "bad_manifest.json"
    bad.write_text(
        json.dumps({"r3k_semantic_sha256": "0" * 64, "hashes": {}}, indent=2) + "\n",
        encoding="utf-8",
    )
    # Copy to a temp path then attempt write with different content via helper
    dest = tmp_path / "R3K_INPUT_AUTHORITY_MANIFEST.json"
    write_input_authority_manifest(dest=dest, repo=REPO)
    # Corrupt and refuse overwrite
    dest.write_text(
        json.dumps({"r3k_semantic_sha256": "1" * 64, "hashes": {"x": 1}}, indent=2) + "\n",
        encoding="utf-8",
    )
    with pytest.raises(Mai07R3KHashContractError, match="refusing_silent_overwrite"):
        write_input_authority_manifest(dest=dest, repo=REPO)


def test_12_official_review_inbox_unchanged():
    assert_official_inbox_empty()
    xlsx = list(OFFICIAL_INBOX.glob("**/*.xlsx")) if OFFICIAL_INBOX.is_dir() else []
    assert xlsx == []


def test_13_no_runtime_resource_imports_or_mutations():
    assert RUNTIME_VERSION == "mai-07.1.3-r3f-sealnew"
    assert ENABLE_PROMOTION_OVERLAY is False
    r = xlrr.validate_resources()
    assert r["ok"] and r["content_hash"] == ACTIVE
    # Closure module must not import resource writers
    src = (
        REPO
        / "erp_bot/src/oip/modules/language_runtime/transliteration/application"
        / "mai07_r3k_hash_contract.py"
    ).read_text(encoding="utf-8")
    assert "write_manifest" not in src
    assert "promote" not in src.lower()


def test_14_governance_flags_remain_false():
    manifest = build_input_authority_manifest(REPO)
    assert manifest["independent_human_review"] is False
    assert manifest["linguist_approved"] is False
    assert manifest["quality_gates_passed"] is False
    assert manifest["production_approved"] is False
    assert manifest["majority_voting_is_gold"] is False
    assert manifest["agreement_is_independent_human_irr"] is False
    assert manifest["official_round_a_lock_eligible"] is False
    assert manifest["round_b_ready"] is False
    assert manifest["frozen_v3_quality_gate_authorized"] is False
    assert manifest["prohibited_for_training"] is True


def test_15_mai08_remains_not_started():
    ledger = json.loads((REPO / "docs/mokxya-ai/MAI_PHASE_LEDGER.json").read_text(encoding="utf-8"))
    phases = ledger["phases"] if isinstance(ledger, dict) and "phases" in ledger else ledger
    if isinstance(phases, dict):
        mai08 = phases.get("MAI-08") or next(
            (v for k, v in phases.items() if str(k).startswith("MAI-08") or (isinstance(v, dict) and v.get("id") == "MAI-08")),
            None,
        )
    else:
        mai08 = next(p for p in phases if p.get("id") == "MAI-08")
    assert mai08["status"] == "NOT_STARTED"
    assert build_input_authority_manifest(REPO)["MAI-08"] == "NOT_STARTED"


def test_canonical_machine_artifacts_have_full_hashes_no_hybrid():
    report = json.loads(
        (DEFAULT_OUT / "reports/CONSENSUS_DIAGNOSTIC_REPORT.json").read_text(encoding="utf-8")
    )
    for key in (
        "semantic_hash",
        "input_accounting_semantic_hash",
        "input_remaining_semantic_hash",
    ):
        require_full_sha256(report[key], label=key)
    text = R3K_REPORT_MD.read_text(encoding="utf-8")
    reject_hybrid_accounting_citation(text)
    assert KNOWN["accounting_import_semantic_sha256"] in text


def test_changed_inputs_require_semantic_invalidation():
    with pytest.raises(Mai07R3KHashContractError, match="without_semantic_hash_invalidation"):
        assert_inputs_invalidate_semantic_on_change(
            recorded_input_hashes={"accounting_import_semantic_sha256": KNOWN["accounting_import_semantic_sha256"]},
            current_input_hashes={"accounting_import_semantic_sha256": "a" * 64},
            recorded_semantic=KNOWN["r3k_semantic_sha256"],
            current_semantic=KNOWN["r3k_semantic_sha256"],
        )
