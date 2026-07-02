import type { FalconEntity } from "./types";

// ─── TYPE PRIORITY ORDER ──────────────────────────────────────────────────────
const TYPE_PRIORITY: Record<string, number> = {
  module: 0,
  voucher_type: 1,
  report: 2,
  master: 3,
  field: 4,
  concept: 5,
  action: 6,
  setting: 7,
  screen: 8,
};

// ─── ENTITY PATTERNS ─────────────────────────────────────────────────────────
export const ENTITY_PATTERNS: Array<{
  pattern: string | RegExp;
  type: FalconEntity["type"];
  canonical: string;
}> = [
  // ── MODULE ─────────────────────────────────────────────────────────────────
  { pattern: "billing",        type: "module", canonical: "Billing / Sales Invoice" },
  { pattern: "invoice hub",    type: "module", canonical: "Invoice Hub" },
  { pattern: "purchase",       type: "module", canonical: "Purchase Module" },
  { pattern: "inventory",      type: "module", canonical: "Inventory Module" },
  { pattern: "payroll",        type: "module", canonical: "Payroll Module" },
  { pattern: "point of sale",  type: "module", canonical: "POS Mode" },
  { pattern: "pos",            type: "module", canonical: "POS Mode" },
  { pattern: "reports",        type: "module", canonical: "Reports Module" },
  { pattern: "masters",        type: "module", canonical: "Masters Module" },
  { pattern: "finance",        type: "module", canonical: "Finance / Vouchers" },
  { pattern: "gateway",        type: "module", canonical: "Gateway / Company Settings" },
  { pattern: "utilities",      type: "module", canonical: "Utilities" },

  // ── VOUCHER_TYPE ───────────────────────────────────────────────────────────
  { pattern: "sales invoice",    type: "voucher_type", canonical: "Sales Invoice" },
  { pattern: "purchase invoice", type: "voucher_type", canonical: "Purchase Invoice" },
  { pattern: "journal entry",    type: "voucher_type", canonical: "Journal Entry" },
  { pattern: "journal voucher",  type: "voucher_type", canonical: "Journal Entry" },
  { pattern: "payment voucher",  type: "voucher_type", canonical: "Payment Voucher" },
  { pattern: "receipt voucher",  type: "voucher_type", canonical: "Receipt Voucher" },
  { pattern: "contra voucher",   type: "voucher_type", canonical: "Contra Voucher" },
  { pattern: "credit note",      type: "voucher_type", canonical: "Credit Note / Sales Return" },
  { pattern: "debit note",       type: "voucher_type", canonical: "Debit Note / Purchase Return" },
  { pattern: "sales return",     type: "voucher_type", canonical: "Sales Return" },
  { pattern: "purchase return",  type: "voucher_type", canonical: "Purchase Return" },
  { pattern: "delivery challan", type: "voucher_type", canonical: "Delivery Challan" },
  { pattern: "goods receipt note", type: "voucher_type", canonical: "Goods Receipt Note (GRN)" },
  { pattern: "grn",              type: "voucher_type", canonical: "Goods Receipt Note (GRN)" },
  { pattern: "stock transfer",   type: "voucher_type", canonical: "Stock Transfer" },
  { pattern: "physical stock",   type: "voucher_type", canonical: "Physical Stock Adjustment" },
  { pattern: "sales order",      type: "voucher_type", canonical: "Sales Order" },
  { pattern: "purchase order",   type: "voucher_type", canonical: "Purchase Order" },
  { pattern: "quotation",        type: "voucher_type", canonical: "Quotation / Estimate" },

  // ── REPORT ─────────────────────────────────────────────────────────────────
  { pattern: "trial balance",          type: "report", canonical: "Trial Balance" },
  { pattern: "balance sheet",          type: "report", canonical: "Balance Sheet" },
  { pattern: "profit and loss",        type: "report", canonical: "Profit & Loss Statement" },
  { pattern: "p&l",                    type: "report", canonical: "Profit & Loss Statement" },
  { pattern: "cash flow",              type: "report", canonical: "Cash Flow Statement" },
  { pattern: "day book",               type: "report", canonical: "Day Book" },
  { pattern: "general ledger",         type: "report", canonical: "General Ledger Report" },
  { pattern: "aging report",           type: "report", canonical: "Aging Report" },
  { pattern: "outstanding receivable", type: "report", canonical: "Outstanding Receivables" },
  { pattern: "outstanding payable",    type: "report", canonical: "Outstanding Payables" },
  { pattern: "stock summary",          type: "report", canonical: "Stock Summary" },
  { pattern: "vat report",             type: "report", canonical: "VAT Report" },
  { pattern: "annex a",                type: "report", canonical: "VAT Annex A" },
  { pattern: "annex b",                type: "report", canonical: "VAT Annex B" },
  { pattern: "annex c",                type: "report", canonical: "VAT Annex C" },
  { pattern: "tds certificate",        type: "report", canonical: "TDS Certificate" },
  { pattern: "budget vs actual",       type: "report", canonical: "Budget vs Actual Report" },
  { pattern: "cost center report",     type: "report", canonical: "Cost Center Report" },

  // ── MASTER ─────────────────────────────────────────────────────────────────
  { pattern: "chart of accounts", type: "master", canonical: "Chart of Accounts" },
  { pattern: "coa",               type: "master", canonical: "Chart of Accounts" },
  { pattern: "party",             type: "master", canonical: "Party Master" },
  { pattern: "customer",          type: "master", canonical: "Party Master (Customer)" },
  { pattern: "supplier",          type: "master", canonical: "Party Master (Supplier)" },
  { pattern: "item master",       type: "master", canonical: "Item / Stock Master" },
  { pattern: "stock item",        type: "master", canonical: "Item / Stock Master" },
  { pattern: "warehouse",         type: "master", canonical: "Warehouse / Godown Master" },
  { pattern: "godown",            type: "master", canonical: "Warehouse / Godown Master" },
  { pattern: "cost center",       type: "master", canonical: "Cost Center Master" },
  { pattern: "price list",        type: "master", canonical: "Price List Master" },
  { pattern: "budget master",     type: "master", canonical: "Budget Master" },
  { pattern: "fiscal year",       type: "master", canonical: "Fiscal Year" },
  { pattern: "pay head",          type: "master", canonical: "Pay Head (Payroll)" },
  { pattern: "salary structure",  type: "master", canonical: "Salary Structure" },
  { pattern: "unit of measure",   type: "master", canonical: "Unit of Measure" },

  // ── FIELD ──────────────────────────────────────────────────────────────────
  { pattern: "opening balance", type: "field", canonical: "Opening Balance" },
  { pattern: "bill by bill",    type: "field", canonical: "Bill-by-Bill Tracking" },
  { pattern: "narration",       type: "field", canonical: "Narration / Remarks" },
  { pattern: "voucher number",  type: "field", canonical: "Voucher Number" },
  { pattern: "invoice number",  type: "field", canonical: "Invoice Number" },
  { pattern: "tds",             type: "field", canonical: "TDS (Tax Deducted at Source)" },
  { pattern: "vat",             type: "field", canonical: "VAT (13%)" },
  { pattern: "discount",        type: "field", canonical: "Discount %" },
  { pattern: "round off",       type: "field", canonical: "Round Off" },
  { pattern: "grand total",     type: "field", canonical: "Grand Total" },

  // ── CONCEPT ────────────────────────────────────────────────────────────────
  { pattern: "double entry",       type: "concept", canonical: "Double-Entry Accounting" },
  { pattern: "debit",              type: "concept", canonical: "Debit" },
  { pattern: "credit",             type: "concept", canonical: "Credit" },
  { pattern: "reconciliation",     type: "concept", canonical: "Reconciliation" },
  { pattern: "approval workflow",  type: "concept", canonical: "Voucher Approval Workflow" },
  { pattern: "audit log",          type: "concept", canonical: "Audit Log" },
  { pattern: "backup",             type: "concept", canonical: "Backup & Restore" },
  { pattern: "factory reset",      type: "concept", canonical: "Factory Reset" },
  { pattern: "cbms",               type: "concept", canonical: "CBMS (IRD Submission)" },
  { pattern: "irn",                type: "concept", canonical: "IRN (Invoice Reference Number)" },
  { pattern: "pan",                type: "concept", canonical: "PAN Number" },

  // ── SETTING ────────────────────────────────────────────────────────────────
  { pattern: "system settings",  type: "setting", canonical: "System Settings" },
  { pattern: "company settings", type: "setting", canonical: "Company Settings" },
  { pattern: "user permission",  type: "setting", canonical: "User Roles & Permissions" },
  { pattern: "role",             type: "setting", canonical: "User Role" },

  // ── ACTION ─────────────────────────────────────────────────────────────────
  { pattern: "post",           type: "action", canonical: "Post / Finalize" },
  { pattern: "draft",          type: "action", canonical: "Save as Draft" },
  { pattern: "approve",        type: "action", canonical: "Approve Voucher" },
  { pattern: "cancel",         type: "action", canonical: "Cancel / Void" },
  { pattern: "print",          type: "action", canonical: "Print / PDF" },
  { pattern: "export",         type: "action", canonical: "Export" },
  { pattern: "import",         type: "action", canonical: "Import" },
  { pattern: "backup restore", type: "action", canonical: "Backup & Restore" },
];

// ─── MAIN FUNCTION ────────────────────────────────────────────────────────────

/**
 * Extracts ERP entities from a pre-normalized query string.
 * Results are deduplicated by canonical name and sorted by type priority.
 *
 * @param normalizedQuery  Lowercased, punctuation-cleaned query string.
 * @param tokens           Stop-word-filtered token array (used for future extensions).
 * @param expandedTokens   Synonym-expanded token set (used for future extensions).
 * @returns                Ordered, deduplicated array of FalconEntity objects.
 */
export function extractEntities(
  normalizedQuery: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _tokens: string[],
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _expandedTokens: Set<string>
): FalconEntity[] {
  const seenCanonicals = new Set<string>();
  const matched: FalconEntity[] = [];

  for (const entry of ENTITY_PATTERNS) {
    const { pattern, type, canonical } = entry;

    // Skip if we already have an entity with this canonical name
    if (seenCanonicals.has(canonical)) continue;

    const isMatch =
      typeof pattern === "string"
        ? normalizedQuery.includes(pattern)
        : pattern.test(normalizedQuery);

    if (isMatch) {
      seenCanonicals.add(canonical);
      // Extract the matched value from the query
      const value =
        typeof pattern === "string"
          ? pattern
          : (pattern.exec(normalizedQuery)?.[0] ?? canonical.toLowerCase());

      matched.push({ type, surface: value, canonical });
    }
  }

  // Sort by type priority (module first, setting last)
  matched.sort(
    (a, b) => (TYPE_PRIORITY[a.type] ?? 99) - (TYPE_PRIORITY[b.type] ?? 99)
  );

  return matched;
}
