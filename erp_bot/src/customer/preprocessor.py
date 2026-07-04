"""Text preprocessing for customer NLU."""

from __future__ import annotations

import re

from .vocabulary import light_clean, normalize_text, strip_fillers


def preprocess(raw: str) -> str:
    """Full normalization for slot extraction."""
    text = raw.strip()
    text = re.sub(r"\s+", " ", text)
    return normalize_text(text)


def preprocess_for_classify(raw: str) -> str:
    """Light cleaning for intent classification — keeps Romanized tokens intact."""
    return light_clean(raw)


def tokenize(normalized: str) -> list[str]:
    return strip_fillers(normalized.split())
