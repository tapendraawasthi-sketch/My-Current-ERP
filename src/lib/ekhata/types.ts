/** Account classification per CA / IFRS framework */
export type AccountClass =
  | "asset"
  | "liability"
  | "equity"
  | "income"
  | "expense"
  | "gain"
  | "loss"
  | "stock";

/** All supported e-Khata transaction intents — basic khata + CA-level */
export type KhataIntent =
  // Basic trader khata (backward compatible)
  | "khata_credit_sale"
  | "khata_cash_sale"
  | "khata_payment_in"
  | "khata_purchase"
  | "khata_payment_out"
  | "khata_expense"
  // CA-level: receivables & payables
  | "khata_credit_purchase"
  | "khata_outstanding_expense"
  | "khata_prepaid_expense"
  // CA-level: bad debts
  | "khata_bad_debt_writeoff"
  | "khata_bad_debt_recovery"
  | "khata_provision_bad_debt"
  // CA-level: payroll & statutory
  | "khata_salary_payment"
  | "khata_salary_accrual"
  | "khata_ssf_employee"
  | "khata_ssf_employer"
  | "khata_gratuity_provision"
  | "khata_gratuity_payment"
  // CA-level: tax (Nepal VAT/TDS)
  | "khata_vat_sales"
  | "khata_vat_purchase"
  | "khata_vat_payment"
  | "khata_tds_deducted"
  | "khata_tds_paid"
  // CA-level: income & expense
  | "khata_other_income"
  | "khata_depreciation"
  | "khata_bank_charges"
  | "khata_discount_allowed"
  | "khata_discount_received"
  // CA-level: capital & stock
  | "khata_capital_introduced"
  | "khata_drawings"
  | "khata_loan_received"
  | "khata_loan_repayment"
  | "khata_stock_purchase"
  | "khata_stock_sale_cogs"
  | "khata_contra_cash_bank"
  | "khata_sales_return"
  | "khata_purchase_return"
  | "khata_customer_advance"
  | "khata_employee_advance"
  | "khata_opening_balance"
  | "khata_asset_disposal"
  | "khata_inventory_write_down"
  | "khata_commission_income"
  | "khata_rent_expense";

export interface JournalLineDraft {
  accountCode: string;
  accountName: string;
  accountClass: AccountClass;
  debit: number;
  credit: number;
  narration?: string;
}

export interface KhataConfirmationCard {
  intent: KhataIntent;
  party?: string | null;
  amount: number;
  /** Secondary amount (e.g. VAT portion, SSF portion) */
  secondaryAmount?: number | null;
  item?: string | null;
  date: string;
  raw_text: string;
  /** CA-level multi-line journal preview */
  journalLines?: JournalLineDraft[];
  /** Human-readable CA explanation */
  caExplanation?: string;
  /** Primary account classification for this transaction */
  primaryClass?: AccountClass;
  tags?: string[];
}

export interface KhataParseResult {
  clarifying_question?: string;
  card?: KhataConfirmationCard;
}

export interface EKhataChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp: Date;
}

export const KHATA_INTENT_LABELS: Record<KhataIntent, string> = {
  khata_credit_sale: "Credit Sale (Udhaar / Receivable)",
  khata_cash_sale: "Cash Sale",
  khata_payment_in: "Payment Received (Receivable Settlement)",
  khata_purchase: "Cash Purchase",
  khata_payment_out: "Payment Made (Payable Settlement)",
  khata_expense: "Expense",
  khata_credit_purchase: "Credit Purchase (Payable / Outstanding)",
  khata_outstanding_expense: "Accrued Expense (Outstanding Bill)",
  khata_prepaid_expense: "Prepaid Expense",
  khata_bad_debt_writeoff: "Bad Debt Write-off",
  khata_bad_debt_recovery: "Bad Debt Recovery",
  khata_provision_bad_debt: "Provision for Bad Debts",
  khata_salary_payment: "Salary Payment",
  khata_salary_accrual: "Salary Accrual (Outstanding Salary)",
  khata_ssf_employee: "SSF Employee Contribution (10%)",
  khata_ssf_employer: "SSF Employer Contribution (11%)",
  khata_gratuity_provision: "Gratuity Provision",
  khata_gratuity_payment: "Gratuity Payment",
  khata_vat_sales: "Sales with VAT (13%)",
  khata_vat_purchase: "Purchase with VAT Input",
  khata_vat_payment: "VAT Payment to IRD",
  khata_tds_deducted: "TDS Deducted at Source",
  khata_tds_paid: "TDS Remittance to IRD",
  khata_other_income: "Other Income (Interest/Rent/Dividend)",
  khata_depreciation: "Depreciation",
  khata_bank_charges: "Bank Charges",
  khata_discount_allowed: "Discount Allowed",
  khata_discount_received: "Discount Received",
  khata_capital_introduced: "Capital Introduced",
  khata_drawings: "Drawings / Owner Withdrawal",
  khata_loan_received: "Loan Received",
  khata_loan_repayment: "Loan Repayment",
  khata_stock_purchase: "Stock / Inventory Purchase",
  khata_stock_sale_cogs: "Cost of Goods Sold (COGS)",
  khata_contra_cash_bank: "Contra (Cash ↔ Bank)",
  khata_sales_return: "Sales Return / Credit Note",
  khata_purchase_return: "Purchase Return / Debit Note",
  khata_customer_advance: "Advance Received from Customer",
  khata_employee_advance: "Advance to Employee",
  khata_opening_balance: "Opening Balance Entry",
  khata_asset_disposal: "Fixed Asset Disposal",
  khata_inventory_write_down: "Inventory Write-down",
  khata_commission_income: "Commission Income",
  khata_rent_expense: "Rent Expense",
};

/** Nepal statutory rates used in entry generation */
export const NEPAL_RATES = {
  VAT: 0.13,
  SSF_EMPLOYEE: 0.1,
  SSF_EMPLOYER: 0.11,
  TDS_SERVICES: 0.15,
  TDS_RENT: 0.1,
  TDS_CONTRACT: 0.015,
} as const;
