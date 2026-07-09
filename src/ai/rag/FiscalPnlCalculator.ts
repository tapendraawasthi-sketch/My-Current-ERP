/** SUTRA AI — P&L from invoice history with fiscal-year awareness */

import type { ErpInvoiceRef, ErpPnlSnapshot } from "../types";
import type { FiscalYearBounds } from "../context/FiscalYearResolver";

function isSalesInvoice(type: string): boolean {
  const t = type.toLowerCase();
  return t.includes("sales") && !t.includes("return") && !t.includes("purchase");
}

function isPurchaseInvoice(type: string): boolean {
  const t = type.toLowerCase();
  return t.includes("purchase") && !t.includes("return") && !t.includes("sales");
}

function isSalesReturn(type: string): boolean {
  return /sales.*return|return.*sales/i.test(type);
}

function isPurchaseReturn(type: string): boolean {
  return /purchase.*return|return.*purchase/i.test(type);
}

function periodRange(
  period: ErpPnlSnapshot["period"],
  fy?: FiscalYearBounds,
): { start: string; end: string } {
  const today = new Date().toISOString().slice(0, 10);
  const now = new Date();

  if (period === "today") return { start: today, end: today };

  if (period === "this_week") {
    const start = new Date(now);
    start.setDate(now.getDate() - 7);
    return { start: start.toISOString().slice(0, 10), end: today };
  }

  if (period === "last_month") {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    return {
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
    };
  }

  if (period === "current_fy" && fy) {
    return { start: fy.startDate, end: fy.endDate };
  }

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  return { start: monthStart.toISOString().slice(0, 10), end: today };
}

export function computePnlFromInvoices(
  invoices: ErpInvoiceRef[],
  period: ErpPnlSnapshot["period"],
  fy?: FiscalYearBounds,
): ErpPnlSnapshot {
  const { start, end } = periodRange(period, fy);
  let totalIncome = 0;
  let totalExpense = 0;
  let entryCount = 0;

  for (const inv of invoices) {
    if (!inv.date || inv.date < start || inv.date > end) continue;
    const amt = inv.grandTotal ?? 0;
    if (amt <= 0) continue;
    entryCount += 1;

    if (isSalesInvoice(inv.type)) totalIncome += amt;
    else if (isPurchaseInvoice(inv.type)) totalExpense += amt;
    else if (isSalesReturn(inv.type)) totalIncome -= amt;
    else if (isPurchaseReturn(inv.type)) totalExpense -= amt;
    else if (/sales/i.test(inv.type)) totalIncome += amt;
    else if (/purchase/i.test(inv.type)) totalExpense += amt;
  }

  return {
    period,
    totalIncome: Math.round(totalIncome * 100) / 100,
    totalExpense: Math.round(totalExpense * 100) / 100,
    netProfit: Math.round((totalIncome - totalExpense) * 100) / 100,
    entryCount,
  };
}
