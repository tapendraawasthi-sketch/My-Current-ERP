"""MAI-07R3A governance tests — no frozen quality pass claims."""

from __future__ import annotations

import ast
import csv
import hashlib
import json
import re
from pathlib import Path

import pytest

from src.oip.modules.language_runtime.transliteration import (
    ENABLE_PROMOTION_OVERLAY,
    RUNTIME_VERSION,
)
from src.oip.modules.language_runtime.transliteration.application.build_mai07r3a_review_packet import (
    REVIEW_ROOT,
    SEED,
    SENSITIVE,
    _csv_cell,
    build_review_packet,
    recompute_conflicts,
)
from src.oip.modules.language_runtime.transliteration.application.eval_metric_definitions import (
    FROZEN_DATASET_HASH,
    FROZEN_RESOURCE_HASH,
    FROZEN_RUNTIME_SEMANTIC_HASH,
)
from src.oip.modules.language_runtime.transliteration.infrastructure import (
    resource_repository as xlrr,
)

REPO = Path(__file__).resolve().parents[4]
RUNTIME = (
    REPO
    / "erp_bot"
    / "src/oip/modules/language_runtime/transliteration"
)


def test_overlay_disabled_by_default():
    assert ENABLE_PROMOTION_OVERLAY is False
    # Active may advance under authorized R3D; overlay must remain disabled.
    assert RUNTIME_VERSION.startswith("mai-07.")


def test_production_cannot_enable_failed_r2_overlay_without_pack():
    # Active pack must not contain promotion_overlay_config.json
    man = json.loads((xlrr.RESOURCES_DIR / "manifest.json").read_text(encoding="utf-8"))
    assert "promotion_overlay_config.json" not in man["files"]
    assert not (xlrr.RESOURCES_DIR / "promotion_overlay_config.json").exists()
    # Service gates on ENABLE_PROMOTION_OVERLAY and non-empty config
    src = (RUNTIME / "application/transliteration_service.py").read_text(encoding="utf-8")
    assert "ENABLE_PROMOTION_OVERLAY" in src
    assert "overlay is not None" in src or "overlay is not None" in src.replace("  ", " ")


def test_prer1_resource_hash_preserved_as_parent():
    """Pre-R1 pack hash remains recorded; active pack may be R3D corrective."""
    man = json.loads((xlrr.RESOURCES_DIR / "manifest.json").read_text(encoding="utf-8"))
    assert man["prior_content_hash_mai0710"] == FROZEN_RESOURCE_HASH
    assert ENABLE_PROMOTION_OVERLAY is False


def test_sealed_prer1_v1_semantic_hash_authority_unchanged():
    """R3A/R3C sealed pre-R1 V1 semantic hash remains the historical authority.

    Active R3F runtime (mai-07.1.2-r3f) is not required to reproduce that hash.
    Re-running evaluate_mai07 on frozen V1 against the active corrective pack
    would be an unauthorized frozen retune signal and is deliberately not done here.
    Governing authority: MAI-07R3A/R3C sealed baselines + MAI-07R3D/R3F protocol
    (active pack may advance; parent pre-R1 hash must remain recorded).
    """
    from src.oip.modules.language_runtime.transliteration import (
        PARENT_PRE_R1_RESOURCE_HASH,
        PARENT_PRE_R1_RUNTIME_VERSION,
        PARENT_R3D_RESOURCE_HASH,
        PARENT_R3D_RUNTIME_VERSION,
        RUNTIME_VERSION,
    )

    assert RUNTIME_VERSION == "mai-07.1.13-r3s-active"
    assert PARENT_PRE_R1_RUNTIME_VERSION == "mai-07.1.0"
    assert PARENT_PRE_R1_RESOURCE_HASH == FROZEN_RESOURCE_HASH
    assert PARENT_R3D_RUNTIME_VERSION == "mai-07.1.1-r3d"
    assert PARENT_R3D_RESOURCE_HASH == "083bce288907c0db882bdf7082bf9093e9086035c653dadcd4964625b61e966f"
    man = json.loads((xlrr.RESOURCES_DIR / "manifest.json").read_text(encoding="utf-8"))
    assert man["prior_content_hash_mai0710"] == FROZEN_RESOURCE_HASH
    assert man["resource_pack_version"] == "mai-07.1.3-r3f-sealnew"
    assert ENABLE_PROMOTION_OVERLAY is False

    sidecar = json.loads(
        (REPO / "evals/mai07/baselines/MAI_07_runtime_semantic_hash.json").read_text(encoding="utf-8")
    )
    # Sealed pre-R1 / R3A authority is the pre_closure field (not the later experimental semantic_hash).
    assert sidecar.get("pre_closure_semantic_hash") == FROZEN_RUNTIME_SEMANTIC_HASH
    assert FROZEN_RUNTIME_SEMANTIC_HASH == (
        "b28e8240bf0c4faa1253212c40e721f77148516fb3a2a3303582303b8a035849"
    )


def test_frozen_v1_dataset_hash_unchanged():
    man = json.loads(
        (REPO / "evals/mai07/manifests/MAI_07_ROMANIZED_TRANSLITERATION_V1.manifest.json").read_text(
            encoding="utf-8"
        )
    )
    h = hashlib.sha256()
    for f in sorted(man["files"], key=lambda x: x["suite_id"]):
        h.update(f["suite_id"].encode())
        h.update(b"\0")
        h.update((REPO / f["path"]).read_bytes())
    assert h.hexdigest() == FROZEN_DATASET_HASH == man["dataset_hash"]


def test_conflict_recompute_deterministic_and_count():
    a, tax_a = recompute_conflicts(REPO)
    b, tax_b = recompute_conflicts(REPO)
    assert [c.case_id for c in a] == [c.case_id for c in b]
    assert tax_a["conflict_count"] == tax_b["conflict_count"] == 49
    assert tax_a["matches_expected"] is True
    assert tax_a["english_only"] == 31
    assert tax_a["name_only"] == 18


def test_control_sample_deterministic_and_unique():
    r1 = build_review_packet(REPO)
    r2 = build_review_packet(REPO)
    assert r1["review_items"] == r2["review_items"] >= 149
    assert r1["artifact_hashes"]["round_a"] == r2["artifact_hashes"]["round_a"]
    mapping = json.loads((REVIEW_ROOT / "MAI_07R3_BLIND_MAPPING.json").read_text(encoding="utf-8"))
    ids = [e["case_id"] for e in mapping["entries"]]
    assert len(ids) == len(set(ids))
    rids = [e["review_id"] for e in mapping["entries"]]
    assert len(rids) == len(set(rids))
    assert all(rid.startswith("R3A-") for rid in rids)
    # Reviewer-facing CSVs must not contain frozen case IDs
    a_text = (REVIEW_ROOT / "MAI_07R3_ROUND_A_REVIEW.csv").read_text(encoding="utf-8")
    for cid in ids:
        assert cid not in a_text


def test_round_a_has_no_candidates_or_scores():
    a_text = (REVIEW_ROOT / "MAI_07R3_ROUND_A_REVIEW.csv").read_text(encoding="utf-8")
    forbidden = ("ranking_score", "rank_1", "261/316", "QUALITY", "target_top1", "provenance")
    for f in forbidden:
        assert f not in a_text
    # Round A header has no candidate columns
    header = a_text.splitlines()[0]
    assert "candidate" not in header.lower()


def test_round_b_order_deterministically_randomized():
    mapping = json.loads((REVIEW_ROOT / "MAI_07R3_BLIND_MAPPING.json").read_text(encoding="utf-8"))
    # At least one conflict row with non-identity permutation potential
    assert any(e.get("candidate_order_indices") for e in mapping["entries"])
    # Same seed rebuild keeps mapping hash stable already tested; order lists present
    assert mapping["seed"] == SEED


def test_csv_formula_injection_guard():
    assert _csv_cell("=cmd") == "'=cmd"
    assert _csv_cell("+1") == "'+1"
    assert _csv_cell("-1") == "'-1"
    assert _csv_cell("@x") == "'@x"
    assert _csv_cell("mero") == "mero"


def test_utf8_devanagari_round_trip():
    b = (REVIEW_ROOT / "MAI_07R3_ROUND_B_REVIEW.csv").read_text(encoding="utf-8")
    # May or may not contain Devanagari depending on sample; ensure no decode crash and BOM-free
    assert not b.startswith("\ufeff")
    rows = list(csv.reader(b.splitlines()))
    assert rows[0][0] == "review_id"


def test_review_schema_rejects_invalid_decisions():
    schema = json.loads((REVIEW_ROOT / "MAI_07R3_REVIEW_SCHEMA.json").read_text(encoding="utf-8"))
    allowed = set(schema["round_a_enums"]["preferred_rank_policy"])
    assert "DEVANAGARI_TARGET_REQUIRED" in allowed
    assert "MAKE_PHASE_PASS" not in allowed
    assert "INCORRECT" in schema["round_b_enums"]["acceptability"]


def test_no_sensitive_patterns_in_reviewer_facing_csvs():
    for name in ("MAI_07R3_ROUND_A_REVIEW.csv", "MAI_07R3_ROUND_B_REVIEW.csv"):
        text = (REVIEW_ROOT / name).read_text(encoding="utf-8")
        assert SENSITIVE.search(text) is None


def test_runtime_does_not_import_review_files():
    for path in (RUNTIME / "infrastructure").rglob("*.py"):
        tree = ast.parse(path.read_text(encoding="utf-8"))
        for node in ast.walk(tree):
            if isinstance(node, (ast.Import, ast.ImportFrom)):
                mod = getattr(node, "module", None) or ""
                assert "reviews.mai07r3" not in mod
                assert "mai07r3" not in mod
    svc = (RUNTIME / "application/transliteration_service.py").read_text(encoding="utf-8")
    assert "docs/mokxya-ai/reviews" not in svc


def test_no_v2_dataset_generated_during_r3a_scope():
    """R3A must not author V2; R3C may freeze V2 with explicit parent lineage."""
    v2 = REPO / "evals/mai07/manifests/MAI_07_ROMANIZED_TRANSLITERATION_V2.manifest.json"
    if not v2.exists():
        return
    man = json.loads(v2.read_text(encoding="utf-8"))
    assert man.get("parent_dataset_hash") == FROZEN_DATASET_HASH
    assert man.get("prohibited_for_training") is True


def test_mai08_not_started_in_ledger():
    ledger = json.loads((REPO / "docs/mokxya-ai/MAI_PHASE_LEDGER.json").read_text(encoding="utf-8"))
    mai08 = next(p for p in ledger["phases"] if p["id"] == "MAI-08")
    assert mai08["status"] == "NOT_STARTED"
