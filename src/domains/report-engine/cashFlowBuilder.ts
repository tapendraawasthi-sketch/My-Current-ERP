import { createLegacyStateReader } from "@fios/legacy";
import { readGeneralLedgerFromProjection } from "./generalLedgerProjectionReader";

const state = createLegacyStateReader();

export interface CashFlowReport {
  operating: number;
  investing: number;
  financing: number;
  netChange: number;
  rows: Array<{ date: string; category: string; amount: number }>;
}

export async function buildCashFlowFromProjection(
  startDate?: string,
  endDate?: string,
): Promise<CashFlowReport> {
  const accounts = state.getAccounts() as Array<{
    id: string;
    type: string;
    group?: string;
    accountGroup?: string;
  }>;
  const ledger = await readGeneralLedgerFromProjection();
  const filtered = ledger.filter((e) => {
    if (startDate && e.date < startDate) return false;
    if (endDate && e.date > endDate) return false;
    return true;
  });

  let operating = 0;
  let investing = 0;
  let financing = 0;
  const rows: CashFlowReport["rows"] = [];

  for (const entry of filtered) {
    const acc = accounts.find((a) => a.id === entry.accountId);
    if (!acc) continue;
    const net = entry.debit - entry.credit;
    let category: "operating" | "investing" | "financing" = "operating";
    if (acc.type === "expense" || acc.type === "income" || acc.type === "revenue") {
      operating += net;
      category = "operating";
    } else if (acc.type === "asset") {
      investing += net;
      category = "investing";
    } else if (acc.type === "liability" || acc.type === "equity") {
      financing += net;
      category = "financing";
    }
    rows.push({ date: entry.date, category, amount: net });
  }

  return {
    operating,
    investing,
    financing,
    netChange: operating + investing + financing,
    rows,
  };
}
