"""NEXT-05 / ADR_0075 — confirm path honesty (Model B tokens; NL never posts).

Does not mint product tokens, post, or invoke Dexie/OEC.
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any, Mapping

AUTHORITY = "ADR_0075"
STEP = "NEXT-05"
PRODUCT_MUTATION_PATH = "DEXIE_EXECUTE_ORBIX_CONFIRM"
DECISION = "MODEL_B_SHORT_LIVED_CONFIRM_TOKEN"


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[6]


def registry_path() -> Path:
    return _repo_root() / "docs" / "mokxya-ai" / "MAI_CONFIRM_PATH_REGISTRY.json"


@lru_cache(maxsize=1)
def load_confirm_path_registry() -> dict[str, Any]:
    path = registry_path()
    data = json.loads(path.read_text(encoding="utf-8"))
    if data.get("authority") != AUTHORITY:
        raise RuntimeError("CONFIRM_PATH_REGISTRY_AUTHORITY_MISMATCH")
    if data.get("decision") != DECISION:
        raise RuntimeError("CONFIRM_PATH_DECISION_MISMATCH")
    return data


def confirm_path_observability() -> dict[str, Any]:
    reg = load_confirm_path_registry()
    return {
        "confirm_path_step": STEP,
        "confirm_path_adr": AUTHORITY,
        "confirm_path_decision": reg["decision"],
        "product_mutation_path": PRODUCT_MUTATION_PATH,
        "nl_assent_posts": False,
        "ai_confirm_oec_is_authority": False,
        "ai_may_mint_product_confirm_token": False,
        "confirm_token_required": True,
        "confirm_token_single_use": True,
        "receipt_required_for_success": True,
        "oec_is_sole_mutation_authority": False,
        "production_approved": False,
        "gap_p0_001_register_status": "REDUCED",
        "gap_p0_001_status": "OPEN",
    }


def assert_confirm_path_honesty(claim: Mapping[str, Any] | None = None) -> None:
    """Fail closed on NL assent / AI authority / reuse / receipt-less success."""
    reg = load_confirm_path_registry()
    if reg.get("nl_assent_posts") is True:
        raise RuntimeError("NL_ASSENT_POSTS_FORBIDDEN")
    if reg.get("ai_confirm_oec_is_authority") is True:
        raise RuntimeError("AI_CONFIRM_OEC_AUTHORITY_FORBIDDEN")
    if reg.get("ai_may_mint_product_confirm_token") is True:
        raise RuntimeError("AI_MAY_MINT_PRODUCT_TOKEN_FORBIDDEN")
    if str(reg.get("product_mutation_path")) != PRODUCT_MUTATION_PATH:
        raise RuntimeError("CONFIRM_PATH_PRODUCT_PATH_INVALID")
    if reg["honesty"].get("oec_is_sole_mutation_authority") is True:
        raise RuntimeError("SOLE_OEC_CLAIM_FORBIDDEN")
    if reg["honesty"].get("production_approved") is True:
        raise RuntimeError("CONFIRM_PATH_PRODUCTION_APPROVED")
    if reg["token_policy"].get("single_use") is not True:
        raise RuntimeError("CONFIRM_TOKEN_MUST_BE_SINGLE_USE")
    if reg.get("receipt_required_for_success") is not True:
        raise RuntimeError("RECEIPT_REQUIRED_FOR_SUCCESS")

    if not claim:
        return

    if claim.get("nl_assent_posts") is True:
        raise RuntimeError("NL_ASSENT_POSTS_FORBIDDEN")
    if claim.get("ai_confirm_oec_is_authority") is True:
        raise RuntimeError("AI_CONFIRM_OEC_AUTHORITY_FORBIDDEN")
    if claim.get("confirm_token_reuse_allowed") is True:
        raise RuntimeError("CONFIRM_TOKEN_REUSE_FORBIDDEN")
    if claim.get("success_without_receipt") is True:
        raise RuntimeError("SUCCESS_WITHOUT_RECEIPT_FORBIDDEN")
    if claim.get("oec_is_sole_mutation_authority") is True:
        raise RuntimeError("SOLE_OEC_CLAIM_FORBIDDEN")
    if claim.get("allow_confirm_dispatch") is True:
        raise RuntimeError("LIVE_CONFIRM_DISPATCH_FORBIDDEN")
    if claim.get("allow_oec_dispatch") is True:
        raise RuntimeError("LIVE_OEC_DISPATCH_FORBIDDEN")
