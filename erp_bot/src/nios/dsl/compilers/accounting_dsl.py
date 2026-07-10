"""AccountingDSL — compile UIL financial/inventory effects to journal entries."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from ...execution.engines.tax_engine import round2


@dataclass
class JournalLine:
    account: str
    debit: float = 0.0
    credit: float = 0.0
    narration: str = ""


@dataclass
class AccountingProgram:
    id: str
    action: str
    party: str | None
    lines: list[JournalLine] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)

    @property
    def balanced(self) -> bool:
        debit = sum(l.debit for l in self.lines)
        credit = sum(l.credit for l in self.lines)
        return abs(round2(debit) - round2(credit)) < 0.01


def compile_sale(
    *,
    party: str,
    amount: float,
    item: str | None = None,
    vat_amount: float = 0.0,
) -> AccountingProgram:
    """UIL sell → Dr Receivable / Cr Sales + VAT."""
    total = round2(amount + vat_amount)
    lines = [
        JournalLine("Accounts Receivable", debit=total, narration=f"Sale to {party}"),
        JournalLine("Sales Revenue", credit=round2(amount), narration=item or "goods sold"),
    ]
    if vat_amount > 0:
        lines.append(JournalLine("VAT Payable", credit=round2(vat_amount), narration="Output VAT"))
    return AccountingProgram(
        id=f"sale-{party}",
        action="sell",
        party=party,
        lines=lines,
        metadata={"item": item, "amount": amount, "vat_amount": vat_amount},
    )


def compile_purchase(
    *,
    party: str,
    amount: float,
    item: str | None = None,
    vat_amount: float = 0.0,
) -> AccountingProgram:
    """UIL purchase → Dr Purchase + VAT / Cr Payable."""
    total = round2(amount + vat_amount)
    lines = [
        JournalLine("Purchase", debit=round2(amount), narration=item or "goods purchased"),
        JournalLine("Accounts Payable", credit=total, narration=f"Purchase from {party}"),
    ]
    if vat_amount > 0:
        lines.insert(1, JournalLine("VAT Recoverable", debit=round2(vat_amount), narration="Input VAT"))
    return AccountingProgram(
        id=f"purchase-{party}",
        action="purchase",
        party=party,
        lines=lines,
        metadata={"item": item, "amount": amount, "vat_amount": vat_amount},
    )


def compile_payment(*, party: str, amount: float, mode: str = "cash") -> AccountingProgram:
    """UIL payment → Dr Payable / Cr Cash or Bank."""
    account = "Cash" if mode == "cash" else "Bank"
    return AccountingProgram(
        id=f"payment-{party}",
        action="payment",
        party=party,
        lines=[
            JournalLine("Accounts Payable", debit=round2(amount), narration=f"Payment to {party}"),
            JournalLine(account, credit=round2(amount), narration=mode),
        ],
    )


def compile_receipt(*, party: str, amount: float, mode: str = "cash") -> AccountingProgram:
    """UIL receipt → Dr Cash/Bank / Cr Receivable."""
    account = "Cash" if mode == "cash" else "Bank"
    return AccountingProgram(
        id=f"receipt-{party}",
        action="receipt",
        party=party,
        lines=[
            JournalLine(account, debit=round2(amount), narration=f"Receipt from {party}"),
            JournalLine("Accounts Receivable", credit=round2(amount), narration=mode),
        ],
    )


def compile_from_uil(uil: dict[str, Any]) -> AccountingProgram:
    """Compile UIL document dict to AccountingDSL program."""
    action = str(uil.get("action", "query"))
    actor = uil.get("actor") or {}
    obj = uil.get("object") or {}
    fin = uil.get("financial_effect") or {}
    tax = uil.get("tax_effect") or {}

    party = str(actor.get("party", "Unknown"))
    amount = float(fin.get("amount") or obj.get("amount") or 0)
    vat_amount = float(tax.get("vat") or fin.get("vat") or 0)
    item = obj.get("item")

    if action in ("sell", "sale"):
        return compile_sale(party=party, amount=amount, item=str(item) if item else None, vat_amount=vat_amount)
    if action in ("purchase", "buy"):
        return compile_purchase(party=party, amount=amount, item=str(item) if item else None, vat_amount=vat_amount)
    if action == "payment":
        return compile_payment(party=party, amount=amount, mode=str(fin.get("mode", "cash")))
    if action == "receipt":
        return compile_receipt(party=party, amount=amount, mode=str(fin.get("mode", "cash")))

    return AccountingProgram(id="noop", action=action, party=party, lines=[], metadata={"note": "no accounting effect"})


def program_to_journal_lines(program: AccountingProgram) -> list[dict[str, float | str]]:
    return [
        {"account": l.account, "debit": l.debit, "credit": l.credit, "narration": l.narration}
        for l in program.lines
    ]
