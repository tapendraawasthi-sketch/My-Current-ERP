// src/lib/tallyVoucher.ts
// ─── Voucher types (F4–F9) ──────────────────────────────────────────────────
export type VoucherType =
  | "Journal" // F7
  | "Payment" // F5
  | "Receipt" // F6
  | "Contra" // F4
  | "Sales" // F8  ← new
  | "Purchase"; // F9  ← new

export type TallyType =
  | "journal"
  | "payment"
  | "receipt"
  | "contra"
  | "sales" // ← new
  | "purchase"; // ← new

// ─── Bank allocation ─────────────────────────────────────────────────────────
export type BankMode =
  "Cheque/DD" | "EFT" | "NEFT" | "RTGS" | "IMPS" | "UPI" | "Debit Card" | "Credit Card" | "Others";

export type BankReconciliationStatus = "Not Reconciled" | "Reconciled";

export interface BankAllocation {
  id: string;
  transactionType: BankMode;
  instrumentNumber?: string;
  instrumentDate?: string; // YYYY-MM-DD
  favouringName?: string; // payee name on cheque ← new
  bankDate?: string; // effective clearing date ← new
  bankStatus: BankReconciliationStatus; // ← new (was always "Not Reconciled")
  bankName?: string;
  branchName?: string;
  ifscCode?: string;
  // receipt-specific fields ← new
  draweeBankName?: string;
  chequeStatus?: "Deposited" | "Cleared" | "Bounced";
  amount: number;
  remarks?: string;
}

// ─── Bill-wise allocation ────────────────────────────────────────────────────
export type BillMethod =
  | "New Reference"
  | "Against Reference"
  | "Advance" // ← new
  | "On Account"; // ← new

export interface BillWiseAllocation {
  id: string;
  method: BillMethod;
  refNo?: string;
  refDate?: string;
  amount: number;
  narration?: string;
}

// ─── Cash denomination ───────────────────────────────────────────────────────
export interface CashDenomination {
  denom: number;
  count: number;
}

// ─── Invoice line (Sales/Purchase Item Invoice) ── new ───────────────────────
export interface InvoiceItemLine {
  id: string;
  itemId?: string;
  itemName: string;
  godownId?: string;
  godownName?: string;
  qty: number;
  unit: string;
  rate: number;
  perUnit: string;
  amount: number; // auto: qty * rate
  discountPct?: number;
  discountAmt?: number;
  narration?: string;
}

// ─── Voucher line (double-entry) ─────────────────────────────────────────────
export interface VoucherLine {
  id: string;
  accountId: string;
  accountName: string;
  debit: number;
  credit: number;
  narration?: string;
  bankAllocation?: BankAllocation;
  billWise?: BillWiseAllocation[];
  isCash?: boolean;
  cashDenominations?: CashDenomination[];
  isBank?: boolean;
}

// ─── Voucher class (preset) ─────────────────────────────────────────── new ──
export interface VoucherClass {
  id: string;
  name: string; // e.g. "Cash Payment"
  voucherType: TallyType;
  defaultAccountId: string; // pre-fills Account field
  defaultAccountName: string;
}

// ─── F12 configuration (per voucher type) ──────────────────────────── new ──
export interface F12VoucherConfig {
  showReference: boolean;
  showDispatchDetails: boolean; // Sales
  showOrderDetails: boolean; // Sales/Purchase
  showNarrationPerEntry: boolean;
  showBillWise: boolean;
  showCostCenter: boolean;
  showGST: boolean;
  entryMode: "single" | "double";
  invoiceMode: "item" | "accounting"; // Sales/Purchase
  notation: "ByTo" | "DrCr"; // Journal
  showBankAllocation: boolean;
  showCashDenomination: boolean;
}

export const DEFAULT_F12_CONFIG: F12VoucherConfig = {
  showReference: true,
  showDispatchDetails: false,
  showOrderDetails: false,
  showNarrationPerEntry: false,
  showBillWise: true,
  showCostCenter: false,
  showGST: true,
  entryMode: "single",
  invoiceMode: "item",
  notation: "ByTo",
  showBankAllocation: true,
  showCashDenomination: true,
};

// ─── Voucher meta ─────────────────────────────────────────────────────────────
export interface VoucherMeta {
  id: string;
  voucherType: VoucherType;
  voucherNumber: string;
  date: string; // YYYY-MM-DD
  reference?: string;
  narration?: string;
  totalDebit: number;
  totalCredit: number;
  isSingleEntry: boolean;
  isPostDated?: boolean; // ← new (Ctrl+T)
  isOptional?: boolean; // ← new (Ctrl+L)
  createdAt: string;
  updatedAt: string;
  fiscalYearId?: string;
  companyId?: string;
  branchId?: string;
  // Sales/Purchase extras ← new
  partyId?: string;
  partyName?: string;
  supplierInvoiceNo?: string;
  supplierInvoiceDate?: string;
  placeOfSupply?: string;
}

export interface Voucher extends VoucherMeta {
  lines: VoucherLine[];
  itemLines?: InvoiceItemLine[]; // ← new for Sales/Purchase item mode
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
export const cryptoRandomId = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

export const todayAD = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const blankLine = (drcr: "dr" | "cr" = "dr"): VoucherLine => ({
  id: cryptoRandomId(),
  accountId: "",
  accountName: "",
  debit: drcr === "dr" ? 0 : 0,
  credit: drcr === "cr" ? 0 : 0,
  narration: "",
});

export const blankItemLine = (): InvoiceItemLine => ({
  id: cryptoRandomId(),
  itemId: "",
  itemName: "",
  godownId: "",
  godownName: "",
  qty: 0,
  unit: "PCS",
  rate: 0,
  perUnit: "PCS",
  amount: 0,
  narration: "",
});

export const blankVoucher = (type: VoucherType): Voucher => ({
  id: cryptoRandomId(),
  voucherType: type,
  voucherNumber: "",
  date: todayAD(),
  reference: "",
  narration: "",
  totalDebit: 0,
  totalCredit: 0,
  isSingleEntry: false,
  isPostDated: false,
  isOptional: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  lines: [blankLine("dr"), blankLine("cr")],
});

export const recalcTotals = (lines: VoucherLine[]) => {
  const totalDebit = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  return { totalDebit, totalCredit, diff: totalDebit - totalCredit };
};

export const isBalanced = (lines: VoucherLine[]): boolean => {
  const { diff } = recalcTotals(lines);
  return Math.abs(diff) < 0.001;
};

export const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

// ─── Display maps ─────────────────────────────────────────────────────────────
export const voucherTypeShortcut: Record<string, TallyType> = {
  F4: "contra",
  F5: "payment",
  F6: "receipt",
  F7: "journal",
  F8: "sales", // ← new
  F9: "purchase", // ← new
};

export const voucherTypeLabel: Record<VoucherType, string> = {
  Journal: "Journal Voucher  (F7)",
  Payment: "Payment Voucher  (F5)",
  Receipt: "Receipt Voucher  (F6)",
  Contra: "Contra Voucher   (F4)",
  Sales: "Sales Voucher    (F8)", // ← new
  Purchase: "Purchase Voucher (F9)", // ← new
};

export const TRANSACTION_TYPES: BankMode[] = [
  "Cheque/DD",
  "EFT",
  "NEFT",
  "RTGS",
  "IMPS",
  "UPI",
  "Debit Card",
  "Credit Card",
  "Others",
];

export const DENOMINATIONS = [2000, 500, 200, 100, 50, 20, 10, 5, 2, 1];
