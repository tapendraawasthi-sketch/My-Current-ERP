"""In-chat report generation from session ledger snapshots."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from ollama import Client

from ..bridges.dexie_bridge import compute_pnl, compute_trial_balance
from ..config import FAST_MODEL, OLLAMA_BASE_URL


@dataclass
class ReportResult:
  report_type: str = ""
  table_markdown: str = ""
  summary: str = ""
  raw_data: dict[str, Any] = field(default_factory=dict)
  exportable: bool = True
  error: str | None = None


class ChatReportGenerator:
  async def generate(
    self,
    report_type: str,
    params: dict[str, Any],
    context: dict[str, Any],
  ) -> ReportResult:
    generators = {
      "trial_balance": self._trial_balance,
      "day_book": self._day_book,
      "party_ledger": self._party_ledger,
      "cash_book": self._cash_book,
      "profit_loss": self._profit_loss,
      "vat_summary": self._vat_summary,
      "outstanding_receivables": self._outstanding_receivables,
    }
    gen = generators.get(report_type)
    if not gen:
      return ReportResult(
        error=f"Unknown report: {report_type}. Available: {', '.join(generators)}"
      )

    data = await gen(params, context)
    summary = self._summarize_report(report_type, data)
    return ReportResult(
      report_type=report_type,
      table_markdown=data.get("markdown", ""),
      summary=summary,
      raw_data=data.get("raw", data),
      exportable=True,
    )

  async def _trial_balance(self, params: dict, context: dict) -> dict[str, Any]:
    del params
    tb = context.get("trial_balance") or compute_trial_balance()
    rows = ["| Account | Dr (Rs) | Cr (Rs) |", "|---|---:|---:|"]
    for row in tb.get("rows", []):
      rows.append(
        f"| {row.get('name', row.get('account', ''))} | "
        f"{row.get('debit', 0):,.2f} | {row.get('credit', 0):,.2f} |"
      )
    rows.append(
      f"| **TOTAL** | **{tb.get('totalDebit', 0):,.2f}** | "
      f"**{tb.get('totalCredit', 0):,.2f}** |"
    )
    status = "✅ Balanced" if tb.get("isBalanced", True) else "❌ NOT BALANCED"
    rows.append(f"\n{status}")
    return {"markdown": "\n".join(rows), "raw": tb}

  async def _day_book(self, params: dict, context: dict) -> dict[str, Any]:
    date = params.get("date") or __import__("datetime").datetime.now().strftime("%Y-%m-%d")
    entries = [
      e for e in (context.get("recent_entries") or []) if e.get("date") == date
    ]
    rows = ["| Time | Party | Narration | Amount |", "|---|---|---|---:|"]
    for e in entries:
      rows.append(
        f"| {e.get('date','')} | {e.get('party','')} | {e.get('narration','')} | "
        f"{e.get('amount',0):,.2f} |"
      )
    return {"markdown": "\n".join(rows) or f"No entries on {date}.", "raw": entries}

  async def _party_ledger(self, params: dict, context: dict) -> dict[str, Any]:
    party = params.get("party", "")
    entries = [
      e
      for e in (context.get("recent_entries") or [])
      if str(e.get("party", "")).lower() == party.lower()
    ]
    rows = ["| Date | Narration | Amount | Type |", "|---|---|---:|---|"]
    for e in entries:
      rows.append(
        f"| {e.get('date','')} | {e.get('narration','')} | "
        f"{e.get('amount',0):,.2f} | {e.get('intent','')} |"
      )
    bal = (context.get("party_balances") or {}).get(party)
    if bal is not None:
      rows.append(f"\n**Net balance: Rs {float(bal):,.2f}**")
    return {"markdown": "\n".join(rows) or f"No entries for {party}.", "raw": entries}

  async def _cash_book(self, params: dict, context: dict) -> dict[str, Any]:
    del params
    bal = context.get("cash_balance", 0)
    md = f"**Cash Balance: Rs {float(bal):,.2f}**\n\nSee day book for cash movements."
    return {"markdown": md, "raw": {"cash_balance": bal}}

  async def _profit_loss(self, params: dict, context: dict) -> dict[str, Any]:
    period = params.get("period", "current_month")
    pnl = compute_pnl(period)
    md = (
      f"| | Rs |\n|---|---:|\n"
      f"| Income | {pnl.get('total_income', context.get('month_income',0)):,.2f} |\n"
      f"| Expenses | {pnl.get('total_expenses', context.get('month_expense',0)):,.2f} |\n"
      f"| **Net Profit** | **{pnl.get('net_profit', context.get('month_profit',0)):,.2f}** |"
    )
    return {"markdown": md, "raw": pnl}

  async def _vat_summary(self, params: dict, context: dict) -> dict[str, Any]:
    del params
    out_v = float(context.get("vat_output_total", 0))
    in_v = float(context.get("vat_input_total", 0))
    payable = out_v - in_v
    md = (
      f"| | Rs |\n|---|---:|\n"
      f"| Output VAT | {out_v:,.2f} |\n"
      f"| Input VAT | {in_v:,.2f} |\n"
      f"| **Payable** | **{payable:,.2f}** |"
    )
    return {"markdown": md, "raw": {"output": out_v, "input": in_v, "payable": payable}}

  async def _outstanding_receivables(self, params: dict, context: dict) -> dict[str, Any]:
    del params
    balances = context.get("party_balances") or {}
    rows = ["| Party | Balance (Rs) |", "|---|---:|"]
    for party, bal in sorted(balances.items(), key=lambda x: -float(x[1])):
      if float(bal) > 0:
        rows.append(f"| {party} | {float(bal):,.2f} |")
    return {"markdown": "\n".join(rows), "raw": balances}

  def _summarize_report(self, report_type: str, data: dict[str, Any]) -> str:
    try:
      client = Client(host=OLLAMA_BASE_URL)
      response = client.chat(
        model=FAST_MODEL,
        messages=[
          {
            "role": "user",
            "content": f"One sentence Nepali+English summary of this {report_type} report:\n"
            f"{data.get('markdown','')[:800]}",
          }
        ],
        options={"temperature": 0.3, "num_ctx": 1024},
      )
      return (response.message.content or "").strip()
    except Exception:
      return f"{report_type.replace('_', ' ').title()} report ready."


_generator: ChatReportGenerator | None = None


def get_report_generator() -> ChatReportGenerator:
  global _generator
  if _generator is None:
    _generator = ChatReportGenerator()
  return _generator
