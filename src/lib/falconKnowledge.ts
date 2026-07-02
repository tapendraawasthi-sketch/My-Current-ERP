export interface ModuleDoc {
  description: string;
  howToUse: string[];
  keyFeatures: string[];
  relatedModules: string[];
  commonQuestions: Array<{ q: string; a: string }>;
}

export type KnowledgeContext = {
  moduleId?: string;
  userQuery?: string;
  currentRoute?: string;
};

/**
 * Knowledge base covering all ERP modules in Sutra ERP.
 */
export const ERP_MODULE_KNOWLEDGE: Record<string, ModuleDoc> = {
  "dashboard": {
    description: "Main landing page providing a high-level overview of the company's financial and operational status.",
    howToUse: [
      "Navigate to the main dashboard from the sidebar.",
      "Review the key metrics cards for quick insights.",
      "Check recent transactions and alerts."
    ],
    keyFeatures: ["Key Performance Indicators (KPIs)", "Recent Activity Feed", "Alerts & Notifications"],
    relatedModules: ["financial-dashboard", "sales-invoice", "purchase-invoice"],
    commonQuestions: [
      { q: "What does the dashboard show?", a: "It shows an overview of your sales, purchases, cash flow, and recent activities." }
    ]
  },
  "financial-dashboard": {
    description: "Detailed financial metrics and charts for analyzing company performance.",
    howToUse: [
      "Select 'Financial Dashboard' from the Reports menu.",
      "Use filters to adjust date ranges."
    ],
    keyFeatures: ["Cash Flow Analysis", "Expense Breakdown", "Revenue Trends"],
    relatedModules: ["balance-sheet", "profit-loss", "dashboard"],
    commonQuestions: [
      { q: "How can I view last month's cash flow?", a: "Go to the Financial Dashboard and adjust the date filter to last month." }
    ]
  },
  "chart-of-accounts": {
    description: "Master list of all accounts used in the general ledger.",
    howToUse: [
      "Go to Masters -> Chart of Accounts.",
      "Click 'New Account' or 'F3' to add a ledger.",
      "Assign it under a relevant group (e.g., Sundry Debtors, Direct Expenses)."
    ],
    keyFeatures: ["Hierarchical Account Groups", "Opening Balance Entry", "Account Type Classification"],
    relatedModules: ["journal-entry", "general-ledger"],
    commonQuestions: [
      { q: "How do I create a new expense account?", a: "Go to Chart of Accounts, press F3, enter the name, and select 'Indirect Expenses' as the group." }
    ]
  },
  "parties": {
    description: "Management of customers and suppliers (Sundry Debtors & Creditors).",
    howToUse: [
      "Go to Masters -> Parties.",
      "Press F3 to add a new party.",
      "Fill in VAT/PAN details and contact information."
    ],
    keyFeatures: ["Customer/Supplier Management", "Credit Limits", "VAT/PAN validation"],
    relatedModules: ["sales-invoice", "purchase-invoice", "outstanding-receivables"],
    commonQuestions: [
      { q: "How do I set a credit limit for a customer?", a: "Edit the party in Masters -> Parties and set the 'Credit Limit' field." }
    ]
  },
  "items": {
    description: "Inventory stock items master.",
    howToUse: [
      "Go to Masters -> Items.",
      "Add item name, unit, tax category, and opening stock."
    ],
    keyFeatures: ["Multiple Units", "Tax Categories", "Stock Valuation Methods"],
    relatedModules: ["sales-invoice", "purchase-invoice", "stock-summary"],
    commonQuestions: [
      { q: "How to add opening stock?", a: "While creating or editing an item, enter the quantity in the 'Opening Stock' field." }
    ]
  },
  "sales-invoice": {
    description: "Module for recording sales transactions and generating bills for customers.",
    howToUse: [
      "Go to Transactions -> Sales Invoice.",
      "Select the Party (Customer).",
      "Add Items, quantities, and rates.",
      "Apply any discounts or bill sundries.",
      "Press F2 to save and F8 to print."
    ],
    keyFeatures: ["Multi-item entry", "Auto tax calculation", "Bill sundries support", "CBMS integration"],
    relatedModules: ["parties", "items", "receipt-voucher", "sales-return"],
    commonQuestions: [
      { q: "How do I create a sales invoice?", a: "Go to Transactions -> Sales Invoice, select customer, add items, and press F2 to save." },
      { q: "Why is VAT not calculating?", a: "Check if the selected item has a VAT-applicable tax category and the party's VAT number is correct." }
    ]
  },
  "purchase-invoice": {
    description: "Module for recording purchase bills from suppliers.",
    howToUse: [
      "Go to Transactions -> Purchase Invoice.",
      "Select the Supplier.",
      "Enter Supplier Invoice Number.",
      "Add items and match the bill amount.",
      "Press F2 to save."
    ],
    keyFeatures: ["Input VAT calculation", "Stock inward", "Bill reference tracking"],
    relatedModules: ["parties", "items", "payment-voucher", "purchase-return"],
    commonQuestions: [
      { q: "How to enter a purchase bill?", a: "Go to Transactions -> Purchase, select supplier, add items, and save." }
    ]
  },
  "sales-return": {
    description: "Records goods returned by customers (Credit Note).",
    howToUse: [
      "Go to Transactions -> Sales Return.",
      "Select Party and reference the original Sales Invoice.",
      "Enter returned items."
    ],
    keyFeatures: ["Original Invoice Linking", "Stock Auto-adjustment"],
    relatedModules: ["sales-invoice"],
    commonQuestions: [
      { q: "How to process a customer return?", a: "Use Transactions -> Sales Return and link it to the original invoice." }
    ]
  },
  "purchase-return": {
    description: "Records goods returned to suppliers (Debit Note).",
    howToUse: [
      "Go to Transactions -> Purchase Return.",
      "Select Supplier and original Purchase Invoice."
    ],
    keyFeatures: ["Stock Auto-adjustment", "Supplier Balance update"],
    relatedModules: ["purchase-invoice"],
    commonQuestions: [
      { q: "How to return goods to supplier?", a: "Use Transactions -> Purchase Return." }
    ]
  },
  "payment-voucher": {
    description: "Records payments made to suppliers or for expenses.",
    howToUse: [
      "Go to Transactions -> Payment.",
      "Debit the receiver/expense account.",
      "Credit Cash or Bank.",
      "Save (F2)."
    ],
    keyFeatures: ["Multi-mode payment", "Bill allocation"],
    relatedModules: ["parties", "journal-entry", "bank-reconciliation"],
    commonQuestions: [
      { q: "How to pay a supplier?", a: "Go to Transactions -> Payment, debit the supplier, credit bank/cash." }
    ]
  },
  "receipt-voucher": {
    description: "Records money received from customers or other income.",
    howToUse: [
      "Go to Transactions -> Receipt.",
      "Credit the giver/income account.",
      "Debit Cash or Bank."
    ],
    keyFeatures: ["Bill allocation", "PDC handling"],
    relatedModules: ["parties", "sales-invoice"],
    commonQuestions: [
      { q: "How to record customer payment?", a: "Go to Transactions -> Receipt, credit customer, debit bank." }
    ]
  },
  "journal-entry": {
    description: "For non-cash adjustments, depreciation, and complex accounting entries.",
    howToUse: [
      "Go to Transactions -> Journal.",
      "Ensure total Debits equal total Credits.",
      "Add narration and save."
    ],
    keyFeatures: ["Multi-account debit/credit", "Strict balancing"],
    relatedModules: ["general-ledger"],
    commonQuestions: [
      { q: "How to enter depreciation?", a: "Use a Journal Entry: Debit Depreciation Expense, Credit Accumulated Depreciation/Asset." }
    ]
  },
  "contra-voucher": {
    description: "For cash deposits, withdrawals, or bank-to-bank transfers.",
    howToUse: [
      "Go to Transactions -> Contra.",
      "Select Bank and Cash accounts."
    ],
    keyFeatures: ["Cash-Bank only validation"],
    relatedModules: ["journal-entry"],
    commonQuestions: [
      { q: "How to record cash deposit to bank?", a: "Use Contra Voucher. Debit Bank, Credit Cash." }
    ]
  },
  "balance-sheet": {
    description: "Financial statement showing assets, liabilities, and equity.",
    howToUse: [
      "Go to Reports -> Balance Sheet.",
      "Select date as-of.",
      "Expand groups for detail."
    ],
    keyFeatures: ["T-format or Vertical", "Drill-down to ledgers"],
    relatedModules: ["profit-loss", "trial-balance"],
    commonQuestions: [
      { q: "Why is Balance Sheet not matching?", a: "Check Trial Balance for unbalanced entries or unposted opening balances." }
    ]
  },
  "profit-loss": {
    description: "Shows revenue and expenses for a period.",
    howToUse: [
      "Go to Reports -> Profit & Loss.",
      "Select date range."
    ],
    keyFeatures: ["Gross & Net Profit", "Drill-down capability"],
    relatedModules: ["balance-sheet"],
    commonQuestions: [
      { q: "How to see monthly profit?", a: "Go to Profit & Loss and adjust the date filter." }
    ]
  },
  "trial-balance": {
    description: "Lists all ledger balances to ensure debits equal credits.",
    howToUse: [
      "Go to Reports -> Trial Balance."
    ],
    keyFeatures: ["Group-wise/Ledger-wise view"],
    relatedModules: ["general-ledger"],
    commonQuestions: [
      { q: "What does Trial Balance show?", a: "It ensures the total of all debit balances equals the total of all credit balances." }
    ]
  },
  "day-book": {
    description: "Chronological list of all transactions for a day.",
    howToUse: [
      "Go to Reports -> Day Book.",
      "Select the date."
    ],
    keyFeatures: ["All voucher types", "Daily summary"],
    relatedModules: ["general-ledger"],
    commonQuestions: [
      { q: "How to see today's entries?", a: "Check the Day Book for today's date." }
    ]
  },
  "vat-reports": {
    description: "Reports required for VAT filing in Nepal.",
    howToUse: [
      "Go to Reports -> VAT Reports.",
      "Generate Purchase/Sales Register or VAT Return."
    ],
    keyFeatures: ["CBMS compliant format", "Materialize taxable/non-taxable"],
    relatedModules: ["sales-invoice", "purchase-invoice"],
    commonQuestions: [
      { q: "How to prepare VAT return?", a: "Go to VAT Reports and generate the VAT Return for the Nepali month." }
    ]
  },
  "system-settings": {
    description: "Global company settings and preferences.",
    howToUse: [
      "Go to Administration -> System Settings."
    ],
    keyFeatures: ["Voucher numbering config", "Features toggle"],
    relatedModules: ["user-management"],
    commonQuestions: [
      { q: "How to change voucher numbering?", a: "Go to System Settings -> Voucher Numbering." }
    ]
  }
};

/**
 * Common accounting concepts for explaining financial terms.
 */
export const ACCOUNTING_CONCEPTS: Record<string, string> = {
  "double-entry": "Every financial transaction has equal and opposite effects in at least two different accounts (Debit and Credit).",
  "debit": "An entry that increases an asset or expense account, or decreases a liability or equity account.",
  "credit": "An entry that increases a liability or equity account, or decreases an asset or expense account.",
  "trial-balance": "A list of all general ledger accounts and their balances to ensure total debits equal total credits.",
  "balance-sheet": "A statement showing a company's assets, liabilities, and equity at a specific point in time.",
  "profit-loss": "A statement showing revenues, costs, and expenses over a specific period, resulting in net profit or loss.",
  "vat": "Value Added Tax. In Nepal, the standard rate is 13%. It is collected on sales and paid on purchases.",
  "tds": "Tax Deducted at Source. A portion of payment deducted and remitted to the government.",
  "fiscal-year": "A 12-month accounting period. In Nepal, it typically starts in Shrawan (mid-July).",
  "ledger": "The principal book for recording and totaling economic transactions by account.",
  "voucher": "An internal document used to record a transaction before it is posted to the ledger.",
  "journal": "A record of financial transactions in chronological order.",
  "contra": "An entry involving only cash and bank accounts, used for deposits or withdrawals.",
  "outstanding": "Amounts owed by customers (receivables) or owed to suppliers (payables) that are not yet paid.",
  "aging": "A report showing how long invoices have been outstanding to evaluate bad debt risks.",
  "depreciation": "The systematic allocation of the cost of a fixed asset over its useful life.",
  "fifo": "First-In, First-Out. An inventory valuation method where the oldest stock is sold first."
};

/**
 * Context regarding the ERP's internal codebase.
 */
export const CODE_STRUCTURE_KNOWLEDGE = {
  state: "src/store/useStore.ts — Zustand store with all ERP data.",
  database: "src/lib/db.ts — Dexie (IndexedDB) for offline-first storage.",
  types: "src/lib/types.ts — All TypeScript interfaces.",
  utils: "src/lib/utils.ts, src/lib/accounting.ts, src/lib/taxUtils.ts",
  print: "src/lib/printUtils.ts — PDF/receipt generation.",
  nepaliDate: "src/lib/nepaliDate.ts — BS/AD conversion.",
  components: "src/components/ and pages in src/pages/",
  falcon: "src/components/falcon/ - UI components for the AI."
};

/**
 * Standard ERP keyboard shortcuts.
 */
export const KEYBOARD_SHORTCUTS: Record<string, string> = {
  "F2": "Save record",
  "F3": "Create new master/record",
  "F4": "Enter Narration",
  "F5": "Refresh page",
  "F6": "Change Voucher Type",
  "F8": "Print",
  "F9": "Delete current row/item",
  "F10": "Toggle Column Filter",
  "F12": "Toggle Settings Panel",
  "Ctrl+A": "Select All",
  "Ctrl+Z": "Undo",
  "Escape": "Cancel or Close modal",
  "Tab": "Move to next field",
  "Alt+F4": "Close Company",
  "Ctrl+G": "Global Search",
  "Ctrl+/": "Toggle Falcon AI Panel"
};

/**
 * Helps understand what actions are available per route.
 */
export const NAVIGATION_HELP: Record<string, string[]> = {
  "sales-invoice": ["Select customer", "Add items", "Apply discount", "Save invoice", "Print invoice"],
  "parties": ["Add new customer", "Add new supplier", "Set credit limit", "View ledger"],
  "reports": ["View Balance Sheet", "View P&L", "View Trial Balance", "Check Day Book"]
};

/**
 * Solutions for common ERP errors.
 */
export const ERROR_SOLUTIONS = [
  {
    error: "Trial Balance mismatch",
    cause: "Opening balances do not balance, or a manual ledger entry was unbalanced.",
    solution: "Check the difference amount. Verify opening balances in Chart of Accounts. Ensure all journal entries balance."
  },
  {
    error: "Cannot delete item",
    cause: "Item has existing transaction history.",
    solution: "You cannot delete items that have been used in invoices or vouchers. Deactivate it instead."
  },
  {
    error: "VAT amount incorrect on print",
    cause: "Tax category misconfigured or rounding differences.",
    solution: "Verify the Item's tax category is set to 'Taxable 13%'. Check System Settings for rounding preferences."
  }
];
