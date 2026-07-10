import { readTrialBalanceFromProjection } from "./trialBalanceProjectionReader";
import { buildInventoryValuationReport } from "./inventoryValuationReport";
import { readAllAccountBalances } from "./accountLedgerReader";

export interface DashboardQueryResult {
  totalDebit: number;
  totalCredit: number;
  accountCount: number;
  stockValue: number;
  stockItemCount: number;
}

export async function runDashboardQuery(): Promise<DashboardQueryResult> {
  const tb = await readTrialBalanceFromProjection();
  const stock = await buildInventoryValuationReport();
  const accounts = await readAllAccountBalances();
  return {
    totalDebit: tb.totalDebit,
    totalCredit: tb.totalCredit,
    accountCount: accounts.length,
    stockValue: stock.totalValue,
    stockItemCount: stock.rows.length,
  };
}
