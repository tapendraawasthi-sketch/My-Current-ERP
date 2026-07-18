"""MAI-07R3D frozen-data firewall: active corrective code must not import frozen eval/review artifacts."""

from __future__ import annotations

import ast
from pathlib import Path

REPO = Path(__file__).resolve().parents[4]
XL = REPO / "erp_bot/src/oip/modules/language_runtime/transliteration"

FORBIDDEN_SUBSTRINGS = (
    "evals/mai07/frozen_v2",
    "MAI_07R3C_V2_ONE_SHOT_PREDICTIONS",
    "MAI_07R3C_V2_PER_CASE_AUDIT",
    "MAI_07R3_BLIND_MAPPING",
    "REVIEW_IMPORT_COMPLETED",
)

# Runtime/build/eval paths that must never consume frozen V2 bodies or review packages.
STRICT_FILES = [
    XL / "application/transliteration_service.py",
    XL / "application/eval_mai07_r3d.py",
    XL / "application/eval_mai07_r3d_differential.py",
    XL / "infrastructure/r3d_safety_gate.py",
    XL / "infrastructure/deterministic_ranker.py",
    XL / "infrastructure/deterministic_generator.py",
]


def test_r3d_runtime_modules_do_not_reference_frozen_artifacts():
    for path in STRICT_FILES:
        text = path.read_text(encoding="utf-8")
        for tok in FORBIDDEN_SUBSTRINGS:
            assert tok not in text, f"{path.name} must not reference {tok}"


def test_r3d_modules_do_not_import_frozen_eval_modules():
    forbidden_imports = {
        "eval_mai07_r3c",
        "build_mai07r3c_dataset_v2",
        "import_mai07r3b_reviews",
        "build_mai07r3a_review_packet",
        "eval_audit_scorer_r3c",
        "eval_scoring_r3c",
    }
    files = STRICT_FILES + [XL / "application/build_mai07r3d_corrective_datasets.py"]
    for path in files:
        tree = ast.parse(path.read_text(encoding="utf-8"))
        for node in ast.walk(tree):
            if isinstance(node, ast.ImportFrom) and node.module:
                leaf = node.module.rsplit(".", 1)[-1]
                assert leaf not in forbidden_imports, f"{path.name} imports {leaf}"


def test_builder_documents_forbidden_frozen_tokens():
    from erp_bot.src.oip.modules.language_runtime.transliteration.application.build_mai07r3d_corrective_datasets import (
        FORBIDDEN_FROZEN_PATH_TOKENS,
    )

    assert "frozen_v2" in FORBIDDEN_FROZEN_PATH_TOKENS
    assert "MAI_07R3C_V2_ONE_SHOT_PREDICTIONS" in FORBIDDEN_FROZEN_PATH_TOKENS
