"""MAI-07R3J-A — V3 review-packet data firewall.

Governance tooling only. Refuses to open V1/V2 case bodies, frozen
prediction rows, holdout bodies, or prior blind mappings as gold inputs.
"""

from __future__ import annotations

import ast
from pathlib import Path
from typing import Iterable

REPO = Path(__file__).resolve().parents[7]

# Path suffixes / names that must never be opened by the V3 packet builder.
FORBIDDEN_PATH_MARKERS: tuple[str, ...] = (
    "frozen_v2",
    "ROMANIZED_TRANSLITERATION_V1",
    "ROMANIZED_TRANSLITERATION_V2",
    "ONE_SHOT_PREDICTIONS",
    "PER_CASE_AUDIT",
    "MAI_07R3_BLIND_MAPPING",
    "MAI_07R3_UNBLINDED_ADJUDICATION",
    "MAI_07R3_REVIEW_IMPORT_COMPLETED",
    "HOLDOUT_ATTEMPT",
    "HOLDOUT_PREDICTIONS",
    "r3h2_shared_collision/reports",
    "r3h_english_identity/reports",
    "r3i_frozen_reauthorized/reports/MAI_07R3I_V2",
    "r3e/reports/MAI_07R3E_V2",
    "r3g_reauthorized_002/reports/MAI_07R3G",
)

FORBIDDEN_IMPORT_MODULES: frozenset[str] = frozenset(
    {
        "eval_mai07",
        "eval_mai07_r3c",
        "eval_mai07_r3e",
        "eval_mai07_r3g",
        "eval_mai07_r3g_reauthorized",
        "eval_mai07_r3g_reauthorized_002",
        "eval_mai07_r3i_frozen_reauthorized",
        "build_mai07r3c_dataset_v2",
        "build_mai07r3a_review_packet",
        "import_mai07r3b_reviews",
        "transliteration_service",
        "resource_repository",
        "deterministic_generator",
        "deterministic_ranker",
        "english_identity_guard",
    }
)

ALLOWED_R3JA_MODULES: frozenset[str] = frozenset(
    {
        "mai07_r3ja_v3_firewall",
        "mai07_r3ja_v3_independent_corpus",
        "mai07_r3ja_v3_agreement",
        "build_mai07_r3ja_v3_review_packet",
    }
)


def normalize_path(path: Path | str) -> str:
    return str(path).replace("\\", "/")


def is_forbidden_path(path: Path | str) -> bool:
    s = normalize_path(path)
    return any(marker in s for marker in FORBIDDEN_PATH_MARKERS)


def assert_path_allowed(path: Path | str, *, purpose: str = "read") -> None:
    if is_forbidden_path(path):
        raise PermissionError(
            f"V3_FIREWALL_BLOCKED:{purpose}:{normalize_path(path)}"
        )


def safe_read_text(path: Path, *, encoding: str = "utf-8") -> str:
    """Read only non-forbidden paths (manifests/docs hashes permitted if not markers)."""
    assert_path_allowed(path, purpose="read_text")
    return path.read_text(encoding=encoding)


def safe_sha256_file(path: Path) -> str:
    """Hash bytes of a file without parsing JSONL case bodies.

    Allowed for immutability snapshots of historical artifacts including V2
    dataset *files* when the caller only needs the digest and never parses rows.
    For V3 packet construction this must still not be used to open case content.
    """
    import hashlib

    # Hashing historical artifact files for immutability is permitted; parsing is not.
    return hashlib.sha256(path.read_bytes()).hexdigest()


def assert_source_code_firewall(source_path: Path) -> list[str]:
    """Static AST check: builder must not import forbidden runtime/eval modules."""
    tree = ast.parse(source_path.read_text(encoding="utf-8"), filename=str(source_path))
    violations: list[str] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                leaf = alias.name.rsplit(".", 1)[-1]
                if leaf in FORBIDDEN_IMPORT_MODULES:
                    violations.append(f"import:{alias.name}")
        elif isinstance(node, ast.ImportFrom):
            mod = node.module or ""
            leaf = mod.rsplit(".", 1)[-1]
            if leaf in FORBIDDEN_IMPORT_MODULES:
                violations.append(f"from:{mod}")
            for alias in node.names:
                if alias.name in FORBIDDEN_IMPORT_MODULES:
                    violations.append(f"from_name:{alias.name}")
    return violations


def scan_tree_for_forbidden_opens(source_paths: Iterable[Path]) -> list[str]:
    out: list[str] = []
    for path in source_paths:
        out.extend(f"{path.name}:{v}" for v in assert_source_code_firewall(path))
    return out


HISTORICAL_IMMUTABLE_PATHS: tuple[str, ...] = (
    "evals/mai07/manifests/MAI_07_ROMANIZED_TRANSLITERATION_V1.manifest.json",
    "evals/mai07/manifests/MAI_07_ROMANIZED_TRANSLITERATION_V2.manifest.json",
    "evals/mai07/r3i_frozen_reauthorized/MAI_07R3I_FROZEN_V2_ATTEMPT_001.LOCKED_NOT_RUN.json",
    "evals/mai07/r3i_frozen_reauthorized/MAI_07R3I_FROZEN_V2_ATTEMPT_001.QUALITY_RESULT.json",
    "evals/mai07_r3h2_shared_collision/MAI_07R3H2_SHARED_COLLISION_RELEASE_CANDIDATE_001.LOCKED_NOT_RUN.json",
    "docs/mokxya-ai/reviews/mai07r3/MAI_07R3_BLIND_MAPPING.json",
)


def snapshot_historical_hashes(repo: Path = REPO) -> dict[str, str | None]:
    """Record SHA-256 of historical artifacts without parsing case bodies."""
    out: dict[str, str | None] = {}
    for rel in HISTORICAL_IMMUTABLE_PATHS:
        p = repo / rel
        out[rel] = safe_sha256_file(p) if p.exists() else None
    return out
