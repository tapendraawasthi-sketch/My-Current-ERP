// src/lib/falcon/accountingRules.ts
// Static domain knowledge used by the Falcon composer layer (Phase 6).
// All data is specific to Sutra ERP's Nepal/VAT/TDS context.

// ─── Type definitions ────────────────────────────────────────────────────────

export interface AccountingPrinciple {
  topic: string;
  keywords: string[];
  explanation: string;
}

export interface WorkflowRule {
  scenario: string;
  condition: string;
  consequence: string;
  action: string;
  keywords: string[];
}

export interface ComparisonEntry {
  termA: string;
  termB: string;
  differencePoints: string[];
}

export interface FormulaEntry {
  name: string;
  formula: string;
  explanation: string;
  example: string;
  keywords: string[];
}

// ─── ACCOUNTING_PRINCIPLES ───────────────────────────────────────────────────

export const ACCOUNTING_PRINCIPLES: AccountingPrinciple[] = [
  {
    topic: "Double-Entry Bookkeeping",
    keywords: ["double entry", "debit", "credit", "journal", "balanced", "ledger", "dr", "cr"],
    explanation:
      "Every financial transaction in Sutra ERP is recorded with at least one debit and one " +
      "equal credit entry so that the accounting equation (Assets = Liabilities + Equity) always " +
      "stays balanced. When you post a Sales Invoice, the Debtor ledger is debited and the Sales " +
      "Income ledger (plus VAT Output) is credited. The Trial Balance will always show equal debit " +
      "and credit totals.",
  },
  {
    topic: "Accrual vs Cash Basis Accounting",
    keywords: ["accrual", "cash basis", "revenue recognition", "expense recognition", "realised", "unrealised"],
    explanation:
      "Under the accrual basis (Sutra ERP's default), income is recognised when an invoice is " +
      "raised and expenses when a bill is received — regardless of when cash changes hands. Cash " +
      "basis accounting instead records income and expenses only when cash is actually received or " +
      "paid. Nepal's tax authority (IRD) generally requires accrual basis for VAT-registered businesses.",
  },
  {
    topic: "VAT (Value Added Tax) Accounting",
    keywords: ["vat", "output vat", "input vat", "tax credit", "vat return", "ird", "13%", "vat payable"],
    explanation:
      "Nepal imposes 13% VAT on most goods and services. Sutra ERP tracks Output VAT (collected " +
      "from customers on sales invoices) and Input VAT (paid to suppliers on purchase invoices) " +
      "separately. At the end of each VAT period the net VAT payable = Output VAT − Input VAT. " +
      "The VAT Return report under Reports → Taxation summarises this figure ready for IRD filing.",
  },
  {
    topic: "TDS (Tax Deducted at Source) / Withholding Tax",
    keywords: ["tds", "withholding", "advance tax", "tax deducted", "tds certificate", "15%", "ird tds"],
    explanation:
      "TDS is a mechanism under the Nepal Income Tax Act where the payer deducts tax at a " +
      "prescribed rate before making a payment. Common rates are 1.5% on domestic goods, 5% on " +
      "services, and 15% on rent/royalties. In Sutra ERP, TDS is configured per ledger/party and " +
      "is automatically calculated on the Payment or Journal voucher. TDS certificates can be " +
      "printed from Reports → TDS Certificate.",
  },
  {
    topic: "Matching Principle",
    keywords: ["matching", "expense recognition", "period", "fiscal year", "accrual expense", "prepaid", "outstanding"],
    explanation:
      "The matching principle requires that expenses be recorded in the same accounting period as " +
      "the revenue they help generate. In Sutra ERP, prepaid expenses and accrued liabilities can " +
      "be recorded using Journal Vouchers so that the Profit & Loss report for each period " +
      "accurately reflects the costs incurred to earn that period's revenue.",
  },
  {
    topic: "Going Concern",
    keywords: ["going concern", "continuity", "business life", "entity assumption"],
    explanation:
      "The going concern principle assumes the business will continue operating indefinitely. " +
      "This underpins how Sutra ERP carries forward balances — ledger closing balances at fiscal " +
      "year-end automatically become opening balances for the new year via the Year-End closing " +
      "process (Utilities → Year End Closing), without liquidation adjustments.",
  },
  {
    topic: "Conservatism (Prudence) Principle",
    keywords: ["conservatism", "prudence", "provision", "write off", "bad debt", "stock write down"],
    explanation:
      "Under the conservatism principle, potential losses should be recognised as soon as they " +
      "are anticipated, while gains are only recorded when realised. In Sutra ERP this is applied " +
      "by creating provisions (e.g. for bad debts) via Journal Vouchers debiting Bad Debt Expense " +
      "and crediting Provision for Bad Debts, and by stock write-down adjustments through " +
      "Inventory → Stock Adjustment.",
  },
  {
    topic: "Bill-by-Bill (Outstanding) Tracking",
    keywords: ["bill wise", "bill-by-bill", "outstanding", "allocation", "ageing", "fifo", "advance"],
    explanation:
      "Bill-by-bill tracking links each payment or receipt to specific invoices rather than " +
      "netting totals on a party ledger. Enable it per ledger in the ledger master. Once active, " +
      "the Bill Allocation panel appears on payment/receipt vouchers and offers an Auto-Fill " +
      "(FIFO) button that clears the oldest invoices first. The Party Outstanding and Ageing " +
      "reports depend on this feature being enabled.",
  },
];

// ─── ERP_WORKFLOW_RULES ──────────────────────────────────────────────────────

export const ERP_WORKFLOW_RULES: WorkflowRule[] = [
  {
    scenario: "Payment against multiple bills (FIFO allocation)",
    condition:
      "A party has several open invoices and a partial payment is received.",
    consequence:
      "Without proper bill allocation the outstanding report shows incorrect ageing and the " +
      "party's balance may not reconcile.",
    action:
      "Open the Receipt/Payment voucher, click 'Auto-Fill (FIFO)' in the Bill Allocation panel " +
      "to let Sutra ERP apply the payment to the oldest invoices first. Manually adjust the split " +
      "if needed, then save.",
    keywords: ["bill", "allocation", "fifo", "payment", "outstanding", "receipt", "ageing", "multiple"],
  },
  {
    scenario: "VAT return filing period closure",
    condition:
      "The VAT period (typically bi-monthly in Nepal) is about to end and invoices are still " +
      "being entered for that period.",
    consequence:
      "Invoices entered after period closure will fall into the next VAT period, causing a " +
      "mismatch between filed returns and the ledger.",
    action:
      "Before filing, run Reports → Taxation → VAT Return to verify totals. Lock the period in " +
      "System Settings → Period Lock after filing to prevent back-dated entries. Any corrections " +
      "must go through a VAT adjustment journal in the current period.",
    keywords: ["vat", "return", "period", "filing", "ird", "closure", "lock", "bi-monthly"],
  },
  {
    scenario: "Low stock alert and reorder",
    condition:
      "An item's current stock falls at or below its reorder level set in the Item Master.",
    consequence:
      "The Dashboard Alerts panel flags the item. Selling below-zero stock is blocked unless " +
      "negative stock is explicitly allowed in Inventory Settings.",
    action:
      "Go to Masters → Inventory, open the item, and check the reorder level. Then raise a " +
      "Purchase Order (Transactions → Purchase → Purchase Order) for the supplier and convert it " +
      "to a Purchase Invoice once goods arrive via GRN.",
    keywords: ["low stock", "reorder", "stock alert", "inventory", "purchase order", "reorder level", "item"],
  },
  {
    scenario: "Voucher approval workflow",
    condition:
      "A voucher (Sales Invoice, Payment, Journal, etc.) is saved by an operator whose role " +
      "requires supervisor approval.",
    consequence:
      "The voucher status is set to 'Pending Approval'. It is visible in reports but flagged and " +
      "cannot be printed on official stationery until approved.",
    action:
      "A user with Approve Vouchers permission should go to Transactions → Voucher Approval, " +
      "review the pending list, and click Approve or Reject. Rejected vouchers return to the " +
      "originator with a note.",
    keywords: ["approval", "voucher", "pending", "approve", "reject", "workflow", "supervisor", "permission"],
  },
  {
    scenario: "Inter-branch / inter-warehouse stock transfer",
    condition:
      "Stock needs to move from one warehouse or branch to another.",
    consequence:
      "Simply editing opening stock is wrong — it breaks the audit trail and inventory history.",
    action:
      "Use Transactions → Inventory → Stock Transfer. Select the source warehouse, destination " +
      "warehouse, items and quantities. On saving, Sutra ERP posts an Inventory Out from the " +
      "source and Inventory In at the destination. For inter-branch transfers an accounting " +
      "journal posting branch transfer receivable/payable is generated automatically.",
    keywords: ["stock transfer", "warehouse", "godown", "branch", "inter-branch", "inventory", "movement", "transfer"],
  },
  {
    scenario: "Credit limit exceeded on sales",
    condition:
      "A customer's outstanding balance plus the new invoice amount exceeds their credit limit " +
      "set in the Party Master.",
    consequence:
      "Sutra ERP shows a warning (or blocks saving, depending on settings) to prevent excessive " +
      "credit exposure.",
    action:
      "Either reduce the invoice amount / request a payment first, or temporarily raise the " +
      "credit limit in Masters → Parties → (party) → Credit Limit field. Supervisor override " +
      "may be required if voucher approval is enabled.",
    keywords: ["credit limit", "outstanding", "block", "party", "customer", "sales invoice", "credit", "overdue"],
  },
  {
    scenario: "TDS deduction on supplier payment",
    condition:
      "A payment is made to a supplier who is subject to TDS under Nepal Income Tax Act.",
    consequence:
      "The full payment amount is recorded as the expense, but only the net amount is paid to " +
      "the supplier; the TDS amount is a liability payable to IRD.",
    action:
      "On the Payment Voucher, enable TDS and enter the applicable rate (e.g. 1.5% goods, 5% " +
      "services). Sutra ERP splits the entry: Supplier ledger Dr (full), Bank/Cash Cr (net), " +
      "TDS Payable Cr (withheld amount). Later pay TDS Payable to IRD and print a TDS Certificate " +
      "from Reports → TDS Certificate.",
    keywords: ["tds", "withholding", "supplier", "payment", "ird", "certificate", "deduct", "tax", "payable"],
  },
  {
    scenario: "Year-end closing and opening balance carry-forward",
    condition:
      "The fiscal year ends (in Nepal, typically Ashad 32 / mid-July) and a new year must begin.",
    consequence:
      "Without closing the year, profit/loss is not transferred to retained earnings and the new " +
      "year's balance sheet will be incorrect.",
    action:
      "Go to Utilities → Year End Closing. Sutra ERP will transfer net profit/loss to the " +
      "Retained Earnings (or Partners' Capital) ledger, carry forward all balance sheet balances " +
      "as opening balances, and reset income/expense ledgers to zero for the new year.",
    keywords: ["year end", "closing", "fiscal year", "opening balance", "retained earnings", "carry forward", "fy"],
  },
];

// ─── COMPARISON_TABLE ────────────────────────────────────────────────────────

export const COMPARISON_TABLE: ComparisonEntry[] = [
  {
    termA: "Sales Invoice",
    termB: "Sales Return",
    differencePoints: [
      "A Sales Invoice records revenue when goods or services are sold to a customer; a Sales Return (Credit Note) reverses or reduces that revenue when goods are returned.",
      "A Sales Invoice increases the customer's outstanding balance (debit Debtor, credit Sales & VAT Output); a Sales Return decreases it (debit Sales Return & VAT Output, credit Debtor).",
      "Sales Invoices are mandatory for VAT-registered businesses to file in the VAT Return; Sales Returns reduce Output VAT in the same return.",
      "In Sutra ERP: Sales Invoice is under Transactions → Sales; Sales Return is under Transactions → Sales → Sales Return.",
    ],
  },
  {
    termA: "Purchase Invoice",
    termB: "Purchase Order",
    differencePoints: [
      "A Purchase Order (PO) is a non-financial commitment document sent to a supplier requesting goods/services — it does not post any accounting entries.",
      "A Purchase Invoice records the actual receipt of goods/services and the resulting liability, posting Purchases Dr and Creditor Cr (plus Input VAT).",
      "POs can be converted to Purchase Invoices in Sutra ERP once goods arrive, using the 'Convert PO' button on the Purchase Invoice form.",
      "Outstanding POs appear in the Pending Orders report; they do not affect the Trial Balance or VAT Return until converted.",
    ],
  },
  {
    termA: "Debit Note",
    termB: "Credit Note",
    differencePoints: [
      "A Debit Note is issued by the buyer to a supplier to claim a reduction in the amount owed (e.g. goods returned to supplier or price adjustment); it debits the supplier ledger.",
      "A Credit Note is issued by the seller to a customer to reduce the amount the customer owes (e.g. sales return, discount after invoice); it credits the customer ledger.",
      "In Sutra ERP, Purchase Return generates a Debit Note effect; Sales Return generates a Credit Note effect.",
      "Both affect VAT: a Debit Note reduces Input VAT claimed; a Credit Note reduces Output VAT declared in the VAT Return.",
    ],
  },
  {
    termA: "VAT",
    termB: "TDS",
    differencePoints: [
      "VAT (Value Added Tax) at 13% is an indirect tax on the consumption of goods/services, collected from customers and remitted to IRD after deducting Input VAT on purchases.",
      "TDS (Tax Deducted at Source) is a direct withholding tax deducted by the payer from payments to a supplier/contractor before remitting the net amount; the withheld tax is paid directly to IRD.",
      "VAT is tracked via Output VAT and Input VAT ledgers; TDS is tracked via a TDS Payable ledger on the balance sheet.",
      "VAT returns are filed bi-monthly; TDS is typically deposited within 25 days of the month in which it was deducted.",
    ],
  },
  {
    termA: "Cash Voucher",
    termB: "Bank Voucher",
    differencePoints: [
      "A Cash Voucher records transactions involving physical cash (notes and coins); the contra ledger is Cash in Hand.",
      "A Bank Voucher records transactions through a bank account (cheque, NEFT, mobile banking); the contra ledger is a Bank account ledger.",
      "In Sutra ERP both appear under Transactions → Accounts; the system differentiates them by which ledger is selected on the Payment/Receipt form.",
      "Bank Vouchers support cheque/instrument number entry for PDC (Post-Dated Cheque) tracking; Cash Vouchers do not have an instrument field.",
    ],
  },
  {
    termA: "Journal Voucher",
    termB: "Payment Voucher",
    differencePoints: [
      "A Journal Voucher is a generic double-entry adjustment between any two ledgers — it does not involve the cash or bank ledger as a mandatory side.",
      "A Payment Voucher records an outflow of cash or bank funds to a party or expense ledger; one side must always be a cash or bank account.",
      "Journal Vouchers are used for provisions, accruals, TDS adjustments, depreciation, and inter-account transfers; Payment Vouchers are used to pay suppliers, salaries, or expenses.",
      "Both post to the General Ledger and appear in the Trial Balance; only Payment Vouchers appear in the Cash / Bank Book.",
    ],
  },
  {
    termA: "Stock Adjustment",
    termB: "Stock Transfer",
    differencePoints: [
      "Stock Adjustment changes the quantity or value of stock in a location — typically used for write-offs, damage, pilferage, or counting corrections.",
      "Stock Transfer moves stock from one warehouse/godown to another without changing total inventory quantity.",
      "Stock Adjustments affect the P&L (Inventory Write-Off / Gain on Stock ledger); Stock Transfers are purely inventory movements with no P&L impact unless inter-branch accounting is enabled.",
      "In Sutra ERP: Inventory → Stock Adjustment for adjustments; Transactions → Inventory → Stock Transfer for transfers.",
    ],
  },
  {
    termA: "Ledger",
    termB: "Account Group",
    differencePoints: [
      "A Ledger (account) is the lowest-level record where actual transactions are posted — e.g. 'Trade Debtors', 'Cash in Hand', 'Sales 13% VAT'.",
      "An Account Group is a container / parent that groups related ledgers together for reporting — e.g. 'Current Assets' contains Cash, Bank, Debtors.",
      "Ledgers hold transaction history and balances; Account Groups aggregate those balances for the Balance Sheet and Trial Balance.",
      "In Sutra ERP's Chart of Accounts, you toggle the 'Group / Ledger' switch when adding a new master to choose which type to create.",
    ],
  },
];

// ─── FORMULA_LIBRARY ─────────────────────────────────────────────────────────

export const FORMULA_LIBRARY: FormulaEntry[] = [
  {
    name: "VAT Amount",
    formula: "VAT Amount = Taxable Amount × VAT Rate / 100",
    explanation:
      "In Nepal the standard VAT rate is 13%. Sutra ERP applies this formula automatically " +
      "when an item is marked 'Is Taxable' in the Item Master. The VAT Amount is added to the " +
      "invoice total and posted to the VAT Output ledger.",
    example:
      "Taxable Amount = NPR 10,000 → VAT Amount = 10,000 × 13 / 100 = NPR 1,300 → Invoice Total = NPR 11,300.",
    keywords: ["vat", "tax", "13%", "taxable", "output vat", "amount", "calculate", "nepal"],
  },
  {
    name: "TDS Amount",
    formula: "TDS Amount = Gross Payment Amount × TDS Rate / 100",
    explanation:
      "TDS is deducted by the payer before making a payment. The net amount paid to the " +
      "supplier is Gross Payment − TDS Amount. The TDS Amount is held in TDS Payable until " +
      "remitted to IRD.",
    example:
      "Gross invoice = NPR 50,000, TDS rate = 5% (services) → TDS = 50,000 × 5 / 100 = NPR 2,500 → Net paid = NPR 47,500.",
    keywords: ["tds", "withholding", "rate", "deduct", "supplier", "services", "goods", "calculate"],
  },
  {
    name: "Gross Profit",
    formula: "Gross Profit = Net Sales − Cost of Goods Sold (COGS)",
    explanation:
      "Gross Profit measures profitability before operating expenses. In Sutra ERP it appears " +
      "in the Trading Account section of the Profit & Loss report. Net Sales is total sales " +
      "minus returns; COGS is opening stock plus purchases minus closing stock.",
    example:
      "Net Sales = NPR 5,00,000 | COGS = NPR 3,20,000 → Gross Profit = NPR 1,80,000 (36% margin).",
    keywords: ["gross profit", "cogs", "trading", "margin", "profit", "sales", "cost", "stock"],
  },
  {
    name: "Net Profit",
    formula: "Net Profit = Gross Profit − Operating Expenses − Tax",
    explanation:
      "Net Profit (bottom-line profit) is what remains after all expenses and taxes are " +
      "deducted. Sutra ERP's Profit & Loss report calculates this automatically across the " +
      "selected date range.",
    example:
      "Gross Profit = NPR 1,80,000 | Operating Expenses = NPR 80,000 | Tax = NPR 15,000 → Net Profit = NPR 85,000.",
    keywords: ["net profit", "profit loss", "p&l", "operating", "expenses", "bottom line", "income"],
  },
  {
    name: "Outstanding Amount (Party)",
    formula: "Outstanding = Total Invoiced − Total Receipts/Payments Received",
    explanation:
      "For a customer, outstanding is the amount still to be collected. For a supplier it is the " +
      "amount still to be paid. Sutra ERP calculates this per party and per bill when bill-by-bill " +
      "tracking is enabled. The Party Outstanding Report and Ageing Report use this formula.",
    example:
      "Customer has invoices totalling NPR 2,00,000 and payments of NPR 1,20,000 → Outstanding = NPR 80,000.",
    keywords: ["outstanding", "due", "balance", "party", "ageing", "collection", "payable", "receivable"],
  },
  {
    name: "Closing Stock Value",
    formula: "Closing Stock Value = Opening Stock + Purchases − COGS (Sales × Cost Ratio)",
    explanation:
      "Sutra ERP values stock using the Weighted Average Cost (WAC) method by default. Each " +
      "purchase updates the running average cost. The Stock Valuation Report shows closing " +
      "stock quantity and value per item and per warehouse.",
    example:
      "Opening stock 100 units @ NPR 10 = NPR 1,000. Purchased 50 @ NPR 12 = NPR 600. " +
      "New WAC = (1,000 + 600) / 150 = NPR 10.67 per unit.",
    keywords: ["closing stock", "stock value", "weighted average", "wac", "inventory", "valuation", "cost"],
  },
  {
    name: "Discount Amount",
    formula: "Discount Amount = List Price × Discount % / 100",
    explanation:
      "Sutra ERP supports both item-level and invoice-level discounts. Item-level discount is " +
      "applied to each line before VAT is calculated on the reduced price. Invoice-level (trade) " +
      "discount is applied to the subtotal. Ensure discount ledgers are correctly mapped under " +
      "the item or invoice discount account to avoid misposting.",
    example:
      "List Price = NPR 5,00,000, Discount = 10% → Discount Amount = NPR 50,000 → Net Price = NPR 4,50,000.",
    keywords: ["discount", "trade discount", "rate", "list price", "invoice discount", "item discount", "calculate"],
  },
  {
    name: "Depreciation (Straight-Line Method)",
    formula: "Annual Depreciation = (Cost − Salvage Value) / Useful Life (years)",
    explanation:
      "Depreciation reduces the book value of a fixed asset evenly over its useful life. In " +
      "Sutra ERP, record depreciation with a Journal Voucher: Debit Depreciation Expense, " +
      "Credit Accumulated Depreciation. Nepal's Income Tax Act specifies depreciation rates per " +
      "asset pool (e.g. 25% WDV for machinery).",
    example:
      "Machine cost NPR 1,00,000, salvage value NPR 10,000, life 9 years → Annual depreciation = " +
      "(1,00,000 − 10,000) / 9 = NPR 10,000 per year.",
    keywords: ["depreciation", "fixed asset", "straight line", "salvage", "useful life", "wdv", "asset"],
  },
  {
    name: "Input VAT Credit",
    formula: "Net VAT Payable = Output VAT (on Sales) − Input VAT Credit (on Purchases)",
    explanation:
      "VAT-registered businesses can offset Input VAT paid on business purchases against " +
      "Output VAT collected from customers. The net amount is payable to IRD. If Input VAT " +
      "exceeds Output VAT, the excess is a refundable credit. Sutra ERP's VAT Return report " +
      "computes this automatically.",
    example:
      "Output VAT = NPR 26,000 | Input VAT = NPR 18,000 → Net VAT payable to IRD = NPR 8,000.",
    keywords: ["input vat", "output vat", "credit", "net vat", "payable", "refund", "ird", "return"],
  },
];
