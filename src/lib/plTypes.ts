// src/lib/plTypes.ts
// Type definitions for the Profit & Loss reporting engine

export type PLReportVariant =
  | "horizontal"
  | "vertical"
  | "monthly-summary"
  | "detailed-monthly";

export type PLViewMode = "group" | "detail";

export interface PLReportOptions {
  fromDate: string;
  toDate: string;
  showSecondLevel: boolean;
  updateClosingStock: boolean;
  showPercentage: boolean;
  showPreviousYear: boolean;
  branchId?: string;
  costCentreId?: string;
  variant: PLReportVariant;
  showDetailedSummary?: boolean; // for monthly-summary
  customFormatId?: string;
}

export interface PLAccountLine {
  accountId: string;
  accountName: string;
  groupId?: string;
  groupName?: string;
  debit: number;
  credit: number;
  netBalance: number; // credit - debit (positive = credit nature)
  absBalance: number;
  nature: "debit" | "credit"; // which side it belongs to in P&L
  isGroup: boolean;
  depth: number;
  children?: PLAccountLine[];
  prevYearBalance?: number;
  percentage?: number;
  monthlyAmounts?: number[]; // index 0 = first month of FY, index 11 = last
}

export interface PLSection {
  id: string;
  label: string;
  lines: PLAccountLine[];
  total: number;
  prevYearTotal?: number;
  showSubtotal?: boolean;
}

export interface PLComputation {
  // Trading Account
  openingStock: number;
  purchases: PLSection; // debit
  directExpenses: PLSection; // debit
  closingStock: number;
  sales: PLSection; // credit
  directIncome: PLSection; // credit

  grossProfit: number; // positive = profit, negative = loss
  grossProfitLabel: string; // "Gross Profit" or "Gross Loss"

  // P&L Account
  indirectExpenses: PLSection; // debit
  indirectIncome: PLSection; // credit

  netProfit: number; // positive = profit, negative = loss
  netProfitLabel: string; // "Net Profit" or "Net Loss"

  // Totals
  tradingDebitTotal: number;
  tradingCreditTotal: number;
  plDebitTotal: number;
  plCreditTotal: number;
  grandDebitTotal: number;
  grandCreditTotal: number;

  // Previous year
  prevYearNetProfit?: number;

  // For percentage calculation
  revenueBase: number; // sales total for % base

  // Monthly data (for monthly variants)
  monthLabels?: string[];
  monthlyData?: MonthlyPLData[];

  fromDate: string;
  toDate: string;
  options: PLReportOptions;
}

export interface MonthlyPLData {
  monthLabel: string;
  monthIndex: number;
  year: number;
  sales: number;
  directIncome: number;
  openingStock: number;
  purchases: number;
  directExpenses: number;
  closingStock: number;
  grossProfit: number;
  indirectIncome: number;
  indirectExpenses: number;
  netProfit: number;
  accountBreakdown?: Record<string, number>; // accountId → amount
}

export interface PLDrillState {
  level: 0 | 1 | 2 | 3 | 4;
  // level 0 = P&L report
  // level 1 = group account list
  // level 2 = account ledger
  // level 3 = voucher detail
  selectedGroupId?: string;
  selectedGroupLabel?: string;
  selectedAccountId?: string;
  selectedAccountName?: string;
  selectedVoucherId?: string;
  fromDate?: string;
  toDate?: string;
}

export interface AccountLedgerEntry {
  id: string;
  date: string;
  voucherNo: string;
  voucherType: string;
  particulars: string;
  narration?: string;
  debit: number;
  credit: number;
  runningBalance: number;
  voucherId: string;
}

export interface AccountLedgerData {
  accountId: string;
  accountName: string;
  openingBalance: number;
  closingBalance: number;
  entries: AccountLedgerEntry[];
  totalDebit: number;
  totalCredit: number;
}

// Group classification for P&L placement
export type PLGroupType =
  | "sales"
  | "purchase"
  | "direct-expense"
  | "direct-income"
  | "indirect-expense"
  | "indirect-income"
  | "stock"
  | "balance-sheet"; // does not appear in P&L

export const GROUP_TYPE_KEYWORDS: Record<PLGroupType, string[]> = {
  sales: ["sales", "revenue", "turnover", "income from operations"],
  purchase: ["purchase", "buying", "procurement"],
  "direct-expense": ["direct expense", "manufacturing expense", "cost of production", "direct cost", "factory"],
  "direct-income": ["direct income", "job work", "processing charges", "scrap"],
  "indirect-expense": ["indirect expense", "indirect cost", "operating expense", "admin expense", "selling expense", "general expense", "overhead", "salary", "rent", "depreciation", "interest expense", "bank charge", "audit fee", "advertisement", "telephone", "electricity", "insurance", "vehicle", "printing", "stationery", "postage", "freight outward", "legal", "professional", "bad debt"],
  "indirect-income": ["indirect income", "other income", "non-operating income", "interest received", "discount received", "commission received", "rent received", "dividend"],
  stock: ["stock", "inventory", "closing stock", "opening stock"],
  "balance-sheet": [], // catch-all for anything else
};
