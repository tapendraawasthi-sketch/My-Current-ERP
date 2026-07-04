from __future__ import annotations

import re
import unicodedata

NEPALI_DIGIT_MAP = str.maketrans("०१२३४५६७८९", "0123456789")

WORD_TO_NUMBER: dict[str, int] = {
    "ek": 1,
    "dui": 2,
    "tin": 3,
    "char": 4,
    "panch": 5,
    "chha": 6,
    "saat": 7,
    "aath": 8,
    "nau": 9,
    "das": 10,
    "bis": 20,
    "tis": 30,
    "chaalis": 40,
    "pachaas": 50,
    "saath": 60,
    "sattar": 70,
    "assi": 80,
    "nabbe": 90,
    "saya": 100,
    "hajar": 1000,
    "lakh": 100000,
}

FILLER_WORDS = {
    "le",
    "lai",
    "ma",
    "ko",
    "ki",
    "ho",
    "cha",
    "gareko",
    "garne",
    "bhayo",
}


def normalize_unicode_digits(text: str) -> str:
    return text.translate(NEPALI_DIGIT_MAP)


def strip_punctuation(text: str) -> str:
    return re.sub(r"[^\w\s.]", " ", text)


def remove_fillers(tokens: list[str]) -> list[str]:
    return [token for token in tokens if token not in FILLER_WORDS]


def normalize(text: str) -> str:
    text = unicodedata.normalize("NFKC", text)
    text = normalize_unicode_digits(text)
    text = text.lower().strip()
    text = strip_punctuation(text)
    text = re.sub(r"\s+", " ", text).strip()
    tokens = remove_fillers(text.split())
    return " ".join(tokens)


def parse_amount_words(text: str) -> int | None:
    normalized = normalize(text)
    if not normalized:
        return None

    k_match = re.search(r"(\d+(?:\.\d+)?)\s*k\b", normalized)
    if k_match:
        return int(float(k_match.group(1)) * 1000)

    digit_match = re.search(r"\b(\d+(?:\.\d+)?)\b", normalized)
    if digit_match and not re.search(r"\b(hajar|saya|lakh)\b", normalized):
        value = digit_match.group(1)
        return int(float(value))

    tokens = normalized.split()
    total = 0
    current = 0
    found = False

    for token in tokens:
        if token.isdigit():
            current = int(token)
            found = True
            continue
        if token in WORD_TO_NUMBER:
            found = True
            multiplier = WORD_TO_NUMBER[token]
            if multiplier >= 100:
                current = (current or 1) * multiplier
                total += current
                current = 0
            else:
                current += multiplier
            continue

    if current:
        total += current

    return total if found else None
