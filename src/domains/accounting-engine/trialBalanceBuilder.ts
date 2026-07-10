import { createLegacyStateReader } from "@fios/legacy";
import { computeTrialBalance as legacyComputeTrialBalance } from "@/lib/accounting";
import { listAccountingAggregates, listShadowVouchers } from "./accountingSnapshot";

const state = createLegacyStateReader();

export interface TrialBalanceRow {
  accountId: string;
  accountName?: string;
  debit: number;
  credit: number;
}

export interface TrialBalanceResult {
  rows: TrialBalanceRow[];
  totalDebit: number;
  totalCredit: number;
}

export function buildShadowTrialBalance(): TrialBalanceResult {
  const aggregates = listAccountingAggregates();
  const accounts = state.getAccounts() as Array<{ id: string; name?: string; isGroup?: boolean }>;
  const accountMap = new Map(accounts.map((a) => [a.id, a]));

  const rows: TrialBalanceRow[] = aggregates
    .map((agg) => {
      const account = accountMap.get(agg.accountId);
      if (account?.isGroup) return null;
      const net = agg.balance;
      return {
        accountId: agg.accountId,
        accountName: account?.name,
        debit: net > 0 ? net : 0,
        credit: net < 0 ? -net : 0,
      };
    })
    .filter((r): r is TrialBalanceRow => r !== null && (r.debit !== 0 || r.credit !== 0));

  const totalDebit = rows.reduce((s, r) => s + r.debit, 0);
  const totalCredit = rows.reduce((s, r) => s + r.credit, 0);
  return { rows, totalDebit, totalCredit };
}

export function buildLegacyTrialBalance(): TrialBalanceResult {
  const result = legacyComputeTrialBalance(state.getAccounts(), state.getVouchers());
  return {
    rows: result.rows.map((r) => ({
      accountId: r.accountId,
      accountName: r.accountName,
      debit: r.debit,
      credit: r.credit,
    })),
    totalDebit: result.totalDebit,
    totalCredit: result.totalCredit,
  };
}

export function buildTrialBalanceFromVouchers(): TrialBalanceResult {
  const vouchers = listShadowVouchers().filter((v) => v.status === "posted");
  const balances = new Map<string, { debit: number; credit: number }>();
  for (const voucher of vouchers) {
    for (const line of voucher.lines) {
      const existing = balances.get(line.accountId) ?? { debit: 0, credit: 0 };
      existing.debit += line.debit;
      existing.credit += line.credit;
      balances.set(line.accountId, existing);
    }
  }
  const rows: TrialBalanceRow[] = [];
  for (const [accountId, bal] of balances) {
    const net = bal.debit - bal.credit;
    rows.push({
      accountId,
      debit: net > 0 ? net : 0,
      credit: net < 0 ? -net : 0,
    });
  }
  const totalDebit = rows.reduce((s, r) => s + r.debit, 0);
  const totalCredit = rows.reduce((s, r) => s + r.credit, 0);
  return { rows, totalDebit, totalCredit };
}
