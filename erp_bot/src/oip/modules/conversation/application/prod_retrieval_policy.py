"""NEXT-14 / ADR_0081 — production retrieval honesty (GAP-P2-001 REDUCED).

Does not retrieve documents or start Ollama.
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any, Mapping

AUTHORITY = "ADR_0081"
STEP = "NEXT-14"
DECISION = "PROD_LEXICAL_ONLY_RETRIEVAL"
REGISTER_GAP_STATUS = "REDUCED"
PROD_RETRIEVAL_MODE = "LEXICAL_ONLY"


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[6]


def registry_path() -> Path:
    return _repo_root() / "docs" / "mokxya-ai" / "MAI_PROD_RETRIEVAL_REGISTRY.json"


@lru_cache(maxsize=1)
def load_prod_retrieval_registry() -> dict[str, Any]:
    path = registry_path()
    data = json.loads(path.read_text(encoding="utf-8"))
    if data.get("authority") != AUTHORITY:
        raise RuntimeError("PROD_RETRIEVAL_REGISTRY_AUTHORITY_MISMATCH")
    if data.get("decision") != DECISION:
        raise RuntimeError("PROD_RETRIEVAL_DECISION_MISMATCH")
    return data


def prod_retrieval_observability() -> dict[str, Any]:
    reg = load_prod_retrieval_registry()
    return {
        "prod_retrieval_step": STEP,
        "prod_retrieval_adr": AUTHORITY,
        "prod_retrieval_decision": reg["decision"],
        "prod_retrieval_mode": PROD_RETRIEVAL_MODE,
        "ollama_required_for_prod": False,
        "chroma_required_for_prod": False,
        "vector_required_for_prod": False,
        "semantic_enabled_in_production": False,
        "gap_p2_001_register_status": REGISTER_GAP_STATUS,
        "gap_p2_001_closed": False,
        "production_approved": False,
        "is_execution_authority": False,
    }


def assert_prod_retrieval_honesty(claim: Mapping[str, Any] | None = None) -> None:
    reg = load_prod_retrieval_registry()
    if reg["gap_p2_001"].get("register_status") != REGISTER_GAP_STATUS:
        raise RuntimeError("GAP_P2_001_REGISTER_MUST_BE_REDUCED")
    if reg["gap_p2_001"].get("closed") is True:
        raise RuntimeError("GAP_P2_001_FALSE_CLOSED")
    honesty = reg.get("honesty") or {}
    policies = reg.get("policies") or {}
    if honesty.get("production_approved") is True:
        raise RuntimeError("PROD_RETRIEVAL_PRODUCTION_APPROVED")
    if honesty.get("ollama_required_for_prod") is True:
        raise RuntimeError("PROD_RETRIEVAL_OLLAMA_REQUIRED")
    if honesty.get("vector_required_for_prod") is True:
        raise RuntimeError("PROD_RETRIEVAL_VECTOR_REQUIRED")
    if policies.get("prod_retrieval_mode") != PROD_RETRIEVAL_MODE:
        raise RuntimeError("PROD_RETRIEVAL_MODE_MUST_BE_LEXICAL_ONLY")
    if policies.get("semantic_enabled_in_production") is True:
        raise RuntimeError("PROD_RETRIEVAL_SEMANTIC_IN_PROD")
    if policies.get("allow_non_prod_semantic_break_glass_in_production") is True:
        raise RuntimeError("PROD_RETRIEVAL_BREAK_GLASS_IN_PROD")

    if not claim:
        return
    if claim.get("production_approved") is True:
        raise RuntimeError("PROD_RETRIEVAL_PRODUCTION_APPROVED")
    if claim.get("ollama_required_for_prod") is True:
        raise RuntimeError("PROD_RETRIEVAL_OLLAMA_REQUIRED")
    if claim.get("vector_required_for_prod") is True:
        raise RuntimeError("PROD_RETRIEVAL_VECTOR_REQUIRED")
    if claim.get("gap_p2_001_closed") is True:
        raise RuntimeError("GAP_P2_001_FALSE_CLOSED")
    if claim.get("semantic_enabled_in_production") is True:
        raise RuntimeError("PROD_RETRIEVAL_SEMANTIC_IN_PROD")
