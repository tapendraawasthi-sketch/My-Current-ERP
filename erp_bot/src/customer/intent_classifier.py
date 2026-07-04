"""Rule-based intent classifier for Romanized Nepali trader chat."""

from __future__ import annotations

import re

from .intents import CustomerIntent
from .preprocessor import preprocess, preprocess_for_classify
from .slot_extractor import Slots, extract_party, extract_slots
from .vocabulary import EXPENSE_HINTS, SUPPLIER_HINTS

_GREETING = re.compile(
    r"^(hi|hello|hey|namaste|namaskar|help|madat|sahayata)\b", re.I
)

_REMINDER = re.compile(
    r"\b(reminder|samjhaideu|samjhaune|yaad dilau|yaad dilaune|"
    r"phone garideu|tirna vana|tirna vanne|magne|magideu)\b",
    re.I,
)

_QUERY_BALANCE_ALL = re.compile(
    r"\b(kasle kasle|kun kun|kasko kati|sabai.*baki|purano udharo.*jamma|"
    r"kasle paisa tirna baki|kul kati baki|kati kaam baki|purano udharo|"
    r"who owes|who all still owes|show.*all.*due|pending dues|"
    r"herchu\b|dekhau\b)\b",
    re.I,
)

_QUERY_BALANCE_ONE = re.compile(
    r"(\b\w+\s+ko\s+kati\s+baki\b|\bkati\s+baki\s+cha\b|\bbaki\s+kati\b|"
    r"\btirna\s+baki\b|\baunu\s+parne\b|\bdinu\s+parne\b|"
    r"how much does .+ owe|outstanding)\b",
    re.I,
)

_QUERY_DAILY = re.compile(
    r"\b(aja\s+kati|hijo\s+kati|aaja\s+kati|kati\s+kamayo|kati\s+kamai|"
    r"kati\s+bikri|kati\s+becha|total\s+bikri|kati\s+kharcha|"
    r"how much did i earn|how much sold|today'?s?\s+(sale|earning)|"
    r"mahina.*kati|season.*kati|hapta.*kati|besi\s+kamayo|"
    r"bikri\s+kati\s+vayo|kamayo\s+ki\s+kam)\b",
    re.I,
)

_QUERY_STOCK = re.compile(
    r"\b(kati\s+bacheko|bacheko\s+cha|stock\s+kati|"
    r"\b\w+\s+ko\s+stock\s+kati|khatam\s+huna|"
    r"sakiyo|sadiyo|feri\s+kinnu|running\s+low|how\s+much\s+.+\s+left|"
    r"how\s+much\s+stock)\b",
    re.I,
)

_RETURN = re.compile(r"\b(return|pharkayo|pharki aayo|farkeko|farkayo|farki)\b", re.I)
_DISCOUNT = re.compile(r"\b(discount|chhut|ghatai|kam garidiye|percent off)\b", re.I)
_OPENING = re.compile(
    r"\b(opening balance|opening entry|suru ko baki|shuru ko hisab)\b", re.I
)

# Expense: paid out (bhada, bill, talab, kharcha) — NOT credit sale "rakhe"
_EXPENSE = re.compile(
    r"\b(kharcha\s+(garya|vayo|bhayo|lagyo)|"
    r"(dokan|pasal|parlor|ghar|thau|van|truck|transport)\s+ko\s+bhada|"
    r"(bijuli|light|internet|petrol|ice)\s+(bill|ko\s+kharcha)|"
    r"(staff|mazdur)\s+ko\s+(talab|tanka|jyala|commission)|"
    r"gadi\s+ko\s+service|oven\s+repair|sewing\s+machine\s+repair)\b",
    re.I,
)

_PURCHASE = re.compile(
    r"\b(kinya|kinye|kinyo|kinna|mangaye|mangayeko|lyayeko|lyaye|order garya)\b", re.I
)
_SALE = re.compile(r"\b(becha|bechyo|beche|becera|bikri garya|bikri)\b", re.I)
_CASH = re.compile(r"\b(nagad|cash|hatai hatai|turuntai|nagadma)\b", re.I)
_CREDIT = re.compile(r"\b(udharo|udhaaro|udhaar|udharoma|khatama|khata|udharo rakhe|rakhya)\b", re.I)
_PAID_BACK = re.compile(
    r"\b(tirin|tirya|tirey|tirera|chukta|mitayo|tirnu)\b", re.I
)
_RECEIVED_CASH = re.compile(r"\b(payo|payo|liye|liyo|aayo)\b", re.I)
_EARN = re.compile(r"\b(kamayo|kamai|aamdani)\b", re.I)
_GAVE = re.compile(r"\b(diye|dieko|deko|dinu vayo)\b", re.I)


def classify(raw: str) -> CustomerIntent:
    q = preprocess_for_classify(raw)
    return classify_normalized(q, raw)


def classify_normalized(normalized: str, raw: str = "") -> CustomerIntent:
    q = normalized
    raw_lower = (raw or normalized).lower()

    if _GREETING.search(q.strip()):
        return "GENERAL"

    if _OPENING.search(q):
        return "OPENING_ENTRY"

    # ── Queries first (highest priority) ─────────────────────────────────────
    if _REMINDER.search(q):
        return "REMINDER_REQUEST"

    if _QUERY_BALANCE_ALL.search(q):
        return "QUERY_BALANCE_ALL"

    # Stock query before balance (earphone ko stock kati baki cha)
    if _QUERY_STOCK.search(q):
        return "QUERY_STOCK"

    if _QUERY_BALANCE_ONE.search(q):
        return "QUERY_BALANCE_ONE"

    if _QUERY_DAILY.search(q):
        return "QUERY_DAILY_TOTAL"

    if _RETURN.search(q):
        if any(h in q for h in SUPPLIER_HINTS) or "supplier" in raw_lower:
            return "RETURN_PURCHASE"
        return "RETURN_SALES"

    if _DISCOUNT.search(q):
        return "DISCOUNT_GIVEN"

    # Unicode Nepali credit sale
    if re.search(r"उधार|उधारो", q) and re.search(r"दिए|दियो|दिनु", q):
        return "SALE_CREDIT"

    # Payment made to supplier (before expense)
    if re.search(r"\b(dealer|supplier|distributor|kisan|factory)\s+lai\b", q) and (
        _PAID_BACK.search(q) or "advance" in q
    ):
        return "PAYMENT_MADE"

    # Bulk credit sale: "retailer lai mal pathaye"
    if re.search(r"\b\w+\s+lai\b", q) and re.search(r"\b(pathaye|pathayo|diye)\b", q):
        if _CREDIT.search(q) or "udharo" in q or "mal pathaye" in q:
            return "SALE_CREDIT"

    # Cash sale with nagad liye/payo
    if (_CASH.search(q) or re.search(r"\b(nagad|cash)\b", q)) and (
        _RECEIVED_CASH.search(q) or _GAVE.search(q) or _SALE.search(q)
    ):
        return "SALE_CASH"

    # ── Purchase (kinna/kinye — even with kharcha vayo phrasing) ───────────
    if _PURCHASE.search(q) and re.search(r"\bkinna\b", q):
        return "PURCHASE_CASH"

    if _EXPENSE.search(q) or (
        any(h in q for h in EXPENSE_HINTS)
        and (_PAID_BACK.search(q) or _GAVE.search(q))
        and not _CREDIT.search(q)
        and not _PURCHASE.search(q)
    ):
        return "EXPENSE"
    if _PAID_BACK.search(q):
        # "Sita ley 500 tirin" — customer payment
        if any(h in q for h in SUPPLIER_HINTS) or re.search(
            r"\b(dealer|supplier|distributor|factory|farm|kisan|company)\s+lai\b", q
        ):
            return "PAYMENT_MADE"
        if _PURCHASE.search(q) and not extract_party(q):
            pass  # fall through to purchase
        elif not any(h in q for h in EXPENSE_HINTS):
            return "PAYMENT_RECEIVED"

    # ── Purchase ─────────────────────────────────────────────────────────────
    if _PURCHASE.search(q):
        if _CREDIT.search(q) or "udharoma" in q or "udharo ma" in q:
            return "PURCHASE_CREDIT"
        return "PURCHASE_CASH"

    # ── Credit sale ──────────────────────────────────────────────────────────
    if _CREDIT.search(q) and (_GAVE.search(q) or "rakhe" in q or "rakhya" in q):
        return "SALE_CREDIT"

    if re.search(r"\b\w+\s+lai\b", q) and (_GAVE.search(q) or _CREDIT.search(q)):
        return "SALE_CREDIT"

    # ── Cash sale ────────────────────────────────────────────────────────────
    if (_SALE.search(q) or _EARN.search(q) or _RECEIVED_CASH.search(q)) and (
        _CASH.search(q) or _EARN.search(q) or _RECEIVED_CASH.search(q)
    ):
        if not _CREDIT.search(q):
            return "SALE_CASH"

    if _SALE.search(q) and re.search(r"\b\d+\b", q) and not _CREDIT.search(q):
        return "SALE_CASH"

    # Staff salary / expense via diye
    if _GAVE.search(q) and any(h in q for h in ("talab", "tanka", "jyala", "commission")):
        return "EXPENSE"

    # Payment made to supplier
    if re.search(r"\b(dealer|supplier|distributor|kisan)\s+lai\b", q) and (
        _PAID_BACK.search(q) or _GAVE.search(q)
    ):
        return "PAYMENT_MADE"

    return "GENERAL"


def classify_with_slots(raw: str) -> tuple[CustomerIntent, Slots, str]:
    normalized = preprocess(raw)
    intent = classify(raw)
    slots = extract_slots(normalized, raw)
    return intent, slots, normalized
