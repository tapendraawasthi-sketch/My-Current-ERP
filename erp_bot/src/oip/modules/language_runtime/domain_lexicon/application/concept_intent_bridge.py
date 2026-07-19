"""MAI-10 slice 2 — map domain concepts to planner intent candidates.

Evidence-gated only: never posts drafts; abstains on education cues and
conflicting sales/purchase concepts. Keyword registry remains the fallback.
"""

from __future__ import annotations

import re
from typing import Iterable

from .domain_lexicon_service import parse_domain_concepts

# Soft abstain cues — concept bridge must not steal these turns.
_EDUCATION = re.compile(
    r"(?i)\b(what is|explain|define|meaning|k ho|के हो|भनेको के)\b"
)
_APPROVAL = re.compile(r"(?i)\b(approve|approval|swikriti|manjur|स्वीकृति)\b")
_JOURNAL_EXPLICIT = re.compile(r"(?i)\bjournal\s+entry\b")

# Concept → intent when that concept is the decisive signal.
_PRIMARY: dict[str, tuple[str, float]] = {
    "CONCEPT_BALANCE": ("ledger_balance_query", 0.93),
    "CONCEPT_REPORT": ("report_generation", 0.92),
    "CONCEPT_SALES": ("sales_entry", 0.9),
    "CONCEPT_PURCHASE": ("purchase_entry", 0.9),
    "CONCEPT_EXPENSE": ("journal_entry", 0.86),
    "CONCEPT_RENT": ("journal_entry", 0.86),
    "CONCEPT_INTEREST": ("journal_entry", 0.86),
}

_VAT_CALC = re.compile(
    r"(?i)\b(calculate|compute|kati|percent|%|13)\b"
)


def map_concepts_to_intent(
    concept_ids: Iterable[str],
    *,
    message: str,
) -> tuple[str, float, tuple[str, ...]] | None:
    """Return (intent, confidence, reason_codes) or None to abstain."""
    concepts = frozenset(concept_ids)
    if not concepts:
        return None

    if _EDUCATION.search(message) or _APPROVAL.search(message):
        return None
    if _JOURNAL_EXPLICIT.search(message):
        return None

    reasons: list[str] = ["CONCEPT_INTENT_BRIDGE"]

    # Report dominates when present (e.g. "today sales report").
    if "CONCEPT_REPORT" in concepts:
        return "report_generation", 0.92, tuple(reasons + ["CONCEPT_REPORT"])

    if "CONCEPT_BALANCE" in concepts:
        return "ledger_balance_query", 0.93, tuple(reasons + ["CONCEPT_BALANCE"])

    if "CONCEPT_VAT" in concepts and _VAT_CALC.search(message):
        return "vat_calculation", 0.91, tuple(reasons + ["CONCEPT_VAT", "VAT_CALC_CUE"])

    has_sales = "CONCEPT_SALES" in concepts
    has_purchase = "CONCEPT_PURCHASE" in concepts
    if has_sales and has_purchase:
        return None  # ambiguous — keyword / clarify path

    if has_sales:
        return "sales_entry", 0.9, tuple(reasons + ["CONCEPT_SALES"])
    if has_purchase:
        return "purchase_entry", 0.9, tuple(reasons + ["CONCEPT_PURCHASE"])

    for cid in (
        "CONCEPT_EXPENSE",
        "CONCEPT_RENT",
        "CONCEPT_INTEREST",
    ):
        if cid in concepts:
            intent, conf = _PRIMARY[cid]
            return intent, conf, tuple(reasons + [cid])

    # Credit / cash / invoice / stock alone are not enough to route intent.
    return None


def resolve_intent_from_message(message: str) -> tuple[str, float, tuple[str, ...]] | None:
    """Parse concepts from raw message then map to intent candidate."""
    rows = parse_domain_concepts(message)
    concept_ids = [r["concept_id"] for r in rows]
    return map_concepts_to_intent(concept_ids, message=message)
