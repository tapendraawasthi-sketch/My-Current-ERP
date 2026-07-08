"""
Compound entry batch — parse, reason, and verify multiple transactions separately.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from ..reasoning.accounting_reasoner import AccountingReasoner, JournalEntry, SessionContext
from ..reasoning.journal_verifier_chain import run_journal_verifier_chain
from .engine import NLUEngine, ParsedEntry


@dataclass
class CompoundSubEntry:
    index: int
    text: str
    parsed: ParsedEntry
    journal: JournalEntry
    card: dict[str, Any]
    warnings: list[str] = field(default_factory=list)


@dataclass
class CompoundBatchResult:
    ok: bool
    sub_entries: list[CompoundSubEntry] = field(default_factory=list)
    error_message: str | None = None
    failed_part: str | None = None


def build_compound_batch(
    parts: list[str],
    *,
    nlu: NLUEngine,
    reasoner: AccountingReasoner,
    session_context: SessionContext,
    verify_ctx: dict[str, Any],
    sector_slug: str | None = None,
    original_narration: str = "",
) -> CompoundBatchResult:
    """Build verified sub-entries — one journal per compound part."""
    from .knowledge_enrich import enrich_parsed_entry

    sub_entries: list[CompoundSubEntry] = []
    for i, part in enumerate(parts, start=1):
        parsed = nlu.parse(part, {
            "session_id": session_context.session_id,
            "recent_parties": session_context.recent_parties,
            "last_intent": session_context.last_intent,
            "business_sector": session_context.business_sector,
            "business_sector_slug": sector_slug,
        })
        parsed = enrich_parsed_entry(
            parsed,
            part,
            sector_profile=sector_slug,
            session_sector=session_context.business_sector,
        )

        if parsed.skip_posting:
            return CompoundBatchResult(
                ok=False,
                failed_part=part,
                error_message=parsed.clarification_question
                or "Yo bhag ma entry post garna mildaina — detail clear garnus.",
            )
        if parsed.needs_clarification or not parsed.amount:
            return CompoundBatchResult(
                ok=False,
                failed_part=part,
                error_message=(
                    f"Compound entry ko bhag {i} bujhiyena: «{part}». "
                    "Pratyek line ma amount ra transaction type clear lekhnus."
                ),
            )

        try:
            journal = reasoner.reason_entry(parsed, session_context)
        except ValueError as exc:
            return CompoundBatchResult(ok=False, failed_part=part, error_message=str(exc))

        chain = run_journal_verifier_chain(journal, parsed, verify_ctx, use_llm=False)
        if chain.blocked:
            err = "; ".join(chain.errors[:2])
            return CompoundBatchResult(
                ok=False,
                failed_part=part,
                error_message=f"Bhag {i} verify fail: {err}",
            )

        narration = part if part != original_narration else original_narration
        card = chain.entry.to_khata_card(narration)
        card["compound_index"] = i
        card["compound_part"] = part
        sub_entries.append(
            CompoundSubEntry(
                index=i,
                text=part,
                parsed=parsed,
                journal=chain.entry,
                card=card,
                warnings=list(chain.warnings),
            )
        )

    return CompoundBatchResult(ok=True, sub_entries=sub_entries)


def build_batch_card(sub_entries: list[CompoundSubEntry], original: str) -> dict[str, Any]:
    """Merged batch card for UI — separate sub-cards plus combined lines."""
    all_lines: list[dict[str, Any]] = []
    for sub in sub_entries:
        for line in sub.card.get("journalLines") or []:
            tagged = dict(line)
            tagged["compoundIndex"] = sub.index
            tagged["compoundPart"] = sub.text
            all_lines.append(tagged)

    total = sum(float(s.journal.amount or 0) for s in sub_entries)
    return {
        "compound": True,
        "compoundCount": len(sub_entries),
        "raw_text": original,
        "amount": int(round(total)),
        "intent": "compound_batch",
        "journalLines": all_lines,
        "parts": [
            {
                "index": s.index,
                "text": s.text,
                "intent": s.journal.intent,
                "amount": int(round(s.journal.amount or 0)),
                "card": s.card,
                "warnings": s.warnings,
            }
            for s in sub_entries
        ],
    }


def format_batch_confirmation(sub_entries: list[CompoundSubEntry], *, language: str = "mixed") -> str:
    lines: list[str] = []
    header = (
        f"📎 **{len(sub_entries)} alag transaction** — pratyek verify bhayo. Confirm garnus:"
        if language != "english"
        else f"📎 **{len(sub_entries)} separate transactions** — each verified. Please confirm:"
    )
    lines.append(header)
    for sub in sub_entries:
        amt = int(round(sub.journal.amount or 0))
        lines.append(
            f"\n**{sub.index}.** {sub.text}\n"
            f"   → {sub.journal.intent} | Rs {amt:,}"
        )
        for line in sub.journal.lines:
            side = "Dr" if line.debit else "Cr"
            val = line.debit or line.credit
            name = line.name or line.account
            lines.append(f"   {side} {name} {val:,.0f}")
    return "\n".join(lines)
