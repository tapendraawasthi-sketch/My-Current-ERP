"""NEXT-09 / ADR_0083 — launch language sample product-policy review honesty."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any, Mapping

AUTHORITY = "ADR_0083"
STEP = "NEXT-09"
DECISION = "LAUNCH_LANGUAGE_SAMPLE_PRODUCT_POLICY_REVIEW"
REGISTER_GAP_P1_009_STATUS = "REDUCED"


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[6]


def registry_path() -> Path:
    return (
        _repo_root() / "docs" / "mokxya-ai" / "MAI_LAUNCH_LANGUAGE_SAMPLE_REGISTRY.json"
    )


@lru_cache(maxsize=1)
def load_launch_language_sample_registry() -> dict[str, Any]:
    data = json.loads(registry_path().read_text(encoding="utf-8"))
    if data.get("authority") != AUTHORITY:
        raise RuntimeError("LAUNCH_LANGUAGE_REGISTRY_AUTHORITY_MISMATCH")
    if data.get("decision") != DECISION:
        raise RuntimeError("LAUNCH_LANGUAGE_DECISION_MISMATCH")
    return data


def launch_language_sample_observability() -> dict[str, Any]:
    reg = load_launch_language_sample_registry()
    honesty = reg.get("honesty") or {}
    return {
        "launch_language_step": STEP,
        "launch_language_adr": AUTHORITY,
        "launch_language_decision": reg["decision"],
        "gap_p1_009_register_status": reg["gap_p1_009"]["register_status"],
        "product_policy_approved_launch_language_slice": honesty.get(
            "product_policy_approved_launch_language_slice"
        ),
        "linguist_approved_launch_language_slice": honesty.get(
            "linguist_approved_launch_language_slice"
        ),
        "production_approved": False,
        "blocking_fix_count": reg["review"]["blocking_fix_count"],
        "is_execution_authority": False,
    }


def assert_launch_language_sample_honesty(
    claim: Mapping[str, Any] | None = None,
) -> None:
    reg = load_launch_language_sample_registry()
    honesty = reg.get("honesty") or {}
    if honesty.get("production_approved") is True:
        raise RuntimeError("LAUNCH_LANGUAGE_PRODUCTION_APPROVED")
    if honesty.get("linguist_approved_launch_language_slice") is True:
        raise RuntimeError("LAUNCH_LANGUAGE_FALSE_LINGUIST")
    if honesty.get("literary_nepali_claimed") is True:
        raise RuntimeError("LAUNCH_LANGUAGE_LITERARY_NEPALI")
    if honesty.get("is_execution_authority") is True:
        raise RuntimeError("LAUNCH_LANGUAGE_EXECUTION_AUTHORITY")
    if reg["gap_p1_009"].get("closed") is True:
        raise RuntimeError("GAP_P1_009_FALSE_CLOSED")
    if reg["review"].get("blocking_fix_count", 0) != 0:
        raise RuntimeError("LAUNCH_LANGUAGE_BLOCKING_FIX")
    if not claim:
        return
    if claim.get("production_approved") is True:
        raise RuntimeError("LAUNCH_LANGUAGE_PRODUCTION_APPROVED")
    if claim.get("linguist_approved_launch_language_slice") is True:
        raise RuntimeError("LAUNCH_LANGUAGE_FALSE_LINGUIST")
    if claim.get("gap_p1_009_closed") is True:
        raise RuntimeError("GAP_P1_009_FALSE_CLOSED")
