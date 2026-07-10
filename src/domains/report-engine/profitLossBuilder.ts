import { createLegacyStateReader } from "@fios/legacy";
import { readGeneralLedgerFromProjection } from "./generalLedgerProjectionReader";

const state = createLegacyStateReader();

export interface ProfitLossReport {
  incomeRows: Array<{ id: string; name: string; amount: number }>;
  expenseRows: Array<{ id: string; name: string; amount: number }>;
  totalIncome: number;
  totalExpense: number;
  netProfit: number;
}

export async function buildProfitLossFromProjection(
  startDate?: string,
  endDate?: string,
): Promise<ProfitLossReport> {
  const accounts = state.getAccounts() as Array<{
    id: string;
    name: string;
    type: string;
    isGroup?: boolean;
  }>;
  const ledger = await readGeneralLedgerFromProjection();
  const filtered = ledger.filter((e) => {
    if (startDate && e.date < startDate) return false;
    if (endDate && e.date > endDate) return false;
    return true;
  });

  const balances: Record<string, number> = {};
  for (const entry of filtered) {
    balances[entry.accountId] =
      (balances[entry.accountId] ?? 0) + entry.credit - entry.debit;
  }

  const incomeRows = accounts
    .filter((a) => !a.isGroup && (a.type === "income" || a.type === "revenue"))
    .map((a) => ({ id: a.id, name: a.name, amount: balances[a.id] ?? 0 }))
    .filter((r) => Math.abs(r.amount) > 0.01);

  const expenseRows = accounts
    .filter((a) => !a.isGroup && a.type === "expense")
    .map((a) => ({ id: a.id, name: a.name, amount: -(balances[a.id] ?? 0) }))
    .filter((r) => Math.abs(r.amount) > 0.01);

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
