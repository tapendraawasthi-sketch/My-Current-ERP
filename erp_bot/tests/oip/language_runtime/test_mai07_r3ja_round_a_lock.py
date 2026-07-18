"""MAI-07R3J-A Round A lock-and-validation tests."""

from __future__ import annotations

import json
from pathlib import Path

from src.oip.modules.language_runtime.transliteration.application.validate_mai07_r3ja_round_a import (
    EXPECTED_BLIND_MAPPING_SHA,
    EXPECTED_PACKET_MANIFEST_SHA,
    INBOX,
    OUT,
    VALIDATION_DIR,
    discover_returned_workbooks,
    run_round_a_validation,
    verify_sealed_authorities,
)


def test_sealed_packet_and_blind_hashes():
    sealed = verify_sealed_authorities()
    assert sealed["ok"] is True
    assert sealed["packet_manifest_sha256"] == EXPECTED_PACKET_MANIFEST_SHA
    assert sealed["blind_mapping_sha256"] == EXPECTED_BLIND_MAPPING_SHA


def test_empty_inbox_blocks_round_a_and_does_not_release_round_b(tmp_path: Path):
    inbox = tmp_path / "inbox"
    inbox.mkdir()
    result = run_round_a_validation(inbox=inbox)
    assert result["status"] == "BLOCKED_ROUND_A_CORRECTION_REQUIRED"
    assert result["ROUND_A_LOCKED"] is False
    assert result["ROUND_B_READY"] is False
    assert result["round_b_released"] is False
    assert result["human_answers_altered"] is False
    assert result["model_evaluation_performed"] is False
    assert result["LINGUIST_APPROVED"] is False
    assert result["QUALITY_GATES_PASSED"] is False
    assert result["MAI_08"] == "NOT_STARTED"
    # Per-reviewer reports exist under validation dir from last run
    summary = json.loads(
        (VALIDATION_DIR / "MAI_07_V3_ROUND_A_VALIDATION_SUMMARY.json").read_text(encoding="utf-8")
    )
    assert summary["status"] == "BLOCKED_ROUND_A_CORRECTION_REQUIRED"
    roles = {r["role_id"] for r in summary["reviewer_reports"]}
    assert "NEPALI_FLUENT_A" in roles
    assert "PROFESSIONAL_LINGUIST_B" in roles
    assert "ACCOUNTING_DOMAIN" in roles
    assert "PRODUCT_POLICY" in roles
    for r in summary["reviewer_reports"]:
        assert r["corrections"]
        assert r["ok"] is False


def test_blank_packet_templates_not_auto_discovered_as_submissions():
    # Default inbox should not pick up ../reviewers blank templates
    found = discover_returned_workbooks(INBOX)
    # Unless someone copied files into inbox, found is empty
    for role, path in found.items():
        assert "round_a_submissions_inbox" in str(path).replace("\\", "/")


def test_mai08_and_runtime_untouched_after_validation():
    from src.oip.modules.language_runtime.transliteration import (
        ENABLE_PROMOTION_OVERLAY,
        RESOURCE_PACK_VERSION,
        RUNTIME_VERSION,
    )
    from src.oip.modules.language_runtime.transliteration.infrastructure import (
        resource_repository as xlrr,
    )

    ledger = json.loads((OUT.parents[1] / "MAI_PHASE_LEDGER.json").read_text(encoding="utf-8"))
    # OUT = docs/mokxya-ai/reviews/mai07_v3 → parents[1] = docs/mokxya-ai
    mai08 = next(p for p in ledger["phases"] if p["id"] == "MAI-08")
    assert mai08["status"] == "NOT_STARTED"
    xlrr.load_resources(force_reload=True)
    assert xlrr.compute_pack_content_hash() == (
        "1617425373bf525968b5af2a3b1cc8b8e5ad83e68457cfbbb47c73c78c84e930"
    )
    assert RESOURCE_PACK_VERSION == "mai-07.1.3-r3f-sealnew"
    assert RUNTIME_VERSION == "mai-07.1.3-r3f-sealnew"
    assert ENABLE_PROMOTION_OVERLAY is False
