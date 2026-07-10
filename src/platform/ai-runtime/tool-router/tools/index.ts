import { executeQuerySync, QueryTypes } from "@fios/query-bus";
import { assertBalanced, validateJournalLines } from "@fios/accounting-engine";
import { defineTool } from "./toolFactory";

export const accountingEngineTool = defineTool(
  "accounting_engine",
  "Accounting Engine",
  "Deterministic double-entry accounting operations",
  "accounting",
  ["read:accounts", "run:simulation", "write:proposal"],
  async (invocation) => {
    if (invocation.action === "validate_lines") {
      const lines = (invocation.payload.lines as unknown[]) ?? [];
      return validateJournalLines(lines as Parameters<typeof validateJournalLines>[0]);
    }
    if (invocation.action === "assert_balanced") {
      const lines = (invocation.payload.lines as unknown[]) ?? [];
      assertBalanced(lines as Parameters<typeof assertBalanced>[0]);
      return { balanced: true };
    }
    if (invocation.action === "prepare_command") {
      return { prepared: true, input: invocation.payload.input };
    }
    return { action: invocation.action, payload: invocation.payload };
  },
);

export const inventoryTool = defineTool(
  "inventory",
  "Inventory",
  "Stock and inventory queries",
  "inventory",
  ["read:inventory"],
  async (invocation) => {
    const queryType = (invocation.payload.queryType as string) ?? QueryTypes.STOCK_SUMMARY;
    return executeQuerySync({ queryType, payload: invocation.payload as Record<string, unknown> });
  },
);

export const taxTool = defineTool(
  "tax",
  "Tax",
  "Tax summary and compliance queries",
  "tax",
  ["read:reports", "read:settings"],
  async (invocation) => {
    return executeQuerySync({
      queryType: QueryTypes.TAX_SUMMARY,
      payload: invocation.payload as Record<string, unknown>,
    });
  },
);

export const ocrTool = defineTool(
  "ocr",
  "OCR",
  "Document OCR extraction interface",
  "documents",
  ["run:ocr"],
  async (invocation) => {
    return {
      status: "not_configured",
      message: "OCR provider not bound — extension point for document pipeline",
      payload: invocation.payload,
    };
  },
);

export const knowledgeTool = defineTool(
  "knowledge",
  "Knowledge",
  "Accounting knowledge retrieval",
  "knowledge",
  ["read:memory"],
  async (invocation) => {
    const query = String(invocation.payload.query ?? "");
    return { query, source: "knowledge_base", available: true };
  },
);

export const reportsTool = defineTool(
  "reports",
  "Reports",
  "Financial and operational reports via Query Bus",
  "reports",
  ["read:reports"],
  async (invocation) => {
    const queryType = (invocation.payload.queryType as string) ?? QueryTypes.TRIAL_BALANCE;
    return executeQuerySync({ queryType, payload: invocation.payload as Record<string, unknown> });
  },
);

export const calculatorTool = defineTool(
  "calculator",
  "Calculator",
  "Deterministic numeric calculations",
  "utility",
  [],
  async (invocation) => {
    const expr = String(invocation.payload.expression ?? "0");
    const sanitized = expr.replace(/[^0-9+\-*/().%\s]/g, "");
    if (!sanitized.trim()) throw new Error("Invalid expression");
    const result = Function(`"use strict"; return (${sanitized})`)() as number;
    return { expression: sanitized, result };
  },
);

export const simulationTool = defineTool(
  "simulation",
  "Simulation",
  "What-if accounting simulations without state mutation",
  "accounting",
  ["run:simulation", "read:accounts"],
  async (invocation) => ({
    simulated: true,
    input: invocation.payload.input,
    note: "Simulation only — no Command Bus dispatch",
  }),
);

export const searchTool = defineTool(
  "search",
  "Search",
  "Business entity search via Query Bus",
  "search",
  ["read:accounts", "read:parties", "read:inventory"],
  async (invocation) => {
    if (invocation.action === "resolve_query") {
      const input = String(invocation.payload.input ?? "").toLowerCase();
      if (/voucher/i.test(input)) {
        return executeQuerySync({ queryType: QueryTypes.LIST_VOUCHERS, payload: {} });
      }
      if (/invoice/i.test(input)) {
        return executeQuerySync({ queryType: QueryTypes.LIST_INVOICES, payload: {} });
      }
      if (/account/i.test(input)) {
        return executeQuerySync({ queryType: QueryTypes.LIST_ACCOUNTS, payload: {} });
      }
      if (/party|customer|supplier/i.test(input)) {
        return executeQuerySync({ queryType: QueryTypes.LIST_PARTIES, payload: {} });
      }
      if (/item|stock|inventory/i.test(input)) {
        return executeQuerySync({ queryType: QueryTypes.LIST_ITEMS, payload: {} });
      }
      return executeQuerySync({ queryType: QueryTypes.COMPANY_SETTINGS, payload: {} });
    }
    return executeQuerySync({
      queryType: QueryTypes.LIST_ACCOUNTS,
      payload: invocation.payload as Record<string, unknown>,
    });
  },
);

export const memoryTool = defineTool(
  "memory",
  "Memory",
  "Working, conversation, and business memory access",
  "memory",
  ["read:memory", "write:memory"],
  async (invocation) => {
    const { getMemoryStore } = await import("../../memory");
    const store = getMemoryStore();
    if (invocation.action === "working_snapshot") {
      return store.working.snapshot();
    }
    if (invocation.action === "recall") {
      const query = String(invocation.payload.query ?? "");
      return store.longTerm.recall(query, { limit: 5 });
    }
    return { action: invocation.action };
  },
);

export const ALL_TOOLS = [
  accountingEngineTool,
  inventoryTool,
  taxTool,
  ocrTool,
  knowledgeTool,
  reportsTool,
  calculatorTool,
  simulationTool,
  searchTool,
  memoryTool,
];
