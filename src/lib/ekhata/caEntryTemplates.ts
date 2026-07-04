/**
 * CA-level journal entry templates — Chartered Accountant standard double-entry rules.
 * Each template defines WHEN to use it and HOW to post Dr/Cr lines.
 */

import type { JournalLineDraft, KhataIntent, NEPAL_RATES } from "./types";
import { getAccountByCode } from "./caAccountClassification";

export interface EntryTemplate {
  intent: KhataIntent;
  /** CA explanation of the accounting treatment */
  explanation: string;
  /** Tags for training / search */
  tags: string[];
  /** Situation keywords (English + Nepali) */
  keywords: string[];
  /** Primary account class affected */
  primaryClass: string;
  /** Generate journal lines from amount(s) */
  buildLines: (params: EntryBuildParams) => JournalLineDraft[];
}

export interface EntryBuildParams {
  amount: number;
  secondaryAmount?: number;
  party?: string | null;
  item?: string | null;
  narration?: string;
}

function acct(code: string): { code: string; name: string; class: string } {
  const a = getAccountByCode(code);
  if (!a) throw new Error(`Unknown account code: ${code}`);
  return { code: a.code, name: a.name, class: a.class };
}

function line(
  code: string,
  debit: number,
  credit: number,
  narration?: string,
): JournalLineDraft {
  const a = acct(code);
  return {
    accountCode: a.code,
    accountName: a.name,
    accountClass: a.class as JournalLineDraft["accountClass"],
    debit: Math.round(debit * 100) / 100,
    credit: Math.round(credit * 100) / 100,
    narration,
  };
}

function vatSplit(gross: number): { net: number; vat: number } {
  const net = Math.round((gross / 1.13) * 100) / 100;
  const vat = Math.round((gross - net) * 100) / 100;
  return { net, vat };
}

export const CA_ENTRY_TEMPLATES: EntryTemplate[] = [
  // ── BASIC KHATA (backward compatible) ──
  {
    intent: "khata_credit_sale",
    explanation:
      "Credit sale creates a receivable (asset ↑ Dr) and recognises sales income (income ↑ Cr). " +
      "Outstanding = Sundry Debtors until payment received.",
    tags: ["receivable", "outstanding", "udhaar", "credit_sale"],
    keywords: ["udhaar", "udhar", "credit sale", "becheko udhaar", "receivable"],
    primaryClass: "income",
    buildLines: ({ amount, party, narration }) => [
      line("KH-DEBT", amount, 0, narration ?? `Credit sale${party ? ` to ${party}` : ""}`),
      line("KH-SALE", 0, amount, narration),
    ],
  },
  {
    intent: "khata_cash_sale",
    explanation: "Cash sale: Cash (asset ↑ Dr) and Sales (income ↑ Cr). No outstanding created.",
    tags: ["cash", "nagad", "sale"],
    keywords: ["nagad bikri", "cash sale", "nakad"],
    primaryClass: "income",
    buildLines: ({ amount, narration }) => [
      line("KH-CASH", amount, 0, narration),
      line("KH-SALE", 0, amount, narration),
    ],
  },
  {
    intent: "khata_payment_in",
    explanation:
      "Payment received from debtor: Cash ↑ Dr, Receivable ↓ Cr. Settles outstanding receivable.",
    tags: ["receivable", "collection", "payment_in", "jama"],
    keywords: ["tiryo", "payment received", "jama", "aayo"],
    primaryClass: "asset",
    buildLines: ({ amount, party, narration }) => [
      line("KH-CASH", amount, 0, narration ?? `Payment from ${party ?? "debtor"}`),
      line("KH-DEBT", 0, amount, narration),
    ],
  },
  {
    intent: "khata_purchase",
    explanation: "Cash purchase: Purchase/Expense ↑ Dr, Cash ↓ Cr.",
    tags: ["purchase", "cash_purchase", "expense"],
    keywords: ["kineko", "kharid", "cash purchase"],
    primaryClass: "expense",
    buildLines: ({ amount, item, narration }) => [
      line("KH-PUR", amount, 0, narration ?? item ?? "Purchase"),
      line("KH-CASH", 0, amount, narration),
    ],
  },
  {
    intent: "khata_payment_out",
    explanation: "Payment to creditor: Creditor/Payable ↓ Dr, Cash ↓ Cr.",
    tags: ["payable", "payment_out", "creditor"],
    keywords: ["payment gareko", "tirna diye", "creditor payment"],
    primaryClass: "liability",
    buildLines: ({ amount, party, narration }) => [
      line("KH-CRED", amount, 0, narration ?? `Payment to ${party ?? "creditor"}`),
      line("KH-CASH", 0, amount, narration),
    ],
  },
  {
    intent: "khata_expense",
    explanation: "Operating expense paid in cash: Expense ↑ Dr, Cash ↓ Cr.",
    tags: ["expense", "kharcha", "operating"],
    keywords: ["kharcha", "expense", "rent", "electricity"],
    primaryClass: "expense",
    buildLines: ({ amount, item, narration }) => [
      line("KH-EXP", amount, 0, narration ?? item ?? "Expense"),
      line("KH-CASH", 0, amount, narration),
    ],
  },

  // ── RECEIVABLES & PAYABLES ──
  {
    intent: "khata_credit_purchase",
    explanation:
      "Credit purchase: Stock/Purchase ↑ Dr, Creditor/Payable ↑ Cr. Creates outstanding payable.",
    tags: ["payable", "outstanding", "credit_purchase", "udhaar_kharid"],
    keywords: ["udhaar kineko", "credit purchase", "kharid udhaar"],
    primaryClass: "liability",
    buildLines: ({ amount, party, item, narration }) => [
      line("KH-PUR", amount, 0, narration ?? item ?? "Credit purchase"),
      line("KH-CRED", 0, amount, narration ?? `Payable to ${party ?? "supplier"}`),
    ],
  },
  {
    intent: "khata_outstanding_expense",
    explanation:
      "Accrued expense (bill received, not yet paid): Expense ↑ Dr, Outstanding Expenses ↑ Cr.",
    tags: ["accrual", "outstanding", "accrued_expense"],
    keywords: ["outstanding expense", "accrued", "bill aayo", "baki kharcha"],
    primaryClass: "expense",
    buildLines: ({ amount, item, narration }) => [
      line("KH-EXP", amount, 0, narration ?? item ?? "Accrued expense"),
      line("KH-OUT-EXP", 0, amount, narration),
    ],
  },
  {
    intent: "khata_prepaid_expense",
    explanation: "Prepaid expense: Prepaid Asset ↑ Dr, Cash ↓ Cr. Expense recognised later.",
    tags: ["prepaid", "advance", "asset"],
    keywords: ["prepaid", "advance rent", "agadi tiryo"],
    primaryClass: "asset",
    buildLines: ({ amount, item, narration }) => [
      line("KH-PREPAID", amount, 0, narration ?? item ?? "Prepaid expense"),
      line("KH-CASH", 0, amount, narration),
    ],
  },

  // ── BAD DEBTS ──
  {
    intent: "khata_bad_debt_writeoff",
    explanation:
      "Direct bad debt write-off: Bad Debts Expense ↑ Dr, Debtor ↓ Cr. Receivable no longer collectible.",
    tags: ["bad_debt", "writeoff", "irrecoverable"],
    keywords: ["bad debt", "write off", "ramro chaina", "nasakne"],
    primaryClass: "expense",
    buildLines: ({ amount, party, narration }) => [
      line("KH-BD-EXP", amount, 0, narration ?? `Bad debt — ${party ?? "debtor"}`),
      line("KH-DEBT", 0, amount, narration),
    ],
  },
  {
    intent: "khata_provision_bad_debt",
    explanation:
      "Provision for doubtful debts (conservatism): Bad Debts Expense ↑ Dr, Provision ↑ Cr.",
    tags: ["provision", "bad_debt", "doubtful"],
    keywords: ["provision bad debt", "doubtful debt", "andaaja"],
    primaryClass: "expense",
    buildLines: ({ amount, narration }) => [
      line("KH-BD-EXP", amount, 0, narration ?? "Provision for bad debts"),
      line("KH-BD-PROV", 0, amount, narration),
    ],
  },
  {
    intent: "khata_bad_debt_recovery",
    explanation:
      "Recovery of previously written-off debt: Cash ↑ Dr, Bad Debts Recovered (income) ↑ Cr.",
    tags: ["bad_debt", "recovery", "income"],
    keywords: ["bad debt recovery", "feri aayo", "recovered"],
    primaryClass: "income",
    buildLines: ({ amount, party, narration }) => [
      line("KH-CASH", amount, 0, narration ?? `Recovery from ${party ?? "debtor"}`),
      line("KH-BD-REC", 0, amount, narration),
    ],
  },

  // ── PAYROLL & STATUTORY (Nepal) ──
  {
    intent: "khata_salary_accrual",
    explanation:
      "Salary accrual at month-end: Salary Expense ↑ Dr, Salary Payable ↑ Cr.",
    tags: ["salary", "accrual", "payroll", "outstanding"],
    keywords: ["salary accrual", "talab provision", "month end salary"],
    primaryClass: "expense",
    buildLines: ({ amount, narration }) => [
      line("KH-SAL", amount, 0, narration ?? "Salary for the month"),
      line("KH-SAL-PAY", 0, amount, narration),
    ],
  },
  {
    intent: "khata_salary_payment",
    explanation: "Salary payment: Salary Payable ↓ Dr, Bank/Cash ↓ Cr.",
    tags: ["salary", "payment", "payroll"],
    keywords: ["salary payment", "talab diyo", "payroll"],
    primaryClass: "expense",
    buildLines: ({ amount, narration }) => [
      line("KH-SAL-PAY", amount, 0, narration ?? "Salary payment"),
      line("KH-BANK", 0, amount, narration),
    ],
  },
  {
    intent: "khata_ssf_employee",
    explanation:
      "SSF employee contribution (10% of basic): Salary Expense ↑ Dr (gross), SSF Employee Payable ↑ Cr. " +
      "Deducted from employee and remitted to SSF.",
    tags: ["ssf", "employee", "statutory", "nepal"],
    keywords: ["ssf employee", "employee ssf", "10 percent ssf"],
    primaryClass: "liability",
    buildLines: ({ amount, narration }) => {
      const ssfEmp = Math.round(amount * 0.1 * 100) / 100;
      return [
        line("KH-SAL", amount, 0, narration ?? "Gross salary"),
        line("KH-SSF-EMP", 0, ssfEmp, "SSF employee contribution 10%"),
        line("KH-SAL-PAY", 0, amount - ssfEmp, "Net salary payable"),
      ];
    },
  },
  {
    intent: "khata_ssf_employer",
    explanation:
      "SSF employer contribution (11% of basic): SSF Employer Expense ↑ Dr, SSF Employer Payable ↑ Cr.",
    tags: ["ssf", "employer", "statutory", "nepal"],
    keywords: ["ssf employer", "employer ssf", "11 percent ssf"],
    primaryClass: "expense",
    buildLines: ({ amount, narration }) => {
      const ssfEr = Math.round(amount * 0.11 * 100) / 100;
      return [
        line("KH-SSF-ER-EXP", ssfEr, 0, narration ?? "SSF employer contribution 11%"),
        line("KH-SSF-ER", 0, ssfEr, "SSF employer payable"),
      ];
    },
  },
  {
    intent: "khata_gratuity_provision",
    explanation:
      "Gratuity provision (IAS 19 / Nepal labour law): Gratuity Expense ↑ Dr, Gratuity Provision ↑ Cr.",
    tags: ["gratuity", "provision", "employee_benefit"],
    keywords: ["gratuity provision", "gratuity accrual"],
    primaryClass: "expense",
    buildLines: ({ amount, narration }) => [
      line("KH-GRAT-EXP", amount, 0, narration ?? "Gratuity provision"),
      line("KH-GRAT-PROV", 0, amount, narration),
    ],
  },
  {
    intent: "khata_gratuity_payment",
    explanation: "Gratuity payment on retirement: Gratuity Provision ↓ Dr, Bank ↓ Cr.",
    tags: ["gratuity", "payment", "employee_benefit"],
    keywords: ["gratuity payment", "gratuity diyo"],
    primaryClass: "liability",
    buildLines: ({ amount, narration }) => [
      line("KH-GRAT-PROV", amount, 0, narration ?? "Gratuity payment"),
      line("KH-BANK", 0, amount, narration),
    ],
  },

  // ── VAT & TDS (Nepal) ──
  {
    intent: "khata_vat_sales",
    explanation:
      "VAT-inclusive sale: Debtor/Cash ↑ Dr (gross), Sales ↑ Cr (net), Output VAT ↑ Cr (13%).",
    tags: ["vat", "sales", "tax", "nepal"],
    keywords: ["vat sale", "vat bikri", "13 percent vat"],
    primaryClass: "income",
    buildLines: ({ amount, party, narration }) => {
      const { net, vat } = vatSplit(amount);
      return [
        line("KH-DEBT", amount, 0, narration ?? `VAT sale${party ? ` to ${party}` : ""}`),
        line("KH-SALE", 0, net, "Sales (net of VAT)"),
        line("KH-VAT-OUT", 0, vat, "Output VAT 13%"),
      ];
    },
  },
  {
    intent: "khata_vat_purchase",
    explanation:
      "VAT-inclusive purchase: Purchase ↑ Dr (net), Input VAT ↑ Dr, Creditor/Cash ↓ Cr (gross).",
    tags: ["vat", "purchase", "input_vat", "nepal"],
    keywords: ["vat purchase", "vat kharid", "input vat"],
    primaryClass: "expense",
    buildLines: ({ amount, narration }) => {
      const { net, vat } = vatSplit(amount);
      return [
        line("KH-PUR", net, 0, narration ?? "Purchase (net)"),
        line("KH-VAT-IN", vat, 0, "Input VAT 13%"),
        line("KH-CASH", 0, amount, narration),
      ];
    },
  },
  {
    intent: "khata_vat_payment",
    explanation: "VAT remittance to IRD: VAT Payable ↓ Dr, Bank ↓ Cr.",
    tags: ["vat", "payment", "ird", "nepal"],
    keywords: ["vat payment", "vat tiryo", "ird vat"],
    primaryClass: "liability",
    buildLines: ({ amount, narration }) => [
      line("KH-VAT-OUT", amount, 0, narration ?? "VAT payment to IRD"),
      line("KH-BANK", 0, amount, narration),
    ],
  },
  {
    intent: "khata_tds_deducted",
    explanation:
      "TDS deducted on payment: Expense ↑ Dr (gross), TDS Payable ↑ Cr, Bank ↓ Cr (net).",
    tags: ["tds", "withholding", "nepal"],
    keywords: ["tds deducted", "withholding tax", "tds kateko"],
    primaryClass: "liability",
    buildLines: ({ amount, secondaryAmount, narration }) => {
      const tds = secondaryAmount ?? Math.round(amount * 0.15 * 100) / 100;
      const net = amount - tds;
      return [
        line("KH-EXP", amount, 0, narration ?? "Expense (gross)"),
        line("KH-TDS-PAY", 0, tds, "TDS deducted"),
        line("KH-BANK", 0, net, "Net payment"),
      ];
    },
  },
  {
    intent: "khata_tds_paid",
    explanation: "TDS remittance to IRD: TDS Payable ↓ Dr, Bank ↓ Cr.",
    tags: ["tds", "payment", "ird"],
    keywords: ["tds paid", "tds remittance", "tds tiryo"],
    primaryClass: "liability",
    buildLines: ({ amount, narration }) => [
      line("KH-TDS-PAY", amount, 0, narration ?? "TDS remittance"),
      line("KH-BANK", 0, amount, narration),
    ],
  },

  // ── OTHER INCOME & EXPENSES ──
  {
    intent: "khata_other_income",
    explanation: "Other income (interest, rent, dividend): Cash/Bank ↑ Dr, Other Income ↑ Cr.",
    tags: ["income", "interest", "rent", "dividend"],
    keywords: ["interest received", "rent received", "other income", "byaj aayo"],
    primaryClass: "income",
    buildLines: ({ amount, item, narration }) => [
      line("KH-BANK", amount, 0, narration ?? item ?? "Other income received"),
      line("KH-OTH-INC", 0, amount, narration),
    ],
  },
  {
    intent: "khata_depreciation",
    explanation:
      "Depreciation (non-cash): Depreciation Expense ↑ Dr, Accumulated Depreciation ↑ Cr.",
    tags: ["depreciation", "fixed_asset", "non_cash"],
    keywords: ["depreciation", "mulya ghata", "annual depreciation"],
    primaryClass: "expense",
    buildLines: ({ amount, item, narration }) => [
      line("KH-DEPR", amount, 0, narration ?? item ?? "Depreciation"),
      line("KH-ACC-DEP", 0, amount, narration),
    ],
  },
  {
    intent: "khata_bank_charges",
    explanation: "Bank charges: Bank Charges Expense ↑ Dr, Bank ↓ Cr.",
    tags: ["bank", "charges", "expense"],
    keywords: ["bank charge", "bank fee", "bank kharcha"],
    primaryClass: "expense",
    buildLines: ({ amount, narration }) => [
      line("KH-BANK-CHG", amount, 0, narration ?? "Bank charges"),
      line("KH-BANK", 0, amount, narration),
    ],
  },
  {
    intent: "khata_discount_allowed",
    explanation: "Discount allowed to customer: Discount Allowed ↑ Dr, Debtor ↓ Cr.",
    tags: ["discount", "allowed", "expense"],
    keywords: ["discount allowed", "chhut diyo"],
    primaryClass: "expense",
    buildLines: ({ amount, party, narration }) => [
      line("KH-DISC-ALL", amount, 0, narration ?? `Discount to ${party ?? "customer"}`),
      line("KH-DEBT", 0, amount, narration),
    ],
  },
  {
    intent: "khata_discount_received",
    explanation: "Discount received from supplier: Creditor ↓ Dr, Discount Received ↑ Cr.",
    tags: ["discount", "received", "income"],
    keywords: ["discount received", "chhut paayo"],
    primaryClass: "income",
    buildLines: ({ amount, party, narration }) => [
      line("KH-CRED", amount, 0, narration ?? `Discount from ${party ?? "supplier"}`),
      line("KH-DISC-REC", 0, amount, narration),
    ],
  },

  // ── CAPITAL & STOCK ──
  {
    intent: "khata_capital_introduced",
    explanation: "Capital introduced by owner: Cash/Bank ↑ Dr, Capital ↑ Cr.",
    tags: ["capital", "equity", "investment"],
    keywords: ["capital introduced", "puni lagaayo", "owner investment"],
    primaryClass: "equity",
    buildLines: ({ amount, narration }) => [
      line("KH-BANK", amount, 0, narration ?? "Capital introduced"),
      line("KH-CAP", 0, amount, narration),
    ],
  },
  {
    intent: "khata_drawings",
    explanation: "Owner drawings: Drawings ↑ Dr, Cash/Bank ↓ Cr.",
    tags: ["drawings", "equity", "withdrawal"],
    keywords: ["drawings", "nikasne", "owner withdrawal"],
    primaryClass: "equity",
    buildLines: ({ amount, narration }) => [
      line("KH-DRAW", amount, 0, narration ?? "Drawings"),
      line("KH-CASH", 0, amount, narration),
    ],
  },
  {
    intent: "khata_loan_received",
    explanation: "Loan received: Bank ↑ Dr, Loan Payable ↑ Cr.",
    tags: ["loan", "liability", "borrowing"],
    keywords: ["loan received", "rin liyo", "loan liyo"],
    primaryClass: "liability",
    buildLines: ({ amount, narration }) => [
      line("KH-BANK", amount, 0, narration ?? "Loan received"),
      line("KH-LOAN", 0, amount, narration),
    ],
  },
  {
    intent: "khata_loan_repayment",
    explanation: "Loan repayment: Loan Payable ↓ Dr, Bank ↓ Cr.",
    tags: ["loan", "repayment", "liability"],
    keywords: ["loan repayment", "rin tiryo", "loan payment"],
    primaryClass: "liability",
    buildLines: ({ amount, narration }) => [
      line("KH-LOAN", amount, 0, narration ?? "Loan repayment"),
      line("KH-BANK", 0, amount, narration),
    ],
  },
  {
    intent: "khata_stock_purchase",
    explanation: "Inventory purchase: Stock ↑ Dr, Cash/Creditor ↓ Cr.",
    tags: ["stock", "inventory", "purchase"],
    keywords: ["stock purchase", "inventory", "saman kineko"],
    primaryClass: "stock",
    buildLines: ({ amount, item, narration }) => [
      line("KH-STOCK", amount, 0, narration ?? item ?? "Stock purchase"),
      line("KH-CASH", 0, amount, narration),
    ],
  },
  {
    intent: "khata_stock_sale_cogs",
    explanation: "COGS on stock sale: Purchase/COGS ↑ Dr, Stock ↓ Cr.",
    tags: ["cogs", "stock", "cost_of_sales"],
    keywords: ["cogs", "cost of goods", "stock becheko cost"],
    primaryClass: "expense",
    buildLines: ({ amount, narration }) => [
      line("KH-PUR", amount, 0, narration ?? "Cost of goods sold"),
      line("KH-STOCK", 0, amount, narration),
    ],
  },
  {
    intent: "khata_contra_cash_bank",
    explanation: "Contra entry: Cash deposited to bank — Bank ↑ Dr, Cash ↓ Cr.",
    tags: ["contra", "cash", "bank"],
    keywords: ["contra", "cash to bank", "bank ma jama", "transferred to bank", "deposit to bank", "cash deposit"],
    primaryClass: "asset",
    buildLines: ({ amount, narration }) => [
      line("KH-BANK", amount, 0, narration ?? "Cash deposited to bank"),
      line("KH-CASH", 0, amount, narration),
    ],
  },
  {
    intent: "khata_sales_return",
    explanation: "Sales return reverses revenue and receivable/cash: Dr Sales Return, Cr Debtor/Cash.",
    tags: ["sales_return", "credit_note", "return"],
    keywords: ["sales return", "credit note", "return gare", "firta", "firtayo", "saman firta"],
    primaryClass: "income",
    buildLines: ({ amount, party, narration }) => [
      line("KH-SALE", amount, 0, narration ?? `Sales return${party ? ` from ${party}` : ""}`),
      line("KH-DEBT", 0, amount, narration),
    ],
  },
  {
    intent: "khata_purchase_return",
    explanation: "Purchase return reduces stock/purchase and payable/cash: Dr Creditor/Cash, Cr Purchase/Stock.",
    tags: ["purchase_return", "debit_note"],
    keywords: ["purchase return", "debit note", "supplier return", "kharid firta"],
    primaryClass: "expense",
    buildLines: ({ amount, party, narration }) => [
      line("KH-CRED", amount, 0, narration ?? `Purchase return${party ? ` to ${party}` : ""}`),
      line("KH-PUR", 0, amount, narration),
    ],
  },
  {
    intent: "khata_customer_advance",
    explanation: "Advance from customer is a liability until goods/services delivered: Dr Cash/Bank, Cr Customer Advance.",
    tags: ["advance", "customer", "unearned"],
    keywords: ["customer advance", "advance liyo", "advance aayo", "advance received", "unearned revenue"],
    primaryClass: "liability",
    buildLines: ({ amount, party, narration }) => [
      line("KH-CASH", amount, 0, narration ?? `Advance from ${party ?? "customer"}`),
      line("KH-CUST-ADV", 0, amount, narration),
    ],
  },
  {
    intent: "khata_employee_advance",
    explanation: "Advance to employee is recoverable asset: Dr Employee Advance, Cr Cash/Bank.",
    tags: ["advance", "employee", "staff"],
    keywords: ["employee advance", "staff advance", "talab advance", "advance diyo staff"],
    primaryClass: "asset",
    buildLines: ({ amount, party, narration }) => [
      line("KH-EMP-ADV", amount, 0, narration ?? `Advance to ${party ?? "employee"}`),
      line("KH-CASH", 0, amount, narration),
    ],
  },
  {
    intent: "khata_opening_balance",
    explanation: "Opening balance entry establishes initial capital/assets: Dr Assets, Cr Capital.",
    tags: ["opening", "opening_balance"],
    keywords: ["opening balance", "opening entry", "suruwati khata", "purano khata"],
    primaryClass: "equity",
    buildLines: ({ amount, narration }) => [
      line("KH-CASH", amount, 0, narration ?? "Opening balance — cash"),
      line("KH-CAP", 0, amount, narration ?? "Opening capital"),
    ],
  },
  {
    intent: "khata_asset_disposal",
    explanation: "Asset disposal: remove asset cost, clear accumulated depreciation, record proceeds and gain/loss.",
    tags: ["disposal", "asset", "sale_of_asset"],
    keywords: ["asset disposal", "sold asset", "machine becheko", "vehicle becheko", "fixed asset sold"],
    primaryClass: "gain",
    buildLines: ({ amount, narration }) => [
      line("KH-CASH", amount, 0, narration ?? "Proceeds from asset disposal"),
      line("KH-PPE", 0, amount, narration ?? "Asset written off at book value (simplified)"),
    ],
  },
  {
    intent: "khata_inventory_write_down",
    explanation: "Inventory write-down to NRV: Dr Expense/Loss, Cr Stock.",
    tags: ["inventory", "write_down", "shrinkage"],
    keywords: ["inventory write down", "stock adjustment", "shrinkage", "obsolete stock", "stock count difference"],
    primaryClass: "expense",
    buildLines: ({ amount, narration }) => [
      line("KH-EXP", amount, 0, narration ?? "Inventory write-down"),
      line("KH-STOCK", 0, amount, narration),
    ],
  },
  {
    intent: "khata_commission_income",
    explanation: "Commission income: Dr Cash/Debtor, Cr Other Income.",
    tags: ["commission", "other_income"],
    keywords: ["commission income", "commission aayo", "commission received", "aamdani commission"],
    primaryClass: "income",
    buildLines: ({ amount, narration }) => [
      line("KH-CASH", amount, 0, narration ?? "Commission received"),
      line("KH-OTH-INC", 0, amount, narration),
    ],
  },
  {
    intent: "khata_rent_expense",
    explanation: "Rent expense: Dr Rent/Operating Expense, Cr Cash/Creditor.",
    tags: ["rent", "bhaada", "bhada"],
    keywords: ["rent", "bhaada", "bhada", "premises", "landlord"],
    primaryClass: "expense",
    buildLines: ({ amount, narration }) => [
      line("KH-EXP", amount, 0, narration ?? "Rent expense"),
      line("KH-CASH", 0, amount, narration),
    ],
  },
];

const TEMPLATE_MAP = new Map(CA_ENTRY_TEMPLATES.map((t) => [t.intent, t]));

export function getEntryTemplate(intent: KhataIntent): EntryTemplate | undefined {
  return TEMPLATE_MAP.get(intent);
}

export function buildJournalLines(
  intent: KhataIntent,
  params: EntryBuildParams,
): JournalLineDraft[] {
  const template = TEMPLATE_MAP.get(intent);
  if (!template) throw new Error(`No template for intent: ${intent}`);
  return template.buildLines(params);
}

export function findTemplateByKeywords(text: string): EntryTemplate | null {
  const lower = text.toLowerCase();
  let best: EntryTemplate | null = null;
  let bestScore = 0;

  for (const t of CA_ENTRY_TEMPLATES) {
    let score = 0;
    for (const kw of t.keywords) {
      if (lower.includes(kw.toLowerCase())) score += kw.length;
    }
    if (score > bestScore) {
      bestScore = score;
      best = t;
    }
  }
  return bestScore >= 4 ? best : null;
}

export function validateJournalBalance(lines: JournalLineDraft[]): {
  balanced: boolean;
  totalDebit: number;
  totalCredit: number;
} {
  const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
  const totalCredit = lines.reduce((s, l) => s + l.credit, 0);
  const balanced = Math.abs(totalDebit - totalCredit) < 0.01;
  return {
    balanced,
    totalDebit: Math.round(totalDebit * 100) / 100,
    totalCredit: Math.round(totalCredit * 100) / 100,
  };
}
