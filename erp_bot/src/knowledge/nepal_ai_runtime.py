"""
Nepal Universal AI runtime — load JSON maps for Python backend NLU parity.
"""

from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[3]
NEPAL = ROOT / "data" / "nepal-ai"

ENTRY_COMPLETION = re.compile(
    r"\b(vo|vayo|bhayo|bho|gareko|garyo|tireko|tiryo|diye|diyo|liyo|aayo|bhayeko|vayeko)\b",
    re.I,
)
LOSS_EXPENSE = re.compile(r"\b(noksan|nokshan|ghata|ghateko|ghatyo|loss|kharcha|kharcho)\b", re.I)
PURCHASE_VERBS = re.compile(
    r"\b(kineye|kineko|kinye|kinyo|kine|kiniyo|kharid|kinna|kinne|bought|purchase)\b",
    re.I,
)
QUESTION_CORE = re.compile(
    r"\b(k\s*ho|ke\s*ho|k\s*huncha|ke\s*huncha|k\s*bhanne|arth\s*k\s*ho|"
    r"what\s+is|how\s+much|define|explain|kasari|kina|kati\s*%|kati\s*cha)\b|\?\s*$",
    re.I,
)
SAFETY_PATTERNS = [
    (re.compile(r"kar\s*chori|tax\s*chori|chori\s*gar|fake\s*bill|nakali|black\s*money|bribe|ghush", re.I),
     "Yo request garna mildaina. Kanuni hisab-kitab ma matra sahayog garchhu."),
    (re.compile(r"fake\s*(invoice|bill|voucher)|jali\s*bill", re.I),
     "Nakali document ko lagi sahayog mildaina."),
]


@lru_cache(maxsize=1)
def _load_json(rel: str) -> dict[str, Any]:
    path = NEPAL / rel
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def load_typo_map() -> dict[str, str]:
    raw = _load_json("language/typo_normalize_map.json")
    return {str(k).lower(): str(v) for k, v in raw.items()}


def load_verb_map() -> dict[str, dict]:
    return _load_json("language/verb_normalize_map.json")


def expand_typos(text: str) -> str:
    typo = load_typo_map()
    if not typo:
        return text
    tokens = text.lower().split()
    return " ".join(typo.get(t, t) for t in tokens)


def is_accounting_question(text: str) -> bool:
    t = (text or "").strip()
    if not t:
        return False
    if not QUESTION_CORE.search(t):
        return False
    if re.search(r"\d", t) and ENTRY_COMPLETION.search(t):
        if not re.search(r"\b(k\s*ho|ke\s*ho|what\s+is|define|explain)\b", t, re.I):
            return False
    return True


def is_incomplete_transaction(text: str) -> bool:
    t = (text or "").strip().lower()
    if not t or re.search(r"\d", t):
        return False
    if is_accounting_question(text):
        return False
    return bool(PURCHASE_VERBS.search(t) or LOSS_EXPENSE.search(t))


def check_safety(text: str) -> str | None:
    t = (text or "").strip()
    default = "Yo request garna mildaina. Kanuni hisab-kitab ma matra sahayog garchhu."
    for pattern, reply in SAFETY_PATTERNS:
        if pattern.search(t):
            return reply
    raw = _load_json("behavior/safety_pattern_map.json")
    for pat, meta in raw.items():
        if pat.startswith("unsafe"):
            continue
        try:
            if re.search(pat, t, re.I):
                return str(meta.get("response_ne") or default)
        except re.error:
            continue
    return None


def normalize_nepali_text(text: str) -> str:
    """Light normalization — typos + common variants."""
    t = expand_typos((text or "").strip().lower())
    t = re.sub(r"[०-९]", lambda m: str(ord(m.group()) - 0x0966), t)
    t = re.sub(r"\s+", " ", t).strip()
    return t
