/**
 * Short-term cash-flow forecast (Phase 10) — 7 / 30 day horizons.
 * Separates committed vs expected; does not invent unsupported flows.
 */

import type { SutraERPDatabase } from "@/lib/db";
import { getDB } from "@/lib/db";
import { paisaToString } from "@/domains/purchase/money";
import { computeTreasuryPosition } from "./treasuryPosition";
import type { ChequeInstrumentRow, MoneyString, TreasuryForecastItemRow } from "./types";

export type ForecastHorizonDays = 7 | 30;
export type ForecastConfidence = "committed" | "expected";

export interface ForecastDayBucket {
  date: string;
  committedInflowPaisa: number;
  committedOutflowPaisa: number;
  expectedInflowPaisa: number;
  expectedOutflowPaisa: number;
  closingCommittedPaisa: number;
  closingExpectedPaisa: number;
}

export interface CashFlowForecastResult {
  companyId: string;
  asOfDate: string;
  horizonDays: ForecastHorizonDays;
  openingAvailable: MoneyString;
  openingAvailablePaisa: number;
  days: ForecastDayBucket[];
  totals: {
    committedInflowPaisa: number;
    committedOutflowPaisa: number;
    expectedInflowPaisa: number;
    expectedOutflowPaisa: number;
  };
  warningCodes: string[];
}

function addDays(isoDate: string, n: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function inHorizon(date: string, start: string, end: string): boolean {
  return date >= start && date <= end;
}

export async function computeCashFlowForecast(opts: {
  companyId: string;
  horizonDays: ForecastHorizonDays;
  asOfDate?: string;
  bankAccountId?: string | null;
  db?: SutraERPDatabase;
}): Promise<CashFlowForecastResult> {
  const db = opts.db || getDB();
  const asOfDate = opts.asOfDate || new Date().toISOString().slice(0, 10);
  const endDate = addDays(asOfDate, opts.horizonDays);

  const position = await computeTreasuryPosition({
    companyId: opts.companyId,
    bankAccountId: opts.bankAccountId,
    asOfDate,
    db,
  });
  let opening = position.totals.availableBalancePaisa;

  const dayMap = new Map<string, ForecastDayBucket>();
  for (let i = 1; i <= opts.horizonDays; i++) {
    const date = addDays(asOfDate, i);
    dayMap.set(date, {
      date,
      committedInflowPaisa: 0,
      committedOutflowPaisa: 0,
      expectedInflowPaisa: 0,
      expectedOutflowPaisa: 0,
      closingCommittedPaisa: 0,
      closingExpectedPaisa: 0,
    });
  }

  const bump = (
    date: string,
    side: "inflow" | "outflow",
    confidence: ForecastConfidence,
    amountPaisa: number,
  ) => {
    if (!inHorizon(date, addDays(asOfDate, 1), endDate)) return;
    const bucket = dayMap.get(date);
    if (!bucket || amountPaisa <= 0) return;
    if (side === "inflow") {
      if (confidence === "committed") bucket.committedInflowPaisa += amountPaisa;
      else bucket.expectedInflowPaisa += amountPaisa;
    } else if (confidence === "committed") bucket.committedOutflowPaisa += amountPaisa;
    else bucket.expectedOutflowPaisa += amountPaisa;
  };

  // Manual / persisted forecast items
  const forecastTable = (db as any).treasuryForecastItems;
  if (forecastTable) {
    const items = (await forecastTable
      .where("companyId")
      .equals(opts.companyId)
      .toArray()) as TreasuryForecastItemRow[];
    for (const item of items || []) {
      if (item.status !== "open") continue;
      bump(item.date, item.side, item.confidence, item.amountPaisa);
    }
  }

  // Post-dated / outstanding cheques as committed
  const chequeTable = (db as any).chequeInstruments;
  if (chequeTable) {
    const cheques = (await chequeTable
      .where("companyId")
      .equals(opts.companyId)
      .toArray()) as ChequeInstrumentRow[];
    for (const c of cheques || []) {
      if (opts.bankAccountId && c.bankAccountId !== opts.bankAccountId) continue;
      const date = c.chequeDate;
      if (c.instrumentType === "issued" && (c.status === "issued" || c.status === "draft")) {
        bump(date, "outflow", "committed", c.amountPaisa);
      }
      if (c.instrumentType === "received" && (c.status === "received" || c.status === "deposited")) {
        bump(date, "inflow", "committed", c.amountPaisa);
      }
    }
  }

  // Invoice due dates as expected (authoritative open invoices only)
  if (db.invoices) {
    const invoices = await db.invoices.where("companyId").equals(opts.companyId).toArray();
    for (const inv of invoices || []) {
      const status = String((inv as any).status || "");
      if (status !== "posted" && status !== "approved") continue;
      const paymentStatus = String((inv as any).paymentStatus || "");
      if (paymentStatus === "paid") continue;
      const due =
        String((inv as any).dueDate || (inv as any).date || "").slice(0, 10) || asOfDate;
      const remaining = Math.round(
        (Number((inv as any).grandTotal || (inv as any).total || 0) -
          Number((inv as any).paidAmount || 0)) *
          100,
      );
      if (remaining <= 0) continue;
      const type = String((inv as any).type || "");
      if (type.includes("sales")) bump(due, "inflow", "expected", remaining);
      else if (type.includes("purchase")) bump(due, "outflow", "expected", remaining);
    }
  }

  let committedRunning = opening;
  let expectedRunning = opening;
  const days: ForecastDayBucket[] = [];
  const warningCodes: string[] = [];

  for (let i = 1; i <= opts.horizonDays; i++) {
    const date = addDays(asOfDate, i);
    const bucket = dayMap.get(date)!;
    committedRunning +=
      bucket.committedInflowPaisa - bucket.committedOutflowPaisa;
    expectedRunning +=
      bucket.committedInflowPaisa -
      bucket.committedOutflowPaisa +
      bucket.expectedInflowPaisa -
      bucket.expectedOutflowPaisa;
    bucket.closingCommittedPaisa = committedRunning;
    bucket.closingExpectedPaisa = expectedRunning;
    if (expectedRunning < 0) warningCodes.push("projected_negative_cash");
    days.push(bucket);
  }

  const totals = {
    committedInflowPaisa: days.reduce((s, d) => s + d.committedInflowPaisa, 0),
    committedOutflowPaisa: days.reduce((s, d) => s + d.committedOutflowPaisa, 0),
    expectedInflowPaisa: days.reduce((s, d) => s + d.expectedInflowPaisa, 0),
    expectedOutflowPaisa: days.reduce((s, d) => s + d.expectedOutflowPaisa, 0),
  };

  return {
    companyId: opts.companyId,
    asOfDate,
    horizonDays: opts.horizonDays,
    openingAvailable: paisaToString(opening),
    openingAvailablePaisa: opening,
    days,
    totals,
    warningCodes: [...new Set(warningCodes)],
  };
}