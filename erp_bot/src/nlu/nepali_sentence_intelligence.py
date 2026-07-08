"""Nepali sentence intelligence — OCR repair, clause context, meaning synthesis."""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field
from typing import Literal

CORRUPTION_RE = re.compile(
    r"[\uFFFD\uFFFE\uFFFF\u25A1\u25A0\u25AB\u25AA\u25FB\u25FC\u2610\u2611\u2612"
    r"□▯▢■◻◼⬜⬛\uE000-\uF8FF]"
)
DEVANAGARI_RE = re.compile(r"[\u0900-\u097F]")

DOMAIN_LEXICON = [
    "नियमवाली", "ऐन", "दफा", "नियम", "संशोधन", "प्रारम्भ", "संक्षिप्त", "नाम",
    "राजपत्र", "मिति", "प्रकाशित", "सरकारी", "आयकर", "कर", "भ्याट", "उद्योग",
    "पेट्रोलियम", "उधार", "बिक्री", "खरिद", "भुक्तानी", "सम्पत्ति", "दायित्व",
    "पुँजी", "नाफा", "तलब", "भाडा", "ब्याज", "ऋण", "नगद", "बैंक",
]

CONTEXT_REPAIRS: list[tuple[re.Pattern[str], str]] = [
    (
        re.compile(
            r"(पेट्रोलियम\s+उद्योग\s*\(\s*आयकर\s*\))\s*[^\u0900-\u097F\u0964।,]{0,12}"
            r"[\u0900-\u097F]{0,12}\s*[,，]\s*(२०\d{2})"
        ),
        r"\1 नियमवाली, \2",
    ),
    (
        re.compile(
            r"(नेपाल)\s+(?:[^\u0900-\u097F\u0964।]*[\u0900-\u097F]{0,4})?पत्र(मा\s+प्रकाशित)"
        ),
        r"\1 राजपत्र\2",
    ),
    (
        re.compile(
            r"(प्रकाशित)\s+(?:[^\u0900-\u097F\u0964।]*[\u0900-\u097F]{0,4})?ति\s*[:：]"
        ),
        r"\1 मिति :",
    ),
    (
        re.compile(r"(संक्षिप्त)\s+[^\u0900-\u097F\u0964।]{0,6}[\u0900-\u097F]{0,8}\s+(र\s+प्रारम्भ)"),
        r"\1 नाम \2",
    ),
]

PostpositionRole = Literal["agent", "recipient", "source", "location", "possessive", "purpose"]
DomainHint = Literal["legal", "accounting", "transaction", "general"]


def _consonant_skeleton(word: str) -> str:
    word = re.sub(r"[\u093E-\u094F\u0962\u0963\u094D\u0903\u0902]", "", word)
    return re.sub(r"[^\u0900-\u097F]", "", word)


def _levenshtein(a: str, b: str) -> int:
    if not a:
        return len(b)
    if not b:
        return len(a)
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        curr = [i]
        for j, cb in enumerate(b, 1):
            curr.append(min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = curr
    return prev[-1]


def corruption_score(text: str) -> float:
    matches = CORRUPTION_RE.findall(text)
    if not matches:
        return 0.0
    return min(1.0, len(matches) / max(len(text) / 20, 1))


def repair_corrupted_devanagari(text: str) -> str:
    if not text or not text.strip():
        return ""
    out = unicodedata.normalize("NFKC", text.strip())
    out = CORRUPTION_RE.sub("", out)
    for pattern, repl in CONTEXT_REPAIRS:
        out = pattern.sub(repl, out)

    parts = re.split(r"(\s+|[।.،,;:!?]+)", out)
    repaired: list[str] = []
    for part in parts:
        if not DEVANAGARI_RE.search(part) or len(part.strip()) < 3:
            repaired.append(part)
            continue
        if re.fullmatch(r"[२०-९।.\-/]+", part.strip()):
            repaired.append(part)
            continue
        skel = _consonant_skeleton(CORRUPTION_RE.sub("", part))
        best, best_dist = part, 999
        for lex in DOMAIN_LEXICON:
            lex_skel = _consonant_skeleton(lex)
            if not lex_skel:
                continue
            dist = _levenshtein(skel, lex_skel)
            threshold = max(2, int(len(lex_skel) * 0.45))
            if dist <= threshold and dist < best_dist:
                best_dist = dist
                best = lex
        repaired.append(best if best_dist < 999 else part)
    out = "".join(repaired)
    return re.sub(r"\s+", " ", out).strip()


def segment_clauses(text: str) -> list[str]:
    normalized = re.sub(r"\s+", " ", (text or "").strip())
    if not normalized:
        return []
    raw = re.split(
        r"(?<=[।.;])\s+|(?:\s+)(?:ra|र|tara|तर|bhane|भने|ki|कि|so|therefore|ani|अनि)\s+",
        normalized,
        flags=re.I,
    )
    return [c.strip() for c in raw if c.strip() and len(c.strip()) >= 3]


@dataclass
class ClauseAnalysis:
    text: str
    agent: str | None = None
    recipient: str | None = None
    source: str | None = None
    verb: str | None = None
    object: str | None = None
    postposition_roles: list[tuple[str, PostpositionRole]] = field(default_factory=list)
    is_question: bool = False
    is_negated: bool = False
    domain_hint: DomainHint = "general"


@dataclass
class SentenceMeaning:
    original_text: str
    repaired_text: str
    corruption_score: float
    clauses: list[ClauseAnalysis]
    primary_intent: str | None
    summary_nepali: str
    summary_english: str


_QUESTION_RE = re.compile(
    r"\b(k\s*ho|ke\s*ho|kasari|kina|kati|what|how|why|when|where|who|\?|के\s*हो)\b",
    re.I,
)
_NEGATION_RE = re.compile(
    r"\b(xaina|chaina|chhaina|bhayena|hudaina|hoina|not|never|no)\b",
    re.I,
)


def analyze_clause(clause: str) -> ClauseAnalysis:
    soft = re.sub(r"[^\w\s\u0900-\u097F.]", " ", clause)
    soft = re.sub(r"\s+", " ", soft).strip()
    roles: list[tuple[str, PostpositionRole]] = []
    agent = recipient = source = None

    for pattern, role in [
        (r"([^\s]+(?:\s+[^\s]+)?)\s+(?:le|ले)\b", "agent"),
        (r"([^\s]+(?:\s+[^\s]+)?)\s+(?:lai|लाई)\b", "recipient"),
        (r"([^\s]+(?:\s+[^\s]+)?)\s+(?:bata|बाट)\b", "source"),
    ]:
        for m in re.finditer(pattern, soft, re.I):
            phrase = (m.group(1) or "").strip()
            if phrase:
                roles.append((phrase, role))
                if role == "agent" and not agent:
                    agent = phrase
                elif role == "recipient" and not recipient:
                    recipient = phrase
                elif role == "source" and not source:
                    source = phrase

    if re.search(r"\bmaile\b", soft, re.I):
        agent = "Self"

    verb_m = re.search(
        r"\b(tiryo|tireko|kinyo|kineko|becheko|diye|aayo|kharcha|gareko|प्रकाशित)\b",
        soft,
        re.I,
    )
    verb = verb_m.group(1).lower() if verb_m else None

    domain: DomainHint = "general"
    if re.search(r"नियमवाली|ऐन|दफा|राजपत्र|संशोधन", soft):
        domain = "legal"
    elif re.search(r"\d+|tiryo|kinyo|becheko|udhaar|nagad", soft, re.I):
        domain = "transaction"
    elif re.search(r"आयकर|भ्याट|कर|खाता|उधार|बिक्री", soft):
        domain = "accounting"

    return ClauseAnalysis(
        text=clause,
        agent=agent,
        recipient=recipient,
        source=source,
        verb=verb,
        postposition_roles=roles,
        is_question=bool(_QUESTION_RE.search(clause)),
        is_negated=bool(_NEGATION_RE.search(clause)),
        domain_hint=domain,
    )


def analyze_sentence_meaning(raw_text: str) -> SentenceMeaning:
    original = (raw_text or "").strip()
    has_dev = bool(DEVANAGARI_RE.search(original))
    has_corr = bool(CORRUPTION_RE.search(original))
    repaired = (
        repair_corrupted_devanagari(original)
        if has_dev and (has_corr or corruption_score(original) > 0)
        else original
    )
    work = repaired or original
    clauses = [analyze_clause(c) for c in segment_clauses(work)]

    summary_parts = []
    en_parts = []
    if clauses:
        main = clauses[0]
        if main.domain_hint == "legal":
            summary_parts.append("कानूनी/नियामक पाठ")
            en_parts.append("Legal/regulatory text")
        if main.agent:
            summary_parts.append(f"कर्ता: {main.agent}")
            en_parts.append(f"Agent: {main.agent}")
        if main.recipient:
            summary_parts.append(f"प्राप्तकर्ता: {main.recipient}")
            en_parts.append(f"Recipient: {main.recipient}")

    primary = None
    for c in clauses:
        if c.is_question:
            primary = "question"
            break
        if c.domain_hint == "legal":
            primary = "legal_reference"
            break
        if c.recipient and re.search(r"diye|becheko|udhaar", c.text, re.I):
            primary = "credit_sale"
            break
        if c.agent and re.search(r"tiryo|aayo", c.text, re.I):
            primary = "payment_received"
            break

    return SentenceMeaning(
        original_text=original,
        repaired_text=work,
        corruption_score=corruption_score(original),
        clauses=clauses,
        primary_intent=primary,
        summary_nepali=" · ".join(summary_parts) or work[:100],
        summary_english=" · ".join(en_parts) or work[:100],
    )


def synthesize_sentence_context(message: str, max_chars: int = 900) -> str:
    analysis = analyze_sentence_meaning(message)
    if not analysis.clauses and analysis.corruption_score == 0:
        return ""
    lines = [
        "[NEPALI SENTENCE CONTEXT]",
        "Interpret meaning from clause structure and postpositions — not corrupted glyphs.",
    ]
    if analysis.corruption_score > 0:
        lines.append(f"OCR repair applied (score: {analysis.corruption_score:.2f})")
        if analysis.repaired_text != analysis.original_text:
            lines.append(f"Repaired: {analysis.repaired_text[:200]}")
    if analysis.primary_intent:
        lines.append(f"Primary intent signal: {analysis.primary_intent}")
    for clause in analysis.clauses[:3]:
        hints = []
        if clause.agent:
            hints.append(f"agent(le)={clause.agent}")
        if clause.recipient:
            hints.append(f"recipient(lai)={clause.recipient}")
        if clause.verb:
            hints.append(f"verb={clause.verb}")
        if hints:
            lines.append(f"Clause: {clause.text[:80]} → {', '.join(hints)}")
    lines.append(f"Meaning: {analysis.summary_english}")
    out = "\n".join(lines).strip()
    return out if len(out) <= max_chars else out[: max_chars - 3] + "..."
