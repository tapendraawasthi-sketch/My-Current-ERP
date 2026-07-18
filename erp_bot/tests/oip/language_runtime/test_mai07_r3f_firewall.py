"""MAI-07R3F frozen-data firewall: R3F modules must not import/read frozen eval artifacts."""

from __future__ import annotations

import ast
from pathlib import Path

REPO = Path(__file__).resolve().parents[4]
XL = REPO / "erp_bot/src/oip/modules/language_runtime/transliteration"

FORBIDDEN_SUBSTRINGS = (
    "evals/mai07/frozen_v2",
    "MAI_07R3C_V2_ONE_SHOT_PREDICTIONS",
    "MAI_07R3C_V2_PER_CASE_AUDIT",
    "MAI_07R3E_V2_ONE_SHOT_PREDICTIONS",
    "MAI_07R3E_V2_PER_CASE_AUDIT",
    "MAI_07R3_BLIND_MAPPING",
    "REVIEW_IMPORT_COMPLETED",
)

STRICT_FILES = [
    XL / "application/transliteration_service.py",
    XL / "application/build_mai07r3f_english_identity_datasets.py",
    XL / "application/eval_mai07_r3f.py",
    XL / "application/eval_mai07_r3f_differential.py",
    XL / "application/build_mai07r3f_release_candidate.py",
    XL / "infrastructure/english_identity_guard.py",
    XL / "infrastructure/deterministic_ranker.py",
    XL / "infrastructure/deterministic_generator.py",
    XL / "infrastructure/r3d_safety_gate.py",
]


def test_r3f_runtime_modules_do_not_reference_frozen_artifacts():
    for path in STRICT_FILES:
        if not path.exists():
            continue
        text = path.read_text(encoding="utf-8")
        # Strip explicit forbid-list blocks so declared tokens are allowed.
        scrubbed = text
        if "FORBIDDEN_FROZEN_PATH_TOKENS" in scrubbed:
            # Keep only code outside the forbid tuple assignment region.
            parts = scrubbed.split("FORBIDDEN_FROZEN_PATH_TOKENS", 1)
            after = parts[1]
            # Drop until closing paren of the tuple.
            end = after.find(")")
            scrubbed = parts[0] + after[end + 1 :]
        for tok in FORBIDDEN_SUBSTRINGS:
            assert tok not in scrubbed, f"{path.name} references {tok}"


def test_r3f_modules_do_not_import_frozen_eval_modules():
    forbidden_imports = {
        "eval_mai07_r3c",
        "eval_mai07_r3e",
        "build_mai07r3c_dataset_v2",
        "import_mai07r3b_reviews",
        "build_mai07r3a_review_packet",
        "eval_audit_scorer_r3c",
        "eval_scoring_r3c",
    }
    for path in STRICT_FILES:
        if not path.exists():
            continue
        tree = ast.parse(path.read_text(encoding="utf-8"))
        for node in ast.walk(tree):
            if isinstance(node, ast.ImportFrom) and node.module:
                leaf = node.module.rsplit(".", 1)[-1]
                assert leaf not in forbidden_imports, f"{path.name} imports {leaf}"


def test_builder_documents_forbidden_frozen_tokens():
    from erp_bot.src.oip.modules.language_runtime.transliteration.application.build_mai07r3f_english_identity_datasets import (
        FORBIDDEN_FROZEN_PATH_TOKENS,
    )

    assert "frozen_v2" in FORBIDDEN_FROZEN_PATH_TOKENS
    assert "MAI_07R3E_V2_ONE_SHOT_PREDICTIONS" in FORBIDDEN_FROZEN_PATH_TOKENS
    assert "MAI_07R3_BLIND_MAPPING" in FORBIDDEN_FROZEN_PATH_TOKENS
