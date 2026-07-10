import { createLegacyStateReader } from "@fios/legacy";
import { readAllAccountBalances } from "./accountLedgerReader";
import { buildProfitLossFromProjection } from "./profitLossBuilder";

const state = createLegacyStateReader();

export interface BalanceSheetReport {
  assets: Array<{ id: string; name: string; amount: number }>;
  liabilities: Array<{ id: string; name: string; amount: number }>;
  equity: Array<{ id: string; name: string; amount: number }>;
  totalAssets: number;
  totalLiabEquity: number;
}

export async function buildBalanceSheetFromProjection(
  asOfDate?: string,
): Promise<BalanceSheetReport> {
  const accounts = state.getAccounts() as Array<{
    id: string;
    name: string;
    type: string;
    isGroup?: boolean;
  }>;
  const balances = await readAllAccountBalances();
  const balanceMap = new Map(balances.map((b) => [b.accountId, Number(b.balance ?? 0)]));

  const pick = (type: string, negate: boolean) =>
    accounts
      .filter((a) => !a.isGroup && a.type === type)
      .map((a) => ({
        id: a.id,
        name: a.name,
        amount: negate ? -(balanceMap.get(a.id) ?? 0) : balanceMap.get(a.id) ?? 0,
      }))
      .filter((i) => Math.abs(i.amount) > 0.01);

  const assets = pick("asset", false);
  const liabilities = pick("liability", true);
  const equity = pick("equity", true);
  const pl = await buildProfitLossFromProjection(undefined, asOfDate);
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
