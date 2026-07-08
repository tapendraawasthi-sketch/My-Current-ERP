"""Detect and split compound transaction messages."""

from __future__ import annotations

import re

_AMOUNT_COMMA = re.compile(r"\d{1,3}(?:,\d{2,3})+(?:\.\d+)?")
_SPLIT = re.compile(
    r"\s+(?:ra|ani|and|;|\+)\s+"
    r"|"
    r",\s+(?=[a-zA-Z\u0900-\u097F])",
    re.I,
)
_HAS_AMOUNT = re.compile(r"\d|saya|hajar|lakh|panch|das|bees", re.I)
_TX_VERB = re.compile(
    r"\b("
    r"becheko|beche|bechyo|bikri|bikyo|bikne|"
    r"kineko|kinya|kharid|kinyo|"
    r"tiryo|tireko|diye|diyeko|deko|"
    r"kharcha|kharch|expense|bill|"
    r"salary|talab|bhada|bhaada|kiraya|rent|"
    r"jama|aayo|aayeko|liyo|"
    r"payment|paid|sold|purchase|bought|"
    r"advance|deposit|withdraw|"
    r"return|firta|refund"
    r")\b",
    re.I,
)
_LEADING_FILLER = re.compile(r"^(?:aaja|aja|hijo|bholi|yo|aile)\s+", re.I)


def _protect_amount_commas(text: str) -> tuple[str, dict[str, str]]:
    placeholders: dict[str, str] = {}

    def repl(match: re.Match[str]) -> str:
        key = f"__AMT{len(placeholders)}__"
        placeholders[key] = match.group(0)
        return key

    return _AMOUNT_COMMA.sub(repl, text), placeholders


def _restore_amount_commas(text: str, placeholders: dict[str, str]) -> str:
    out = text
    for key, value in placeholders.items():
        out = out.replace(key, value)
    return out


def _part_is_transaction(part: str) -> bool:
    return bool(_HAS_AMOUNT.search(part) and (_TX_VERB.search(part) or len(part) > 14))


def split_compound_transactions(text: str) -> list[str]:
    """
    Split messages like 'aaja bikri 8500, rent 8000 tiryo' into parts.
    Returns original text if not clearly compound.
    """
    t = (text or "").strip()
    if not t or not _HAS_AMOUNT.search(t):
        return [t]

    protected, placeholders = _protect_amount_commas(t)
    parts = [p.strip() for p in _SPLIT.split(protected) if p.strip()]
    parts = [_restore_amount_commas(p, placeholders) for p in parts]
    if len(parts) < 2:
        return [t]

    valid = [p for p in parts if _part_is_transaction(p)]
    if len(valid) < 2:
        return [t]

    # Propagate leading date filler to later parts missing it (aaja bikri 8500, rent 8000)
    shared_prefix = ""
    m = _LEADING_FILLER.match(valid[0])
    if m:
        shared_prefix = m.group(0).strip()
    enriched: list[str] = []
    for part in valid:
        if shared_prefix and not _LEADING_FILLER.match(part) and not _TX_VERB.search(part[:20]):
            enriched.append(f"{shared_prefix} {part}".strip())
        else:
            enriched.append(part)
    return enriched


def is_compound_message(text: str) -> bool:
    return len(split_compound_transactions(text)) > 1


def is_payroll_with_statutory(text: str) -> bool:
    """Salary message mentioning SSF and/or TDS."""
    t = text.lower()
    return bool(re.search(r"\b(salary|talab)\b", t)) and bool(
        re.search(r"\b(ssf|tds|social\s*security|withhold|kataut|katayo)\b", t)
    )


def is_rent_with_tds(text: str) -> bool:
    t = text.lower()
    return bool(re.search(r"\b(rent|bhada|bhaada|kiraya)\b", t)) and bool(
        re.search(r"\b(tiryo|paid|diye|payment|tireko)\b", t)
    )
