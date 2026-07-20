/**
 * Daily posted sales totals from store invoices — no synthetic series.
 */

import type { SalesTrendPoint } from "./types";

type SalesInvoiceRow = {
  type?: string;
  status?: string;
  date?: string;
  grandTotal?: number;
  total?: number;
};

function shortDateLabel(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso.slice(5);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Aggregate posted sales invoices by calendar day within optional FY bounds. */
export function buildDailySalesTrend(
  invoices: SalesInvoiceRow[],
  fyStart?: string,
  fyEnd?: string,
): SalesTrendPoint[] {
  const byDate = new Map<string, number>();
  for (const inv of invoices) {
    if (inv.type !== "sales-invoice" || inv.status !== "posted") continue;
    const date = String(inv.date || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    if (fyStart && date < fyStart) continue;
    if (fyEnd && date > fyEnd) continue;
    byDate.set(date, (byDate.get(date) ?? 0) + Number(inv.grandTotal ?? inv.total ?? 0));
  }
  return Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, amount]) => ({
      date,
      label: shortDateLabel(date),
      amount,
    }));
}

export function sparklineFromTrend(points: SalesTrendPoint[]): Array<{ date: string; value: number }> {
  return points.map((p) => ({ date: p.date, value: p.amount }));
}
