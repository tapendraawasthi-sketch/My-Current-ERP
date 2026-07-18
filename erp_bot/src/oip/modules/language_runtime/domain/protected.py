"""Protected-span detection — priority + longest match, linear-bounded."""

from __future__ import annotations

import re
from dataclasses import dataclass

from .taxonomy import ProtectedKind

# Bounded, non-catastrophic patterns (no nested quantifiers of unbounded width).
_URL = re.compile(
    r"https?://[A-Za-z0-9\-._~:/?#\[\]@!$&'()*+,;=%]{1,500}",
    re.IGNORECASE,
)
_EMAIL = re.compile(
    r"\b[A-Za-z0-9._%+\-]{1,64}@[A-Za-z0-9.\-]{1,255}\.[A-Za-z]{2,24}\b",
)
_EXPLICIT_PAN = re.compile(
    r"(?i)\b(?:pan|प्यान)\s*[:#\-]?\s*[A-Za-z0-9]{5,12}\b",
)
_EXPLICIT_VAT = re.compile(
    r"(?i)\b(?:vat|भ्याट)\s*(?:no|num|n\.?|नं\.?)?\s*[:#\-]?\s*[A-Za-z0-9]{5,16}\b",
)
_INVOICE = re.compile(
    r"(?i)\b(?:invoice|bill|inv|बिल)\s*(?:no|num|n\.?|नं\.?)?\s*[:#\-]?\s*[A-Za-z0-9\-]{1,24}\b",
)
_VOUCHER = re.compile(
    r"(?i)\b(?:voucher|भौचर)\s*(?:no|num|n\.?|नं\.?)?\s*[:#\-]?\s*[A-Za-z0-9\-]{1,24}\b",
)
_ACCOUNT = re.compile(
    r"(?i)\b(?:account\s*code|a/?c\s*code)\s*[:#\-]?\s*[A-Za-z0-9\-]{2,24}\b",
)
_LEGAL = re.compile(
    r"(?i)\b(?:ird|circular|section|अनुसूची)\s+[A-Za-z0-9.\-]{1,32}\b",
)
_FY = re.compile(r"(?i)\bFY\s*\d{4}\s*/\s*\d{2,4}\b")
_DATE = re.compile(
    r"\b(?:20|21)\d{2}[-/.](?:0?[1-9]|1[0-2])[-/.](?:0?[1-9]|[12]\d|3[01])\b"
    r"|\b(?:0?[1-9]|[12]\d|3[01])[-/.](?:0?[1-9]|1[0-2])[-/.](?:20|21)\d{2}\b",
)
_PERCENT = re.compile(r"\b\d{1,3}(?:[.,]\d{1,4})?\s*%")
_MONEY_CTX = re.compile(
    r"(?i)(?:Rs\.?|NPR|रु\.?|रकम|amount|paid|received|cash|bank)\s*[:#]?\s*\d{1,12}(?:[.,]\d{1,4})?"
    r"|\b\d{1,12}(?:[.,]\d{1,4})?\s*(?:Rs\.?|NPR|रु\.?)",
)
_DECIMAL = re.compile(r"\b\d{1,12}[.,]\d{1,6}\b")
_NUMBER = re.compile(r"\b\d{1,12}\b")
_PHONE = re.compile(r"(?i)\b(?:phone|mobile|call|सम्पर्क)\s*[:#]?\s*\+?\d[\d\-\s]{7,16}\d\b")
_PATH = re.compile(r"(?i)(?:[A-Za-z]:\\|/(?:tmp|home|var|Users)/|\\\\)[^\s]{1,180}")
_CODE = re.compile(r"`[^`\n]{1,200}`")
_JSON = re.compile(r"\{[^{}\n]{0,300}\}")
_HANDLE = re.compile(r"[@#][A-Za-z0-9_]{2,40}")

_PRIORITY: list[tuple[ProtectedKind, re.Pattern[str]]] = [
    (ProtectedKind.CODE_FRAGMENT, _CODE),
    (ProtectedKind.JSON_FRAGMENT, _JSON),
    (ProtectedKind.URL, _URL),
    (ProtectedKind.EMAIL, _EMAIL),
    (ProtectedKind.PAN_CANDIDATE, _EXPLICIT_PAN),
    (ProtectedKind.VAT_IDENTIFIER, _EXPLICIT_VAT),
    (ProtectedKind.INVOICE_REFERENCE, _INVOICE),
    (ProtectedKind.VOUCHER_REFERENCE, _VOUCHER),
    (ProtectedKind.ACCOUNT_CODE, _ACCOUNT),
    (ProtectedKind.LEGAL_CITATION, _LEGAL),
    (ProtectedKind.FISCAL_YEAR_LITERAL, _FY),  # before path (avoid /yy false path)
    (ProtectedKind.FILE_PATH, _PATH),
    (ProtectedKind.DATE_LITERAL, _DATE),
    (ProtectedKind.PERCENT_LITERAL, _PERCENT),
    (ProtectedKind.MONEY_LITERAL, _MONEY_CTX),
    (ProtectedKind.PHONE_CANDIDATE, _PHONE),
    (ProtectedKind.HASHTAG_OR_HANDLE, _HANDLE),
    (ProtectedKind.DECIMAL_LITERAL, _DECIMAL),
    (ProtectedKind.NUMBER_LITERAL, _NUMBER),
]


@dataclass(frozen=True)
class ProtectedHit:
    start: int
    end: int
    kind: ProtectedKind
    surface: str


def detect_protected_spans(text: str, *, max_matches: int = 200) -> list[ProtectedHit]:
    """Priority + longest; later lower-priority cannot split covered ranges."""
    covered = [False] * len(text)
    hits: list[ProtectedHit] = []

    for kind, pattern in _PRIORITY:
        if len(hits) >= max_matches:
            break
        for m in pattern.finditer(text):
            if len(hits) >= max_matches:
                break
            start, end = m.start(), m.end()
            if start >= end:
                continue
            if any(covered[i] for i in range(start, end)):
                continue
            for i in range(start, end):
                covered[i] = True
            hits.append(ProtectedHit(start=start, end=end, kind=kind, surface=text[start:end]))

    hits.sort(key=lambda h: h.start)
    return hits
