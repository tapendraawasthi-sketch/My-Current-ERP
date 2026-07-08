"""Unified text normalization for all NLU / reasoning paths."""

from __future__ import annotations

import re
import unicodedata

from ..falcon_trader.normalizer import normalize as _base_normalize, parse_amount_words

# Hardcoded overrides — take precedence over vocabulary JSON maps
_SPELLING_VARIANTS: dict[str, str] = {
    "udhaar": "udhar",
    "udhaaro": "udhar",
    "udharo": "udhar",
    "nagad": "cash",
    "nagar": "cash",
    "nakad": "cash",
    "becheko": "becheko",
    "bechyo": "becheko",
    "becha": "becheko",
    "kinyo": "kineko",
    "kinya": "kineko",
    "tireko": "tiryo",
    "tira": "tiryo",
    "diyeko": "diye",
    "deko": "diye",
    "liye": "liyo",
    "liya": "liyo",
    "chha": "cha",
    "chh": "cha",
    "xa": "cha",
    "xaina": "chaina",
    "hunchha": "huncha",
    "hunxa": "huncha",
    "gareko": "gareko",
    "garyo": "gareko",
    "bhada": "bhaada",
    "bhadaa": "bhaada",
    "talab": "salary",
    "kharch": "kharcha",
    "bikri": "bikri",
    "kharid": "kharid",
    "aaja": "aja",
    "hijo": "hijo",
    "fonepay": "fonepay",
    "connectips": "connectips",
    "esewa": "esewa",
    "khalti": "khalti",
}

_vocab_aliases_loaded = False


def _merged_spelling_variants() -> dict[str, str]:
    global _vocab_aliases_loaded
    merged = dict(_SPELLING_VARIANTS)
    if not _vocab_aliases_loaded:
        try:
            from ..knowledge.vocabulary_loader import get_merged_spelling_aliases

            for src, dst in get_merged_spelling_aliases().items():
                merged.setdefault(src, dst)
        except Exception:
            pass
        _vocab_aliases_loaded = True
    return merged

_DEVANAGARI_DIGIT = str.maketrans("०१२३४५६७८९", "0123456789")


def normalize_accounting_text(text: str) -> str:
    """Normalize Unicode, digits, spacing, and common Roman Nepali variants."""
    if not text:
        return ""
    t = unicodedata.normalize("NFKC", text.strip())
    t = t.translate(_DEVANAGARI_DIGIT)
    t = re.sub(r"\s+", " ", t)
    # Token-level variant map (preserve Devanagari tokens)
    tokens = re.findall(r"[\u0900-\u097F]+|[a-zA-Z0-9]+", t, re.I)
    out: list[str] = []
    for tok in tokens:
        low = tok.lower()
        if re.search(r"[\u0900-\u097F]", tok):
            out.append(tok)
        else:
            out.append(_merged_spelling_variants().get(low, low))
    return " ".join(out)


def normalize_for_matching(text: str) -> str:
    """Lowercase normalized text for regex / pattern matching."""
    return _base_normalize(normalize_accounting_text(text))


def normalize_for_wsd(text: str) -> str:
    """Normalize for grammatical WSD — keeps postpositions le/lai/bata."""
    t = normalize_accounting_text(text).lower()
    t = re.sub(r"[^\w\s\u0900-\u097F.]", " ", t)
    return re.sub(r"\s+", " ", t).strip()


def extract_amount(text: str) -> float | None:
    """Best-effort amount from mixed Nepali/English text."""
    raw = normalize_accounting_text(text)
    m = re.search(r"(?:rs\.?|npr|रु\.?|₹)\s*([\d,]+(?:\.\d+)?)", raw, re.I)
    if m:
        return float(m.group(1).replace(",", ""))
    m = re.search(r"\b([\d,]+(?:\.\d+)?)\b", raw)
    if m:
        v = float(m.group(1).replace(",", ""))
        if v > 0:
            return v
    word = parse_amount_words(raw)
    return float(word) if word and word > 0 else None
