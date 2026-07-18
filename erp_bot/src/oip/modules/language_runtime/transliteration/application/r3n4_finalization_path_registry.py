"""MAI-07R3N4 finalization path authority registry.

Every R3N4 output path family must invoke the authoritative finalizer exactly once.
"""

from __future__ import annotations

from threading import Lock
from typing import Any

REQUIRED_PATH_FAMILIES = (
    "protected",
    "skipped_english",
    "abstention",
    "ordinary_romanized_generation",
    "english_guard_reorder",
    "acronym",
    "structural_identifier",
    "refined_identifier",
    "coalesced_identifier",
    "multi_token_phrase",
    "optional_ambiguous",
    "failure_fallback",
    "cap_pressure",
    "empty_generator_result",
)

_lock = Lock()
_counts: dict[str, int] = {k: 0 for k in REQUIRED_PATH_FAMILIES}
_failures: dict[str, int] = {k: 0 for k in REQUIRED_PATH_FAMILIES}
_extra: dict[str, int] = {}


def reset_path_registry() -> None:
    with _lock:
        for k in REQUIRED_PATH_FAMILIES:
            _counts[k] = 0
            _failures[k] = 0
        _extra.clear()


def record_path_finalization(path_family: str, *, ok: bool = True, reason: str = "") -> None:
    with _lock:
        if path_family in _counts:
            if ok:
                _counts[path_family] += 1
            else:
                _failures[path_family] += 1
        else:
            _extra[path_family] = _extra.get(path_family, 0) + 1
        _ = reason


def path_coverage_report() -> dict[str, Any]:
    with _lock:
        covered = {k: _counts[k] > 0 for k in REQUIRED_PATH_FAMILIES}
        missing = [k for k, v in covered.items() if not v]
        return {
            "required_path_families": list(REQUIRED_PATH_FAMILIES),
            "counts": dict(_counts),
            "failures": dict(_failures),
            "extra": dict(_extra),
            "covered": covered,
            "missing": missing,
            "path_coverage_rate": (
                sum(1 for v in covered.values() if v) / len(REQUIRED_PATH_FAMILIES)
                if REQUIRED_PATH_FAMILIES
                else 0.0
            ),
            "all_required_observed": not missing,
        }


__all__ = [
    "REQUIRED_PATH_FAMILIES",
    "reset_path_registry",
    "record_path_finalization",
    "path_coverage_report",
]
