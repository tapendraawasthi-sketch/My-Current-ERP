"""
Tool Registry — tools the e-Khata agent can call via Ollama native tool calling.
"""

from __future__ import annotations

import json
from datetime import datetime
from typing import Any

from ..bridges.dexie_bridge import (
    check_today_duplicates,
    compute_pnl,
    compute_trial_balance,
    dumps_result,
    query_account_balance,
    query_party_balance,
    search_entries,
)
from ..knowledge.nepal_accounting_kb import NEPAL_TAX_RATES, lookup_tds_rate, vat_split
from ..knowledge.rag_search import search_knowledge

BS_MONTHS = [
    "Baisakh",
    "Jestha",
    "Ashadh",
    "Shrawan",
    "Bhadra",
    "Ashwin",
    "Kartik",
    "Mangsir",
    "Poush",
    "Magh",
    "Falgun",
    "Chaitra",
]


def get_party_balance(party_name: str) -> str:
    """Get the current outstanding balance for a customer or supplier.

    Args:
        party_name: Name of the customer or supplier (e.g., "Ram", "ABC Traders")

    Returns:
        JSON with receivable, payable, net balance.
    """
    return dumps_result(query_party_balance(party_name))


def get_cash_balance() -> str:
    """Get the current cash-in-hand balance."""
    return dumps_result(query_account_balance("KH-CASH"))


def get_bank_balance() -> str:
    """Get the current bank account balance."""
    return dumps_result(query_account_balance("KH-BANK"))


def search_past_entries(query: str, days: int = 30) -> str:
    """Search past journal entries matching a query.

    Args:
        query: Search text (party name, amount, narration keyword)
        days: How many days back to search (default 30)
    """
    return dumps_result(search_entries(query, days))


def calculate_tds(payment_type: str, gross_amount: float) -> str:
    """Calculate TDS for a payment under Nepal Income Tax Act 2058.

    Args:
        payment_type: rent, service_fee, commission, interest, dividend, royalty, contract
        gross_amount: Gross payment before TDS
    """
    rate_key = payment_type.lower().replace(" ", "_")
    rate = lookup_tds_rate(rate_key) if rate_key in NEPAL_TAX_RATES["tds"] else lookup_tds_rate("default")
    tds_amount = round(gross_amount * rate, 2)
    net_amount = round(gross_amount - tds_amount, 2)
    return dumps_result(
        {
            "payment_type": payment_type,
            "gross_amount": gross_amount,
            "tds_rate": rate,
            "tds_rate_percent": f"{rate * 100:g}%",
            "tds_amount": tds_amount,
            "net_payment": net_amount,
            "section": "Section 88 of Income Tax Act 2058",
        }
    )


def calculate_vat(amount: float, is_inclusive: bool = True) -> str:
    """Calculate VAT breakdown at Nepal standard 13% rate.

    Args:
        amount: Transaction amount
        is_inclusive: Whether amount includes VAT (default True)
    """
    if is_inclusive:
        net, vat = vat_split(amount)
        gross = amount
    else:
        net = amount
        vat = round(amount * 0.13, 2)
        gross = round(amount + vat, 2)
    return dumps_result(
        {
            "net_amount": net,
            "vat_amount": vat,
            "gross_amount": gross,
            "vat_rate": "13%",
            "is_inclusive": is_inclusive,
        }
    )


def get_nepal_date() -> str:
    """Get today's date in AD and approximate BS fiscal context."""
    today = datetime.now()
    # Approximate BS = AD + 57 years 8 months (display only without nepali lib)
    bs_year = today.year + 57
    bs_month = ((today.month + 8 - 1) % 12) + 1
    return dumps_result(
        {
            "ad_date": today.strftime("%Y-%m-%d"),
            "bs_date_approx": f"{bs_year}-{bs_month:02d}-{today.day:02d}",
            "bs_formatted_approx": f"{bs_year} {BS_MONTHS[bs_month - 1]} {today.day}",
            "fiscal_year": f"{bs_year}/{bs_year + 1}" if bs_month >= 4 else f"{bs_year - 1}/{bs_year}",
            "day_of_week": today.strftime("%A"),
            "note": "BS date is approximate; use frontend for exact Bikram Sambat.",
        }
    )


def get_depreciation(
    asset_type: str,
    cost: float,
    salvage_value: float = 0,
) -> str:
    """Calculate annual depreciation under Nepal tax depreciation rates.

    Args:
        asset_type: building, furniture, vehicle, computer, machinery, intangible
        cost: Original cost
        salvage_value: Residual value (default 0)
    """
    rates = NEPAL_TAX_RATES.get("depreciation_rates", {})
    rate = float(rates.get(asset_type.lower(), 0.15))
    depreciable = cost - salvage_value
    annual_dep = round(depreciable * rate, 2)
    return dumps_result(
        {
            "asset_type": asset_type,
            "cost": cost,
            "salvage_value": salvage_value,
            "depreciable_amount": depreciable,
            "rate": rate,
            "rate_percent": f"{rate * 100:g}%",
            "annual_depreciation": annual_dep,
            "method": "Diminishing Balance (Nepal Income Tax Act)",
            "useful_life_years": round(1 / rate) if rate > 0 else None,
        }
    )


def check_duplicate_entry(party: str, amount: float, entry_type: str) -> str:
    """Check if a similar entry was already posted today.

    Args:
        party: Party name
        amount: Transaction amount
        entry_type: Entry intent (credit_sale, payment_received, etc.)
    """
    return dumps_result(check_today_duplicates(party, amount, entry_type))


def get_trial_balance() -> str:
    """Generate trial balance from posted entries in session snapshot."""
    return dumps_result(compute_trial_balance())


def get_profit_loss(period: str = "current_month") -> str:
    """Generate profit & loss summary for a period.

    Args:
        period: today, this_week, current_month, last_month, current_fy
    """
    return dumps_result(compute_pnl(period))


def search_accounting_knowledge(question: str) -> str:
    """Search Nepal accounting knowledge base (tax, NFRS, standards).

    Args:
        question: Accounting question to search
    """
    return dumps_result(search_knowledge(question, top_k=3))


ALL_TOOLS: list[Any] = [
    get_party_balance,
    get_cash_balance,
    get_bank_balance,
    search_past_entries,
    calculate_tds,
    calculate_vat,
    get_nepal_date,
    get_depreciation,
    check_duplicate_entry,
    get_trial_balance,
    get_profit_loss,
    search_accounting_knowledge,
]

TOOL_MAP: dict[str, Any] = {fn.__name__: fn for fn in ALL_TOOLS}
