/** Built-in ERP answers when erp_bot backend is unreachable (e.g. on Render without bot service). */

import { ERP_MODULES, type ERPModuleDoc } from "./falcon/erpCodeKnowledge";

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
  pl: "profit-loss",
  pnl: "profit-loss",
  vat: "vat-reports",
  stock: "stock-summary",
  daybook: "day-book",
};

const DEFAULT_SUGGESTIONS = [
  "How do I create a sales invoice?",
  "What is a journal voucher?",
  "How do I view general ledger?",
];

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

function formatModuleAnswer(doc: ERPModuleDoc): string {
  const access = doc.howToAccess.join(" · ");
  const steps = doc.workflow.steps.map((s, i) => `${i + 1}. ${s}`).join("\n");
  const requiredFields = doc.keyFields
    .filter((f) => f.required)
    .map((f) => f.name)
    .join(", ");

  const lines = [
    `**${doc.displayName}**`,
    doc.description,
    "",
    `**Open:** ${access}`,
    "",
    `**Steps:**`,
    steps,
  ];

  if (requiredFields) {
    lines.push("", `**Required fields:** ${requiredFields}`);
  }

  lines.push("", `**Accounting effect:** ${doc.accountingImpact}`);

  if (doc.validationRules.length > 0) {
    lines.push("", "**Rules:**");
    doc.validationRules.slice(0, 4).forEach((r) => lines.push(`- ${r}`));
  }

  if (doc.commonErrors.length > 0) {
    lines.push("", "**Common issues:**");
    doc.commonErrors.slice(0, 3).forEach((e) => {
      lines.push(`- ${e.error} → ${e.solution}`);
    });
  }

  if (doc.vatNote) lines.push("", `**VAT:** ${doc.vatNote}`);
  if (doc.tdsNote) lines.push("", `**TDS:** ${doc.tdsNote}`);

  return lines.join("\n");
}

function formatOverviewAnswer(): string {
  return [
    "**Sutra ERP** is an accounting and inventory system for Nepali businesses.",
    "",
    "**Main areas:**",
    "- **Masters** — parties, items, chart of accounts",
    "- **Transactions** — sales/purchase invoices, receipts, payments, journal & contra",
    "- **Inventory** — stock journals, transfers, GRN, delivery challans",
    "- **Reports** — ledger, trial balance, P&L, balance sheet, VAT, stock summary",
    "",
    "Ask about a specific screen — e.g. *journal voucher*, *general ledger*, *sales invoice*.",
  ].join("\n");
}

export function buildModuleSuggestions(moduleKey?: string): string[] {
  const doc = moduleKey ? ERP_MODULES[moduleKey] : undefined;
  if (!doc?.relatedModules?.length) return DEFAULT_SUGGESTIONS;
  return doc.relatedModules.slice(0, 3).map((id) => {
    const related = ERP_MODULES[id];
    return related ? `Tell me about ${related.displayName}` : `Tell me about ${id}`;
  });
}

export function buildBuiltinErpAnswer(query: string, route?: string): string {
  const moduleKey = resolveModuleKey(query, route);
  const doc = moduleKey ? ERP_MODULES[moduleKey] : undefined;

  if (doc) return formatModuleAnswer(doc);

  if (route) {
    const routeKey = resolveModuleKey("", route);
    const routeDoc = routeKey ? ERP_MODULES[routeKey] : undefined;
    if (routeDoc) return formatModuleAnswer(routeDoc);
  }

  return formatOverviewAnswer();
}

export function resolveBuiltinModuleKey(query: string, route?: string): string | undefined {
  return resolveModuleKey(query, route) ?? (route ? resolveModuleKey("", route) : undefined);
}
