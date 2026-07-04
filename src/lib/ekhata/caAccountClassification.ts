/**
 * CA-level account classification — maps ledger codes to account classes
 * and provides rules for when to debit/credit each class.
 */

import type { AccountClass } from "./types";

export interface ClassifiedAccount {
  code: string;
  name: string;
  class: AccountClass;
  /** Normal balance side: debit or credit */
  normalBalance: "debit" | "credit";
  /** Sub-category for training / reporting */
  subCategory: string;
}

/** Full CA chart of accounts for e-Khata */
export const CA_CHART_OF_ACCOUNTS: ClassifiedAccount[] = [
  // ── ASSETS ──
  { code: "KH-CASH", name: "Cash in Hand", class: "asset", normalBalance: "debit", subCategory: "current_asset" },
  { code: "KH-BANK", name: "Bank Account", class: "asset", normalBalance: "debit", subCategory: "current_asset" },
  { code: "KH-DEBT", name: "Sundry Debtors / Receivables", class: "asset", normalBalance: "debit", subCategory: "current_asset" },
  { code: "KH-STOCK", name: "Stock / Inventory", class: "stock", normalBalance: "debit", subCategory: "current_asset" },
  { code: "KH-PPE", name: "Property, Plant & Equipment", class: "asset", normalBalance: "debit", subCategory: "fixed_asset" },
  { code: "KH-ACC-DEP", name: "Accumulated Depreciation", class: "asset", normalBalance: "credit", subCategory: "contra_asset" },
  { code: "KH-PREPAID", name: "Prepaid Expenses", class: "asset", normalBalance: "debit", subCategory: "current_asset" },
  { code: "KH-ADV-TDS", name: "TDS Receivable / Advance Tax", class: "asset", normalBalance: "debit", subCategory: "current_asset" },
  { code: "KH-BD-REC", name: "Bad Debts Recovered", class: "income", normalBalance: "credit", subCategory: "other_income" },

  // ── LIABILITIES ──
  { code: "KH-CRED", name: "Sundry Creditors / Payables", class: "liability", normalBalance: "credit", subCategory: "current_liability" },
  { code: "KH-LOAN", name: "Loan Payable", class: "liability", normalBalance: "credit", subCategory: "long_term_liability" },
  { code: "KH-SAL-PAY", name: "Salary Payable", class: "liability", normalBalance: "credit", subCategory: "current_liability" },
  { code: "KH-SSF-EMP", name: "SSF Employee Payable", class: "liability", normalBalance: "credit", subCategory: "statutory_liability" },
  { code: "KH-SSF-ER", name: "SSF Employer Payable", class: "liability", normalBalance: "credit", subCategory: "statutory_liability" },
  { code: "KH-GRAT-PROV", name: "Gratuity Provision", class: "liability", normalBalance: "credit", subCategory: "long_term_liability" },
  { code: "KH-BD-PROV", name: "Provision for Bad Debts", class: "liability", normalBalance: "credit", subCategory: "current_liability" },
  { code: "KH-VAT-OUT", name: "Output VAT Payable", class: "liability", normalBalance: "credit", subCategory: "tax_liability" },
  { code: "KH-VAT-IN", name: "Input VAT (Tax Credit)", class: "asset", normalBalance: "debit", subCategory: "tax_asset" },
  { code: "KH-TDS-PAY", name: "TDS Payable", class: "liability", normalBalance: "credit", subCategory: "tax_liability" },
  { code: "KH-OUT-EXP", name: "Outstanding Expenses", class: "liability", normalBalance: "credit", subCategory: "current_liability" },
  { code: "KH-CUST-ADV", name: "Customer Advance / Unearned Revenue", class: "liability", normalBalance: "credit", subCategory: "current_liability" },
  { code: "KH-EMP-ADV", name: "Employee Advance", class: "asset", normalBalance: "debit", subCategory: "current_asset" },

  // ── EQUITY / CAPITAL ──
  { code: "KH-CAP", name: "Capital Account", class: "equity", normalBalance: "credit", subCategory: "capital" },
  { code: "KH-RET-EARN", name: "Retained Earnings", class: "equity", normalBalance: "credit", subCategory: "reserves" },
  { code: "KH-DRAW", name: "Drawings", class: "equity", normalBalance: "debit", subCategory: "drawings" },

  // ── INCOME ──
  { code: "KH-SALE", name: "Sales Revenue", class: "income", normalBalance: "credit", subCategory: "operating_income" },
  { code: "KH-OTH-INC", name: "Other Income", class: "income", normalBalance: "credit", subCategory: "non_operating_income" },
  { code: "KH-DISC-REC", name: "Discount Received", class: "income", normalBalance: "credit", subCategory: "other_income" },

  // ── EXPENSE ──
  { code: "KH-PUR", name: "Purchase / COGS", class: "expense", normalBalance: "debit", subCategory: "direct_expense" },
  { code: "KH-EXP", name: "Operating Expenses", class: "expense", normalBalance: "debit", subCategory: "indirect_expense" },
  { code: "KH-SAL", name: "Salary & Wages", class: "expense", normalBalance: "debit", subCategory: "employee_cost" },
  { code: "KH-DEPR", name: "Depreciation Expense", class: "expense", normalBalance: "debit", subCategory: "non_cash_expense" },
  { code: "KH-BD-EXP", name: "Bad Debts Expense", class: "expense", normalBalance: "debit", subCategory: "financial_expense" },
  { code: "KH-GRAT-EXP", name: "Gratuity Expense", class: "expense", normalBalance: "debit", subCategory: "employee_cost" },
  { code: "KH-SSF-ER-EXP", name: "SSF Employer Expense", class: "expense", normalBalance: "debit", subCategory: "employee_cost" },
  { code: "KH-DISC-ALL", name: "Discount Allowed", class: "expense", normalBalance: "debit", subCategory: "financial_expense" },
  { code: "KH-INT-EXP", name: "Interest Expense", class: "expense", normalBalance: "debit", subCategory: "financial_expense" },
  { code: "KH-BANK-CHG", name: "Bank Charges", class: "expense", normalBalance: "debit", subCategory: "financial_expense" },

  // ── GAIN / LOSS ──
  { code: "KH-GAIN", name: "Capital Gain on Asset Disposal", class: "gain", normalBalance: "credit", subCategory: "capital_gain" },
  { code: "KH-LOSS", name: "Capital Loss on Asset Disposal", class: "loss", normalBalance: "debit", subCategory: "capital_loss" },
];

const CODE_MAP = new Map(CA_CHART_OF_ACCOUNTS.map((a) => [a.code, a]));

export function getAccountByCode(code: string): ClassifiedAccount | undefined {
  return CODE_MAP.get(code);
}

export function classifyAccount(code: string): AccountClass {
  return CODE_MAP.get(code)?.class ?? "expense";
}

/** CA rule: which side increases each account class */
export const CLASS_INCREASE_RULE: Record<AccountClass, "debit" | "credit"> = {
  asset: "debit",
  stock: "debit",
  expense: "debit",
  loss: "debit",
  liability: "credit",
  equity: "credit",
  income: "credit",
  gain: "credit",
};

/** Training reference: when to use each account class */
export const CLASSIFICATION_GUIDE: Record<
  AccountClass,
  { definition: string; examples: string[]; debitWhen: string; creditWhen: string }
> = {
  asset: {
    definition: "Resources owned by the business with future economic benefit.",
    examples: ["Cash", "Bank", "Debtors/Receivables", "Stock", "Fixed Assets", "Prepaid"],
    debitWhen: "Asset increases (purchase, receipt, accrual of receivable)",
    creditWhen: "Asset decreases (payment, sale, write-off, depreciation)",
  },
  liability: {
    definition: "Obligations owed to outsiders — payables, loans, statutory dues.",
    examples: ["Creditors", "Loan Payable", "SSF Payable", "VAT Payable", "Salary Payable"],
    debitWhen: "Liability decreases (payment, settlement)",
    creditWhen: "Liability increases (credit purchase, accrual, provision)",
  },
  equity: {
    definition: "Owner's stake — capital, retained earnings, drawings.",
    examples: ["Capital Introduced", "Retained Earnings", "Drawings"],
    debitWhen: "Equity decreases (drawings, loss transfer)",
    creditWhen: "Equity increases (capital introduced, profit transfer)",
  },
  income: {
    definition: "Revenue from ordinary business activities and other inflows.",
    examples: ["Sales", "Service Income", "Interest Received", "Rent Received", "Discount Received"],
    debitWhen: "Income reversed or reduced (sales return, discount allowed reversal)",
    creditWhen: "Income earned (sale on credit/cash, other income received)",
  },
  expense: {
    definition: "Costs incurred to earn revenue — operating and financial.",
    examples: ["Rent", "Salary", "Electricity", "Depreciation", "Bad Debts", "Bank Charges"],
    debitWhen: "Expense incurred (bill received, payment, accrual)",
    creditWhen: "Expense reversed or prepaid adjustment",
  },
  gain: {
    definition: "Profit on disposal of assets above book value — non-operating.",
    examples: ["Gain on sale of machinery", "Gain on investment"],
    debitWhen: "Gain reversed",
    creditWhen: "Asset sold above written-down value",
  },
  loss: {
    definition: "Loss on disposal of assets below book value — non-operating.",
    examples: ["Loss on sale of vehicle", "Asset write-down"],
    debitWhen: "Asset sold below written-down value or written off",
    creditWhen: "Loss reversed",
  },
  stock: {
    definition: "Inventory held for sale — classified as current asset but tracked separately.",
    examples: ["Raw Materials", "Finished Goods", "Trading Stock"],
    debitWhen: "Stock purchased or manufactured",
    creditWhen: "Stock sold (COGS) or written down",
  },
};

export function getAccountsByClass(accountClass: AccountClass): ClassifiedAccount[] {
  return CA_CHART_OF_ACCOUNTS.filter((a) => a.class === accountClass);
}
