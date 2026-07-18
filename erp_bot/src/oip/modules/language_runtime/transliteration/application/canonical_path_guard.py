"""Canonical-path write guards for MAI-07 evaluation artifacts.

Ordinary tests/validation must never mutate sealed or historical eval trees.
"""

from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
from typing import Iterable

REPO = Path(__file__).resolve().parents[7]

PROTECTED_EVAL_TREES = (
    REPO / "evals" / "mai07_r3h_english_identity",
    REPO / "evals" / "mai07_r3h2_shared_collision",
    REPO / "evals" / "mai07",
)

AUTHORIZE_ENV = "MAI07_AUTHORIZE_EVAL_WRITE"


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def iter_files(root: Path) -> list[Path]:
    if not root.exists():
        return []
    return sorted(p for p in root.rglob("*") if p.is_file())


def hash_tree(root: Path) -> dict[str, str]:
    out: dict[str, str] = {}
    for path in iter_files(root):
        rel = path.relative_to(root).as_posix()
        out[rel] = sha256_file(path)
    return out


def tree_digest(root: Path) -> str:
    mapping = hash_tree(root)
    blob = json.dumps(mapping, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(blob).hexdigest()


def is_under_protected(path: Path) -> bool:
    resolved = path.resolve()
    for root in PROTECTED_EVAL_TREES:
        try:
            resolved.relative_to(root.resolve())
            return True
        except ValueError:
            continue
    return False


def assert_writable_eval_path(path: Path, *, authorize: bool = False) -> None:
    """Refuse writes into protected eval trees unless explicitly authorized.

    Authorization still refuses overwrite of existing sealed lock/attempt/chain
    artifacts (append-only).
    """
    path = path.resolve()
    if not is_under_protected(path):
        return
    sealed_names = (
        ".LOCKED_NOT_RUN.json",
        ".LOCK_RECORD.json",
        ".CHAIN_MANIFEST.json",
        ".QUALIFICATION_RESULT.json",
        "HOLDOUT_ATTEMPT",
        "POST_CLOSEOUT_ARTIFACT_DRIFT.json",
    )
    name = path.name
    if any(tok in name for tok in sealed_names) and path.exists():
        raise PermissionError(f"Append-only sealed artifact cannot be overwritten: {path}")
    if authorize and os.environ.get(AUTHORIZE_ENV) == "1":
        if path.exists() and path.suffix in {".json", ".jsonl"} and "LOCKED" in name:
            raise PermissionError(f"Refusing overwrite of sealed lock body: {path}")
        return
    raise PermissionError(
        f"Refusing write to protected evaluation path {path}. "
        f"Use an isolated output directory, or set {AUTHORIZE_ENV}=1 with authorize=True "
        "for a new versioned write that does not overwrite sealed artifacts."
    )


def write_text_guarded(path: Path, text: str, *, authorize: bool = False, encoding: str = "utf-8") -> None:
    assert_writable_eval_path(path, authorize=authorize)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding=encoding, newline="\n")


def require_explicit_output_dir(output_dir: Path | None, *, label: str) -> Path:
    if output_dir is None:
        raise ValueError(f"{label} requires an explicit output_dir (no canonical default writes)")
    return Path(output_dir)


def snapshot_roots(roots: Iterable[Path]) -> dict[str, str]:
    return {str(root): tree_digest(Path(root)) for root in roots}
