// src/lib/falcon/engine.ts
// Falcon's local matching engine. No external API calls — pure client-side
// keyword scoring against the knowledge base, boosted by current page context.

import { FALCON_KB, type FalconKBEntry } from "./knowledgeBase";

export interface FalconContext {
  route?: string;
  module?: string;
  pageTitle?: string;
}

export interface FalconAnswer {
  text: string;
  matchedEntry: FalconKBEntry | null;
  confidence: number;
  suggestions: string[];
  fallback: boolean;
}

// Route → module mapping so Falcon can boost relevant answers based on
// whichever screen the user is currently on. Extend this map any time you
// add a new page to App.tsx.
const ROUTE_MODULE_MAP: Record<string, string> = {
  dashboard: "reports",
  accounts: "accounts",
  "chart-of-accounts": "accounts",
  parties: "parties",
  "item-master": "inventory",
  items: "inventory",
  "stock-book": "inventory",
  warehouses: "inventory",
  units: "inventory",
  "stock-transfer": "inventory",
  "physical-stock": "inventory",
  billing: "sales",
  sales: "sales",
  "sales-return": "sales",
  "sales-order": "sales",
  quotation: "sales",
  purchase: "purchase",
  "purchase-return": "purchase",
  "purchase-order": "purchase",
  "goods-receipt": "inventory",
  "delivery-challan": "inventory",
  payment: "payment",
  receipt: "receipt",
  journal: "journal",
  contra: "contra",
  "debit-note": "purchase",
  "credit-note": "sales",
  "balance-sheet": "reports",
  "profit-loss": "reports",
  "trial-balance": "reports",
  "day-book": "reports",
  ledger: "reports",
  "cash-flow": "reports",
  "aging-report": "reports",
  "outstanding-receivables": "reports",
  "outstanding-payables": "reports",
  "stock-summary": "inventory",
  "vat-reports": "vat",
  gstr1: "vat",
  payroll: "payroll",
  "fiscal-year": "admin",
  "audit-log": "admin",
  backup: "admin",
  users: "admin",
  settings: "admin",
  "pos-mode": "pos",
  "approval-workflow": "journal",
  "recurring-vouchers": "journal",
  budget: "accounts",
  "cost-centers": "accounts",
};

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
}

function tokenize(s: string): string[] {
  return normalize(s).split(" ").filter((t) => t.length > 1);
}

// Simple stemmer-lite: strips common suffixes so "vouchers" matches "voucher"
function stem(token: string): string {
  return token.replace(/(ing|es|s)$/i, "");
}

function scoreEntry(entry: FalconKBEntry, queryTokens: string[], currentModule?: string): number {
  let score = 0;
  const queryStems = queryTokens.map(stem);

  for (const kw of entry.keywords) {
    const kwTokens = tokenize(kw);
    const kwStems = kwTokens.map(stem);

    // Exact phrase match is the strongest signal
    const normalizedQuery = " " + queryTokens.join(" ") + " ";
    if (normalizedQuery.includes(" " + normalize(kw) + " ")) {
      score += 12;
      continue;
    }

    // Token/stem overlap
    for (const kws of kwStems) {
      if (queryStems.includes(kws)) score += 3;
    }
  }

  // Boost if title words appear in the query
  const titleStems = tokenize(entry.title).map(stem);
  for (const ts of titleStems) {
    if (queryStems.includes(ts)) score += 2;
  }

  // Boost matching current page/module context
  if (currentModule && entry.module === currentModule) {
    score += 4;
  }

  return score;
}

const MIN_CONFIDENT_SCORE = 5;

export function askFalcon(question: string, context?: FalconContext): FalconAnswer {
  const trimmed = question.trim();
  if (!trimmed) {
    return {
      text: "Ask me anything about Sutra ERP — vouchers, ledgers, inventory, VAT, reports, payroll or settings.",
      matchedEntry: null,
      confidence: 0,
      suggestions: defaultSuggestions(context),
      fallback: true,
    };
  }

  const queryTokens = tokenize(trimmed);
  const currentModule = context?.module || (context?.route ? ROUTE_MODULE_MAP[context.route] : undefined);

  let best: FalconKBEntry | null = null;
  let bestScore = 0;

  for (const entry of FALCON_KB) {
    const s = scoreEntry(entry, queryTokens, currentModule);
    if (s > bestScore) {
      bestScore = s;
      best = entry;
    }
  }

  if (best && bestScore >= MIN_CONFIDENT_SCORE) {
    return {
      text: best.answer,
      matchedEntry: best,
      confidence: Math.min(1, bestScore / 20),
      suggestions: best.followups?.length ? best.followups : contextualSuggestions(currentModule),
      fallback: false,
    };
  }

  // Low-confidence fallback — never invent an answer.
  return {
    text:
      "I can help with Sutra ERP workflows, but I don't have a confident answer for that exact wording yet. Try rephrasing with the voucher type, screen name, or report you're asking about (e.g. 'how do I record a payment against a supplier bill'), or pick one of the suggestions below.",
    matchedEntry: null,
    confidence: 0,
    suggestions: contextualSuggestions(currentModule),
    fallback: true,
  };
}

function contextualSuggestions(module?: string): string[] {
  const byModule: Record<string, string[]> = {
    sales: ["How do I create a sales invoice?", "How do I apply a sales return?", "Why is VAT not calculating?"],
    purchase: ["How do I record a purchase invoice?", "How do I create a purchase return?", "What is a GRN?"],
    accounts: ["How do I add a new ledger?", "What is bill-by-bill tracking?", "How do I set an opening balance?"],
    inventory: ["How do I transfer stock between warehouses?", "Why is stock quantity insufficient?", "How do I add a new item?"],
    journal: ["How do I pass a journal entry?", "Why is my voucher not balancing?", "What is the approval workflow?"],
    payment: ["How do I record a supplier payment?", "How do I allocate a payment to a bill?"],
    receipt: ["How do I record a customer receipt?", "How do I use FIFO auto-allocation?"],
    vat: ["How do I generate VAT reports?", "Why is VAT not calculating on a line?", "What is CBMS submission?"],
    reports: ["How do I read the Trial Balance?", "What does the Aging Report show?", "How do I view the General Ledger?"],
    payroll: ["How do I run payroll?", "How do I set up pay heads?"],
    admin: ["How do I back up my data?", "How do I add a new user?", "How do I close the fiscal year?"],
    pos: ["How do I open a POS session?", "How do I hold a bill in POS?"],
  };
  return byModule[module || ""] || defaultSuggestions();
}

function defaultSuggestions(context?: FalconContext): string[] {
  return [
    "How do I create a sales invoice?",
    "How do I pass a journal entry?",
    "What reports are available?",
  ];
}
