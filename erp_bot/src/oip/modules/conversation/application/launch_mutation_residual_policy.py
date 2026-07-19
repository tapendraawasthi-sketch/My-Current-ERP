"""PR-B2 / ADR_0085 — launch mutation residual hard-deny honesty.

Product launch sales/purchase posts: DEXIE_EXECUTE_ORBIX_CONFIRM only.
Node/OEC silent writers with launch markers → deny (draft_mutations=0).
oec_sole remains false; GAP-P0-001 stays REDUCED (not CLOSED).
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any, Mapping

AUTHORITY = "ADR_0085"
STEP = "PR-B2"
DECISION = "LAUNCH_MUTATION_RESIDUAL_HARD_DENY"
PRODUCT_MUTATION_PATH = "DEXIE_EXECUTE_ORBIX_CONFIRM"
REGISTER_GAP_STATUS = "REDUCED"
RUNTIME_GAP_STATUS = "OPEN"

LAUNCH_EVENT_IDS = frozenset(
    {"sales_invoice_draft", "purchase_invoice_draft"}
)
LAUNCH_OVERLAP_NODE_INTENTS = frozenset(
    {"khata_purchase", "khata_cash_sale", "khata_credit_sale"}
)
LAUNCH_CHANNELS = frozenset(
    {
        "orbix",
        "ai",
        "ask_mokxya",
        "accountant",
        "accountant_mode",
        "launch",
        "mokxya",
    }
)


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[6]


def registry_path() -> Path:
    return (
        _repo_root()
        / "docs"
        / "mokxya-ai"
        / "MAI_LAUNCH_MUTATION_RESIDUAL_REGISTRY.json"
    )


@lru_cache(maxsize=1)
def load_launch_mutation_residual_registry() -> dict[str, Any]:
    data = json.loads(registry_path().read_text(encoding="utf-8"))
    if data.get("authority") != AUTHORITY:
        raise RuntimeError("LAUNCH_MUTATION_REGISTRY_AUTHORITY_MISMATCH")
    if data.get("decision") != DECISION:
        raise RuntimeError("LAUNCH_MUTATION_DECISION_MISMATCH")
    return data


def evaluate_silent_writer_attempt(
    *,
    writer_path_id: str,
    launch_event_id: str | None = None,
    intent: str | None = None,
    channel: str | None = None,
    confirm_token: str | None = None,
    product_mutation_path: str | None = None,
) -> dict[str, Any]:
    """Return deny dict for Node/OEC launch-marker attempts; else allow."""
    path = str(writer_path_id or "").strip().upper()
    launch = str(launch_event_id or "").strip().lower()
    intent_n = str(intent or "").strip().lower()
    channel_n = str(channel or "").strip().lower()
    token = str(confirm_token or "").strip()
    product = str(product_mutation_path or "").strip()

    launch_marked = (
        launch in LAUNCH_EVENT_IDS
        or product == PRODUCT_MUTATION_PATH
        or token.startswith("orbix-confirm-")
        or channel_n in LAUNCH_CHANNELS
        or "orbix" in channel_n
        or "launch" in channel_n
    )

    if path in {"OEC_ACTION_RUNTIME", "AI_CONFIRM_OEC_CANDIDATE"} and (
        launch_marked or launch in LAUNCH_EVENT_IDS
    ):
        return {
            "deny": True,
            "error_code": "LAUNCH_MUTATION_OEC_DENIED",
            "text": (
                "Launch sales/purchase must not use OEC/AI confirm dispatch. "
                "Product path is executeOrbixConfirm → Dexie (ADR_0085)."
            ),
            "draft_mutations": 0,
            "silent_applications": 0,
            "authority": AUTHORITY,
            "product_mutation_path": PRODUCT_MUTATION_PATH,
            "oec_is_sole_mutation_authority": False,
            "is_execution_authority": False,
        }

    if path == "NODE_KHATA_CONFIRM" and intent_n in LAUNCH_OVERLAP_NODE_INTENTS:
        if launch_marked:
            return {
                "deny": True,
                "error_code": "LAUNCH_MUTATION_NODE_KHATA_DENIED",
                "text": (
                    "Launch sales/purchase posts must use executeOrbixConfirm → Dexie. "
                    "Node /khata/confirm hard-denied for this launch marker (ADR_0085)."
                ),
                "draft_mutations": 0,
                "silent_applications": 0,
                "authority": AUTHORITY,
                "product_mutation_path": PRODUCT_MUTATION_PATH,
                "oec_is_sole_mutation_authority": False,
                "is_execution_authority": False,
            }

    return {
        "deny": False,
        "error_code": None,
        "draft_mutations": 0,
        "authority": AUTHORITY,
        "product_mutation_path": PRODUCT_MUTATION_PATH,
        "oec_is_sole_mutation_authority": False,
    }


def launch_mutation_residual_observability() -> dict[str, Any]:
    reg = load_launch_mutation_residual_registry()
    return {
        "launch_mutation_step": STEP,
        "launch_mutation_adr": AUTHORITY,
        "launch_mutation_decision": reg["decision"],
        "product_mutation_path": PRODUCT_MUTATION_PATH,
        "oec_is_sole_mutation_authority": False,
        "dual_writers_present": True,
        "gap_p0_001_register_status": REGISTER_GAP_STATUS,
        "gap_p0_001_status": RUNTIME_GAP_STATUS,
        "gap_p0_001_closed": False,
        "node_launch_hard_deny": True,
        "oec_launch_hard_deny": True,
        "production_approved": False,
        "is_execution_authority": False,
    }


def assert_launch_mutation_residual_honesty(
    claim: Mapping[str, Any] | None = None,
) -> None:
    reg = load_launch_mutation_residual_registry()
    honesty = reg.get("honesty") or {}
    if honesty.get("oec_is_sole_mutation_authority") is True:
        raise RuntimeError("LAUNCH_MUTATION_SOLE_OEC")
    if honesty.get("production_approved") is True:
        raise RuntimeError("LAUNCH_MUTATION_PRODUCTION_APPROVED")
    if honesty.get("gap_p0_001_closed") is True:
        raise RuntimeError("GAP_P0_001_FALSE_CLOSED")
    if reg["gap_p0_001"].get("closed") is True:
        raise RuntimeError("GAP_P0_001_FALSE_CLOSED")
    if honesty.get("dual_silent_writer_on_launch_path") is True:
        raise RuntimeError("LAUNCH_DUAL_SILENT_WRITER")
    if not claim:
        return
    if claim.get("oec_is_sole_mutation_authority") is True:
        raise RuntimeError("LAUNCH_MUTATION_SOLE_OEC")
    if claim.get("production_approved") is True:
        raise RuntimeError("LAUNCH_MUTATION_PRODUCTION_APPROVED")
    if claim.get("gap_p0_001_closed") is True:
        raise RuntimeError("GAP_P0_001_FALSE_CLOSED")
    if claim.get("dual_silent_writer_on_launch_path") is True:
        raise RuntimeError("LAUNCH_DUAL_SILENT_WRITER")
    if claim.get("allow_oec_dispatch") is True:
        raise RuntimeError("LIVE_OEC_DISPATCH_FORBIDDEN")
    if claim.get("nl_assent_posts") is True:
        raise RuntimeError("NL_ASSENT_POSTS_FORBIDDEN")
