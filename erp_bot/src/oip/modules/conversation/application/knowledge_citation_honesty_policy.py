"""NEXT-13 / ADR_0080 — knowledge citation honesty (GAP-P2-008 REDUCED).

Does not retrieve documents or mark claims verified.
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any, Mapping

AUTHORITY = "ADR_0080"
STEP = "NEXT-13"
DECISION = "LAUNCH_ASK_KNOWLEDGE_CITATION_HONESTY_GATE"
REGISTER_GAP_STATUS = "REDUCED"
KNOWLEDGE_RELEASE_STATUS = "NOT_RELEASED"


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[6]


def registry_path() -> Path:
    return (
        _repo_root()
        / "docs"
        / "mokxya-ai"
        / "MAI_KNOWLEDGE_CITATION_HONESTY_REGISTRY.json"
    )


@lru_cache(maxsize=1)
def load_knowledge_citation_honesty_registry() -> dict[str, Any]:
    path = registry_path()
    data = json.loads(path.read_text(encoding="utf-8"))
    if data.get("authority") != AUTHORITY:
        raise RuntimeError("KNOWLEDGE_CITATION_REGISTRY_AUTHORITY_MISMATCH")
    if data.get("decision") != DECISION:
        raise RuntimeError("KNOWLEDGE_CITATION_DECISION_MISMATCH")
    return data


def knowledge_citation_observability() -> dict[str, Any]:
    reg = load_knowledge_citation_honesty_registry()
    return {
        "knowledge_citation_step": STEP,
        "knowledge_citation_adr": AUTHORITY,
        "knowledge_citation_decision": reg["decision"],
        "fake_cite_fails": True,
        "missing_evidence_no_answer": True,
        "tax_current_without_release_abstains": True,
        "claims_verified": False,
        "citations_verified": False,
        "fake_citation_allowed": False,
        "legal_effective_dates_proven": False,
        "knowledge_release_status": KNOWLEDGE_RELEASE_STATUS,
        "gap_p2_008_register_status": REGISTER_GAP_STATUS,
        "gap_p2_008_closed": False,
        "production_approved": False,
        "is_execution_authority": False,
    }


def assert_knowledge_citation_honesty(
    claim: Mapping[str, Any] | None = None,
) -> None:
    reg = load_knowledge_citation_honesty_registry()
    if reg["gap_p2_008"].get("register_status") != REGISTER_GAP_STATUS:
        raise RuntimeError("GAP_P2_008_REGISTER_MUST_BE_REDUCED")
    if reg["gap_p2_008"].get("closed") is True:
        raise RuntimeError("GAP_P2_008_FALSE_CLOSED")
    honesty = reg.get("honesty") or {}
    policies = reg.get("policies") or {}
    if honesty.get("production_approved") is True:
        raise RuntimeError("KNOWLEDGE_CITATION_PRODUCTION_APPROVED")
    if honesty.get("legal_effective_dates_proven") is True:
        raise RuntimeError("KNOWLEDGE_CITATION_LEGAL_DATES_PROVEN")
    if honesty.get("claims_verified") is True:
        raise RuntimeError("KNOWLEDGE_CITATION_CLAIMS_VERIFIED")
    if honesty.get("citations_verified") is True:
        raise RuntimeError("KNOWLEDGE_CITATION_CITATIONS_VERIFIED")
    if honesty.get("fake_citation_allowed") is True:
        raise RuntimeError("KNOWLEDGE_CITATION_FAKE_CITE_ALLOWED")
    if honesty.get("knowledge_release_status") != KNOWLEDGE_RELEASE_STATUS:
        raise RuntimeError("KNOWLEDGE_CITATION_RELEASE_MUST_BE_NOT_RELEASED")
    if policies.get("fake_cite_fails") is not True:
        raise RuntimeError("KNOWLEDGE_CITATION_FAKE_CITE_MUST_FAIL")
    if policies.get("tax_current_without_release_abstains") is not True:
        raise RuntimeError("KNOWLEDGE_CITATION_TAX_CURRENT_MUST_ABSTAIN")
    if policies.get("missing_evidence_no_answer") is not True:
        raise RuntimeError("KNOWLEDGE_CITATION_MISSING_EVIDENCE_MUST_NO_ANSWER")

    if not claim:
        return
    if claim.get("production_approved") is True:
        raise RuntimeError("KNOWLEDGE_CITATION_PRODUCTION_APPROVED")
    if claim.get("legal_effective_dates_proven") is True:
        raise RuntimeError("KNOWLEDGE_CITATION_LEGAL_DATES_PROVEN")
    if claim.get("claims_verified") is True:
        raise RuntimeError("KNOWLEDGE_CITATION_CLAIMS_VERIFIED")
    if claim.get("gap_p2_008_closed") is True:
        raise RuntimeError("GAP_P2_008_FALSE_CLOSED")
    if claim.get("fake_citation_allowed") is True:
        raise RuntimeError("KNOWLEDGE_CITATION_FAKE_CITE_ALLOWED")
