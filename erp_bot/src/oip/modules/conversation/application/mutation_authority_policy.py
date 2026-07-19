"""NEXT-02 / ADR_0072 — mutation authority honesty (Model B product path).

Loads the repository mutation authority registry and rejects false sole-OEC
claims. Does not post, mint tokens, or invoke Dexie/OEC.
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any, Mapping

AUTHORITY = "ADR_0072"
STEP = "NEXT-02"
PRODUCT_MUTATION_PATH = "DEXIE_EXECUTE_ORBIX_CONFIRM"
RUNTIME_GAP_STATUS = "OPEN"
REGISTER_GAP_STATUS = "REDUCED"


def _repo_root() -> Path:
    # .../erp_bot/src/oip/modules/conversation/application/this.py → repo root
    return Path(__file__).resolve().parents[6]


def registry_path() -> Path:
    return (
        _repo_root()
        / "docs"
        / "mokxya-ai"
        / "MAI_MUTATION_AUTHORITY_REGISTRY.json"
    )


@lru_cache(maxsize=1)
def load_mutation_authority_registry() -> dict[str, Any]:
    path = registry_path()
    data = json.loads(path.read_text(encoding="utf-8"))
    if data.get("authority") != AUTHORITY:
        raise RuntimeError("MUTATION_AUTHORITY_REGISTRY_AUTHORITY_MISMATCH")
    if data.get("decision") != "OPTION_A_MODEL_B_PRODUCT_AUTHORITY":
        raise RuntimeError("MUTATION_AUTHORITY_DECISION_MISMATCH")
    return data


def product_mutation_path() -> str:
    reg = load_mutation_authority_registry()
    return str(reg["product_mutation_authority"]["id"])


def oec_is_sole_mutation_authority() -> bool:
    return bool(
        load_mutation_authority_registry()["honesty"][
            "oec_is_sole_mutation_authority"
        ]
    )


def classified_path_ids() -> frozenset[str]:
    reg = load_mutation_authority_registry()
    return frozenset(str(p["id"]) for p in reg["paths"])


def mutation_authority_observability() -> dict[str, Any]:
    reg = load_mutation_authority_registry()
    return {
        "mutation_authority_step": STEP,
        "mutation_authority_adr": AUTHORITY,
        "mutation_authority_decision": reg["decision"],
        "product_mutation_path": product_mutation_path(),
        "oec_is_sole_mutation_authority": False,
        "dual_writers_present": True,
        "gap_p0_001_register_status": REGISTER_GAP_STATUS,
        "gap_p0_001_status": RUNTIME_GAP_STATUS,
        "gap_p0_001_closed": False,
        "nl_assent_posts": False,
        "allow_confirm_dispatch": False,
        "allow_oec_dispatch": False,
        "production_approved": False,
    }


def assert_mutation_authority_honesty(
    claim: Mapping[str, Any] | None = None,
) -> None:
    """Fail closed on false sole-OEC / wrong product path / NL assent claims."""
    reg = load_mutation_authority_registry()
    if reg["honesty"].get("oec_is_sole_mutation_authority") is True:
        raise RuntimeError("MUTATION_AUTHORITY_REGISTRY_CLAIMS_SOLE_OEC")
    if reg["honesty"].get("production_approved") is True:
        raise RuntimeError("MUTATION_AUTHORITY_REGISTRY_PRODUCTION_APPROVED")
    if str(reg["product_mutation_authority"]["id"]) != PRODUCT_MUTATION_PATH:
        raise RuntimeError("MUTATION_AUTHORITY_PRODUCT_PATH_INVALID")
    if str(reg["gap_p0_001"].get("runtime_status") or "") != RUNTIME_GAP_STATUS:
        raise RuntimeError("MUTATION_AUTHORITY_RUNTIME_GAP_MUST_STAY_OPEN")
    if reg["gap_p0_001"].get("closed") is True:
        raise RuntimeError("MUTATION_AUTHORITY_GAP_FALSE_CLOSED")

    required = {
        "DEXIE_EXECUTE_ORBIX_CONFIRM",
        "NODE_KHATA_CONFIRM",
        "VOUCHER_SLICE_UI",
        "OEC_ACTION_RUNTIME",
        "AI_CONFIRM_OEC_CANDIDATE",
    }
    if not required.issubset(classified_path_ids()):
        raise RuntimeError("MUTATION_AUTHORITY_PATHS_INCOMPLETE")

    if not claim:
        return

    if claim.get("oec_is_sole_mutation_authority") is True:
        raise RuntimeError("SOLE_OEC_CLAIM_FORBIDDEN")
    if claim.get("sole_oec") is True:
        raise RuntimeError("SOLE_OEC_CLAIM_FORBIDDEN")
    if claim.get("nl_assent_posts") is True:
        raise RuntimeError("NL_ASSENT_POSTS_FORBIDDEN")
    if claim.get("allow_oec_dispatch") is True:
        raise RuntimeError("LIVE_OEC_DISPATCH_FORBIDDEN")
    if claim.get("allow_confirm_dispatch") is True:
        raise RuntimeError("LIVE_CONFIRM_DISPATCH_FORBIDDEN")
    if claim.get("oec_dispatch_invoked") is True:
        raise RuntimeError("OEC_DISPATCH_INVOKED_FORBIDDEN")
    if claim.get("erp_command_posted") is True:
        raise RuntimeError("ERP_COMMAND_POSTED_FORBIDDEN_ON_AI_CLAIM")

    path = claim.get("product_mutation_path")
    if path is not None and str(path) not in {
        PRODUCT_MUTATION_PATH,
        "UNKNOWN",
        "",
    }:
        raise RuntimeError("PRODUCT_MUTATION_PATH_MISCLAIM")

    if str(claim.get("gap_p0_001_status") or RUNTIME_GAP_STATUS) not in {
        RUNTIME_GAP_STATUS,
        "OPEN",
    }:
        # Runtime bundles must not claim CLOSED/APPROVED via this field.
        if str(claim.get("gap_p0_001_status")) in {"CLOSED", "APPROVED"}:
            raise RuntimeError("GAP_P0_001_FALSE_CLOSED")


__all__ = [
    "AUTHORITY",
    "PRODUCT_MUTATION_PATH",
    "REGISTER_GAP_STATUS",
    "RUNTIME_GAP_STATUS",
    "STEP",
    "assert_mutation_authority_honesty",
    "classified_path_ids",
    "load_mutation_authority_registry",
    "mutation_authority_observability",
    "oec_is_sole_mutation_authority",
    "product_mutation_path",
    "registry_path",
]
