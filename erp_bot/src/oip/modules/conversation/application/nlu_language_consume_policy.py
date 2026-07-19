"""NEXT-07 / ADR_0076 — gated language-candidate consume into primary NLU.

Safe consume: concept→intent + number-role preference for amount selection.
Never: transliteration/typo rewrite of raw_text, silent master bind, silent draft.
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any, Mapping

AUTHORITY = "ADR_0076"
STEP = "NEXT-07"
DECISION = "GATED_LANGUAGE_CANDIDATE_NLU_CONSUME"
PRODUCT_PATH = "PRIMARY_ORBIX_OIP_PREPROCESS"


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[6]


def registry_path() -> Path:
    return _repo_root() / "docs" / "mokxya-ai" / "MAI_NLU_LANGUAGE_CONSUME_REGISTRY.json"


@lru_cache(maxsize=1)
def load_nlu_language_consume_registry() -> dict[str, Any]:
    path = registry_path()
    data = json.loads(path.read_text(encoding="utf-8"))
    if data.get("authority") != AUTHORITY:
        raise RuntimeError("NLU_LANGUAGE_CONSUME_REGISTRY_AUTHORITY_MISMATCH")
    if data.get("decision") != DECISION:
        raise RuntimeError("NLU_LANGUAGE_CONSUME_DECISION_MISMATCH")
    return data


def nlu_language_consume_observability() -> dict[str, Any]:
    reg = load_nlu_language_consume_registry()
    pol = reg["policies"]
    return {
        "nlu_language_consume_step": STEP,
        "nlu_language_consume_adr": AUTHORITY,
        "nlu_language_consume_decision": reg["decision"],
        "product_path": PRODUCT_PATH,
        "allow_concept_intent_consume": bool(pol["allow_concept_intent_consume"]),
        "allow_number_role_consume": bool(pol["allow_number_role_consume"]),
        "allow_transliteration_apply": bool(pol["allow_transliteration_apply"]),
        "allow_typo_rewrite_apply": bool(pol["allow_typo_rewrite_apply"]),
        "allow_silent_master_bind": bool(pol["allow_silent_master_bind"]),
        "allow_silent_draft_write": bool(pol["allow_silent_draft_write"]),
        "production_approved": False,
        "gap_p1_009_status": "OPEN",
    }


def assert_nlu_language_consume_honesty(
    claim: Mapping[str, Any] | None = None,
) -> None:
    """Fail closed on unsafe consume / silent bind / rewrite claims."""
    reg = load_nlu_language_consume_registry()
    pol = reg["policies"]
    if pol.get("allow_transliteration_apply") is True:
        raise RuntimeError("TRANSLITERATION_APPLY_FORBIDDEN")
    if pol.get("allow_typo_rewrite_apply") is True:
        raise RuntimeError("TYPO_REWRITE_APPLY_FORBIDDEN")
    if pol.get("allow_silent_master_bind") is True:
        raise RuntimeError("SILENT_MASTER_BIND_FORBIDDEN")
    if pol.get("allow_silent_draft_write") is True:
        raise RuntimeError("SILENT_DRAFT_WRITE_FORBIDDEN")
    if pol.get("allow_concept_intent_consume") is not True:
        raise RuntimeError("CONCEPT_INTENT_CONSUME_MUST_BE_ENABLED")
    if pol.get("allow_number_role_consume") is not True:
        raise RuntimeError("NUMBER_ROLE_CONSUME_MUST_BE_ENABLED")
    if reg["honesty"].get("production_approved") is True:
        raise RuntimeError("NLU_CONSUME_PRODUCTION_APPROVED")

    if not claim:
        return

    if claim.get("allow_transliteration_apply") is True:
        raise RuntimeError("TRANSLITERATION_APPLY_FORBIDDEN")
    if claim.get("allow_typo_rewrite_apply") is True:
        raise RuntimeError("TYPO_REWRITE_APPLY_FORBIDDEN")
    if claim.get("allow_silent_master_bind") is True:
        raise RuntimeError("SILENT_MASTER_BIND_FORBIDDEN")
    if claim.get("allow_silent_draft_write") is True:
        raise RuntimeError("SILENT_DRAFT_WRITE_FORBIDDEN")
    if claim.get("raw_text_mutated") is True:
        raise RuntimeError("RAW_TEXT_MUTATION_FORBIDDEN")
    if claim.get("draft_mutations", 0) not in (0, None):
        raise RuntimeError("DRAFT_MUTATIONS_FORBIDDEN")
