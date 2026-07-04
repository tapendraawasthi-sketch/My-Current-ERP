/** Built-in ERP answers when erp_bot backend is unreachable (e.g. on Render without bot service). */

import { ERP_MODULES, type ERPModuleDoc } from "./falcon/erpCodeKnowledge";

/** Longer phrases first — matched in descending length order. */
const QUERY_MODULE_MAP: Record<string, string> = {
  "journal voucher": "journal-voucher",
  "journal entry": "journal-voucher",
  "journal-voucher": "journal-voucher",
  "payment voucher": "payment-voucher",
  "receipt voucher": "receipt-voucher",
  "contra voucher": "contra-voucher",
  "sales return": "sales-return",
  "purchase return": "purchase-return",
  "sales invoice": "sales-invoice",
  "purchase invoice": "purchase-invoice",
  "general ledger": "general-ledger",
  "chart of accounts": "chart-of-accounts",
  "profit and loss": "profit-loss",
  "profit & loss": "profit-loss",
  "trial balance": "trial-balance",
  "balance sheet": "balance-sheet",
  "day book": "day-book",
  "vat report": "vat-reports",
  "vat return": "vat-reports",
  "stock summary": "stock-summary",
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
  sales: "sales-invoice",
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

const QUERY_KEYWORDS_SORTED = Object.entries(QUERY_MODULE_MAP).sort(
  (a, b) => b[0].length - a[0].length,
);

const DEFAULT_SUGGESTIONS = [
  "How do I create a sales invoice?",
  "What is a journal voucher?",
  "How do I view general ledger?",
];

function matchExplicitQuery(query: string): string | undefined {
  const q = query.toLowerCase().trim();
  if (!q) return undefined;
  for (const [keyword, moduleId] of QUERY_KEYWORDS_SORTED) {
    if ((keyword.includes(" ") || keyword.includes("-")) && q.includes(keyword)) {
      return moduleId;
    }
  }
  return undefined;
}

/** Short queries where a module keyword is the main subject (e.g. "journal", "journal how?"). */
function matchTopicQuery(query: string): string | undefined {
  const q = query.toLowerCase().replace(/[?.,!]/g, "").trim();
  const words = q.split(/\s+/).filter(Boolean);
  if (words.length === 0 || words.length > 4) return undefined;
  for (const [keyword, moduleId] of QUERY_KEYWORDS_SORTED) {
    if (keyword.includes(" ") || keyword.includes("-")) continue;
    if (words.some((w) => w === keyword || w.startsWith(keyword))) return moduleId;
  }
  return undefined;
}

function matchSingleWordQuery(query: string): string | undefined {
  const q = query.toLowerCase().trim();
  if (!q) return undefined;
  for (const [keyword, moduleId] of QUERY_KEYWORDS_SORTED) {
    if (!keyword.includes(" ") && !keyword.includes("-") && q.includes(keyword)) {
      return moduleId;
    }
  }
  return undefined;
}

function matchRouteToModule(route: string): string | undefined {
  const normalized = route.toLowerCase().replace(/\//g, "");
  if (ROUTE_ALIASES[normalized]) return ROUTE_ALIASES[normalized];
  if (ERP_MODULES[normalized]) return normalized;
  const byRoute = Object.values(ERP_MODULES).find(
    (m) => m.route === normalized || m.id === normalized,
  );
  if (byRoute) return byRoute.id;
  return Object.keys(ERP_MODULES).find(
    (k) => k.includes(normalized) || normalized.includes(k),
  );
}

/** Explicit query terms beat page route; route beats incidental keyword mentions in longer questions. */
function resolveModuleKey(query: string, route?: string): string | undefined {
  const explicit = matchExplicitQuery(query);
  if (explicit) return explicit;

  const topic = matchTopicQuery(query);
  if (topic) return topic;

  if (route) {
    const fromRoute = matchRouteToModule(route);
    if (fromRoute) return fromRoute;
  }

  return matchSingleWordQuery(query);
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
  return formatOverviewAnswer();
}

export function resolveBuiltinModuleKey(query: string, route?: string): string | undefined {
  return resolveModuleKey(query, route);
}
