// src/lib/falcon/knowledgeBase.ts
// Falcon's built-in knowledge base for Sutra ERP. Add new entries any time —
// no build step or migration required, this is a plain in-memory array.

export interface FalconKBEntry {
  id: string;
  module: string;
  title: string;
  keywords: string[];
  answer: string;
  followups?: string[];
}

export const FALCON_KB: FalconKBEntry[] = [
  {
    id: "about-falcon",
    module: "general",
    title: "What is Falcon",
    keywords: ["falcon", "who are you", "what are you", "chatbot", "assistant", "help bot"],
    answer:
      "I'm Falcon, the built-in assistant for Sutra ERP. I can explain any screen, walk you through vouchers, ledgers, inventory, VAT, payroll, reports and settings, and suggest what to do next on whichever page you're on. I only know about Sutra ERP — ask me anything about how to use it.",
    followups: [
      "How do I pass a journal entry?",
      "How do I create a sales invoice?",
      "What reports are available?",
    ],
  },
  {
    id: "nav-basics",
    module: "general",
    title: "Navigating the ERP",
    keywords: ["navigate", "menu", "sidebar", "where is", "find screen", "how to open"],
    answer:
      "Use the top menu bar (Company, Masters, Transactions, Reports, Utilities) or the left sidebar grouped by Gateway, Masters, Transactions, Books, Inventory, Reports, Payroll, Security and Configuration. Click a group heading to expand it, then click any item to open that screen.",
  },
  {
    id: "dashboard",
    module: "reports",
    title: "Dashboard overview",
    keywords: ["dashboard", "home screen", "overview", "summary widgets"],
    answer:
      "The Dashboard shows today's sales, outstanding receivables, cash & bank balance, VAT liability, stock value, active parties, and an Alerts panel that flags overdue invoices, low-stock items, PDC cheques due soon, and vouchers pending approval. Click any alert's action button to jump straight to the related screen.",
  },
  {
    id: "coa-overview",
    module: "accounts",
    title: "Chart of Accounts",
    keywords: [
      "chart of accounts",
      "account group",
      "ledger master",
      "coa",
      "add ledger",
      "create account",
    ],
    answer:
      "Chart of Accounts is under Masters. It has 15 predefined primary groups (Capital, Loans, Current Liabilities, Fixed Assets, Current Assets, Investments, Direct/Indirect Income, Direct/Indirect Expenses, Purchase, Suspense, etc.). Press F3 to add a new ledger, double-click any row to edit, and use the Group/Ledger toggle in the Add form to create either a sub-group or an account.",
    followups: ["How do I set an opening balance on a ledger?", "What is bill-by-bill tracking?"],
  },
  {
    id: "coa-opening-balance",
    module: "accounts",
    title: "Ledger opening balance",
    keywords: ["opening balance", "dr cr", "starting balance ledger"],
    answer:
      "When adding or editing a ledger, scroll to the Opening Balance section, enter the amount, and pick Dr or Cr. Debit balances suit assets/expenses ledgers, credit balances suit liabilities/income ledgers by default, but you can override either.",
  },
  {
    id: "bill-wise",
    module: "accounts",
    title: "Bill-by-bill / bill-wise tracking",
    keywords: ["bill wise", "bill by bill", "bill allocation", "outstanding tracking"],
    answer:
      "Enable 'Bill-by-Bill Outstanding Tracking' in System Settings or per-ledger under the ledger's Configuration tab. Once enabled, every Sales/Purchase invoice and Receipt/Payment voucher shows a Bill Allocation panel with an Auto-fill (FIFO) button that allocates the payment against the oldest outstanding bills first, and any unallocated amount is posted as an advance.",
  },
  {
    id: "parties",
    module: "parties",
    title: "Parties Directory",
    keywords: ["party", "customer", "supplier", "add party", "party master", "pan vat party"],
    answer:
      "Parties Directory (Masters → Parties) stores customers, suppliers, or both. Click Add Party, fill Name, Code, PAN/VAT, phone, address and opening balance, then Save. Use the Type filter tabs (All/Customer/Supplier/Both) and the Province filter to narrow the list.",
  },
  {
    id: "items",
    module: "inventory",
    title: "Item / Stock Master",
    keywords: ["item master", "add item", "stock item", "product master", "sku", "barcode"],
    answer:
      "Item Master (Masters → Inventory) has tabs for Basic details, Pricing (purchase rate, sales rate, MRP, VAT), Units (primary/alternate unit with conversion factor), Stock Settings (reorder level, minimum/maximum stock, opening stock) and Accounts (links purchase, sales and stock ledgers). Set 'Is Taxable' and VAT rate here so invoices calculate VAT automatically.",
  },
  {
    id: "units",
    module: "inventory",
    title: "Units of Measure & conversions",
    keywords: ["unit of measure", "uom", "unit conversion", "alternate unit"],
    answer:
      "Units of Measure lets you define base units like PCS, KG, BOX. Unit Conversion Master lets an item be bought/sold in an alternate unit (e.g. 1 BOX = 12 PCS) — set the conversion factor on the Item Master's Units tab.",
  },
  {
    id: "warehouses",
    module: "inventory",
    title: "Warehouses / Godowns",
    keywords: ["warehouse", "godown", "multi godown", "stock location"],
    answer:
      "Warehouses (Masters → Warehouses) define stock locations. Mark one as Default so new items pre-fill it. Use Stock Transfer to move quantities between warehouses — it books an Inventory Out from the source and an Inventory In at the destination, and if it's inter-branch it can also post an accounting journal for branch transfer receivable/payable.",
  },
  {
    id: "sales-voucher",
    module: "sales",
    title: "Sales Invoice / Sales Voucher",
    keywords: ["sales invoice", "sales voucher", "create invoice", "bill customer", "how to sell"],
    answer:
      "Open Transactions → Sales → Sales Voucher (or Billing). Pick the customer, date, add line items (item, qty, rate, discount%, VAT checkbox), choose payment mode (Cash/Bank/Credit), and click Post Invoice. The system auto-calculates taxable amount, 13% VAT, round-off and grand total, and posts the linked ledger entries and stock reduction automatically.",
    followups: ["How do I apply a discount?", "How do I record a partial payment on an invoice?"],
  },
  {
    id: "purchase-voucher",
    module: "purchase",
    title: "Purchase Invoice / Purchase Voucher",
    keywords: ["purchase invoice", "purchase voucher", "record purchase", "supplier bill"],
    answer:
      "Transactions → Purchase → Purchase Voucher. Select the supplier, add line items with purchase rate, mark VAT-applicable lines, and Post. This increases stock, posts input VAT, and creates a payable to the supplier ledger (or reduces cash/bank if paid immediately).",
  },
  {
    id: "sales-return",
    module: "sales",
    title: "Sales Return / Credit Note",
    keywords: ["sales return", "credit note", "customer return goods"],
    answer:
      "Use Sales Return under Transactions → Sales, or the Credit Note voucher. It reverses the original sale's stock and VAT effect and reduces the customer's outstanding balance. Reference the original invoice number in the narration for a clean audit trail.",
  },
  {
    id: "purchase-return",
    module: "purchase",
    title: "Purchase Return / Debit Note",
    keywords: ["purchase return", "debit note", "return to supplier"],
    answer:
      "Purchase Return (or Debit Note) reverses a purchase — stock goes out again and the supplier's payable is reduced. Open it from Transactions → Purchase → Purchase Return.",
  },
  {
    id: "payment-voucher",
    module: "payment",
    title: "Payment Voucher",
    keywords: ["payment voucher", "pay supplier", "record payment", "advance payment supplier"],
    answer:
      "Payment Voucher (Transactions → Finance → Payment) records money going out. Choose the Cash/Bank ledger, the supplier or expense ledger, and the amount. If bill-wise tracking is on, use the Bill Allocation panel to allocate against specific outstanding purchase bills or leave it unallocated to post as an advance.",
  },
  {
    id: "receipt-voucher",
    module: "receipt",
    title: "Receipt Voucher",
    keywords: ["receipt voucher", "receive payment", "customer payment", "collection entry"],
    answer:
      "Receipt Voucher records money coming in from a customer. Select the Cash/Bank account, the customer ledger, and amount, then use the Bill Allocation panel (Auto-fill FIFO button) to settle specific outstanding invoices, or leave the balance to be posted as a customer advance.",
  },
  {
    id: "journal-voucher",
    module: "journal",
    title: "Journal Entry",
    keywords: [
      "journal entry",
      "journal voucher",
      "pass journal",
      "adjustment entry",
      "depreciation entry",
    ],
    answer:
      "Journal Voucher (Transactions → Finance → Journal) is for non-cash adjustments like depreciation, provisions, or corrections. Add at least two ledger lines, put the amount under Debit on one line and Credit on another — the footer shows a Balanced/Unbalanced badge, and you cannot post until total debit equals total credit.",
  },
  {
    id: "contra-voucher",
    module: "contra",
    title: "Contra Voucher",
    keywords: ["contra voucher", "cash to bank", "bank to cash", "cash deposit", "cash withdrawal"],
    answer:
      "Contra Voucher is used only for cash-to-bank or bank-to-bank type transfers (e.g. depositing cash into the bank, or withdrawing cash from the bank). Select the two cash/bank ledgers and the amount.",
  },
  {
    id: "voucher-unbalanced",
    module: "journal",
    title: "Why is my voucher not balancing",
    keywords: [
      "voucher not balancing",
      "debit credit mismatch",
      "unbalanced voucher",
      "why cant i save voucher",
    ],
    answer:
      "A voucher can only be posted when total Debit equals total Credit exactly. Check the footer badge — if it shows UNBALANCED, review each line: a common cause is typing an amount in both the Debit and Credit cell of the same line, or leaving a line's account blank while it still has an amount.",
  },
  {
    id: "delivery-challan",
    module: "inventory",
    title: "Delivery Challan",
    keywords: ["delivery challan", "dispatch goods", "challan"],
    answer:
      "Delivery Challan records goods leaving your warehouse before a tax invoice is raised — useful when dispatch and billing happen on different dates. Save as Draft, then Dispatch Challan to move stock, and later use 'Create Invoice from Challan' to convert it into a Sales Invoice.",
  },
  {
    id: "grn",
    module: "inventory",
    title: "Goods Receipt Note (GRN)",
    keywords: ["grn", "goods receipt note", "receive stock before bill"],
    answer:
      "GRN records goods physically received from a supplier before the purchase bill arrives. Enter ordered/received/accepted/rejected quantities per line, mark it Received to post stock in, and later use 'Create Purchase Invoice from GRN' when the bill is available.",
  },
  {
    id: "stock-transfer",
    module: "inventory",
    title: "Stock Transfer between warehouses",
    keywords: ["stock transfer", "move stock", "transfer between godowns"],
    answer:
      "Stock Transfer (Transactions → Inventory → Stock Transfer) moves quantities from one warehouse to another. Pick the item, quantity, source and destination warehouse; the system books an Out movement at the source and an In movement at the destination with the same reference number.",
  },
  {
    id: "physical-stock",
    module: "inventory",
    title: "Physical Stock / Stock Take",
    keywords: ["physical stock", "stock take", "stock count", "inventory audit count"],
    answer:
      "Physical Stock lets you record the actual counted quantity per item/warehouse and automatically raises adjustment entries for any variance between book stock and physical stock.",
  },
  {
    id: "sales-order",
    module: "sales",
    title: "Sales Order",
    keywords: ["sales order", "so", "customer order before invoice"],
    answer:
      "Sales Order records a customer commitment before invoicing — it does not affect stock or ledgers. Save as Draft, an authorized user (manager/admin) can Approve it, and once approved use 'Create Invoice from Order' to convert it into a Sales Invoice.",
  },
  {
    id: "purchase-order",
    module: "purchase",
    title: "Purchase Order",
    keywords: ["purchase order", "po", "order to supplier"],
    answer:
      "Purchase Order records what you've ordered from a supplier. It follows Draft → Approved → Fulfilled. Use 'Create Invoice from Order' once goods/bill arrive, or track it against a GRN first.",
  },
  {
    id: "quotation",
    module: "sales",
    title: "Quotation / Estimate",
    keywords: ["quotation", "estimate", "proforma"],
    answer:
      "Quotation lets you send a price estimate to a customer or get one from a supplier without affecting stock or accounts. It can later be converted into an Order or Invoice.",
  },
  {
    id: "trial-balance",
    module: "reports",
    title: "Trial Balance",
    keywords: ["trial balance", "tb report"],
    answer:
      "Trial Balance (Reports → Financial) lists every ledger's debit or credit closing balance for a chosen period. If total debits don't equal total credits, it usually means a posting error, an incomplete data migration, or a wrong opening balance — check recent vouchers and opening balances first.",
  },
  {
    id: "balance-sheet",
    module: "reports",
    title: "Balance Sheet",
    keywords: ["balance sheet", "assets liabilities equity report"],
    answer:
      "Balance Sheet (Reports → Financial) shows Assets, Liabilities and Capital/Equity as of a chosen date, grouped by the account groups defined in Chart of Accounts.",
  },
  {
    id: "profit-loss",
    module: "reports",
    title: "Profit & Loss Statement",
    keywords: ["profit and loss", "p&l", "income statement"],
    answer:
      "Profit & Loss (Reports → Financial) shows Direct/Indirect Income against Direct/Indirect Expenses for the selected period and gives net profit or loss.",
  },
  {
    id: "day-book",
    module: "reports",
    title: "Day Book",
    keywords: ["day book", "daily transactions list"],
    answer:
      "Day Book lists every voucher and invoice posted on a chosen date or date range, in one combined feed — useful for a quick daily reconciliation of everything that happened.",
  },
  {
    id: "ledger-report",
    module: "reports",
    title: "General Ledger report",
    keywords: ["general ledger", "ledger report", "account statement", "party ledger"],
    answer:
      "General Ledger (Reports → Books) shows every transaction posted to a single account over a date range with a running balance — pick the account/party from the filter dropdown at the top.",
  },
  {
    id: "cash-flow",
    module: "reports",
    title: "Cash Flow Statement",
    keywords: ["cash flow statement", "cash flow report"],
    answer:
      "Cash Flow Statement groups cash movement into Operating, Investing and Financing activities for the selected period, derived from your posted vouchers.",
  },
  {
    id: "aging-report",
    module: "reports",
    title: "Aging Report",
    keywords: ["aging report", "overdue bills", "receivable aging", "payable aging"],
    answer:
      "Aging Report buckets outstanding customer/supplier bills into ranges like 0-30, 31-60, 61-90 and 90+ days overdue, based on each bill's due date, so you can see how old your outstanding receivables/payables are.",
  },
  {
    id: "outstanding-receivables",
    module: "reports",
    title: "Outstanding Receivables",
    keywords: ["outstanding receivables", "money customers owe", "unpaid sales invoices"],
    answer:
      "Outstanding Receivables lists every posted Sales Invoice with paymentStatus Unpaid or Partial, showing the balance still due per customer and per bill.",
  },
  {
    id: "outstanding-payables",
    module: "reports",
    title: "Outstanding Payables",
    keywords: ["outstanding payables", "money we owe suppliers", "unpaid purchase invoices"],
    answer:
      "Outstanding Payables lists every posted Purchase Invoice still Unpaid or Partial, showing what you owe each supplier and by which bill.",
  },
  {
    id: "stock-summary",
    module: "inventory",
    title: "Stock Summary report",
    keywords: ["stock summary", "current stock report", "stock status"],
    answer:
      "Stock Summary shows current quantity and value per item across all warehouses (or filtered to one warehouse), computed from all stock movements to date.",
  },
  {
    id: "stock-negative",
    module: "inventory",
    title: "Why is stock quantity insufficient / negative",
    keywords: ["stock insufficient", "negative stock", "not enough stock error"],
    answer:
      "This happens when a sale, transfer, or issue tries to move more quantity than is currently in that warehouse. Check Stock Summary for the item's real balance, confirm you selected the correct warehouse, and verify no earlier purchase/opening stock entry is missing or posted to the wrong warehouse.",
  },
  {
    id: "vat-reports",
    module: "vat",
    title: "VAT Reports (Nepal)",
    keywords: ["vat report", "vat annex", "annex a b c", "13 percent vat", "gst report"],
    answer:
      "VAT Reports (Reports → GST) generates the standard Nepal VAT summary and Annex A/B/C annexures from your posted Sales and Purchase invoices, split into taxable, exempt and VAT amounts. Always verify against your actual configured company VAT number and period before final submission to IRD.",
  },
  {
    id: "vat-not-calculating",
    module: "vat",
    title: "Why is VAT not calculating on a line",
    keywords: ["vat not calculating", "vat zero on invoice", "why no vat"],
    answer:
      "Check three things on the invoice line: the 'Tax?' checkbox must be ticked, the VAT% field must be filled (usually 13), and the Item Master for that item must have 'Is Taxable' enabled — if the item itself is marked non-taxable, the line will always compute zero VAT regardless of the checkbox.",
  },
  {
    id: "tds",
    module: "vat",
    title: "TDS (Tax Deducted at Source)",
    keywords: ["tds", "tax deducted at source", "withholding tax", "tds certificate"],
    answer:
      "Enable TDS on a party's master (Subject to TDS) or per-invoice on the Payment tab. Choose the TDS nature/type and rate — the system deducts TDS from the taxable amount and reduces net payable. Use TDS Certificate generation from the party's transaction history for the government-format certificate.",
  },
  {
    id: "pan-validation",
    module: "vat",
    title: "PAN / VAT number validation",
    keywords: ["invalid pan", "pan format", "9 digit pan", "vat number format"],
    answer:
      "Nepal PAN/VAT numbers must be exactly 9 numeric digits. If you get an 'Invalid PAN' error, remove any spaces or dashes and confirm it's exactly 9 digits before saving the party or company profile.",
  },
  {
    id: "cbms",
    module: "vat",
    title: "CBMS submission status",
    keywords: ["cbms", "irn", "cbms submission", "cbms failed"],
    answer:
      "CBMS status on an invoice shows Pending, Submitted (with an IRN and QR code) or Failed. If it shows Failed, open the invoice's CBMS badge and click Resubmit — check that CBMS is enabled in Company Settings and your GSP credentials are correctly configured first.",
  },
  {
    id: "pos-mode",
    module: "pos",
    title: "POS Mode / Retail Billing",
    keywords: ["pos mode", "pos billing", "retail counter", "barcode scan billing"],
    answer:
      "POS Mode is fast retail billing with barcode scanning, split payments (cash/card/wallet/bank/credit), held bills, and day close reconciliation. You must Open a POS Session (enter opening cash) before you can save any sale, and Close Session at day end to reconcile expected vs actual cash.",
  },
  {
    id: "pos-hold-bill",
    module: "pos",
    title: "Holding a bill in POS",
    keywords: ["hold bill pos", "suspend cart", "pause sale pos"],
    answer:
      "In POS Mode, click Hold to suspend the current cart under a name (e.g. 'Table 4'). Recall it later from the Held Bills tab to continue, or Delete it if no longer needed.",
  },
  {
    id: "pos-day-close",
    module: "pos",
    title: "POS Day Close",
    keywords: ["pos day close", "cash reconciliation pos", "closing cash variance"],
    answer:
      "Day Close shows Opening Cash + Cash Sales = Expected Cash. Enter the Actual Closing Cash counted in the drawer — any difference is recorded as Variance in the session history for audit purposes.",
  },
  {
    id: "payroll",
    module: "payroll",
    title: "Payroll",
    keywords: ["payroll", "salary process", "run payroll", "pay heads", "employee salary"],
    answer:
      "Payroll lets you set up Employees, Pay Heads (earnings/deductions), Salary Structures and run monthly Payroll to generate payslips and post the salary journal automatically to your ledgers.",
  },
  {
    id: "cost-center",
    module: "accounts",
    title: "Cost Centers",
    keywords: ["cost center", "cost centre", "department tracking", "project tracking"],
    answer:
      "Enable Cost Center in System Settings, then assign a cost center to any voucher line to track income/expenses by department, project or branch. Cost Center Report shows totals per center.",
  },
  {
    id: "budget",
    module: "accounts",
    title: "Budget Master & Budget vs Actual",
    keywords: ["budget master", "budget vs actual", "set budget"],
    answer:
      "Budget Master lets you set a target amount per ledger/group for a period. Budget vs Actual report then compares posted actuals against that budget to show variance.",
  },
  {
    id: "fiscal-year",
    module: "admin",
    title: "Fiscal Year",
    keywords: ["fiscal year", "close financial year", "year end", "new fiscal year"],
    answer:
      "Fiscal Year (Company → Fiscal Year) shows the currently open year and lets an admin close it at year-end and open the next one. Vouchers can only be dated within the currently open fiscal year.",
  },
  {
    id: "backup-restore",
    module: "admin",
    title: "Backup & Restore",
    keywords: ["backup", "restore data", "export database", "import database"],
    answer:
      "Backup & Restore (Utilities) lets an administrator export the full local database and re-import it later, or on another device. Always take a backup before a factory reset or major data cleanup.",
  },
  {
    id: "factory-reset",
    module: "admin",
    title: "Factory Reset / Erase all data",
    keywords: ["factory reset", "erase all data", "delete everything", "reset database"],
    answer:
      "Factory Reset in System Settings permanently deletes all invoices, vouchers, accounts, parties and stock records and reseeds the default chart of accounts. You must type DELETE ALL DATA to confirm — this cannot be undone, so take a backup first.",
  },
  {
    id: "users-roles",
    module: "admin",
    title: "Users & Roles",
    keywords: ["users", "roles", "permissions", "add user", "change password"],
    answer:
      "Users & Roles (Utilities → Users) lets an admin create logins and assign roles like Accountant, Manager or Administrator. Each role sees different menu options and approval permissions. Users can change their own password from their profile menu (top-right).",
  },
  {
    id: "audit-log",
    module: "admin",
    title: "Audit Log",
    keywords: ["audit log", "who changed this", "activity log", "audit trail"],
    answer:
      "Audit Log (Utilities → Audit Logs) records every Create/Update/Delete/Login/Logout action with the user, timestamp and description — it's append-only and cannot be edited, for compliance purposes.",
  },
  {
    id: "approval-workflow",
    module: "journal",
    title: "Voucher Approval Workflow",
    keywords: ["approval workflow", "approve voucher", "submitted under review posted"],
    answer:
      "Approval Workflow moves a voucher through Draft → Submitted → Under Review → Approved → Posted. Accountants can submit; Managers/Admins can advance or reject back to Draft with a reason; only after Approved can it be Posted to the ledgers.",
  },
  {
    id: "recurring-vouchers",
    module: "journal",
    title: "Recurring Vouchers",
    keywords: ["recurring voucher", "repeat entry monthly", "template voucher"],
    answer:
      "Recurring Vouchers lets you save a voucher as a repeating template (e.g. monthly rent journal) so you don't have to re-key it every period — it generates a new draft voucher on schedule for you to review and post.",
  },
  {
    id: "keyboard-shortcuts",
    module: "general",
    title: "Keyboard Shortcuts",
    keywords: ["keyboard shortcuts", "shortcuts list", "f2 save", "hotkeys"],
    answer:
      "Common shortcuts: F2 saves the current form, F3 opens Add Ledger/Item from a list screen, F9 removes the last voucher line, Esc cancels/closes, Ctrl+S also saves a draft, and the right-hand Quick Actions bar (desktop only) maps F1-F11 and single letters like B (Balance Sheet), T (Trial Balance), S (Stock Status), L (Ledger), V (VAT Report), D (Day Book) to jump straight to that screen. Press F12 to open the Configuration panel for the current screen.",
  },
  {
    id: "print-invoice",
    module: "sales",
    title: "Printing an invoice or voucher",
    keywords: ["print invoice", "print voucher", "pdf invoice", "print receipt"],
    answer:
      "After posting, open the invoice/voucher detail view and click Print (PDF icon) to generate a printable document, or use Print Receipt in POS Mode for a thermal-style receipt. Ensure pop-ups are allowed in your browser, or the print window will be blocked.",
  },
  {
    id: "role-restricted-action",
    module: "admin",
    title: "I can't perform an action / permission denied",
    keywords: ["permission denied", "cant access screen", "not authorized", "restricted feature"],
    answer:
      "Some screens (Backup & Restore, Audit Log, User Management, Company Settings, Fiscal Year close) are restricted to Administrator or Manager roles. If you believe you should have access, ask your system administrator to update your role under Utilities → Users.",
  },
];
