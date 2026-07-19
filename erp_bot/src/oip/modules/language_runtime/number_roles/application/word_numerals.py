"""MAI-09 word numeral expansion — saya / hajar / lakh / crore (+ small digit words)."""

from __future__ import annotations

import re

_WORD_DIGITS = {
    "zero": 0,
    "ek": 1,
    "ekai": 1,
    "dui": 2,
    "tin": 3,
    "teen": 3,
    "char": 4,
    "panch": 5,
    "chha": 6,
    "sat": 7,
    "saat": 7,
    "ath": 8,
    "nau": 9,
    "das": 10,
    "bees": 20,
    "bis": 20,
    "tis": 30,
    "chalis": 40,
    "pachas": 50,
    "saya": 100,
    "saye": 100,
}

_MULT = {
    "saya": 100,
    "saye": 100,
    "hundred": 100,
    "hajar": 1_000,
    "hajaar": 1_000,
    "thousand": 1_000,
    "k": 1_000,
    "lakh": 100_000,
    "lac": 100_000,
    "lakhs": 100_000,
    "crore": 10_000_000,
    "karod": 10_000_000,
    "करोड": 10_000_000,
    "लाख": 100_000,
    "हजार": 1_000,
}

# "5 hajar", "1.5 lakh", "2 crore", "tin hajar"
_PHRASE = re.compile(
    r"(?i)(?<!\w)(\d+(?:\.\d+)?|"
    + "|".join(re.escape(w) for w in sorted(_WORD_DIGITS, key=len, reverse=True))
    + r")\s*("
    + "|".join(re.escape(w) for w in sorted(_MULT, key=len, reverse=True))
    + r")\b"
)


def _base_value(token: str) -> float | None:
    t = token.lower().replace(",", "")
    if re.fullmatch(r"\d+(?:\.\d+)?", t):
        return float(t)
    return float(_WORD_DIGITS[t]) if t in _WORD_DIGITS else None


def expand_word_numeral_phrases(text: str) -> list[dict]:
    """Return amount-role candidates for Nepali multiplier phrases."""
    out: list[dict] = []
    for m in _PHRASE.finditer(text):
        base_tok, mult_tok = m.group(1), m.group(2).lower()
        # Avoid treating bare "saya" as both base and mult when alone
        if base_tok.lower() in _MULT and mult_tok in _MULT and base_tok.lower() == mult_tok:
            continue
        base = _base_value(base_tok)
        mult = _MULT.get(mult_tok)
        if base is None or mult is None:
            continue
        # "saya" as base digit-word without trailing mult already handled via digits map;
        # "saya hajar" is invalid — skip if base word is itself a mult except digit words
        if base_tok.lower() in _MULT and base_tok.lower() not in _WORD_DIGITS:
            continue
        value = int(base * mult) if float(base * mult).is_integer() else base * mult
        out.append(
            {
                "surface": m.group(0).strip(),
                "role": "amount",
                "normalized_value": str(value),
                "unit": "NPR",
                "raw_start": m.start(),
                "raw_end": m.end(),
                "reason_codes": ("WORD_NUMERAL_MULTIPLIER", mult_tok),
                "ambiguous": False,
            }
        )
    return out
