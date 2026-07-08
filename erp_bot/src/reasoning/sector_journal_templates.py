"""
Sector journal templates — build balanced Dr/Cr lines from training debit/credit accounts.

Supports multi-line patterns: service+COGS, split payment, advance, partial purchase,
trade-in, inventory exchange, VAT input/output.
"""

from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path
from typing import Any, Literal

from ..config import ERP_PATH
from ..knowledge.nepal_accounting_kb import CHART_OF_ACCOUNTS, vat_split
from ..nlu.engine import ParsedEntry, PaymentMethod

BOT_DATA = Path(__file__).resolve().parent.parent.parent / "data"
TEMPLATE_PATH = BOT_DATA / "sector_journal_templates.json"
SECTOR_NLU_GLOB = "data/ekhata/knowledge/general/sector/*/nepal-sector-nlu.jsonl"

_DEBIT_LINE = re.compile(r"^Debit:\s*(.+)$", re.M | re.I)
_CREDIT_LINE = re.compile(r"^Credit:\s*(.+)$", re.M | re.I)
_WILDCARD_RE = re.compile(r"unspecified|unknown|n/a|not_applicable|if ", re.I)

TemplatePattern = Literal[
    "simple",
    "vat_output_sale",
    "vat_input_purchase",
    "service_cogs",
    "split_payment_sale",
    "partial_purchase_payment",
    "advance_payment",
    "trade_in_sale",
    "inventory_exchange",
]

DebitRole = Literal[
    "cash",
    "bank",
    "receivable",
    "payable",
    "advance",
    "inventory",
    "vat_in",
    "purchase",
    "expense",
    "other",
]
CreditRole = Literal[
    "vat_out",
    "vat_in",
    "cogs",
    "revenue",
    "payable",
    "inventory",
    "advance_liab",
    "other",
]

# Normalized account label → KH chart code
_ACCOUNT_CODE_MAP: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"\bcash\b", re.I), "KH-CASH"),
    (re.compile(r"\bbank\b|fonepay|khalti|connectips|cheque|chak\b|esewa", re.I), "KH-BANK"),
    (re.compile(r"receivable|debtor|asuli", re.I), "KH-DEBT"),
    (re.compile(r"payable|creditor|diney", re.I), "KH-CRED"),
    (re.compile(r"input\s*vat", re.I), "KH-VAT-IN"),
    (re.compile(r"output\s*vat|vat\s*payable|vat\s*output", re.I), "KH-VAT-OUT"),
    (re.compile(r"inventory|cogs|stock|spare\s*part|components", re.I), "KH-STOCK"),
    (re.compile(r"\bsales\b|revenue|income|repair\s*service|service\s*income|upgrade", re.I), "KH-SALE"),
    (re.compile(r"\bpurchase\b", re.I), "KH-PUR"),
    (re.compile(r"rent\s*expense|\bbhada\b|\bkiraya\b", re.I), "KH-RENT"),
    (re.compile(r"salary|talab", re.I), "KH-SAL"),
    (re.compile(r"staff\s*advance|employee\s*advance", re.I), "KH-EMP-ADV"),
    (re.compile(r"customer\s*advance", re.I), "KH-CUST-ADV"),
    (re.compile(r"advance\s*to\s*supplier|supplier\s*advance", re.I), "KH-PREPAID"),
    (re.compile(r"expense|goodwill|marketing|duty", re.I), "KH-EXP"),
    (re.compile(r"sales\s*return|return", re.I), "KH-SRET"),
]


def parse_account_list(raw: str) -> list[str]:
    """Split 'Cash, Bank' or 'Sales - X, Output VAT' into account labels."""
    if not raw:
        return []
    parts = re.split(r",(?![^()]*\))", raw)
    out: list[str] = []
    for part in parts:
        label = part.strip()
        if not label:
            continue
        if label.lower() in {"none", "n/a", "unknown", "not_applicable"}:
            continue
        out.append(label)
    return out


def extract_accounts_from_content(content: str) -> tuple[list[str], list[str]]:
    debits: list[str] = []
    credits: list[str] = []
    m = _DEBIT_LINE.search(content or "")
    if m:
        debits = parse_account_list(m.group(1))
    m = _CREDIT_LINE.search(content or "")
    if m:
        credits = parse_account_list(m.group(1))
    return debits, credits


def extract_accounts_from_chunk(chunk: Any) -> tuple[list[str], list[str]]:
    content = getattr(chunk, "content", None) or ""
    debits, credits = extract_accounts_from_content(content)
    meta = getattr(chunk, "metadata", None) or {}
    if not debits and meta.get("debit_accounts"):
        debits = [str(x) for x in meta["debit_accounts"]]
    if not credits and meta.get("credit_accounts"):
        credits = [str(x) for x in meta["credit_accounts"]]
    return debits, credits


def _pick_payment_option(options: list[str], payment_method: PaymentMethod) -> str:
    low = [o.lower() for o in options]
    if payment_method == "cash":
        for i, o in enumerate(low):
            if "cash" in o or "nagad" in o:
                return options[i]
    if payment_method in ("bank", "cheque", "esewa", "khalti"):
        for i, o in enumerate(low):
            if any(k in o for k in ("bank", "cheque", "chak", "khalti", "esewa", "fonepay")):
                return options[i]
    if payment_method == "unknown":
        for i, o in enumerate(low):
            if "receivable" in o or "payable" in o:
                return options[i]
    return options[0]


def resolve_account_label(label: str, payment_method: PaymentMethod = "unknown") -> str | None:
    """Resolve slash alternatives and wildcards to a single account label."""
    text = (label or "").strip()
    if not text or text.lower() in {"none", "unknown", "n/a"}:
        return None
    if _WILDCARD_RE.search(text) and "/" not in text:
        return None
    if "/" in text and not text.lower().startswith("sales -"):
        options = [o.strip() for o in text.split("/") if o.strip()]
        if options:
            return _pick_payment_option(options, payment_method)
    if "(" in text:
        text = re.sub(r"\s*\([^)]*\)", "", text).strip()
    return text or None


def map_account_to_code(label: str) -> tuple[str, str]:
    """Return (KH-code, display name)."""
    for pattern, code in _ACCOUNT_CODE_MAP:
        if pattern.search(label):
            name = CHART_OF_ACCOUNTS.get(code, {}).get("name", label)
            return code, name
    low = label.lower()
    if "sales" in low or "income" in low or "revenue" in low:
        return "KH-SALE", label
    if "purchase" in low:
        return "KH-PUR", label
    if "expense" in low:
        return "KH-EXP", label
    if "inventory" in low:
        return "KH-STOCK", label
    return "KH-EXP", label


def _classify_debit(label: str) -> DebitRole:
    low = label.lower()
    if "input" in low and "vat" in low:
        return "vat_in"
    if "advance" in low:
        return "advance"
    if "receivable" in low or "debtor" in low:
        return "receivable"
    if "payable" in low:
        return "payable"
    if "inventory" in low or "stock" in low or "cogs" in low:
        return "inventory"
    if "purchase" in low:
        return "purchase"
    if re.search(r"\bcash\b", low):
        return "cash"
    if any(k in low for k in ("bank", "cheque", "esewa", "khalti", "fonepay", "chak")):
        return "bank"
    if "expense" in low or "duty" in low:
        return "expense"
    return "other"


def _classify_credit(label: str) -> CreditRole:
    low = label.lower()
    if "output" in low and "vat" in low:
        return "vat_out"
    if "vat payable" in low or (re.search(r"\bvat\b", low) and "input" not in low):
        return "vat_out"
    if "input" in low and "vat" in low:
        return "vat_in"
    if "cogs" in low:
        return "cogs"
    if "inventory" in low or "stock" in low:
        return "inventory"
    if any(k in low for k in ("sales", "income", "revenue", "service", "upgrade")):
        return "revenue"
    if "payable" in low or "creditor" in low:
        return "payable"
    if "advance" in low:
        return "advance_liab"
    if "inventory" in low:
        return "inventory"
    return "other"


def _resolve_accounts(
    debit_accounts: list[str],
    credit_accounts: list[str],
    payment_method: PaymentMethod,
) -> tuple[list[str], list[str]]:
    debits = [
        resolve_account_label(d, payment_method)
        for d in debit_accounts
        if resolve_account_label(d, payment_method)
    ]
    credits = [
        resolve_account_label(c, payment_method)
        for c in credit_accounts
        if resolve_account_label(c, payment_method)
    ]
    return debits, credits


def detect_template_pattern(
    debits: list[str],
    credits: list[str],
) -> TemplatePattern:
    d_roles = [_classify_debit(d) for d in debits]
    c_roles = [_classify_credit(c) for c in credits]

    if (
        d_roles.count("inventory") >= 1
        and c_roles.count("inventory") >= 1
        and len(debits) == 1
        and len(credits) == 1
    ):
        return "inventory_exchange"

    if (
        d_roles.count("inventory") >= 1
        and any(r in d_roles for r in ("cash", "bank"))
        and c_roles.count("revenue") >= 1
    ):
        return "trade_in_sale"

    if (
        any(r in d_roles for r in ("cash", "bank"))
        and d_roles.count("receivable") >= 1
        and len(debits) == 2
    ):
        return "split_payment_sale"

    if d_roles.count("advance") >= 1 and any(r in c_roles for r in ("cash", "bank", "other")):
        return "advance_payment"

    if d_roles.count("vat_in") >= 1 and any(r in d_roles for r in ("purchase", "expense", "other")):
        if c_roles.count("payable") >= 1 and any(r in c_roles for r in ("cash", "bank", "other")):
            return "partial_purchase_payment"
        return "vat_input_purchase"

    if (
        len(debits) == 1
        and c_roles.count("revenue") >= 1
        and (c_roles.count("cogs") >= 1 or c_roles.count("inventory") >= 1)
    ):
        return "service_cogs"

    if c_roles.count("vat_out") >= 1:
        return "vat_output_sale"

    return "simple"


def can_build_sector_template(
    debit_accounts: list[str],
    credit_accounts: list[str],
    *,
    amount: float | None,
    secondary_amount: float | None = None,
    tertiary_amount: float | None = None,
    payment_method: PaymentMethod = "unknown",
) -> bool:
    if not amount or amount <= 0:
        return False
    if any("/" in d for d in debit_accounts) and payment_method == "unknown":
        return False
    if any("/" in c for c in credit_accounts) and payment_method == "unknown":
        return False

    debits, credits = _resolve_accounts(debit_accounts, credit_accounts, payment_method)
    if not debits or not credits:
        return False

    pattern = detect_template_pattern(debits, credits)
    if pattern == "service_cogs":
        return secondary_amount is not None and secondary_amount > 0
    if pattern == "split_payment_sale":
        return secondary_amount is not None and 0 < secondary_amount < amount
    if pattern == "partial_purchase_payment":
        return secondary_amount is not None and 0 < secondary_amount < amount
    if pattern == "trade_in_sale":
        cash = secondary_amount or 0
        trade_in = tertiary_amount or 0
        return cash > 0 and trade_in > 0 and abs((cash + trade_in) - amount) < 0.05
    if pattern in ("inventory_exchange", "advance_payment", "vat_output_sale", "vat_input_purchase", "simple"):
        return True
    return False


def _line(label: str, debit: float, credit: float, desc: str = "") -> dict[str, Any]:
    code, name = map_account_to_code(label)
    return {
        "account": code,
        "accountCode": code,
        "accountName": name,
        "debit": round(debit, 2),
        "credit": round(credit, 2),
        "description": desc or label,
    }


def _balance(lines: list[dict[str, Any]]) -> list[dict[str, Any]]:
    total_dr = sum(l["debit"] for l in lines)
    total_cr = sum(l["credit"] for l in lines)
    if abs(total_dr - total_cr) >= 0.02:
        raise ValueError(f"Unbalanced sector template: Dr={total_dr} Cr={total_cr}")
    return lines


def build_sector_journal_lines(
    debit_accounts: list[str],
    credit_accounts: list[str],
    amount: float,
    *,
    payment_method: PaymentMethod = "unknown",
    secondary_amount: float | None = None,
    tertiary_amount: float | None = None,
    vat_inclusive: bool = False,
) -> list[dict[str, Any]]:
    """Build balanced journal lines from sector debit/credit account lists."""
    if not can_build_sector_template(
        debit_accounts,
        credit_accounts,
        amount=amount,
        secondary_amount=secondary_amount,
        tertiary_amount=tertiary_amount,
        payment_method=payment_method,
    ):
        raise ValueError("Sector template not allocatable for current slots")

    debits, credits = _resolve_accounts(debit_accounts, credit_accounts, payment_method)
    pattern = detect_template_pattern(debits, credits)
    d_roles = {d: _classify_debit(d) for d in debits}
    c_roles = {c: _classify_credit(c) for c in credits}
    lines: list[dict[str, Any]] = []

    if pattern == "inventory_exchange":
        lines.append(_line(debits[0], amount, 0, "Inventory out"))
        lines.append(_line(credits[0], 0, amount, "Inventory in"))
        return _balance(lines)

    if pattern == "advance_payment":
        lines.append(_line(debits[0], amount, 0, "Advance paid"))
        lines.append(_line(credits[0], 0, amount, "Cash/bank paid"))
        return _balance(lines)

    if pattern == "trade_in_sale":
        cash = float(secondary_amount or 0)
        trade_in = float(tertiary_amount or 0)
        cash_acct = next(d for d, r in d_roles.items() if r in ("cash", "bank"))
        inv_acct = next(d for d, r in d_roles.items() if r == "inventory")
        rev_acct = next(c for c, r in c_roles.items() if r == "revenue")
        lines.append(_line(inv_acct, trade_in, 0, "Trade-in inventory"))
        lines.append(_line(cash_acct, cash, 0, "Cash/bank portion"))
        lines.append(_line(rev_acct, 0, amount, "Sales"))
        return _balance(lines)

    if pattern == "split_payment_sale":
        cash_part = float(secondary_amount or 0)
        ar_part = round(amount - cash_part, 2)
        cash_acct = next(d for d, r in d_roles.items() if r in ("cash", "bank"))
        ar_acct = next(d for d, r in d_roles.items() if r == "receivable")
        vat_acct = next((c for c, r in c_roles.items() if r == "vat_out"), None)
        rev_accounts = [c for c, r in c_roles.items() if r == "revenue"]
        lines.append(_line(cash_acct, cash_part, 0, "Cash portion"))
        lines.append(_line(ar_acct, ar_part, 0, "Credit portion"))
        if vat_acct:
            net, vat = vat_split(amount)
            rev_acct = rev_accounts[0] if rev_accounts else credits[0]
            lines.append(_line(rev_acct, 0, net, "Revenue excl. VAT"))
            lines.append(_line(vat_acct, 0, vat, "Output VAT"))
        else:
            rev_acct = rev_accounts[0] if rev_accounts else credits[0]
            lines.append(_line(rev_acct, 0, amount, "Sales"))
        return _balance(lines)

    if pattern == "partial_purchase_payment":
        cash_paid = float(secondary_amount or 0)
        payable_part = round(amount - cash_paid, 2)
        net, vat = vat_split(amount)
        pur_acct = next((d for d, r in d_roles.items() if r in ("purchase", "other", "expense")), debits[0])
        vat_debit = next((d for d, r in d_roles.items() if r == "vat_in"), None)
        cash_acct = next((c for c, r in c_roles.items() if r in ("cash", "bank", "other")), credits[0])
        pay_acct = next((c for c, r in c_roles.items() if r == "payable"), credits[-1])
        lines.append(_line(pur_acct, net, 0, "Purchase excl. VAT"))
        if vat_debit:
            lines.append(_line(vat_debit, vat, 0, "Input VAT"))
        lines.append(_line(cash_acct, 0, cash_paid, "Cash paid"))
        lines.append(_line(pay_acct, 0, payable_part, "Payable balance"))
        return _balance(lines)

    if pattern == "vat_input_purchase":
        net, vat = vat_split(amount)
        pur_acct = next((d for d, r in d_roles.items() if r in ("purchase", "other")), debits[0])
        vat_debit = next((d for d, r in d_roles.items() if r == "vat_in"), None)
        cr_acct = credits[0]
        lines.append(_line(pur_acct, net, 0, "Purchase excl. VAT"))
        if vat_debit:
            lines.append(_line(vat_debit, vat, 0, "Input VAT"))
        lines.append(_line(cr_acct, 0, amount, "Cash/bank/payable"))
        return _balance(lines)

    if pattern == "service_cogs":
        part_cost = float(secondary_amount or 0)
        rev_amount = round(amount - part_cost, 2)
        dr_acct = debits[0]
        rev_acct = next(c for c, r in c_roles.items() if r == "revenue")
        cogs_acct = next(c for c, r in c_roles.items() if r in ("cogs", "inventory"))
        lines.append(_line(dr_acct, amount, 0, "Receipt"))
        lines.append(_line(rev_acct, 0, rev_amount, "Service income"))
        lines.append(_line(cogs_acct, 0, part_cost, "COGS / parts"))
        return _balance(lines)

    if pattern == "vat_output_sale":
        net, vat = vat_split(amount)
        dr_acct = debits[0]
        vat_acct = next(c for c, r in c_roles.items() if r == "vat_out")
        rev_acct = next((c for c, r in c_roles.items() if r == "revenue"), credits[0])
        lines.append(_line(dr_acct, amount, 0, "Receipt"))
        lines.append(_line(rev_acct, 0, net, "Revenue excl. VAT"))
        lines.append(_line(vat_acct, 0, vat, "Output VAT"))
        return _balance(lines)

    # simple 1:1
    lines.append(_line(debits[0], amount, 0, "Debit"))
    lines.append(_line(credits[0], 0, amount, "Credit"))
    return _balance(lines)


def template_fingerprint(
    *,
    sector_slug: str,
    nlu_intent: str | None,
    transaction_category: str | None,
    record_intent: str | None = None,
) -> str:
    return "|".join(
        [
            sector_slug or "",
            nlu_intent or "",
            transaction_category or "",
            record_intent or "",
        ]
    )


@lru_cache(maxsize=1)
def _load_template_index() -> dict[str, dict[str, Any]]:
    if not TEMPLATE_PATH.exists():
        return {}
    data = json.loads(TEMPLATE_PATH.read_text(encoding="utf-8"))
    index: dict[str, dict[str, Any]] = {}
    for tpl in data.get("templates") or []:
        for key in (
            tpl.get("id"),
            template_fingerprint(
                sector_slug=str(tpl.get("sector_slug") or ""),
                nlu_intent=str(tpl.get("nlu_intent") or "") or None,
                transaction_category=str(tpl.get("transaction_category") or "") or None,
            ),
            template_fingerprint(
                sector_slug=str(tpl.get("sector_slug") or ""),
                nlu_intent=str(tpl.get("nlu_intent") or "") or None,
                transaction_category=str(tpl.get("transaction_category") or "") or None,
                record_intent=str(tpl.get("record_intent") or "") or None,
            ),
        ):
            if key:
                index[key] = tpl
    return index


def lookup_sector_template(
    *,
    sector_slug: str | None = None,
    nlu_intent: str | None = None,
    transaction_category: str | None = None,
    record_intent: str | None = None,
    template_id: str | None = None,
) -> dict[str, Any] | None:
    index = _load_template_index()
    if template_id and template_id in index:
        return index[template_id]
    if sector_slug:
        for key in (
            template_fingerprint(
                sector_slug=sector_slug,
                nlu_intent=nlu_intent,
                transaction_category=transaction_category,
                record_intent=record_intent,
            ),
            template_fingerprint(
                sector_slug=sector_slug,
                nlu_intent=nlu_intent,
                transaction_category=transaction_category,
            ),
            template_fingerprint(
                sector_slug=sector_slug,
                nlu_intent=nlu_intent,
                transaction_category=None,
            ),
        ):
            if key in index:
                return index[key]
    return None


def build_templates_from_sector_files() -> dict[str, Any]:
    """Scan sector NLU JSONL files and aggregate unique debit/credit templates."""
    grouped: dict[str, dict[str, Any]] = {}
    paths = sorted(ERP_PATH.glob(SECTOR_NLU_GLOB))
    for path in paths:
        for line in path.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            row = json.loads(line)
            content = str(row.get("content") or "")
            debits, credits = extract_accounts_from_content(content)
            if not debits or not credits:
                continue
            sector_slug = str(row.get("sector_slug") or "")
            nlu_intent = str(row.get("nlu_intent") or "")
            tx_cat = str(row.get("transaction_category") or "")
            record_intent = str(row.get("intent") or "")
            fp = template_fingerprint(
                sector_slug=sector_slug,
                nlu_intent=nlu_intent,
                transaction_category=tx_cat,
                record_intent=record_intent,
            )
            entry = grouped.setdefault(
                fp,
                {
                    "id": fp,
                    "sector_slug": sector_slug,
                    "nlu_intent": nlu_intent,
                    "record_intent": record_intent,
                    "transaction_category": tx_cat,
                    "erp_action": str(row.get("erp_action") or ""),
                    "debit_accounts": debits,
                    "credit_accounts": credits,
                    "example_count": 0,
                    "confidence_sum": 0.0,
                },
            )
            entry["example_count"] += 1
            entry["confidence_sum"] += float(row.get("confidence") or 0)
    templates: list[dict[str, Any]] = []
    for entry in grouped.values():
        count = entry.pop("example_count")
        conf_sum = entry.pop("confidence_sum")
        entry["confidence_avg"] = round(conf_sum / count, 3) if count else 0
        debits, credits = _resolve_accounts(
            entry["debit_accounts"],
            entry["credit_accounts"],
            "unknown",
        )
        if debits and credits:
            entry["template_pattern"] = detect_template_pattern(debits, credits)
        templates.append(entry)
    templates.sort(key=lambda t: (t.get("sector_slug", ""), t.get("nlu_intent", "")))
    return {
        "version": 2,
        "description": "Sector journal templates codegen from nepal-sector-nlu.jsonl",
        "template_count": len(templates),
        "templates": templates,
    }


def write_sector_templates(path: Path | None = None) -> Path:
    target = path or TEMPLATE_PATH
    payload = build_templates_from_sector_files()
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    _load_template_index.cache_clear()
    return target


def try_build_from_parsed(parsed: ParsedEntry) -> list[dict[str, Any]] | None:
    """Attempt sector-template journal lines from enriched ParsedEntry."""
    debits = list(parsed.debit_accounts or [])
    credits = list(parsed.credit_accounts or [])
    if not debits or not credits:
        tpl = lookup_sector_template(
            sector_slug=parsed.sector_slug,
            nlu_intent=parsed.intent if parsed.intent != "unknown" else None,
            transaction_category=parsed.transaction_category,
            template_id=parsed.sector_template_id,
        )
        if tpl:
            debits = list(tpl.get("debit_accounts") or [])
            credits = list(tpl.get("credit_accounts") or [])
    if not debits or not credits or not parsed.amount:
        return None
    try:
        return build_sector_journal_lines(
            debits,
            credits,
            float(parsed.amount),
            payment_method=parsed.payment_method,
            secondary_amount=parsed.secondary_amount,
            tertiary_amount=parsed.tertiary_amount,
            vat_inclusive=parsed.vat_inclusive,
        )
    except ValueError:
        return None
