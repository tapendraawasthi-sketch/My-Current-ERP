// src/lib/accounting.ts
import { AccountType } from "./types";
import { getDB } from "./db";

export function isDebitNature(type: AccountType | string): boolean {
  return (
    type === AccountType.ASSET ||
    type === AccountType.EXPENSE ||
    type === "asset" ||
    type === "expense"
  );
}

export async function generateSerialNumber(
  voucherType: string,
  seriesId?: string,
  fiscalYearBS?: string,
  preview = false,
): Promise<string> {
  const prefixes: Record<string, string> = {
    journal: "JV",
    "journal-voucher": "JV",
    payment: "PV",
    "payment-voucher": "PV",
    receipt: "RV",
    "receipt-voucher": "RV",
    contra: "CV",
    "contra-voucher": "CV",
    "sales-invoice": "SI",
    sales_invoice: "SI",
    "purchase-invoice": "PI",
    purchase_invoice: "PI",
    "sales-return": "SR",
    sales_return: "SR",
    "purchase-return": "PR",
    purchase_return: "PR",
    "debit-note": "DN",
    "credit-note": "CN",
    "delivery-challan": "DC",
    "goods-receipt-note": "GRN",
    "sales-order": "SO",
    "purchase-order": "PO",
  };
  const prefix = prefixes[voucherType] || "VCH";
  try {
    const db = getDB();
    // Use max existing number + 1 to avoid race conditions with count-based numbering
    const allOfType = await db.vouchers.where("type").equals(voucherType).toArray();
    let maxNum = 0;
    for (const v of allOfType) {
      const match = v.voucherNo?.match(/-(\d+)$/);
      if (match) maxNum = Math.max(maxNum, parseInt(match[1], 10));
    }
    return `${prefix}-${String(maxNum + 1).padStart(4, "0")}`;
  } catch {
    return `${prefix}-0001`;
  }
}

// Synchronous fallback — uses timestamp + random suffix to minimise collision risk.
// Callers that can await should use generateSerialNumber() instead for guaranteed sequence.
export function generateSerialNumberSync(voucherType: string): string {
  const prefixes: Record<string, string> = {
    journal: "JV",
    payment: "PV",
    receipt: "RV",
    contra: "CV",
    "sales-invoice": "SI",
    "purchase-invoice": "PI",
    "sales-return": "SR",
    "purchase-return": "PR",
  };
  const prefix = prefixes[voucherType] || "VCH";
  const ts = Date.now().toString(36).toUpperCase().slice(-6);
  const rand = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0");
  return `${prefix}-${ts}${rand}`;
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

export function validateDoubleEntry(
  lines: Array<{ debit?: number; credit?: number }>,
): DoubleEntryValidation {
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

function voucherAllocationsForInvoice(
  inv: any,
  vouchers: any[],
  voucherType: "receipt" | "payment",
): number {
  let allocated = 0;
  for (const v of vouchers) {
    if (v.status !== "posted" || v.type !== voucherType) continue;
    if (v.partyId && inv.partyId && v.partyId !== inv.partyId) continue;

    for (const line of v.lines ?? []) {
      if (line.billRefNo === inv.invoiceNo || line.billRefNo === inv.id) {
        allocated += Number(line.amount ?? line.credit ?? line.debit ?? 0);
      }
      for (const bw of line.billWise ?? []) {
        if (bw.invoiceId === inv.id || bw.billRefNo === inv.invoiceNo) {
          allocated += Number(bw.amount ?? 0);
        }
      }
    }

    for (const bw of v.billWiseDetails ?? []) {
      if (bw.invoiceId === inv.id || bw.billRefNo === inv.invoiceNo) {
        allocated += Number(bw.amount ?? 0);
      }
    }
  }
  return allocated;
}

export function computeInvoiceOutstanding(inv: any, vouchers: any[] = []): number {
  if (inv.status === "cancelled" || inv.status === "draft" || inv.status !== "posted") return 0;
  const original = Number(inv.grandTotal ?? inv.total ?? 0);
  if (original <= 0) return 0;

  let allocated = Number(inv.paidAmount ?? 0);
  if (inv.type === "sales-invoice") {
    allocated += voucherAllocationsForInvoice(inv, vouchers, "receipt");
  } else if (inv.type === "purchase-invoice") {
    allocated += voucherAllocationsForInvoice(inv, vouchers, "payment");
  }

  return Math.max(0, parseFloat((original - allocated).toFixed(2)));
}

export function computeOutstandingReceivables(
  parties: any[],
  invoices: any[],
  vouchers: any[] = [],
): { totalAmount: number; parties: Array<{ partyId: string; name: string; amount: number }> } {
  const partyBalances: Record<string, number> = {};

  for (const inv of invoices) {
    if (inv.type !== "sales-invoice" || inv.status !== "posted") continue;
    const outstanding = computeInvoiceOutstanding(inv, vouchers);
    if (outstanding <= 0.005) continue;
    partyBalances[inv.partyId] = (partyBalances[inv.partyId] || 0) + outstanding;
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
  openingBalanceCr = 0,
): number {
  // Use Dr/Cr split if provided, otherwise fall back to single openingBalance
  let balance =
    openingBalanceDr || openingBalanceCr ? openingBalanceDr - openingBalanceCr : openingBalance;
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

export const generateVoucherNo = (type = "journal") => generateSerialNumberSync(type);

export function computeTrialBalance(
  accounts: any[],
  vouchers: any[],
): { rows: any[]; totalDebit: number; totalCredit: number } {
  const balances: Record<string, { debit: number; credit: number }> = {};
  for (const v of vouchers) {
    if (v.status !== "posted") continue;
    for (const line of v.lines || []) {
      if (!balances[line.accountId]) balances[line.accountId] = { debit: 0, credit: 0 };
      balances[line.accountId].debit += Number(line.debit) || 0;
      balances[line.accountId].credit += Number(line.credit) || 0;
    }
  }
  const rows = accounts
    .filter((a) => !a.isGroup)
    .map((a) => {
      const ob = balances[a.id] || { debit: 0, credit: 0 };
      const obDr = (a.openingBalanceDr || 0) + ob.debit;
      const obCr = (a.openingBalanceCr || 0) + ob.credit;
      return {
        accountId: a.id,
        accountCode: a.code,
        accountName: a.name,
        type: a.type,
        debit: obDr > obCr ? obDr - obCr : 0,
        credit: obCr > obDr ? obCr - obDr : 0,
      };
    })
    .filter((r) => r.debit !== 0 || r.credit !== 0);
  const totalDebit = rows.reduce((s, r) => s + r.debit, 0);
  const totalCredit = rows.reduce((s, r) => s + r.credit, 0);
  return { rows, totalDebit, totalCredit };
}
/**
 * Given a start date, frequency, and optional day-of-month,
 * returns the next due date as an ISO date string (YYYY-MM-DD).
 */
export function calculateNextDueDate(
  startDate: string,
  frequency: string,
  dayOfMonth?: number,
): string {
  const base = new Date(startDate);
  if (isNaN(base.getTime())) return new Date().toISOString().split("T")[0];

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  let next = new Date(base);

  const advance = (d: Date): Date => {
    const n = new Date(d);
    switch (frequency) {
      case "daily":
        n.setDate(n.getDate() + 1);
        break;
      case "weekly":
        n.setDate(n.getDate() + 7);
        break;
      case "fortnightly":
        n.setDate(n.getDate() + 14);
        break;
      case "monthly":
        n.setMonth(n.getMonth() + 1);
        if (dayOfMonth) n.setDate(Math.min(dayOfMonth, daysInMonth(n.getFullYear(), n.getMonth())));
        break;
      case "quarterly":
        n.setMonth(n.getMonth() + 3);
        break;
      case "half_yearly":
        n.setMonth(n.getMonth() + 6);
        break;
      case "yearly":
        n.setFullYear(n.getFullYear() + 1);
        break;
      default:
        n.setMonth(n.getMonth() + 1);
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

export function computeProfitLoss(
  accounts: any[],
  vouchers: any[],
  startDate?: string,
  endDate?: string,
): {
  incomeRows: any[];
  expenseRows: any[];
  totalIncome: number;
  totalExpense: number;
  netProfit: number;
} {
  const filtered = vouchers.filter(
    (v) =>
      v.status === "posted" &&
      (!startDate || v.date >= startDate) &&
      (!endDate || v.date <= endDate),
  );

  // Seed balances with each account's opening balance so migrations / partial
  // year-starts that carry an opening position are included in the P&L.
  const balances: Record<string, number> = {};
  for (const acc of accounts) {
    if (
      !acc.isGroup &&
      (acc.type === "income" || acc.type === "revenue" || acc.type === "expense")
    ) {
      const obDr = Number(acc.openingBalanceDr || 0);
      const obCr = Number(acc.openingBalanceCr || 0);
      const ob = Number(acc.openingBalance || 0);
      // Income accounts are credit-nature; expenses are debit-nature.
      if (obDr || obCr) {
        balances[acc.id] = obCr - obDr;
      } else if (ob) {
        balances[acc.id] = acc.type === "expense" ? -ob : ob;
      }
    }
  }

  for (const v of filtered) {
    for (const line of v.lines || []) {
      balances[line.accountId] =
        (balances[line.accountId] || 0) + (line.credit || 0) - (line.debit || 0);
    }
  }
  const incomeRows = accounts
    .filter((a) => !a.isGroup && (a.type === "income" || a.type === "revenue"))
    .map((a) => ({ id: a.id, name: a.name, amount: balances[a.id] || 0 }))
    .filter((r) => r.amount !== 0);
  const expenseRows = accounts
    .filter((a) => !a.isGroup && a.type === "expense")
    .map((a) => ({ id: a.id, name: a.name, amount: Math.abs(balances[a.id] || 0) }))
    .filter((r) => r.amount !== 0);
  const totalIncome = incomeRows.reduce((s, r) => s + r.amount, 0);
  const totalExpense = expenseRows.reduce((s, r) => s + r.amount, 0);
  return {
    incomeRows,
    expenseRows,
    totalIncome,
    totalExpense,
    netProfit: totalIncome - totalExpense,
  };
}

export function computeBalanceSheet(
  accounts: any[],
  vouchers: any[],
  asOfDate?: string,
): {
  assets: any[];
  liabilities: any[];
  equity: any[];
  totalAssets: number;
  totalLiabEquity: number;
} {
  const filtered = vouchers.filter(
    (v) => v.status === "posted" && (!asOfDate || v.date <= asOfDate),
  );
  const balances: Record<string, number> = {};
  for (const acc of accounts) {
    if (!acc.isGroup) balances[acc.id] = (acc.openingBalanceDr || 0) - (acc.openingBalanceCr || 0);
  }
  for (const v of filtered) {
    for (const line of v.lines || []) {
      balances[line.accountId] =
        (balances[line.accountId] || 0) + (line.debit || 0) - (line.credit || 0);
    }
  }
  const pick = (type: string, negate: boolean) =>
    accounts
      .filter((a) => !a.isGroup && a.type === type)
      .map((a) => ({
        id: a.id,
        name: a.name,
        amount: negate ? -(balances[a.id] || 0) : balances[a.id] || 0,
      }))
      .filter((i) => Math.abs(i.amount) > 0.01);
  const assets = pick("asset", false);
  const liabilities = pick("liability", true);
  const equity = pick("equity", true);

  // Add current period net profit to equity so Balance Sheet balances
  // (Assets = Liabilities + Equity + Retained Earnings)
  const pl = computeProfitLoss(accounts, filtered);
  if (Math.abs(pl.netProfit) > 0.01) {
    equity.push({
      id: "__retained_earnings",
      name: "Profit & Loss (Current Period)",
      amount: pl.netProfit,
    });
  }

  const totalAssets = assets.reduce((s, r) => s + r.amount, 0);
  const totalLiabEquity =
    liabilities.reduce((s, r) => s + r.amount, 0) + equity.reduce((s, r) => s + r.amount, 0);
  return { assets, liabilities, equity, totalAssets, totalLiabEquity };
}

export function computeCashFlow(
  accounts: any[],
  vouchers: any[],
  startDate?: string,
  endDate?: string,
): { operating: number; investing: number; financing: number; netChange: number; rows: any[] } {
  const filtered = vouchers.filter(
    (v) =>
      v.status === "posted" &&
      (!startDate || v.date >= startDate) &&
      (!endDate || v.date <= endDate),
  );
  let operating = 0,
    investing = 0,
    financing = 0;
  const rows: any[] = [];

  // Helper to classify by account group rather than just type
  const isCashOrBank = (acc: any) => {
    const g = (acc.group || acc.accountGroup || "").toLowerCase();
    return (
      g === "cash" ||
      g === "bank" ||
      g === "cash-in-hand" ||
      g === "bank accounts" ||
      g === "bank account"
    );
  };
  const isFixedAsset = (acc: any) => {
    const g = (acc.group || acc.accountGroup || "").toLowerCase();
    return g === "fixed assets" || g === "fixed-assets" || g === "investments";
  };
  const isLongTermLiability = (acc: any) => {
    const g = (acc.group || acc.accountGroup || "").toLowerCase();
    return (
      g === "loans (liability)" ||
      g === "secured loans" ||
      g === "unsecured loans" ||
      g === "share capital" ||
      g === "capital account"
    );
  };

  for (const v of filtered) {
    for (const line of v.lines || []) {
      const acc = accounts.find((a) => a.id === line.accountId);
      if (!acc) continue;
      const net = (line.debit || 0) - (line.credit || 0);

      // Skip cash/bank accounts — they are the "cash" being measured
      if (isCashOrBank(acc)) continue;

      let category: "operating" | "investing" | "financing" = "operating";

      if (acc.type === "expense" || acc.type === "income" || acc.type === "revenue") {
        // Income & expense are operating activities
        operating += net;
        category = "operating";
      } else if (acc.type === "asset") {
        if (isFixedAsset(acc)) {
          // Fixed assets / investments → Investing
          investing -= net;
          category = "investing";
        } else {
          // Current assets (receivables, inventory) → Operating (working capital)
          operating -= net;
          category = "operating";
        }
      } else if (acc.type === "liability" || acc.type === "equity") {
        if (isLongTermLiability(acc) || acc.type === "equity") {
          // Long-term loans, capital → Financing
          financing += net;
          category = "financing";
        } else {
          // Current liabilities (payables, duties) → Operating
          operating += net;
          category = "operating";
        }
      }

      rows.push({
        date: v.date,
        description: line.narration || v.narration || acc.name,
        amount: net,
        category,
      });
    }
  }
  return { operating, investing, financing, netChange: operating + investing + financing, rows };
}

export function computeOutstandingPayables(
  parties: any[],
  invoices: any[],
  vouchers: any[] = [],
): { totalAmount: number; parties: Array<{ partyId: string; name: string; amount: number }> } {
  const partyBalances: Record<string, number> = {};
  for (const inv of invoices) {
    if (inv.type !== "purchase-invoice" || inv.status !== "posted") continue;
    const outstanding = computeInvoiceOutstanding(inv, vouchers);
    if (outstanding <= 0.005) continue;
    partyBalances[inv.partyId] = (partyBalances[inv.partyId] || 0) + outstanding;
  }
  const result = Object.entries(partyBalances).map(([partyId, amount]) => {
    const party = parties.find((p) => p.id === partyId);
    return { partyId, name: party?.name || "Unknown", amount };
  });
  return { totalAmount: result.reduce((s, r) => s + r.amount, 0), parties: result };
}

export function computePartyOutstandingSummary(
  partyId: string,
  invoices: any[],
  vouchers: any[] = [],
): {
  totalReceivable: number;
  totalPayable: number;
  netOutstanding: number;
  oldestBillNo: string | null;
  oldestBillDate: string | null;
  oldestDays: number;
} {
  let totalReceivable = 0;
  let totalPayable = 0;
  let oldestBill: any = null;
  const today = new Date().toISOString().slice(0, 10);

  for (const inv of invoices) {
    if (inv.partyId !== partyId || inv.status !== "posted") continue;
    const outstanding = computeInvoiceOutstanding(inv, vouchers);
    if (outstanding <= 0.005) continue;

    if (inv.type === "sales-invoice") {
      totalReceivable += outstanding;
    } else if (inv.type === "purchase-invoice") {
      totalPayable += outstanding;
    } else {
      continue;
    }

    if (!oldestBill || String(inv.date) < String(oldestBill.date)) {
      oldestBill = inv;
    }
  }

  const refDate = oldestBill?.dueDate || oldestBill?.date;
  const oldestDays = refDate
    ? Math.max(
        0,
        Math.floor((new Date(today).getTime() - new Date(refDate).getTime()) / 86400000),
      )
    : 0;

  return {
    totalReceivable,
    totalPayable,
    netOutstanding: totalReceivable - totalPayable,
    oldestBillNo: oldestBill?.invoiceNo ?? null,
    oldestBillDate: oldestBill?.date ?? null,
    oldestDays,
  };
}

export function getAccountBalance(accountId: string, vouchers: any[], accounts?: any[]): number {
  const account = accounts?.find((a) => a.id === accountId);
  const obDr = account?.openingBalanceDr ?? 0;
  const obCr = account?.openingBalanceCr ?? 0;
  let balance = obDr || obCr ? obDr - obCr : (account?.openingBalance ?? 0);
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

export function computeAgingReport(
  invoices: any[],
  parties: any[],
  asOfDate?: string,
  partyType?: string,
): any[] {
  const today = asOfDate ? new Date(asOfDate) : new Date();
  return invoices
    .filter((inv) => {
      if (inv.status === "cancelled") return false;
      if (inv.paymentStatus === "paid") return false;
      if (partyType === "customer" && inv.type !== "sales-invoice") return false;
      if (partyType === "supplier" && inv.type !== "purchase-invoice") return false;
      return true;
    })
    .map((inv) => {
      const party = parties.find((p) => p.id === inv.partyId);
      const due = inv.dueDate ? new Date(inv.dueDate) : new Date(inv.date);
      const daysOverdue = Math.floor((today.getTime() - due.getTime()) / 86400000);
      const outstanding = (inv.grandTotal || 0) - (inv.paidAmount || 0);
      const bucket =
        daysOverdue <= 0
          ? "Not Due"
          : daysOverdue <= 30
            ? "1-30"
            : daysOverdue <= 60
              ? "31-60"
              : daysOverdue <= 90
                ? "61-90"
                : "90+";
      return {
        invoiceId: inv.id,
        invoiceNo: inv.invoiceNo,
        partyId: inv.partyId,
        partyName: party?.name || inv.partyName || "Unknown",
        date: inv.date,
        dueDate: inv.dueDate,
        daysOverdue,
        outstanding,
        bucket,
        type: inv.type,
      };
    });
}

export function computePartyStatement(
  party: any,
  accounts: any[],
  vouchers: any[],
  invoices: any[],
  startDate?: string,
  endDate?: string,
): { rows: any[]; openingBalance: number; closingBalance: number } {
  if (!party) return { rows: [], openingBalance: 0, closingBalance: 0 };
  const partyAccount = accounts.find((a) => a.partyId === party.id || a.name === party.name);
  if (!partyAccount) return { rows: [], openingBalance: 0, closingBalance: 0 };
  const openingBalance =
    (partyAccount.openingBalanceDr || 0) - (partyAccount.openingBalanceCr || 0);
  const rows: any[] = [];
  let runningBalance = openingBalance;
  const relevantVouchers = vouchers
    .filter(
      (v) =>
        v.status === "posted" &&
        (!startDate || v.date >= startDate) &&
        (!endDate || v.date <= endDate) &&
        v.lines?.some((l: any) => l.accountId === partyAccount?.id),
    )
    .sort((a, b) => a.date.localeCompare(b.date));
  for (const v of relevantVouchers) {
    for (const line of v.lines || []) {
      if (line.accountId !== partyAccount?.id) continue;
      const debit = line.debit || 0;
      const credit = line.credit || 0;
      runningBalance += debit - credit;
      rows.push({
        date: v.date,
        voucherNo: v.voucherNo,
        narration: line.narration || v.narration || "",
        debit,
        credit,
        balance: runningBalance,
      });
    }
  }
  return { rows, openingBalance, closingBalance: runningBalance };
}

export function computeOutstandingAnalysis(
  parties: any[],
  invoices: any[],
  vouchers: any[] = [],
): { receivables: any; payables: any } {
  const receivables = computeOutstandingReceivables(parties, invoices, vouchers);
  const payables = computeOutstandingPayables(parties, invoices, vouchers);
  return { receivables, payables };
}

export function computeRatios(
  balanceSheet: any,
  profitLoss: any,
  _accounts?: any[],
): Record<string, number> {
  if (!balanceSheet || !profitLoss) return {};
  // Note: These sum ALL assets/liabilities. For a true current ratio, the balance sheet
  // would need to distinguish current vs fixed. Using totals as a working approximation.
  const totalAssetsVal = (balanceSheet.assets || []).reduce(
    (s: number, a: any) => s + (a.amount || 0),
    0,
  );
  const totalLiabVal = (balanceSheet.liabilities || []).reduce(
    (s: number, a: any) => s + (a.amount || 0),
    0,
  );
  const netProfit = profitLoss.netProfit || 0;
  const totalAssets = balanceSheet.totalAssets || 0;
  return {
    currentRatio: totalLiabVal !== 0 ? Math.round((totalAssetsVal / totalLiabVal) * 100) / 100 : 0,
    returnOnAssets: totalAssets !== 0 ? Math.round((netProfit / totalAssets) * 10000) / 100 : 0,
    netProfitMargin:
      profitLoss.totalIncome !== 0
        ? Math.round((netProfit / profitLoss.totalIncome) * 10000) / 100
        : 0,
  };
}
