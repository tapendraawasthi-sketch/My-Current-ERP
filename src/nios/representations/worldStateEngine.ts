/**
 * World State Engine — TS mirror (Phase 4)
 */

export const WORLD_STATE_DOMAINS = [
  "business",
  "economy",
  "law",
  "market",
  "tax",
  "inventory",
  "employees",
  "customers",
  "competitors",
  "macroeconomics",
  "political_risk",
  "currency_banking",
] as const;

export type WorldStateDomain = (typeof WORLD_STATE_DOMAINS)[number];

export interface WorldStateSummary {
  domain_count?: number;
  slice_count?: number;
  liquidity?: number;
  working_capital?: number;
  vat_estimate?: number;
  filing_status?: string;
}

export function balanceToBusinessSlice(balance: Record<string, number>): Record<string, number> {
  const cash = balance.cash ?? balance.cashBalance ?? 0;
  const bank = balance.bank ?? balance.bankBalance ?? 0;
  const receivable = balance.receivable ?? balance.receivables ?? 0;
  const payable = balance.payable ?? balance.payables ?? 0;
  return {
    cash,
    bank,
    receivable,
    payable,
    liquidity: cash + bank,
    working_capital: receivable - payable,
  };
}

export function domainsForIntent(intent: string): WorldStateDomain[] {
  const map: Record<string, WorldStateDomain[]> = {
    ledger_query: ["business", "customers"],
    tax_query: ["tax", "law", "business"],
    simulation: ["business", "employees", "tax"],
    scenario: ["business", "economy", "market"],
    accounting_qa: ["law", "tax"],
    khata_entry: ["business", "customers"],
  };
  return map[intent] ?? ["business", "tax"];
}
