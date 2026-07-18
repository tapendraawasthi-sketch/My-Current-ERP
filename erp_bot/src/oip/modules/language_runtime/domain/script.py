"""Unicode script classification (std unicodedata / ranges)."""

from __future__ import annotations

import unicodedata

from .taxonomy import ScriptCategory

# Devanagari block + digits
_DEV_START, _DEV_END = 0x0900, 0x097F
_DEV_DIGIT_START, _DEV_DIGIT_END = 0x0966, 0x096F

# Bidirectional / zero-width / invisible
_BIDI = frozenset(
    {
        "\u202a",
        "\u202b",
        "\u202c",
        "\u202d",
        "\u202e",
        "\u2066",
        "\u2067",
        "\u2068",
        "\u2069",
    }
)
_ZERO_WIDTH = frozenset({"\u200b", "\u200c", "\u200d", "\ufeff", "\u2060"})
_INVISIBLE_SEP = frozenset({"\u2063", "\u2064", "\u00ad"})


def classify_char_script(ch: str) -> ScriptCategory:
    if not ch:
        return ScriptCategory.UNKNOWN
    cp = ord(ch)
    if ch.isspace():
        return ScriptCategory.WHITESPACE
    if "0" <= ch <= "9":
        return ScriptCategory.ASCII_DIGIT
    if _DEV_DIGIT_START <= cp <= _DEV_DIGIT_END:
        return ScriptCategory.DEVANAGARI_DIGIT
    if _DEV_START <= cp <= _DEV_END:
        return ScriptCategory.DEVANAGARI
    if ("a" <= ch <= "z") or ("A" <= ch <= "Z"):
        return ScriptCategory.LATIN
    # Latin-1 / Latin Extended letters
    cat = unicodedata.category(ch)
    name = unicodedata.name(ch, "")
    if cat.startswith("L") and "LATIN" in name:
        return ScriptCategory.LATIN
    if cat.startswith("L") and "DEVANAGARI" in name:
        return ScriptCategory.DEVANAGARI
    if cat in {"Cc", "Cf"} or ch in _BIDI or ch in _ZERO_WIDTH:
        return ScriptCategory.CONTROL
    if cat.startswith("P"):
        return ScriptCategory.COMMON_PUNCTUATION
    if "EMOJI" in name or cat == "So" and cp >= 0x1F300:
        return ScriptCategory.EMOJI
    if cat.startswith("S") or cat.startswith("M"):
        # Marks attached to Devanagari are handled in token scripts
        if "DEVANAGARI" in name:
            return ScriptCategory.DEVANAGARI
        return ScriptCategory.SYMBOL
    return ScriptCategory.UNKNOWN


def detect_quality_flags(text: str) -> list[str]:
    flags: list[str] = []
    if any(ch in _BIDI for ch in text):
        flags.append("BIDI_CONTROL_PRESENT")
    if any(ch in _ZERO_WIDTH for ch in text):
        flags.append("ZERO_WIDTH_PRESENT")
    if any(ch in _INVISIBLE_SEP for ch in text):
        flags.append("INVISIBLE_SEPARATOR_PRESENT")
    if any(classify_char_script(ch) is ScriptCategory.CONTROL for ch in text):
        if "CONTROL_CHARACTER_PRESENT" not in flags:
            flags.append("CONTROL_CHARACTER_PRESENT")
    if "\u00a0" in text or "\u2007" in text or "\u202f" in text:
        flags.append("UNUSUAL_WHITESPACE")
    if len(text) > 10000:
        flags.append("EXCESSIVE_LENGTH")
    # Excessive combining marks
    combining = 0
    max_run = 0
    for ch in text:
        if unicodedata.combining(ch):
            combining += 1
            max_run = max(max_run, combining)
        else:
            combining = 0
    if max_run >= 8:
        flags.append("EXCESSIVE_COMBINING_MARKS")
    # Excessive repetition
    if len(text) >= 40:
        for size in (1, 2, 3):
            for i in range(0, min(20, len(text) - size * 12)):
                unit = text[i : i + size]
                if unit and text[i : i + size * 12] == unit * 12:
                    flags.append("EXCESSIVE_REPETITION")
                    break
            if "EXCESSIVE_REPETITION" in flags:
                break
    return flags
