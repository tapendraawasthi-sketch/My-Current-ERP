"""
Unified vocabulary loader — Python parity with src/lib/ekhata/vocabulary/loader.ts.

Reads data/ekhata/vocabulary/_registry.json and category JSON files (single source
of truth shared with the TypeScript frontend brains).
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any, Literal

from ..config import ERP_PATH

PaymentMethod = Literal["cash", "bank", "cheque", "esewa", "khalti", "unknown"]

VOCAB_ROOT = ERP_PATH / "data" / "ekhata" / "vocabulary"
REGISTRY_PATH = VOCAB_ROOT / "_registry.json"
MASTER_PATH = VOCAB_ROOT / "master.json"

INTENT_HINT_TO_NLU: dict[str, str] = {
    "khata_cash_sale": "cash_sale",
    "khata_purchase": "cash_purchase",
    "khata_payment_in": "payment_received",
    "khata_payment_out": "payment_made",
    "khata_expense": "expense",
    "credit": "credit_sale",
    "cash": "cash_sale",
    "return": "sales_return",
}

_PAYMENT_TERM_OVERRIDES: dict[str, PaymentMethod] = {
    "khalti": "khalti",
    "khalti ma": "khalti",
    "esewa": "esewa",
    "e sewa": "esewa",
    "e-sewa": "esewa",
    "esewa ma": "esewa",
    "fonepay": "esewa",
    "fone pay": "esewa",
    "connectips": "bank",
    "connect ips": "bank",
    "cheque": "cheque",
    "check": "cheque",
    "chak": "cheque",
    "cheque bata": "cheque",
    "chak bata": "cheque",
}

_PAYMENT_STOPWORD_PARTS = frozenset(
    {"ma", "bata", "payment", "pay", "online", "digital", "wallet", "transfer", "bank"}
)


def _resolve_payment_for_term(token: str, default: PaymentMethod) -> PaymentMethod:
    if token in _PAYMENT_TERM_OVERRIDES:
        return _PAYMENT_TERM_OVERRIDES[token]
    for part in re.findall(r"[a-z0-9]+", token):
        if part in _PAYMENT_TERM_OVERRIDES:
            return _PAYMENT_TERM_OVERRIDES[part]
    return default


@dataclass(frozen=True)
class SectorMatch:
    slug: str
    sector_slug: str | None
    score: int
    display_name: dict[str, str]


def _flatten_terms(group: dict[str, Any] | None) -> list[str]:
    if not group:
        return []
    out: list[str] = []
    for key in ("en", "ne_roman", "ne_devanagari", "variants"):
        out.extend(group.get(key) or [])
    return out


@lru_cache(maxsize=1)
def _load_registry() -> dict[str, Any]:
    if not REGISTRY_PATH.exists():
        return {"version": 0, "categories": []}
    return json.loads(REGISTRY_PATH.read_text(encoding="utf-8"))


@lru_cache(maxsize=1)
def _load_categories() -> tuple[dict[str, Any], ...]:
    registry = _load_registry()
    categories: list[dict[str, Any]] = []
    for entry in registry.get("categories") or []:
        rel = entry.get("file") or ""
        path = VOCAB_ROOT / rel
        if not path.exists():
            continue
        data = json.loads(path.read_text(encoding="utf-8"))
        categories.append(data)
    return tuple(categories)


def get_vocabulary_registry() -> dict[str, Any]:
    return _load_registry()


def get_all_categories() -> tuple[dict[str, Any], ...]:
    return _load_categories()


@lru_cache(maxsize=1)
def get_merged_spelling_aliases() -> dict[str, str]:
    """All spelling variant → canonical maps from every category file."""
    out: dict[str, str] = {}
    for cat in _load_categories():
        for group in (cat.get("groups") or {}).values():
            mapping = group.get("map") or {}
            for src, dst in mapping.items():
                out[src.lower()] = dst.lower() if isinstance(dst, str) else str(dst)
    return out


@lru_cache(maxsize=1)
def get_all_business_terms() -> tuple[str, ...]:
    terms: set[str] = set()
    for cat in _load_categories():
        for group in (cat.get("groups") or {}).values():
            for term in _flatten_terms(group):
                t = term.strip().lower()
                if len(t) >= 2:
                    terms.add(t)
    return tuple(sorted(terms))


@lru_cache(maxsize=1)
def _payment_group_methods() -> dict[str, PaymentMethod]:
    """Map vocabulary group keys to default payment methods."""
    out: dict[str, PaymentMethod] = {}
    for cat in _load_categories():
        slug = cat.get("slug") or ""
        groups = cat.get("groups") or {}
        if slug == "universal-payment-modes":
            out["digital_wallets"] = "esewa"
            out["bank_cheque"] = "bank"
        if slug == "universal-transactions":
            out["cash_terms"] = "cash"
    return out


@lru_cache(maxsize=1)
def get_payment_aliases() -> dict[str, PaymentMethod]:
    """Token → payment method for clarification follow-ups and regex parse."""
    aliases: dict[str, PaymentMethod] = {
        "cash": "cash",
        "nagad": "cash",
        "nakad": "cash",
        "nagar": "cash",
        "bank": "bank",
        "transfer": "bank",
        "cheque": "cheque",
        "check": "cheque",
        "esewa": "esewa",
        "khalti": "khalti",
        "fonepay": "esewa",
        "connectips": "bank",
        "online": "esewa",
        "digital": "esewa",
        "wallet": "esewa",
        "udhaar": "unknown",
        "udhar": "unknown",
        "credit": "unknown",
    }
    group_defaults = _payment_group_methods()
    for cat in _load_categories():
        groups = cat.get("groups") or {}
        for group_key, group in groups.items():
            default = group_defaults.get(group_key)
            if not default:
                continue
            for term in _flatten_terms(group):
                token = term.strip().lower()
                if len(token) < 2:
                    continue
                aliases[token] = _resolve_payment_for_term(token, default)
                for part in re.findall(r"[a-z0-9]+", token):
                    if len(part) >= 3 and part not in _PAYMENT_STOPWORD_PARTS:
                        aliases.setdefault(part, _resolve_payment_for_term(part, default))
    return aliases


def detect_business_sector(text: str) -> SectorMatch | None:
    """Detect best-matching business sector from message text (TS parity)."""
    q = text.lower()
    best: SectorMatch | None = None

    for cat in _load_categories():
        if cat.get("businessNature") == "universal":
            continue
        score = 0
        items = (cat.get("groups") or {}).get("items")
        if items:
            for term in _flatten_terms(items):
                t = term.lower()
                if len(t) < 3:
                    continue
                if t in q:
                    score += 4 if " " in t else 2
        for tag in cat.get("tags") or []:
            tag_text = str(tag).replace("-", " ")
            if tag_text in q or str(tag) in q:
                score += 1
        if score <= 0:
            continue
        match = SectorMatch(
            slug=str(cat.get("slug") or ""),
            sector_slug=cat.get("sectorSlug"),
            score=score,
            display_name=cat.get("displayName") or {},
        )
        if best is None or score > best.score:
            best = match
    return best


def match_transaction_intent_hint(text: str) -> str | None:
    """Return vocabulary intentHint (khata_*) if transaction verbs match."""
    q = text.lower()
    for cat in _load_categories():
        for group in (cat.get("groups") or {}).values():
            hint = group.get("intentHint")
            if not hint:
                continue
            for term in _flatten_terms(group):
                t = term.lower()
                if len(t) >= 3 and t in q:
                    return str(hint)
    return None


def map_intent_hint_to_nlu(hint: str | None, payment_method: PaymentMethod = "unknown") -> str | None:
    if not hint:
        return None
    base = INTENT_HINT_TO_NLU.get(hint)
    if not base:
        return None
    if hint == "khata_cash_sale":
        return "cash_sale" if payment_method == "cash" else "credit_sale"
    if hint == "khata_purchase":
        return "cash_purchase" if payment_method == "cash" else "credit_purchase"
    return base


def detect_payment_method(text: str) -> PaymentMethod:
    """Detect payment mode from unified vocabulary terms."""
    norm = text.lower()
    aliases = get_payment_aliases()
    # Longest phrase first to prefer "fone pay" over "pay"
    for term in sorted(aliases, key=len, reverse=True):
        if len(term) < 3:
            continue
        if " " in term:
            if term in norm:
                return aliases[term]
        elif re.search(rf"\b{re.escape(term)}\b", norm):
            return aliases[term]
    return "unknown"


def mentions_business_item(text: str) -> bool:
    q = text.lower()
    return any(len(term) >= 3 and term in q for term in get_all_business_terms())


def get_sector_vocabulary(sector_slug: str) -> dict[str, Any] | None:
    for cat in _load_categories():
        if cat.get("sectorSlug") == sector_slug or cat.get("slug") == sector_slug:
            return cat
    return None


def build_nlu_vocabulary_summary(*, max_chars: int = 2200) -> str:
    """Compact vocabulary block for NLU LLM system prompt."""
    lines = [
        "UNIFIED VOCABULARY (data/ekhata/vocabulary — shared TS/Python):",
        "Payment: nagad/cash, bank/cheque/chak, esewa/khalti/fonepay/connectips/qr",
        "Sale verbs: becheko/bikri/bech/sold | Purchase: kineko/kharid/kin/bought",
        "Payment in: aayo/jama/tiryo (le/bata) | Payment out: tiryo/diye/paid",
        "Expense: kharcha/bill/talab/bhada/bijuli | Credit: udhaar/udhar/credit",
        "Return: firta/return/refund | Units: thok/bori/piece/kg/litre",
    ]

    sector = detect_business_sector(" ".join(lines))
    if sector:
        lines.append(f"Sector detection active — e.g. {sector.slug} (score-based)")

    # Sample spelling aliases for LLM awareness
    aliases = get_merged_spelling_aliases()
    samples = [f"{k}→{v}" for k, v in list(aliases.items())[:12]]
    if samples:
        lines.append("Spelling aliases: " + ", ".join(samples))

    text = "\n".join(lines)
    return text[:max_chars] if len(text) > max_chars else text


def build_master_vocabulary() -> dict[str, Any]:
    """Build master.json artifact from category files."""
    categories = _load_categories()
    return {
        "version": (_load_registry().get("version") or 1),
        "description": "Unified e-Khata vocabulary — generated from category JSON files",
        "source": "data/ekhata/vocabulary/_registry.json + categories/*.json",
        "category_count": len(categories),
        "term_count": len(get_all_business_terms()),
        "spelling_alias_count": len(get_merged_spelling_aliases()),
        "payment_alias_count": len(get_payment_aliases()),
        "spelling_aliases": get_merged_spelling_aliases(),
        "payment_aliases": get_payment_aliases(),
        "intent_hint_map": INTENT_HINT_TO_NLU,
        "categories": [
            {
                "slug": c.get("slug"),
                "sectorSlug": c.get("sectorSlug"),
                "businessNature": c.get("businessNature"),
                "tags": c.get("tags"),
            }
            for c in categories
        ],
    }


def write_master_vocabulary(path: Path | None = None) -> Path:
    target = path or MASTER_PATH
    payload = build_master_vocabulary()
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return target
