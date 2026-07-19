"""NEXT-12 / ADR_0079 — E2E launch slice evidence honesty.

Does not post, sync, or invent receipts.
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any, Mapping

AUTHORITY = "ADR_0079"
STEP = "NEXT-12"
DECISION = "E2E_LAUNCH_SLICE_EVIDENCE_PACK"
PRODUCT_CONFIRM_PATH = "DEXIE_EXECUTE_ORBIX_CONFIRM"
REQUIRED_EVENTS = frozenset(
    {
        "sales_invoice_draft",
        "purchase_invoice_draft",
        "ask_company_report",
    }
)


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[6]


def registry_path() -> Path:
    return _repo_root() / "docs" / "mokxya-ai" / "MAI_E2E_LAUNCH_SLICE_REGISTRY.json"


@lru_cache(maxsize=1)
def load_e2e_launch_slice_registry() -> dict[str, Any]:
    path = registry_path()
    data = json.loads(path.read_text(encoding="utf-8"))
    if data.get("authority") != AUTHORITY:
        raise RuntimeError("E2E_LAUNCH_SLICE_REGISTRY_AUTHORITY_MISMATCH")
    if data.get("decision") != DECISION:
        raise RuntimeError("E2E_LAUNCH_SLICE_DECISION_MISMATCH")
    return data


def e2e_launch_slice_observability() -> dict[str, Any]:
    reg = load_e2e_launch_slice_registry()
    ids = [v["launch_event_id"] for v in reg["verticals"]]
    return {
        "e2e_launch_slice_step": STEP,
        "e2e_launch_slice_adr": AUTHORITY,
        "e2e_launch_slice_decision": reg["decision"],
        "launch_event_ids": ids,
        "product_confirm_path": PRODUCT_CONFIRM_PATH,
        "dual_silent_writers_forbidden": True,
        "nl_assent_posts": False,
        "queued_must_not_label_synced": True,
        "production_approved": False,
        "is_execution_authority": False,
        "settlement_in_slice": False,
    }


def assert_e2e_launch_slice_honesty(claim: Mapping[str, Any] | None = None) -> None:
    reg = load_e2e_launch_slice_registry()
    honesty = reg.get("honesty") or {}
    policies = reg.get("policies") or {}
    if honesty.get("production_approved") is True:
        raise RuntimeError("E2E_LAUNCH_SLICE_PRODUCTION_APPROVED")
    if honesty.get("is_execution_authority") is True:
        raise RuntimeError("E2E_LAUNCH_SLICE_EXECUTION_AUTHORITY")
    if honesty.get("oec_sole_mutation_authority") is True:
        raise RuntimeError("E2E_LAUNCH_SLICE_OEC_SOLE")
    if honesty.get("gap_p0_001_closed") is True:
        raise RuntimeError("E2E_LAUNCH_SLICE_GAP_P0_001_FALSE_CLOSED")
    if honesty.get("settlement_in_slice") is True:
        raise RuntimeError("E2E_LAUNCH_SLICE_SETTLEMENT")
    if policies.get("dual_silent_writers_forbidden") is not True:
        raise RuntimeError("E2E_LAUNCH_SLICE_DUAL_WRITERS_MUST_BE_FORBIDDEN")
    if policies.get("nl_assent_posts") is True:
        raise RuntimeError("E2E_LAUNCH_SLICE_NL_ASSENT_POSTS")
    if policies.get("queued_must_not_label_synced") is not True:
        raise RuntimeError("E2E_LAUNCH_SLICE_QUEUED_SYNCED_HONESTY")
    if reg.get("product_confirm_path") != PRODUCT_CONFIRM_PATH:
        raise RuntimeError("E2E_LAUNCH_SLICE_CONFIRM_PATH")

    ids = {v["launch_event_id"] for v in reg["verticals"]}
    if ids != REQUIRED_EVENTS:
        raise RuntimeError("E2E_LAUNCH_SLICE_EVENT_SET_MISMATCH")

    for v in reg["verticals"]:
        if not v.get("automated_evidence"):
            raise RuntimeError("E2E_LAUNCH_SLICE_MISSING_EVIDENCE")
        if v["launch_event_id"] != "ask_company_report" and not v.get(
            "requires_receipt"
        ):
            raise RuntimeError("E2E_LAUNCH_SLICE_RECEIPT_REQUIRED")
        if v.get("allows_mutation_on_ask") is True:
            raise RuntimeError("E2E_LAUNCH_SLICE_ASK_MUTATION")

    if not claim:
        return
    if claim.get("production_approved") is True:
        raise RuntimeError("E2E_LAUNCH_SLICE_PRODUCTION_APPROVED")
    if claim.get("is_execution_authority") is True:
        raise RuntimeError("E2E_LAUNCH_SLICE_EXECUTION_AUTHORITY")
    if claim.get("oec_sole_mutation_authority") is True:
        raise RuntimeError("E2E_LAUNCH_SLICE_OEC_SOLE")
    if claim.get("dual_silent_writers") is True:
        raise RuntimeError("E2E_LAUNCH_SLICE_DUAL_WRITERS")
    if claim.get("nl_assent_posts") is True:
        raise RuntimeError("E2E_LAUNCH_SLICE_NL_ASSENT_POSTS")
    if claim.get("queued_labelled_synced_without_ack") is True:
        raise RuntimeError("E2E_LAUNCH_SLICE_QUEUED_SYNCED")
    if claim.get("settlement_in_slice") is True:
        raise RuntimeError("E2E_LAUNCH_SLICE_SETTLEMENT")


def evidence_paths_exist() -> list[str]:
    """Return missing relative evidence paths (empty if all present)."""
    root = _repo_root()
    reg = load_e2e_launch_slice_registry()
    missing: list[str] = []
    seen: set[str] = set()
    for v in reg["verticals"]:
        for rel in v.get("automated_evidence") or []:
            if rel in seen:
                continue
            seen.add(rel)
            if not (root / rel).is_file():
                missing.append(rel)
    baseline = (
        root / "docs" / "mokxya-ai" / "baselines" / "NEXT_12_E2E_LAUNCH_SLICE.md"
    )
    if not baseline.is_file():
        missing.append("docs/mokxya-ai/baselines/NEXT_12_E2E_LAUNCH_SLICE.md")
    adr = (
        root
        / "docs"
        / "mokxya-ai"
        / "decisions"
        / "ADR_0079_E2E_LAUNCH_SLICE.md"
    )
    if not adr.is_file():
        missing.append("docs/mokxya-ai/decisions/ADR_0079_E2E_LAUNCH_SLICE.md")
    return missing
