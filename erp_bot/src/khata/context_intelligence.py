"""Intelligent context synthesis for e-Khata.

Analyzes user input, retrieves local grammar/IFRS knowledge, and produces compact
relevant summaries — not raw section dumps. Pure Python; no external APIs.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path

from ..config import KHATA_SYNTHESIZE_CONTEXT
from ..vectorstore.ca_knowledge_store import search_ca_knowledge
from ..vectorstore.nepali_grammar_store import (
    format_grammar_context,
    get_chunks_for_sections,
    search_nepali_grammar,
)

_REPO_ROOT = Path(__file__).resolve().parent.parent.parent.parent
_GRAMMAR_INDEX = _REPO_ROOT / "data" / "ekhata" / "nepali-grammar-index.json"

_SESSION_META: dict[str, dict[str, str]] = {}

_DEVANAGARI_RE = re.compile(r"[\u0900-\u097F]")
_AMOUNT_RE = re.compile(
    r"\b(\d+(?:\.\d+)?(?:k|K|hajar|saya|lakh|crore)?|"
    r"dedh|sade|aadha|paune|saay|say)\b",
    re.I,
)
_PARTY_RE = re.compile(
    r"\b([A-Z][a-z]{2,}(?:\s+[A-Z][a-z]+)?)\s+(?:le|lai|ko|sanga|bata)\b|"
    r"\b([A-Z][a-z]{2,})\s+(?:le|lai)\b",
    re.I,
)
_FRAMEWORK_RE = re.compile(
    r"\b(ifrs|nas|conceptual\s+framework|recognition|derecognition|measurement|"
    r"faithful|relevance|comparability|materiality|going\s+concern|fair\s+value|"
    r"historical\s+cost|economic\s+resource|present\s+obligation|unit\s+of\s+account|"
    r"executory|substance|capital\s+maintenance|accrual\s+accounting|stewardship|"
    r"sampatti|dayitwo|manyata|mulyankan|biswasilo|sambandhit|nyaya\s+mulya|"
    r"paribhasha|ko\s+matlab|ko\s+paribhasha|k\s+ho)\b",
    re.I,
)
_TRANSACTION_RE = re.compile(
    r"\b(\d+|saya|hajar|lakh)\b.*\b(udhaar|salary|ssf|gratuity|vat|tds|"
    r"depreciation|bad\s*debt|loan|capital|drawings|stock|kharcha|bikri|kineko|kinyo|"
    r"tiryo|diyo|becheko|sold|purchase|bought|payment|commission|advance|return|rent|bhaada|"
    r"debit|credit|dr|cr|ledger|khata)\b|"
    r"\b(sold|bought|paid|received|tiryo|kineko|debit|credit)\b.*\d",
    re.I,
)
_NEPALI_ROMAN_RE = re.compile(
    r"\b(k\s*ho|k\s*xa|kasari|udhaar|kharcha|bikri|tiryo|diyo|liyo|kinyo|beche|"
    r"hisab|lekha|chha|hunchha|xaina|garchu|garxu|tapai|timi|paisa|saya|hajar|"
    r"lakh|malai|lai|le\s|ko\s|ma\s|bata|sanga|ni\b|ta\b|hai\b|yaar|bhai|dai|"
    r"garnu|kinnu|bechnu|tirnu|nakad|rasid|naafa|ghaata|talab|bhaada)\b",
    re.I,
)
_ENGLISH_ACCOUNTING_RE = re.compile(
    r"\b(debit|credit|journal|ledger|vat|tds|ssf|receivable|payable|expense|"
    r"revenue|asset|liability|equity|depreciation|accrual|invoice|purchase|sale|"
    r"payment|salary|gratuity|bad\s*debt|opening\s+balance|contra|write[\s-]?off)\b",
    re.I,
)

_INTENT_KEYWORDS: dict[str, list[str]] = {
    "khata_credit_sale": ["udhaar", "credit sale", "receivable", "beche", "bechyo", "becheko", "diye"],
    "khata_payment_in": ["tiryo", "tirnu", "payment received", "paid us", "aayo", "prapti"],
    "khata_cash_sale": ["cash sale", "nakad bikri", "nagad beche"],
    "khata_purchase": ["kinyo", "kineko", "kinna", "purchase", "kharid", "bought"],
    "khata_expense": ["kharcha", "expense", "bijuli", "rent", "bhaada", "petrol"],
    "khata_salary": ["salary", "talab", "payroll", "bonus"],
    "tax_vat": ["vat", "tds", "ird", "tax", "13%", "section 88", "section 107"],
    "correction_undo": ["reverse", "galat", "undo", "cancel entry", "feri", "ulto"],
    "accounting_ledger": ["debit", "credit", "dr", "cr", "ledger", "khata", "journal"],
    "digital_payment": ["esewa", "khalti", "connect ips", "bank transfer", "cheque"],
    "normalization": ["chha", "xa", "xaina", "spelling", "typo", "halkhabar"],
    "nlu_rules": ["nlu", "parse", "interpret", "ambiguous"],
    "entity_extraction": ["party", "amount", "date", "ner", "extract"],
}

_VERB_HINTS: dict[str, str] = {
    "tiryo": "Payment received — debtor paid (Dr Cash/Bank, Cr Receivable)",
    "tirnu": "Payment action — check who paid whom",
    "diyo": "Ambiguous — credit given OR payment; agent (le) decides direction",
    "diye": "Credit sale / gave on credit (udhaar)",
    "liyo": "Received / took — often payment in or purchase on credit",
    "kinyo": "Purchase — expense or inventory (Dr Purchase/Expense, Cr Cash/Payable)",
    "kineko": "Purchase completed",
    "beche": "Sale — cash or credit depending on payment words",
    "bechyo": "Sold — map to sales revenue",
    "becheko": "Sale completed",
    "udhaar": "Credit (receivable) — NOT bad debt unless write-off words present",
    "kharcha": "Expense — Dr Expense, Cr Cash/Bank/Payable",
    "bikri": "Sales revenue",
    "debit": "Increase asset/expense or decrease liability — check account named",
    "credit": "Increase liability/income or decrease asset — check account named",
    "dr": "Debit side of journal entry",
    "cr": "Credit side of journal entry",
}

_SKIP_LINE_RE = re.compile(
    r"^(━+|SECTION\s+\d+|खण्ड\s+\d+|OVERVIEW:|EXAMPLES:|Part\s+\d+|Document\s+Completion)",
    re.I,
)


@dataclass
class MessageAnalysis:
    text: str
    tokens: list[str]
    token_set: set[str]
    has_devanagari: bool
    has_nepali_roman: bool
    has_english_accounting: bool
    is_transaction: bool
    is_framework: bool
    intent_keys: list[str]
    verb_signals: list[str]
    amount_signals: list[str]
    party_hints: list[str]
    expanded_query: str = ""


def _tokenize(text: str) -> list[str]:
    return [
        t.lower()
        for t in re.findall(
            r"[\u0900-\u097F]+|[a-zA-Z]{2,}|\d+(?:\.\d+)?(?:k|hajar|saya|lakh)?",
            text,
            re.I,
        )
    ]


def _load_intent_section_map() -> dict[str, list[int]]:
    if not _GRAMMAR_INDEX.exists():
        return {}
    try:
        data = json.loads(_GRAMMAR_INDEX.read_text(encoding="utf-8"))
        return data.get("intentSectionMap", {})
    except (json.JSONDecodeError, OSError):
        return {}


def _detect_intent_keys(text: str, tokens: set[str]) -> list[str]:
    lower = text.lower()
    scored: list[tuple[int, str]] = []
    for key, keywords in _INTENT_KEYWORDS.items():
        score = sum(1 for kw in keywords if kw in lower or kw in tokens)
        if score:
            scored.append((score, key))
    scored.sort(reverse=True)
    return [k for _, k in scored[:3]]


def _session_meta(session_id: str) -> dict[str, str]:
    return _SESSION_META.setdefault(session_id, {})


def analyze_message(text: str, session_id: str = "default") -> MessageAnalysis:
    text = (text or "").strip()
    tokens = _tokenize(text)
    token_set = set(tokens)
    meta = _session_meta(session_id)

    party_hints = []
    for m in _PARTY_RE.finditer(text):
        party = m.group(1) or m.group(2)
        if party and party.lower() not in {"cash", "bank", "sales", "purchase", "expense", "vat", "tds"}:
            party_hints.append(party)

    verb_signals = [v for v in _VERB_HINTS if v in token_set or v in text.lower()]
    amount_signals = _AMOUNT_RE.findall(text)
    intent_keys = _detect_intent_keys(text, token_set)

    expand_parts = [text]
    if meta.get("last_party"):
        expand_parts.append(meta["last_party"])
    if meta.get("last_intent"):
        expand_parts.append(meta["last_intent"].replace("khata_", " "))
    if intent_keys:
        expand_parts.extend(_INTENT_KEYWORDS.get(intent_keys[0], [])[:4])

    return MessageAnalysis(
        text=text,
        tokens=tokens,
        token_set=token_set,
        has_devanagari=bool(_DEVANAGARI_RE.search(text)),
        has_nepali_roman=bool(_NEPALI_ROMAN_RE.search(text)),
        has_english_accounting=bool(_ENGLISH_ACCOUNTING_RE.search(text)),
        is_transaction=bool(_TRANSACTION_RE.search(text)),
        is_framework=bool(_FRAMEWORK_RE.search(text)),
        intent_keys=intent_keys,
        verb_signals=verb_signals,
        amount_signals=amount_signals[:3],
        party_hints=party_hints[:2],
        expanded_query=" ".join(expand_parts),
    )


def _merge_hits(primary: list[dict], extra: list[dict], k: int) -> list[dict]:
    seen: set[str] = set()
    merged: list[dict] = []
    for hit in primary + extra:
        key = hit.get("chunk_id") or f"{hit.get('section_id')}-{hit.get('source', '')}"
        if key in seen:
            continue
        seen.add(key)
        merged.append(hit)
        if len(merged) >= k:
            break
    return merged


def retrieve_grammar_hits(analysis: MessageAnalysis, k: int = 5) -> list[dict]:
    """BM25 search plus intent-mapped section boost."""
    query = analysis.expanded_query or analysis.text
    hits = search_nepali_grammar(query, k=k)

    section_map = _load_intent_section_map()
    boost_ids: list[int] = []
    for key in analysis.intent_keys:
        boost_ids.extend(section_map.get(key, []))

    if analysis.is_transaction and not boost_ids:
        boost_ids.extend(section_map.get("accounting_ledger", []))

    if analysis.has_english_accounting and 81 not in boost_ids:
        boost_ids.extend([81, 83, 102])

    if boost_ids:
        extra = get_chunks_for_sections(sorted(set(boost_ids))[:6])
        hits = _merge_hits(hits, extra, k=max(k, 5))

    return hits


def _score_line(line: str, analysis: MessageAnalysis) -> float:
    stripped = line.strip()
    if not stripped or len(stripped) < 8:
        return 0.0
    if _SKIP_LINE_RE.match(stripped):
        return 0.0

    lower = stripped.lower()
    score = 0.0

    for token in analysis.token_set:
        if len(token) >= 2 and token in lower:
            score += 2.0

    for verb in analysis.verb_signals:
        if verb in lower:
            score += 3.5

    for party in analysis.party_hints:
        if party.lower() in lower:
            score += 4.0

    if stripped.startswith("AI RULE"):
        score += 10.0
    elif stripped.startswith("RULE GROUP"):
        score += 8.0
    elif re.match(r"RULE\s+\d+\.\d+:", stripped):
        score += 7.0
    elif stripped.startswith("→"):
        score += 5.0
    elif stripped.startswith(("•", "INTENT:", "NORMALIZE:", "MAP:")):
        score += 4.0

    if analysis.amount_signals and re.search(r"\d", stripped):
        score += 2.5

    if analysis.intent_keys:
        for key in analysis.intent_keys:
            for kw in _INTENT_KEYWORDS.get(key, []):
                if kw in lower:
                    score += 1.5

    # Penalize very long narrative lines
    if len(stripped) > 220:
        score *= 0.35

    return score


def _pick_lines(body: str, analysis: MessageAnalysis, limit: int = 8) -> list[str]:
    scored: list[tuple[float, str]] = []
    for line in body.splitlines():
        s = _score_line(line, analysis)
        if s >= 3.0:
            scored.append((s, line.strip()))

    scored.sort(key=lambda x: x[0], reverse=True)

    picked: list[str] = []
    seen_norm: set[str] = set()
    for _, line in scored:
        norm = re.sub(r"\s+", " ", line.lower())[:80]
        if norm in seen_norm:
            continue
        seen_norm.add(norm)
        if len(line) > 200:
            line = line[:197] + "..."
        picked.append(line)
        if len(picked) >= limit:
            break
    return picked


def _build_interpretation_hints(analysis: MessageAnalysis) -> list[str]:
    hints: list[str] = []

    if analysis.has_devanagari:
        hints.append("Devanagari input — normalize to Roman equivalents (chha↔xa, ग↔ga).")
    if analysis.has_nepali_roman and analysis.has_english_accounting:
        hints.append("Code-switched input — parse English accounting terms with Nepali verbs.")
    elif analysis.has_english_accounting and not analysis.has_nepali_roman:
        hints.append("English accounting terms — map debit/credit/ledger to Nepali khata rules.")

    for verb in analysis.verb_signals[:3]:
        hint = _VERB_HINTS.get(verb)
        if hint:
            hints.append(f"'{verb}' → {hint}")

    if "diyo" in analysis.verb_signals or "diye" in analysis.verb_signals:
        hints.append("Agent check: `X le ... diyo` = X paid; `X lai ... diye` = credit to X.")

    if analysis.party_hints:
        hints.append(f"Probable party: {', '.join(analysis.party_hints)}.")

    if analysis.amount_signals:
        hints.append(f"Amount signal: {', '.join(analysis.amount_signals[:2])}.")

    if analysis.intent_keys:
        hints.append(f"Likely intent family: {', '.join(analysis.intent_keys[:2])}.")

    if analysis.is_transaction and not analysis.amount_signals:
        hints.append("Transaction-like message but no clear amount — ask user for rakam/number.")

    return hints[:6]


def synthesize_grammar_context(
    hits: list[dict],
    analysis: MessageAnalysis,
    max_chars: int = 2100,
) -> str:
    if not hits:
        return ""

    lines = [
        "[NEPALI NLU INTELLIGENCE — synthesized for this message]",
        "Use only the bullets below; do not recite full grammar sections.",
        "",
        "▸ Message understanding",
    ]
    lines.extend(f"  • {h}" for h in _build_interpretation_hints(analysis))

    used = sum(len(x) + 1 for x in lines)
    section_budget = max(400, (max_chars - used) // max(len(hits), 1))

    for hit in hits:
        sid = hit.get("section_id", 0)
        title = hit.get("title_en") or hit.get("title_ne") or f"Section {sid}"
        body = hit.get("text", "")

        picked = _pick_lines(body, analysis, limit=7)
        if not picked:
            continue

        block = [f"▸ Sec {sid}: {title}"]
        block.extend(f"  • {ln}" if not ln.startswith("→") else f"  {ln}" for ln in picked)

        block_text = "\n".join(block)
        if len(block_text) > section_budget:
            block_text = block_text[: section_budget - 3] + "..."

        if used + len(block_text) + 2 > max_chars:
            break

        lines.append("")
        lines.append(block_text)
        used += len(block_text) + 2

    return "\n".join(lines).strip()


def synthesize_ifrs_context(query: str, max_chars: int = 850) -> str:
    hits = search_ca_knowledge(query, k=3)
    if not hits:
        return ""

    lines = [
        "[IFRS FRAMEWORK — relevant excerpts]",
        "Cite paragraph IDs when answering; do not invent rules.",
        "",
    ]
    used = sum(len(x) + 1 for x in lines)

    for hit in hits:
        pid = hit.get("paragraph_id", "")
        section = hit.get("section", "")
        body = (hit.get("text") or "").strip()
        if not body:
            continue

        # First 2 sentences or 280 chars
        sentences = re.split(r"(?<=[.!?])\s+", body)
        snippet = " ".join(sentences[:2]).strip()
        if len(snippet) > 280:
            snippet = snippet[:277] + "..."

        label = f"Para {pid}" if pid else section
        block = f"▸ {label}: {snippet}"
        if used + len(block) + 2 > max_chars:
            break
        lines.append(block)
        used += len(block) + 2

    return "\n".join(lines).strip() if len(lines) > 3 else ""


def build_intelligent_context(
    message: str,
    session_id: str = "default",
    *,
    force_ifrs: bool | None = None,
    force_grammar: bool | None = None,
) -> str:
    """Build compact intelligent context for Ollama system prompt."""
    analysis = analyze_message(message, session_id)

    include_grammar = force_grammar
    if include_grammar is None:
        include_grammar = (
            analysis.has_devanagari
            or analysis.has_nepali_roman
            or analysis.has_english_accounting
            or analysis.is_transaction
        )

    include_ifrs = force_ifrs
    if include_ifrs is None:
        include_ifrs = analysis.is_framework

    parts: list[str] = []

    if include_grammar:
        hits = retrieve_grammar_hits(analysis, k=5)
        if KHATA_SYNTHESIZE_CONTEXT:
            grammar = synthesize_grammar_context(hits, analysis)
        else:
            grammar = format_grammar_context(hits)
        if grammar:
            parts.append(grammar)

    if include_ifrs:
        ifrs = synthesize_ifrs_context(message)
        if ifrs:
            parts.append(ifrs)

    return "\n\n".join(parts)


def update_session_from_message(session_id: str, message: str) -> None:
    """Track last party/intent hints from user text."""
    analysis = analyze_message(message, session_id)
    meta = _session_meta(session_id)
    if analysis.party_hints:
        meta["last_party"] = analysis.party_hints[0]
    if analysis.intent_keys:
        meta["last_intent"] = analysis.intent_keys[0]


def update_session_from_card(session_id: str, card: dict) -> None:
    """Track confirmed entry metadata for follow-up messages."""
    meta = _session_meta(session_id)
    intent = card.get("intent")
    party = card.get("party")
    if intent:
        meta["last_intent"] = str(intent)
    if party:
        meta["last_party"] = str(party)


def clear_session_context(session_id: str) -> None:
    _SESSION_META.pop(session_id, None)
