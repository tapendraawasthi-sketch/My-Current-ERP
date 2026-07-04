/** Built-in ERP answers when erp_bot backend is unreachable (e.g. on Render without bot service). */

import { ERP_MODULES, type ERPModuleDoc } from "./falcon/erpCodeKnowledge";
import { classifyIntent, formatNavAnswer, type FalconIntent } from "./falcon/intentTaxonomy";
import { getNavigationPathWithShortcut } from "./falcon/codeStructureParser";
import { postComposeScope } from "./falcon/intentTaxonomy";

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

export function resolveBuiltinModuleKey(query: string, route?: string): string | undefined {
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

function formatModuleByIntent(doc: ERPModuleDoc, intent: FalconIntent, moduleKey: string): string {
  const nav = getNavigationPathWithShortcut(moduleKey);

  switch (intent) {
    case "action_path":
    case "nav": {
      if (nav) return formatNavAnswer(nav.path, nav.shortcut);
      const path = doc.howToAccess.find((a) => !/^F\d+|^Press/i.test(a)) || doc.howToAccess[0];
      const shortcutLine = doc.howToAccess.find((a) => /F\d+|Ctrl\+/i.test(a));
      const shortcut = shortcutLine?.match(/F\d+|Ctrl\+[A-Z]/i)?.[0];
      return formatNavAnswer(path.replace(/^Press\s+/i, ""), shortcut);
    }
    case "steps":
      return doc.workflow.steps.map((s, i) => `${i + 1}. ${s}`).join("\n");
    case "definition":
      return postComposeScope(`**${doc.displayName}**\n${doc.description}`, "definition");
    case "effect":
      return postComposeScope(
        `**${doc.displayName} — Accounting Effect:**\n${doc.accountingImpact}`,
        "effect",
      );
    case "troubleshoot": {
      const err = doc.commonErrors[0];
      if (!err) return `No known issues documented for ${doc.displayName}.`;
      return `**Problem:** ${err.error}\n\n**Solution:** ${err.solution}`;
    }
    default:
      return postComposeScope(`**${doc.displayName}**\n${doc.description}`, "definition");
  }
}

function formatOverviewAnswer(): string {
  return [
    "**Sutra ERP** is an accounting and inventory system for Nepali businesses.",
    "",
    "Ask about a specific feature — e.g. *journal voucher*, *how to make payment voucher*, *trial balance*.",
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

export function buildBuiltinErpAnswer(
  query: string,
  route?: string,
  intent?: FalconIntent,
): string {
  const resolvedIntent = intent ?? classifyIntent(query);
  const moduleKey = resolveBuiltinModuleKey(query, route);
  const doc = moduleKey ? ERP_MODULES[moduleKey] : undefined;
  if (doc) return formatModuleByIntent(doc, resolvedIntent, moduleKey);
  return formatOverviewAnswer();
}
