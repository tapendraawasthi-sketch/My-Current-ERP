// src/lib/accounting.ts
import { AccountType } from "./types";
import { getDB } from "./db";

export function isDebitNature(type: AccountType | string): boolean {
  return type === AccountType.ASSET || type === AccountType.EXPENSE ||
    type === "asset" || type === "expense";
}

export async function generateSerialNumber(
  voucherType: string,
  seriesId?: string,
  fiscalYearBS?: string,
  preview = false
): Promise<string> {
  const prefixes: Record<string, string> = {
    journal: "JV", "journal-voucher": "JV",
    payment: "PV", "payment-voucher": "PV",
    receipt: "RV", "receipt-voucher": "RV",
    contra: "CV", "contra-voucher": "CV",
    "sales-invoice": "SI", "sales_invoice": "SI",
    "purchase-invoice": "PI", "purchase_invoice": "PI",
    "sales-return": "SR", "sales_return": "SR",
    "purchase-return": "PR", "purchase_return": "PR",
    "debit-note": "DN", "credit-note": "CN",
    "delivery-challan": "DC", "goods-receipt-note": "GRN",
    "sales-order": "SO", "purchase-order": "PO",
  };
  const prefix = prefixes[voucherType] || "VCH";
  try {
    const db = getDB();
    const count = await db.vouchers.where("type").equals(voucherType).count();
    return `${prefix}-${String(count + 1).padStart(4, "0")}`;
  } catch {
    return `${prefix}-0001`;
  }
}

// Synchronous version for contexts that can't await
export function generateSerialNumberSync(voucherType: string): string {
  const prefixes: Record<string, string> = {
    journal: "JV", payment: "PV", receipt: "RV", contra: "CV",
    "sales-invoice": "SI", "purchase-invoice": "PI",
    "sales-return": "SR", "purchase-return": "PR",
  };
  const prefix = prefixes[voucherType] || "VCH";
  return `${prefix}-${String(Math.floor(Math.random() * 9000) + 1000)}`;
}

// Used by store
export async function generateNextNumber(type: string): Promise<string> {
  return generateSerialNumber(type);
}

export interface DoubleEntryValidation {
  isValid: boolean;
  difference: number;
  totalDebit: number;
  totalCredit: number;
}

export function validateDoubleEntry(lines: Array<{ debit?: number; credit?: number }>): DoubleEntryValidation {
  const totalDebit = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  const difference = Math.abs(totalDebit - totalCredit);
  return {
    isValid: difference < 0.01,
    difference: Math.round(difference * 100) / 100,
    totalDebit: Math.round(totalDebit * 100) / 100,
    totalCredit: Math.round(totalCredit * 100) / 100,
  };
}

export function computeOutstandingReceivables(
  parties: any[],
  invoices: any[],
  vouchers: any[]
): { totalAmount: number; parties: Array<{ partyId: string; name: string; amount: number }> } {
  const partyBalances: Record<string, number> = {};

  for (const inv of invoices) {
    if (
      inv.type === "sales-invoice" &&
      inv.status === "posted" &&
      (inv.paymentStatus === "unpaid" || inv.paymentStatus === "partial")
    ) {
      const outstanding = (inv.grandTotal || 0) - (inv.paidAmount || 0);
      partyBalances[inv.partyId] = (partyBalances[inv.partyId] || 0) + outstanding;
    }
  }

  const result = Object.entries(partyBalances).map(([partyId, amount]) => {
    const party = parties.find((p) => p.id === partyId);
    return { partyId, name: party?.name || "Unknown", amount };
  });

  return {
    totalAmount: result.reduce((s, r) => s + r.amount, 0),
    parties: result,
  };
}

export function computeLedgerBalance(
  accountId: string,
  vouchers: any[],
  openingBalance = 0,
  openingBalanceDr = 0,
  openingBalanceCr = 0
): number {
  let balance = openingBalanceDr - openingBalanceCr;
  for (const v of vouchers) {
    if (v.status !== "posted") continue;
    for (const line of v.lines || []) {
      if (line.accountId === accountId) {
        balance += (line.debit || 0) - (line.credit || 0);
      }
    }
  }
  return balance;
}

export const generateVoucherNo = () => "";
export const computeTrialBalance = () => ({});
/**
 * Given a start date, frequency, and optional day-of-month,
 * returns the next due date as an ISO date string (YYYY-MM-DD).
 */
export function calculateNextDueDate(
  startDate: string,
  frequency: string,
  dayOfMonth?: number
): string {
  const base = new Date(startDate);
  if (isNaN(base.getTime())) return new Date().toISOString().split("T")[0];

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  let next = new Date(base);

  const advance = (d: Date): Date => {
    const n = new Date(d);
    switch (frequency) {
      case "daily":        n.setDate(n.getDate() + 1); break;
      case "weekly":       n.setDate(n.getDate() + 7); break;
      case "fortnightly":  n.setDate(n.getDate() + 14); break;
      case "monthly":
        n.setMonth(n.getMonth() + 1);
        if (dayOfMonth) n.setDate(Math.min(dayOfMonth, daysInMonth(n.getFullYear(), n.getMonth())));
        break;
      case "quarterly":    n.setMonth(n.getMonth() + 3); break;
      case "half_yearly":  n.setMonth(n.getMonth() + 6); break;
      case "yearly":       n.setFullYear(n.getFullYear() + 1); break;
      default:             n.setMonth(n.getMonth() + 1);
    }
    return n;
  };

  // Advance until next is in the future
  while (next <= now) {
    next = advance(next);
  }

  return next.toISOString().split("T")[0];
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

export const computeProfitLoss = () => ({});
export const computeBalanceSheet = () => ({});
export const computeCashFlow = () => ({});
export const computeOutstandingPayables = () => [];


export const getAccountBalance = () => 0;
export const computeAgingReport = () => [];
export const computePartyStatement = () => ({});
export const computeOutstandingAnalysis = () => ({});

export const computeRatios = () => ({});
