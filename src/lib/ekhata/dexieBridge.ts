/**
 * Dexie Bridge — exposes IndexedDB ledger data for e-Khata AI.
 *
 * Source of truth: Dexie `vouchers` (khata_* types) + `accounts` balances.
 * Frontend pushes snapshots to the Python backend on each chat request.
 */

import { getDB } from "../db";
import { CA_CHART_OF_ACCOUNTS } from "./caAccountClassification";

const CHART_NAMES = Object.fromEntries(
  CA_CHART_OF_ACCOUNTS.map((a) => [a.code, a.name]),
) as Record<string, string>;

export interface PartyBalance {
  party: string;
  totalReceivable: number;
  totalPayable: number;
  netBalance: number;
  lastTransactionDate: string;
  transactionCount: number;
}

export interface AccountBalance {
  accountCode: string;
  accountName: string;
  debitTotal: number;
  creditTotal: number;
  balance: number;
}

export interface TrialBalanceRow {
  account: string;
  name: string;
  debit: number;
  credit: number;
}

export interface KhataVoucherSummary {
  id: string;
  date: string;
  narration?: string;
  amount: number;
  party?: string;
  intent: string;
  voucherNo: string;
}

/** Posted e-Khata vouchers from Dexie */
export async function getKhataVouchers() {
  const db = getDB();
  return db.vouchers
    .filter((v) => Boolean(v.type?.startsWith("khata_")) && v.status === "posted")
    .toArray();
}

async function accountCodeById(): Promise<Map<string, string>> {
  const db = getDB();
  const accounts = await db.accounts.toArray();
  return new Map(accounts.map((a) => [a.id, a.code]));
}

function matchParty(name: string | undefined, query: string): boolean {
  if (!name || !query) return false;
  return name.toLowerCase().includes(query.toLowerCase());
}

/** Running receivable/payable for a party from khata vouchers */
export async function getPartyBalance(partyName: string): Promise<PartyBalance> {
  const vouchers = await getKhataVouchers();
  const codeMap = await accountCodeById();

  let totalReceivable = 0;
  let totalPayable = 0;
  let lastDate = "";
  let count = 0;

  for (const v of vouchers) {
    if (!matchParty(v.partyName, partyName)) continue;
    count += 1;
    if ((v.date || "") > lastDate) lastDate = v.date || "";

    for (const line of v.lines || []) {
      const code = codeMap.get(line.accountId) || "";
      if (code === "KH-DEBT") {
        totalReceivable += (line.debit || 0) - (line.credit || 0);
      }
      if (code === "KH-CRED") {
        totalPayable += (line.credit || 0) - (line.debit || 0);
      }
    }
  }

  return {
    party: partyName,
    totalReceivable: Math.max(0, totalReceivable),
    totalPayable: Math.max(0, totalPayable),
    netBalance: totalReceivable - totalPayable,
    lastTransactionDate: lastDate,
    transactionCount: count,
  };
}

/** Balance for a KH-* account code */
export async function getAccountBalance(accountCode: string): Promise<AccountBalance> {
  const db = getDB();
  const acct = await db.accounts.filter((a) => a.code === accountCode).first();

  let debitTotal = 0;
  let creditTotal = 0;
  const vouchers = await getKhataVouchers();
  const codeMap = await accountCodeById();

  for (const v of vouchers) {
    for (const line of v.lines || []) {
      const code = codeMap.get(line.accountId) || "";
      if (code === accountCode) {
        debitTotal += line.debit || 0;
        creditTotal += line.credit || 0;
      }
    }
  }

  const ledgerBalance = acct?.balance ?? debitTotal - creditTotal;

  return {
    accountCode,
    accountName: CHART_NAMES[accountCode] || acct?.name || accountCode,
    debitTotal,
    creditTotal,
    balance: ledgerBalance,
  };
}

/** Trial balance from all khata voucher lines */
export async function getTrialBalance(): Promise<{
  rows: TrialBalanceRow[];
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
}> {
  const vouchers = await getKhataVouchers();
  const codeMap = await accountCodeById();
  const accountTotals: Record<string, { debit: number; credit: number }> = {};

  for (const v of vouchers) {
    for (const line of v.lines || []) {
      const code = codeMap.get(line.accountId);
      if (!code) continue;
      if (!accountTotals[code]) accountTotals[code] = { debit: 0, credit: 0 };
      accountTotals[code].debit += line.debit || 0;
      accountTotals[code].credit += line.credit || 0;
    }
  }

  const rows: TrialBalanceRow[] = Object.entries(accountTotals)
    .map(([account, totals]) => ({
      account,
      name: CHART_NAMES[account] || account,
      debit: totals.debit,
      credit: totals.credit,
    }))
    .filter((r) => r.debit > 0 || r.credit > 0)
    .sort((a, b) => a.account.localeCompare(b.account));

  const totalDebit = rows.reduce((s, r) => s + r.debit, 0);
  const totalCredit = rows.reduce((s, r) => s + r.credit, 0);

  return {
    rows,
    totalDebit,
    totalCredit,
    isBalanced: Math.abs(totalDebit - totalCredit) < 0.01,
  };
}

/** Search khata vouchers by narration, party, or amount */
export async function searchEntries(
  query: string,
  daysBack = 30,
): Promise<KhataVoucherSummary[]> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysBack);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const vouchers = await getKhataVouchers();
  const q = query.toLowerCase();

  return vouchers
    .filter((e) => (e.date || "") >= cutoffStr)
    .filter(
      (e) =>
        (e.narration && e.narration.toLowerCase().includes(q)) ||
        (e.partyName && e.partyName.toLowerCase().includes(q)) ||
        String(e.grandTotal || e.amount || "").includes(q),
    )
    .slice(0, 20)
    .map((e) => ({
      id: e.id,
      date: e.date,
      narration: e.narration,
      amount: e.grandTotal || e.amount || 0,
      party: e.partyName,
      intent: e.type,
      voucherNo: e.voucherNo,
    }));
}

/** Check duplicate khata entry today */
export async function checkTodayDuplicate(
  party: string,
  amount: number,
  entryType: string,
): Promise<{ duplicate: boolean; match?: KhataVoucherSummary }> {
  const today = new Date().toISOString().slice(0, 10);
  const vouchers = await getKhataVouchers();

  for (const v of vouchers) {
    if (
      v.date === today &&
      matchParty(v.partyName, party) &&
      Math.abs((v.grandTotal || 0) - amount) < 0.01 &&
      (v.type === entryType || v.type?.includes(entryType.replace("khata_", "")))
    ) {
      return {
        duplicate: true,
        match: {
          id: v.id,
          date: v.date,
          narration: v.narration,
          amount: v.grandTotal || 0,
          party: v.partyName,
          intent: v.type,
          voucherNo: v.voucherNo,
        },
      };
    }
  }
  return { duplicate: false };
}

/** P&L summary for a period */
export async function computePnL(
  period: "today" | "this_week" | "current_month" | "last_month" | "current_fy" = "current_month",
): Promise<{
  totalIncome: number;
  totalExpense: number;
  netProfit: number;
  entryCount: number;
}> {
  const now = new Date();
  let start = new Date(now);

  if (period === "today") {
    /* same day */
  } else if (period === "this_week") {
    start.setDate(now.getDate() - 7);
  } else if (period === "last_month") {
    start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    now.setDate(0);
  } else if (period === "current_fy") {
    // Nepal FY ~ Shrawan: approximate July start
    const fyStartMonth = now.getMonth() >= 6 ? 6 : 6;
    start = new Date(now.getFullYear() - (now.getMonth() < 6 ? 1 : 0), fyStartMonth, 1);
  } else {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  const startStr = start.toISOString().slice(0, 10);
  const endStr = new Date().toISOString().slice(0, 10);
  const vouchers = await getKhataVouchers();
  const codeMap = await accountCodeById();

  let totalIncome = 0;
  let totalExpense = 0;
  let entryCount = 0;

  const incomeCodes = new Set(["KH-SALE", "KH-OTH-INC", "KH-DISC-REC", "KH-BD-REC", "KH-INT-INC"]);
  const expenseCodes = new Set([
    "KH-PUR",
    "KH-EXP",
    "KH-SAL",
    "KH-DEPR",
    "KH-BD-EXP",
    "KH-BANK-CHG",
    "KH-DISC-ALL",
    "KH-SSF-ER-EXP",
    "KH-GRAT-EXP",
    "KH-INT-EXP",
  ]);

  for (const v of vouchers) {
    if ((v.date || "") < startStr || (v.date || "") > endStr) continue;
    entryCount += 1;
    for (const line of v.lines || []) {
      const code = codeMap.get(line.accountId) || "";
      if (incomeCodes.has(code)) totalIncome += (line.credit || 0) - (line.debit || 0);
      if (expenseCodes.has(code)) totalExpense += (line.debit || 0) - (line.credit || 0);
    }
  }

  return {
    totalIncome: Math.round(totalIncome * 100) / 100,
    totalExpense: Math.round(totalExpense * 100) / 100,
    netProfit: Math.round((totalIncome - totalExpense) * 100) / 100,
    entryCount,
  };
}

/** Snapshot pushed to Python backend on each chat turn */
export async function buildSessionSnapshot(): Promise<Record<string, unknown>> {
  const [cashBal, bankBal, tb, pnl] = await Promise.all([
    getAccountBalance("KH-CASH"),
    getAccountBalance("KH-BANK"),
    getTrialBalance(),
    computePnL("current_month"),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const vouchers = await getKhataVouchers();
  const todayEntries = vouchers.filter((v) => v.date === today).length;

  const recent = [...vouchers]
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
    .slice(0, 20);

  const recentParties = [
    ...new Set(recent.map((e) => e.partyName).filter(Boolean) as string[]),
  ];

  const partyBalances: Record<string, number> = {};
  const partyAvgAmount: Record<string, number> = {};
  for (const party of recentParties.slice(0, 8)) {
    const bal = await getPartyBalance(party);
    partyBalances[party] = bal.netBalance;
    const partyVouchers = vouchers.filter((v) =>
      v.partyName?.toLowerCase().includes(party.toLowerCase()),
    );
    if (partyVouchers.length > 0) {
      const total = partyVouchers.reduce((s, v) => s + (v.grandTotal || v.amount || 0), 0);
      partyAvgAmount[party] = Math.round((total / partyVouchers.length) * 100) / 100;
    }
  }

  const recentEntries = vouchers
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
    .slice(0, 100)
    .map((v) => ({
      id: v.id,
      date: v.date,
      narration: v.narration,
      amount: v.grandTotal || v.amount || 0,
      party: v.partyName,
      intent: v.type,
    }));

  return {
    cash_balance: cashBal.balance,
    bank_balance: bankBal.balance,
    today_entry_count: todayEntries,
    total_entries: vouchers.length,
    recent_parties: recentParties,
    party_balances: partyBalances,
    party_avg_amount: partyAvgAmount,
    recent_entries: recentEntries,
    trial_balance: tb,
    trial_balance_balanced: tb.isBalanced,
    vat_output_total: tb.rows.find((r) => r.account === "KH-VAT-OUT")?.credit || 0,
    vat_input_total: tb.rows.find((r) => r.account === "KH-VAT-IN")?.debit || 0,
    tds_payable: tb.rows.find((r) => r.account === "KH-TDS-PAY")?.credit || 0,
    month_income: pnl.totalIncome,
    month_expense: pnl.totalExpense,
    month_profit: pnl.netProfit,
  };
}
