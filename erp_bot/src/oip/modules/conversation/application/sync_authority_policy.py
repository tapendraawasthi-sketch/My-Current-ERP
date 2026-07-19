"""NEXT-04 / ADR_0074 — sync authority honesty (accounting event-sync path).

Loads the sync authority registry and rejects false dual-closed / queued=synced
/ AI sync-dispatch claims. Does not start sync workers or mutate queues.
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any, Mapping

AUTHORITY = "ADR_0074"
STEP = "NEXT-04"
ACCOUNTING_SYNC_AUTHORITY = "EVENT_SYNC_QUEUE"
RUNTIME_GAP_STATUS = "OPEN"
REGISTER_GAP_STATUS = "REDUCED"
CONFLICT_POLICY = "REQUIRE_RECONFIRM_ON_MATERIAL_CONFLICT"


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[6]


def registry_path() -> Path:
    return _repo_root() / "docs" / "mokxya-ai" / "MAI_SYNC_AUTHORITY_REGISTRY.json"


@lru_cache(maxsize=1)
def load_sync_authority_registry() -> dict[str, Any]:
    path = registry_path()
    data = json.loads(path.read_text(encoding="utf-8"))
    if data.get("authority") != AUTHORITY:
        raise RuntimeError("SYNC_AUTHORITY_REGISTRY_AUTHORITY_MISMATCH")
    if data.get("decision") != "ACCOUNTING_EVENT_SYNC_QUEUE_AUTHORITY":
        raise RuntimeError("SYNC_AUTHORITY_DECISION_MISMATCH")
    return data


def accounting_sync_authority_id() -> str:
    return str(
        load_sync_authority_registry()["accounting_sync_authority"]["id"]
    )


def sync_authority_observability() -> dict[str, Any]:
    reg = load_sync_authority_registry()
    return {
        "sync_authority_step": STEP,
        "sync_authority_adr": AUTHORITY,
        "sync_authority_decision": reg["decision"],
        "accounting_sync_authority": ACCOUNTING_SYNC_AUTHORITY,
        "conflict_policy": CONFLICT_POLICY,
        "queued_must_not_label_synced": True,
        "conflict_auto_overwrite": False,
        "dual_sync_status": "OPEN",
        "dual_sync_written_exception": reg["gap_p1_002"][
            "dual_sync_written_exception"
        ],
        "gap_p1_002_register_status": REGISTER_GAP_STATUS,
        "gap_p1_002_status": RUNTIME_GAP_STATUS,
        "gap_p1_002_closed": False,
        "allow_sync_push": False,
        "allow_conflict_resolve": False,
        "allow_reversal_dispatch": False,
        "production_approved": False,
    }


def assert_sync_authority_honesty(
    claim: Mapping[str, Any] | None = None,
) -> None:
    reg = load_sync_authority_registry()
    if accounting_sync_authority_id() != ACCOUNTING_SYNC_AUTHORITY:
        raise RuntimeError("SYNC_AUTHORITY_PRODUCT_PATH_INVALID")
    if str(reg["gap_p1_002"].get("runtime_status") or "") != RUNTIME_GAP_STATUS:
        raise RuntimeError("SYNC_AUTHORITY_RUNTIME_GAP_MUST_STAY_OPEN")
    if reg["gap_p1_002"].get("closed") is True:
        raise RuntimeError("SYNC_AUTHORITY_GAP_FALSE_CLOSED")
    if not reg["honesty"].get("accounting_legacy_outbox_blocked"):
        raise RuntimeError("SYNC_AUTHORITY_LEGACY_ACCOUNTING_NOT_BLOCKED")
    if str(reg["policies"].get("conflict_policy")) != CONFLICT_POLICY:
        raise RuntimeError("SYNC_AUTHORITY_CONFLICT_POLICY_MISMATCH")
    if reg["policies"].get("queued_must_not_label_synced") is not True:
        raise RuntimeError("SYNC_AUTHORITY_QUEUED_SYNCED_POLICY_MISSING")
    if reg["policies"].get("conflict_auto_overwrite") is True:
        raise RuntimeError("SYNC_AUTHORITY_AUTO_OVERWRITE_FORBIDDEN")

    required = {
        "EVENT_SYNC_QUEUE",
        "LEGACY_SYNC_OUTBOX_ACCOUNTING",
        "LEGACY_SYNC_OUTBOX_NON_ACCOUNTING",
        "AI_OFFLINE_SYNC_CANDIDATE",
    }
    ids = {str(p["id"]) for p in reg["paths"]}
    if not required.issubset(ids):
        raise RuntimeError("SYNC_AUTHORITY_PATHS_INCOMPLETE")

    blocked = next(
        p for p in reg["paths"] if p["id"] == "LEGACY_SYNC_OUTBOX_ACCOUNTING"
    )
    if str(blocked.get("status")) != "BLOCKED":
        raise RuntimeError("SYNC_AUTHORITY_ACCOUNTING_OUTBOX_NOT_BLOCKED")

    if not claim:
        return

    if claim.get("queued_labeled_synced") is True:
        raise RuntimeError("QUEUED_LABELED_SYNCED_FORBIDDEN")
    if claim.get("conflict_auto_overwrite") is True:
        raise RuntimeError("CONFLICT_AUTO_OVERWRITE_FORBIDDEN")
    if claim.get("allow_sync_push") is True:
        raise RuntimeError("LIVE_SYNC_PUSH_FORBIDDEN")
    if claim.get("allow_conflict_resolve") is True:
        raise RuntimeError("LIVE_CONFLICT_RESOLVE_FORBIDDEN")
    if claim.get("allow_reversal_dispatch") is True:
        raise RuntimeError("LIVE_REVERSAL_DISPATCH_FORBIDDEN")
    if claim.get("sync_workers_started") is True:
        raise RuntimeError("SYNC_WORKERS_FROM_AI_FORBIDDEN")
    if claim.get("sync_push_invoked") is True:
        raise RuntimeError("SYNC_PUSH_FROM_AI_FORBIDDEN")
    if str(claim.get("gap_p1_002_status") or RUNTIME_GAP_STATUS) in {
        "CLOSED",
        "APPROVED",
    }:
        raise RuntimeError("GAP_P1_002_FALSE_CLOSED")
    if claim.get("dual_sync_closed") is True:
        raise RuntimeError("DUAL_SYNC_FALSE_CLOSED")


__all__ = [
    "ACCOUNTING_SYNC_AUTHORITY",
    "AUTHORITY",
    "CONFLICT_POLICY",
    "REGISTER_GAP_STATUS",
    "RUNTIME_GAP_STATUS",
    "STEP",
    "accounting_sync_authority_id",
    "assert_sync_authority_honesty",
    "load_sync_authority_registry",
    "registry_path",
    "sync_authority_observability",
]
