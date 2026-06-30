// src/lib/balanceSheetTypes.ts
export type BSFormatType = "standard" | "schedule-iii" | "ifrs" | "non-corporate";
export type BSOrientation = "horizontal" | "vertical";
export type BSValueType = "group-balance" | "formula" | "manual" | "pl-result" | "closing-stock";
export type BSStockUpdation = "automatic" | "manual" | "gp-ratio";

export interface BSFormatRow {
  id: string;
  caption: string;
  level: number; // 0=major head, 1=sub-head, 2=line item
  side: "assets" | "liabilities" | "equity" | "both";
  valueType: BSValueType;
  groupIds?: string[]; // account group IDs to sum
  formula?: string; // e.g. "rowA - rowB"
  manualValue?: number;
  showPercentage?: boolean;
  bold?: boolean;
  underline?: boolean;
  isSubtotal?: boolean;
  isGrandTotal?: boolean;
  indent?: number;
  negateSign?: boolean; // flip debit/credit sign
  hideIfZero?: boolean;
}

export interface BSFormat {
  id: string;
  name: string;
  formatType: BSFormatType;
  reportTitle: string;
  rows: BSFormatRow[];
  createdAt: string;
  updatedAt: string;
}

export interface BSOptions {
  fromDate: string;
  toDate: string;
  orientation: BSOrientation;
  formatId: string;
  showSecondLevel: boolean;
  showZeroBalances: boolean;
  showPercentage: boolean;
  showPreviousYear: boolean;
  previousYearDate?: string;
  stockUpdation: BSStockUpdation;
  manualClosingStock?: number;
  roundOff: boolean;
  costCentreId?: string;
  comparativeYears?: number;
}

export interface BSAccountEntry {
  accountId: string;
  accountName: string;
  accountCode: string;
  balance: number; // positive = credit, negative = debit
  debit: number;
  credit: number;
  openingBalance: number;
  isGroup: boolean;
  level: number;
  children: BSAccountEntry[];
  groupType: string;
  prevYearBalance?: number;
  percentage?: number;
}

export interface BSSection {
  id: string;
  caption: string;
  total: number;
  prevYearTotal?: number;
  percentage?: number;
  rows: BSRowData[];
  level: number;
  bold?: boolean;
  isSubtotal?: boolean;
  isGrandTotal?: boolean;
}

export interface BSRowData {
  id: string;
  caption: string;
  amount: number;
  prevYearAmount?: number;
  percentage?: number;
  level: number;
  indent: number;
  bold?: boolean;
  underline?: boolean;
  isSubtotal?: boolean;
  isGrandTotal?: boolean;
  accountId?: string;
  groupId?: string;
  isClickable: boolean;
  children?: BSRowData[];
  expanded?: boolean;
  isPLLine?: boolean; // special Profit & Loss line
  isPLAdjusted?: boolean; // screen-only balancing line
  isClosingStock?: boolean;
  hideIfZero?: boolean;
  zeroBalance?: boolean;
}

export interface BSComputation {
  // Two-side data
  liabilitiesEquity: BSSection[]; // Left/Top side
  assets: BSSection[]; // Right/Bottom side

  // Totals
  totalLiabilitiesEquity: number;
  totalAssets: number;

  // P&L integration
  currentPeriodPL: number; // positive = profit
  plTransferred: boolean; // has a transfer journal been posted?
  plAdjustedAmount: number; // screen-only balancing entry

  // Closing stock
  closingStock: number;
  closingStockSource: "automatic" | "manual" | "gp-ratio";

  // Balance check
  isBalanced: boolean;
  difference: number; // should be 0

  // Meta
  fromDate: string;
  toDate: string;
  options: BSOptions;
  generatedAt: string;

  // Comparative
  previousPeriodData?: {
    liabilitiesEquity: BSSection[];
    assets: BSSection[];
    totalLiabilitiesEquity: number;
    totalAssets: number;
  };
}

export interface DrillState {
  level: 0 | 1 | 2 | 3 | 4;
  // 0 = Balance Sheet
  // 1 = Group summary
  // 2 = Sub-group / ledger list
  // 3 = Account Ledger (transaction list)
  // 4 = Voucher detail
  groupId?: string;
  groupName?: string;
  accountId?: string;
  accountName?: string;
  voucherId?: string;
  voucherNo?: string;
  fromDate?: string;
  toDate?: string;
  path: Array<{ id: string; label: string; level: number }>;
}

export interface LedgerEntry {
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

export interface AccountLedgerReport {
  accountId: string;
  accountName: string;
  accountCode: string;
  openingBalance: number;
  closingBalance: number;
  totalDebit: number;
  totalCredit: number;
  entries: LedgerEntry[];
  fromDate: string;
  toDate: string;
}

// Standard BUSY group classifications
export const STANDARD_GROUP_SIDES: Record<string, "assets" | "liabilities" | "equity"> = {
  // Assets
  "fixed assets": "assets",
  "investments": "assets",
  "current assets": "assets",
  "loans & advances (asset)": "assets",
  "misc. expenses (asset)": "assets",
  "branch / divisions": "assets",
  "stock-in-hand": "assets",
  "sundry debtors": "assets",
  "cash-in-hand": "assets",
  "bank accounts": "assets",
  "deposits (asset)": "assets",
  "loans & advances (assets)": "assets",
  // Liabilities
  "current liabilities": "liabilities",
  "loans (liability)": "liabilities",
  "suspense a/c": "liabilities",
  "sundry creditors": "liabilities",
  "duties & taxes": "liabilities",
  "provisions": "liabilities",
  "bank od accounts": "liabilities",
  // Equity
  "capital account": "equity",
  "reserves & surplus": "equity",
  "share capital": "equity",
};

export const INCOME_EXPENSE_GROUPS = [
  "sales accounts", "purchase accounts", "direct expenses", "direct income",
  "indirect expenses", "indirect income", "manufacturing expenses",
];
