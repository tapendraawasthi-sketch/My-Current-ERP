"""Branch A discovery — search for missing LOCKED_NOT_RUN body (read-only)."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

from .rc_lock_chain import compute_rc_semantic_body_sha256, compute_rc_raw_file_sha256

EXPECTED_LOCK_SEMANTIC = "f4c07e24cb78550496720881fbc2b6019650006f8bd39eedd716fd046b6107ff"
EXPECTED_POST_HOLDOUT_SEMANTIC = "530192228e7827bc33213f7ad8a3f4c2b75bdba6a01d78611617fd2d27c10e5c"


def _iter_json_candidates(repo: Path) -> list[Path]:
    roots = [
        repo / "evals",
        repo / "erp_bot",
    ]
    out: list[Path] = []
    for root in roots:
        if not root.exists():
            continue
        for p in root.rglob("*.json"):
            if "node_modules" in p.parts or ".git" in p.parts:
                continue
            out.append(p)
    return out


def search_exact_lock_body(repo: Path) -> dict[str, Any]:
    """Read-only scan; never mutates candidates."""
    hits: list[dict[str, Any]] = []
    narrative_refs: list[str] = []
    for path in _iter_json_candidates(repo):
        try:
            text = path.read_text(encoding="utf-8")
        except OSError:
            continue
        if EXPECTED_LOCK_SEMANTIC in text:
            narrative_refs.append(str(path.relative_to(repo)).replace("\\", "/"))
        try:
            obj = json.loads(text)
        except json.JSONDecodeError:
            continue
        if not isinstance(obj, dict):
            continue
        if obj.get("status") != "LOCKED_NOT_RUN":
            continue
        if not path.name.endswith(".LOCKED_NOT_RUN.json"):
            continue
        sem = compute_rc_semantic_body_sha256(obj)
        raw = hashlib.sha256(text.encode("utf-8")).hexdigest()
        if sem == EXPECTED_LOCK_SEMANTIC:
            hits.append(
                {
                    "path": str(path.relative_to(repo)).replace("\\", "/"),
                    "rc_manifest_semantic_sha256": sem,
                    "raw_file_sha256": raw,
                }
            )
    return {
        "expected_lock_semantic_sha256": EXPECTED_LOCK_SEMANTIC,
        "immutable_hits": hits,
        "narrative_refs_only": narrative_refs,
        "ok": bool(hits),
    }


def attempt_deterministic_reconstruction(repo: Path) -> dict[str, Any]:
    """Try builder replay; report digest without claiming recovery."""
    import importlib

    preserved = repo / "evals/mai07_r3f_seal_new/MAI_07R3F_SEAL_NEW_RELEASE_CANDIDATE_001.LOCKED_NOT_RUN.json"
    if preserved.exists():
        obj = json.loads(preserved.read_text(encoding="utf-8"))
        sem = compute_rc_semantic_body_sha256(obj)
        if sem == EXPECTED_LOCK_SEMANTIC:
            return {
                "reconstruction_attempted": True,
                "provenance": "RECONSTRUCTED_FROM_PREEXISTING_HASH_COMMITMENT",
                "expected_semantic_sha256": EXPECTED_LOCK_SEMANTIC,
                "reconstructed_semantic_sha256": sem,
                "exact_match": True,
                "note": "Recovered exact historical LOCKED_NOT_RUN body from immutable preserved artifact.",
            }

    if repo.name != "My-Current-ERP" and (repo / "evals").exists() is False:
        repo = Path(__file__).resolve().parents[7]
    mod = importlib.import_module(
        "src.oip.modules.language_runtime.transliteration.application.build_mai07r3f_seal_new_rc"
    )
    body = mod.build_rc(repo=repo, lock_timestamp="2026-07-16T00:00:00+00:00", write=False)
    sem = compute_rc_semantic_body_sha256(body)
    return {
        "reconstruction_attempted": True,
        "provenance": (
            "RECONSTRUCTED_FROM_PREEXISTING_HASH_COMMITMENT"
            if sem == EXPECTED_LOCK_SEMANTIC
            else "NOT_RECOVERED"
        ),
        "expected_semantic_sha256": EXPECTED_LOCK_SEMANTIC,
        "reconstructed_semantic_sha256": sem,
        "exact_match": sem == EXPECTED_LOCK_SEMANTIC,
        "note": (
            "Deterministic builder reproduces f4c07e24 from sealed inputs and prior narrative commitments."
            if sem == EXPECTED_LOCK_SEMANTIC
            else "Sealed inputs drifted; exact f4c07e24 digest not reproducible without discretionary edits."
        ),
    }


def branch_a_report(repo: Path) -> dict[str, Any]:
    search = search_exact_lock_body(repo)
    recon = attempt_deterministic_reconstruction(repo)
    status = "PASSED_RECOVERED_LOCK_CHAIN" if search["ok"] else "BRANCH_A_FAILED"
    return {
        "branch": "A",
        "status": status,
        "search": search,
        "reconstruction": recon,
        "branch_b_required": not search["ok"],
    }
