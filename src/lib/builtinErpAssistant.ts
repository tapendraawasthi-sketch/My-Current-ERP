/** Built-in ERP answers when erp_bot backend is unreachable (e.g. on Render without bot service). */

import { ERP_MODULES, getModuleContext } from "./falcon/erpCodeKnowledge";

const QUERY_MODULE_MAP: Record<string, string> = {
  journal: "journal-voucher",
  ledger: "general-ledger",
  invoice: "sales-invoice",
  sales: "sales-invoice",
  purchase: "purchase-invoice",
  receipt: "receipt-voucher",
  payment: "payment-voucher",
  contra: "contra-voucher",
  vat: "vat-reports",
  stock: "stock-summary",
  party: "parties",
  item: "items",
  balance: "balance-sheet",
  trial: "trial-balance",
  daybook: "day-book",
  payroll: "payroll",
};

const ROUTE_ALIASES: Record<string, string> = {
  ledger: "general-ledger",
  billing: "sales-invoice",
  journal: "journal-voucher",
  receipt: "receipt-voucher",
  payment: "payment-voucher",
  contra: "contra-voucher",
  coa: "chart-of-accounts",
  "chart-of-accounts": "chart-of-accounts",
  pl: "profit-loss",
  pnl: "profit-loss",
  vat: "vat-reports",
  stock: "stock-summary",
  daybook: "day-book",
};

function resolveModuleKey(query: string, route?: string): string | undefined {
  if (route) {
    const normalized = route.toLowerCase().replace(/\//g, "");
    if (ROUTE_ALIASES[normalized]) return ROUTE_ALIASES[normalized];
    if (ERP_MODULES[normalized]) return normalized;
    const byRoute = Object.values(ERP_MODULES).find(
      (m) => m.route === normalized || m.id === normalized,
    );
    if (byRoute) return byRoute.id;
    const partial = Object.keys(ERP_MODULES).find(
      (k) => k.includes(normalized) || normalized.includes(k),
    );
    if (partial) return partial;
  }

  const q = query.toLowerCase();
  for (const [keyword, moduleId] of Object.entries(QUERY_MODULE_MAP)) {
    if (q.includes(keyword)) return moduleId;
  }
  return undefined;
}

export function buildBuiltinErpAnswer(query: string, route?: string): string {
  const moduleKey = resolveModuleKey(query, route);
  const moduleCtx = moduleKey ? getModuleContext(moduleKey) : route ? getModuleContext(route) : "";

  if (moduleCtx && !moduleCtx.includes("general ERP knowledge")) {
    const doc = moduleKey ? ERP_MODULES[moduleKey] : undefined;
    const title = doc?.displayName || route || "this module";
    return (
      `**Summary**: Here is how **${title}** works in Sutra ERP (built-in module guide — no API keys).\n\n` +
      `**Module guide**:\n\n${moduleCtx}\n\n` +
      `**Note**: For live codebase search and deeper tracing across files, run \`erp_bot\` locally (\`python erp_bot/scripts/start.py\`).`
    );
  }

  return (
    `**Summary**: Sutra ERP is a multi-tenant accounting and inventory system (React frontend, Express/PostgreSQL backend).\n\n` +
    `**How it works**:\n` +
    `- **Masters**: parties, items, chart of accounts, warehouses\n` +
    `- **Transactions**: sales/purchase invoices, receipts, payments, journal & contra vouchers\n` +
    `- **Inventory**: stock journals, transfers, GRN, delivery challans\n` +
    `- **Reports**: ledger, trial balance, P&L, balance sheet, VAT, stock summary\n` +
    `- **Posting**: double-entry; ledger_postings are insert-only (reversals for corrections)\n\n` +
    `Ask about a specific screen (e.g. "journal voucher", "general ledger", "sales invoice") for detailed steps.\n\n` +
    `**Note**: Built-in guide mode (no API). For full AI codebase search, start local \`erp_bot\`.`
  );
}
