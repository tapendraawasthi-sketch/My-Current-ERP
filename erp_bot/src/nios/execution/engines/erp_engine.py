"""Deterministic ERP engines — trial balance, P&L, ratios from session snapshot."""

from __future__ import annotations

from typing import Any

from .tax_engine import round2


def _num(balance: dict, *keys: str) -> float:
    for k in keys:
        if k in balance and balance[k] is not None:
            return float(balance[k])
    return 0.0


def normalize_balance(balance: dict | None) -> dict[str, float]:
    b = balance or {}
    return {
        "cash": _num(b, "cash", "cashBalance"),
        "bank": _num(b, "bank", "bankBalance"),
        "receivable": _num(b, "receivable", "receivables"),
        "payable": _num(b, "payable", "payables"),
        "inventory": _num(b, "inventory", "stock"),
        "expense": _num(b, "expense", "expenses"),
        "revenue": _num(b, "revenue", "sales"),
    }


def trial_balance(balance: dict | None) -> dict[str, Any]:
    """Build trial balance from ERP snapshot."""
    b = normalize_balance(balance)
    lines = [
        {"account": "Cash", "debit": b["cash"], "credit": 0.0},
        {"account": "Bank", "debit": b["bank"], "credit": 0.0},
        {"account": "Accounts Receivable", "debit": b["receivable"], "credit": 0.0},
        {"account": "Inventory", "debit": b["inventory"], "credit": 0.0},
        {"account": "Accounts Payable", "debit": 0.0, "credit": b["payable"]},
        {"account": "Revenue", "debit": 0.0, "credit": b["revenue"]},
        {"account": "Expense", "debit": b["expense"], "credit": 0.0},
    ]
    total_debit = round2(sum(l["debit"] for l in lines))
    total_credit = round2(sum(l["credit"] for l in lines))
    balanced = abs(total_debit - total_credit) < 0.01
    return {
        "ok": balanced,
        "lines": lines,
        "total_debit": total_debit,
        "total_credit": total_credit,
        "balanced": balanced,
        "summary": f"Trial balance {'balanced' if balanced else 'unbalanced'}: Dr {total_debit:,.0f} / Cr {total_credit:,.0f}",
    }


def profit_loss(balance: dict | None) -> dict[str, Any]:
    """P&L from snapshot revenue/expense."""
    b = normalize_balance(balance)
    gross_profit = round2(b["revenue"] - b["expense"])
    margin = round2((gross_profit / b["revenue"]) * 100) if b["revenue"] else 0.0
    return {
        "ok": True,
        "revenue": b["revenue"],
        "expense": b["expense"],
        "gross_profit": gross_profit,
        "margin_pct": margin,
        "summary": f"P&L: Revenue Rs.{b['revenue']:,.0f} | Expense Rs.{b['expense']:,.0f} | Profit Rs.{gross_profit:,.0f} ({margin}%)",
    }


def balance_sheet(balance: dict | None) -> dict[str, Any]:
    """Simple balance sheet from snapshot."""
    b = normalize_balance(balance)
    assets = round2(b["cash"] + b["bank"] + b["receivable"] + b["inventory"])
    liabilities = round2(b["payable"])
    equity = round2(assets - liabilities)
    return {
        "ok": True,
        "assets": assets,
        "liabilities": liabilities,
        "equity": equity,
        "summary": f"Balance sheet: Assets Rs.{assets:,.0f} | Liabilities Rs.{liabilities:,.0f} | Equity Rs.{equity:,.0f}",
    }


def aging_report(balance: dict | None) -> dict[str, Any]:
    """Receivable/payable aging proxy from snapshot totals."""
    b = normalize_balance(balance)
    recv = b["receivable"]
    pay = b["payable"]
    buckets = {
        "receivable": {
            "0_30": round2(recv * 0.6),
            "31_60": round2(recv * 0.25),
            "61_90": round2(recv * 0.1),
            "90_plus": round2(recv * 0.05),
        },
        "payable": {
            "0_30": round2(pay * 0.5),
            "31_60": round2(pay * 0.3),
            "61_90": round2(pay * 0.15),
            "90_plus": round2(pay * 0.05),
        },
    }
    return {
        "ok": True,
        "buckets": buckets,
        "summary": f"Aging: Receivable Rs.{recv:,.0f} | Payable Rs.{pay:,.0f}",
    }


def ratio_analysis(balance: dict | None) -> dict[str, Any]:
    """Key financial ratios from snapshot."""
    b = normalize_balance(balance)
    current_assets = round2(b["cash"] + b["bank"] + b["receivable"] + b["inventory"])
    current_liabilities = round2(b["payable"]) or 1.0
    current_ratio = round2(current_assets / current_liabilities)
    working_capital = round2(current_assets - current_liabilities)
    liquidity = round2(b["cash"] + b["bank"])
    return {
        "ok": True,
        "current_ratio": current_ratio,
        "working_capital": working_capital,
        "liquidity": liquidity,
        "summary": f"Current ratio {current_ratio} | Working capital Rs.{working_capital:,.0f} | Liquidity Rs.{liquidity:,.0f}",
    }


def ledger_balance(balance: dict | None) -> dict[str, Any]:
    """Cash + bank + receivable - payable summary."""
    b = normalize_balance(balance)
    net = round2(b["cash"] + b["bank"] + b["receivable"] - b["payable"])
    return {
        "ok": True,
        "cash": b["cash"],
        "bank": b["bank"],
        "receivable": b["receivable"],
        "payable": b["payable"],
        "net_position": net,
        "summary": (
            f"Cash Rs.{b['cash']:,.0f} | Bank Rs.{b['bank']:,.0f} | "
            f"Receivable Rs.{b['receivable']:,.0f} | Payable Rs.{b['payable']:,.0f} | Net Rs.{net:,.0f}"
        ),
    }


def execute_erp_capability(cap_id: str, ctx: dict[str, Any]) -> dict[str, Any]:
    """Route ERP capability ID to deterministic engine."""
    balance = ctx.get("balance")
    op = cap_id.split(".")[-1]

    if op in ("balance", "ledger_balance"):
        return ledger_balance(balance)
    if op in ("trial_balance",):
        return trial_balance(balance)
    if op in ("profit_loss",):
        return profit_loss(balance)
    if op in ("balance_sheet",):
        return balance_sheet(balance)
    if op in ("aging_report",):
        return aging_report(balance)
    if op in ("ratio_analysis",):
        return ratio_analysis(balance)
    if op in ("session_snapshot",):
        b = normalize_balance(balance)
        return {"ok": True, "snapshot": b, "summary": f"Snapshot: liquidity Rs.{b['cash'] + b['bank']:,.0f}"}
    if op in ("journal_validate",):
        lines = (ctx.get("payload") or {}).get("lines", [{"debit": 1000, "credit": 0}, {"debit": 0, "credit": 1000}])
        debit = sum(l.get("debit", 0) for l in lines)
        credit = sum(l.get("credit", 0) for l in lines)
        balanced = abs(round2(debit) - round2(credit)) < 0.01
        return {"ok": balanced, "summary": f"Journal {'balanced' if balanced else 'unbalanced'}", "debit": debit, "credit": credit}

    b = normalize_balance(balance)
    return {
        "ok": True,
        "summary": f"ERP {op}: liquidity Rs.{b['cash'] + b['bank']:,.0f}",
        "snapshot": b,
        "capability": cap_id,
    }
