// src/lib/falcon/erpCodeKnowledge.ts
// Falcon AI — Deep ERP Codebase Knowledge Module
// Self-contained, no external imports. Pure TypeScript data & functions.

// ─────────────────────────────────────────────────────────────────────────────
// INTERFACES
// ─────────────────────────────────────────────────────────────────────────────

export interface ERPFieldDoc {
  name: string;
  fieldKey: string;
  type: "select" | "text" | "number" | "date" | "checkbox" | "textarea";
  required: boolean;
  description: string;
  validation?: string;
}

export interface ERPWorkflow {
  steps: string[];
  postingEffect: string;
  canEdit: boolean;
  canDelete: boolean;
  printAvailable: boolean;
}

export interface ERPModuleDoc {
  id: string;
  displayName: string;
  route: string;
  category: "transaction" | "master" | "report" | "config";
  description: string;
  purpose: string;
  howToAccess: string[];
  keyFields: ERPFieldDoc[];
  workflow: ERPWorkflow;
  accountingImpact: string;
  validationRules: string[];
  keyboardShortcuts: Record<string, string>;
  relatedModules: string[];
  commonErrors: Array<{ error: string; solution: string }>;
  nepaliCalendarNote?: string;
  vatNote?: string;
  tdsNote?: string;
}

export interface AccountingRule {
  operation: string;
  debit: string;
  credit: string;
  example: string;
  notes: string;
}

export interface FormulaDoc {
  id: string;
  topic: string;
  formula: string;
  example: string;
  context: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// ERP_MODULES — Complete documentation for all major modules
// ─────────────────────────────────────────────────────────────────────────────

export const ERP_MODULES: Record<string, ERPModuleDoc> = {
  "sales-invoice": {
    id: "sales-invoice",
    displayName: "Sales Invoice",
    route: "billing",
    category: "transaction",
    description:
      "Creates tax invoices for goods and services sold to customers, with full VAT and TDS support compliant with Nepal IRD requirements.",
    purpose:
      "To record a sale transaction, reduce inventory stock, create a customer receivable (or record immediate cash/bank receipt), and calculate the VAT obligation to IRD.",
    howToAccess: [
      "Navigate to Transactions in the top menu",
      "Select Sales Invoice (or press F9 from anywhere)",
      "Alternatively, go to the Gateway screen and click 'New Sales Invoice'",
    ],
    keyFields: [
      {
        name: "Party (Customer)",
        fieldKey: "partyId",
        type: "select",
        required: true,
        description: "The customer purchasing the goods or services. Linked to the Parties master.",
        validation: "Must be a registered party of type Customer or Both.",
      },
      {
        name: "Invoice Date",
        fieldKey: "date",
        type: "date",
        required: true,
        description:
          "Transaction date shown in Bikram Sambat (BS). Stored internally as AD (ISO). Must fall within the open fiscal year.",
        validation: "Cannot be outside the current open fiscal year's date range.",
      },
      {
        name: "Invoice Number",
        fieldKey: "invoiceNo",
        type: "text",
        required: true,
        description:
          "Auto-generated from the voucher series (prefix + sequential number). Can be manually overridden if configured.",
        validation: "Must be unique across all sales invoices for the fiscal year.",
      },
      {
        name: "Warehouse",
        fieldKey: "warehouseId",
        type: "select",
        required: false,
        description:
          "The warehouse from which stock is dispatched. Defaults to the primary warehouse.",
        validation: "If stock checking is enabled, must have sufficient quantity available.",
      },
      {
        name: "Payment Mode",
        fieldKey: "paymentMode",
        type: "select",
        required: true,
        description:
          "Cash (Dr Cash), Bank (Dr Bank Account), or Credit (Dr Customer/Debtor). Determines which account is debited.",
        validation: "If Bank, a bank account must be configured in Chart of Accounts.",
      },
      {
        name: "Item Lines",
        fieldKey: "lines",
        type: "select",
        required: true,
        description:
          "The table of items sold. Each row has: Item, Qty, Unit, Rate, Discount%, VAT checkbox, Line Total.",
        validation: "At least one line required. Qty and Rate must be positive numbers.",
      },
      {
        name: "Quantity",
        fieldKey: "qty",
        type: "number",
        required: true,
        description: "Number of units sold for each line item.",
        validation: "Must be a positive number. Decimal allowed if item unit supports it.",
      },
      {
        name: "Rate",
        fieldKey: "rate",
        type: "number",
        required: true,
        description:
          "Selling price per unit. Auto-populated from item master sale rate but editable.",
        validation: "Must be ≥ 0. Zero-rate allowed for gift/sample.",
      },
      {
        name: "Discount %",
        fieldKey: "discountPercent",
        type: "number",
        required: false,
        description:
          "Line-level discount percentage. Reduces the line total before VAT calculation.",
        validation: "Must be 0–100.",
      },
      {
        name: "VAT Applicable",
        fieldKey: "taxable",
        type: "checkbox",
        required: false,
        description:
          "Whether 13% VAT applies to this line. Auto-set based on the item's VAT category.",
        validation: "Exempt items must have this unchecked.",
      },
      {
        name: "Bill Discount",
        fieldKey: "billDiscount",
        type: "number",
        required: false,
        description: "Invoice-level discount applied after all line totals are summed.",
        validation: "Cannot exceed the subtotal.",
      },
      {
        name: "Bill Sundries",
        fieldKey: "billSundries",
        type: "select",
        required: false,
        description:
          "Additional charges like freight, insurance, packing. Each sundry can be VAT-applicable or exempt.",
        validation: "Bill sundry accounts must exist in Chart of Accounts.",
      },
      {
        name: "Narration",
        fieldKey: "narration",
        type: "textarea",
        required: false,
        description: "Free-text description of the transaction for audit purposes.",
        validation: "Max 500 characters.",
      },
      {
        name: "TDS Deduction",
        fieldKey: "tdsAmount",
        type: "number",
        required: false,
        description:
          "Tax Deducted at Source if customer is required to deduct TDS. Reduces the net receivable.",
        validation: "Only applicable if TDS feature is enabled in F11 settings.",
      },
      {
        name: "Round Off",
        fieldKey: "roundOff",
        type: "number",
        required: false,
        description:
          "Small positive or negative amount to round the grand total to the nearest rupee.",
        validation: "Typically auto-calculated. Should not exceed ±0.99.",
      },
    ],
    workflow: {
      steps: [
        "Select the customer from the Party dropdown",
        "Set the invoice date (BS calendar picker or type in YYYY-MM-DD)",
        "Choose payment mode: Cash, Bank, or Credit",
        "Add item lines: click Add Row or press F3 in the items table",
        "For each line: select the item, enter quantity, verify rate, set discount if any, confirm VAT checkbox",
        "Add Bill Sundries if there are freight or other charges",
        "Apply Bill Discount if a whole-invoice discount applies",
        "Review the calculated Taxable Amount, VAT Amount, and Grand Total",
        "Add narration describing the sale",
        "If TDS applies, verify the TDS deduction amount and section",
        "Press F2 or click Post to save and post the invoice",
        "Print the invoice using Ctrl+P or the Print button",
      ],
      postingEffect:
        "Creates invoice record in invoices table; creates stock movement (outward) reducing item quantity in the selected warehouse; creates voucher in vouchers table with accounting entries: Dr Customer/Cash/Bank, Cr Sales Account, Cr VAT Payable (13% of taxable amount); marks invoice as Posted status.",
      canEdit: false,
      canDelete: false,
      printAvailable: true,
    },
    accountingImpact:
      "DEBIT: Customer Ledger (if credit sale) OR Cash Account (if cash sale) OR Bank Account (if bank payment) = Grand Total. CREDIT: Sales Account = Net Taxable Amount + Exempt Amount. CREDIT: VAT Payable Account = 13% of Taxable Amount. If TDS: DEBIT: Customer = Grand Total - TDS; DEBIT: TDS Receivable = TDS Amount.",
    validationRules: [
      "Party (customer) is mandatory — cannot post without selecting a customer",
      "At least one item line with positive quantity and non-negative rate is required",
      "Invoice date must fall within the open fiscal year's start and end dates",
      "If stock tracking is enabled, item quantity in selected warehouse must be ≥ qty being sold",
      "VAT category on items must match the invoice VAT treatment (taxable vs exempt)",
      "Bill discount cannot exceed the gross amount before discount",
      "TDS amount cannot exceed the invoice grand total",
      "Duplicate invoice numbers within the same fiscal year are not allowed",
    ],
    keyboardShortcuts: {
      F2: "Post (save and finalize) the invoice",
      F3: "Add a new item line to the table",
      F8: "Delete the currently selected item line",
      "Ctrl+P": "Print the invoice as PDF",
      Esc: "Cancel and go back without saving",
      Tab: "Move to the next field",
      F12: "Open F12 configuration for this module",
    },
    relatedModules: [
      "parties",
      "items",
      "chart-of-accounts",
      "vat-reports",
      "outstanding-receivables",
      "day-book",
      "general-ledger",
      "stock-summary",
    ],
    commonErrors: [
      {
        error: "Party not found in dropdown",
        solution: "Create the customer in Parties master first. Go to Masters → Parties → Add New.",
      },
      {
        error: "Item stock is zero or insufficient",
        solution:
          "Check current stock in Stock Summary. Enter a Purchase Invoice to receive stock first, or disable stock checking in settings if it is a service item.",
      },
      {
        error: "Invoice date is outside the fiscal year",
        solution:
          "Verify the open fiscal year's start and end dates in Fiscal Year settings. Change the invoice date to fall within that range.",
      },
      {
        error: "VAT calculation seems wrong",
        solution:
          "Check the VAT category of each item in Item Master. 'Taxable' items attract 13% VAT; 'Exempt' and 'Zero-rated' do not.",
      },
      {
        error: "Cannot edit a posted invoice",
        solution:
          "Posted invoices are locked for audit integrity. To correct, cancel the invoice (creates a reversal) and re-enter the corrected one. Or use a Credit Note for adjustments.",
      },
    ],
    nepaliCalendarNote:
      "Dates are displayed and entered in Bikram Sambat (BS). The system stores them as ISO AD dates internally. A BS-to-AD converter runs automatically. The fiscal year runs from Baisakh 1 (≈ April 13–14 AD) to Chaitra end (≈ April 12–13 AD).",
    vatNote:
      "VAT is calculated at 13% on the taxable (non-exempt) line amounts after line-level discount but before bill-level discount. Bill sundries that are marked as VAT-applicable also attract 13% VAT. The VAT amount is credited to 'VAT Payable' account for periodic remittance to IRD. CBMS integration can submit invoices to IRD in real time.",
    tdsNote:
      "TDS on sales applies when the customer (a company or institution) is required by law to deduct TDS before paying. Common section: 1.5% for contractors. The TDS amount reduces the net receivable. Sutra creates a separate TDS Receivable entry.",
  },

  "purchase-invoice": {
    id: "purchase-invoice",
    displayName: "Purchase Invoice",
    route: "purchase",
    category: "transaction",
    description:
      "Records goods and services purchased from suppliers, increases inventory stock, creates a supplier payable, and captures input VAT credit.",
    purpose:
      "To record purchase of goods or services, increase stock levels, establish a payable to the supplier (or record immediate payment), and claim input VAT credit against output VAT.",
    howToAccess: ["Go to Transactions in the top menu", "Select Purchase Invoice (or press F10)"],
    keyFields: [
      {
        name: "Party (Supplier)",
        fieldKey: "partyId",
        type: "select",
        required: true,
        description:
          "The supplier selling goods or services. Must be registered as Supplier or Both in Parties master.",
        validation: "Required. Determines the Creditor ledger account.",
      },
      {
        name: "Supplier Bill No",
        fieldKey: "supplierBillNo",
        type: "text",
        required: false,
        description:
          "The invoice number on the supplier's physical invoice. Important for VAT input credit matching.",
        validation: "Should be unique per supplier to avoid duplicate entry.",
      },
      {
        name: "Invoice Date",
        fieldKey: "date",
        type: "date",
        required: true,
        description:
          "Date of the supplier's invoice in BS format. Must fall within the open fiscal year.",
        validation: "Must be within the open fiscal year.",
      },
      {
        name: "Payment Mode",
        fieldKey: "paymentMode",
        type: "select",
        required: true,
        description:
          "Cash, Bank, or Credit. Determines which account is credited (Cash, Bank, or Supplier Payable).",
        validation: "Required.",
      },
      {
        name: "Item Lines",
        fieldKey: "lines",
        type: "select",
        required: true,
        description:
          "Items purchased. Each row: Item, Qty, Purchase Rate, Discount%, VAT checkbox, Line Total.",
        validation: "At least one line required.",
      },
      {
        name: "VAT Applicable",
        fieldKey: "taxable",
        type: "checkbox",
        required: false,
        description:
          "Whether input VAT credit is available on this line (13%). Only if supplier is VAT-registered.",
        validation: "Check only if supplier has issued a valid VAT invoice.",
      },
      {
        name: "TDS Deduction",
        fieldKey: "tdsApplicable",
        type: "checkbox",
        required: false,
        description:
          "Enable TDS deduction (withholding tax). The TDS amount is deducted from the payable to the supplier.",
        validation: "Requires TDS section and rate selection.",
      },
      {
        name: "TDS Section",
        fieldKey: "tdsSection",
        type: "select",
        required: false,
        description:
          "The Income Tax section under which TDS is being deducted. E.g., 1.5% for contracts, 10% for rent.",
        validation: "Required if TDS is enabled.",
      },
      {
        name: "Narration",
        fieldKey: "narration",
        type: "textarea",
        required: false,
        description: "Description of the purchase for internal records.",
        validation: "Max 500 characters.",
      },
    ],
    workflow: {
      steps: [
        "Select the supplier from the Party dropdown",
        "Enter the supplier's invoice number and date",
        "Choose payment mode: Cash, Bank, or Credit",
        "Add item lines with quantity, purchase rate, and VAT applicability",
        "Review the calculated VAT Input amount",
        "Enable TDS deduction if applicable and select the TDS section",
        "Verify the net payable amount (Grand Total minus TDS if applicable)",
        "Add narration",
        "Press F2 to post",
      ],
      postingEffect:
        "Increases item stock in selected warehouse; creates voucher entries: Dr Purchases Account + Dr VAT Input Account, Cr Supplier/Cash/Bank; if TDS: Cr TDS Payable instead of full amount to supplier.",
      canEdit: false,
      canDelete: false,
      printAvailable: true,
    },
    accountingImpact:
      "DEBIT: Purchases Account = Net Amount (after discount). DEBIT: VAT Input Account = 13% of Taxable Amount (input credit). CREDIT: Supplier Ledger = Grand Total (if credit). OR CREDIT: Cash/Bank = Grand Total (if immediate payment). If TDS: CREDIT: Supplier = Grand Total - TDS; CREDIT: TDS Payable = TDS Amount.",
    validationRules: [
      "Supplier party is mandatory",
      "At least one item line with positive quantity is required",
      "Invoice date must be within the open fiscal year",
      "Input VAT credit can only be claimed on invoices from VAT-registered suppliers",
      "TDS section and rate are mandatory when TDS is enabled",
      "Supplier bill number should be unique per supplier to prevent duplicate entries",
    ],
    keyboardShortcuts: {
      F2: "Post",
      F3: "Add item line",
      F8: "Delete line",
      "Ctrl+P": "Print",
      Esc: "Cancel",
    },
    relatedModules: [
      "parties",
      "items",
      "payment-voucher",
      "vat-reports",
      "outstanding-payables",
      "stock-summary",
    ],
    commonErrors: [
      {
        error: "Input VAT not being claimed",
        solution:
          "Ensure the VAT checkbox is ticked on taxable lines and the supplier is marked as VAT-registered in the Parties master.",
      },
      {
        error: "TDS not calculating correctly",
        solution:
          "Verify the TDS section is selected and the rate is correct. Check F11 settings to ensure TDS feature is enabled.",
      },
      {
        error: "Stock not increasing after purchase",
        solution:
          "Ensure the items are of type 'Stock Item' (not service) and a warehouse is selected.",
      },
    ],
    vatNote:
      "Input VAT claimed on purchase invoices is credited to 'VAT Input' account. At month-end, VAT Payable (from sales) minus VAT Input (from purchases) = Net VAT payable to IRD. This offset is the core of Nepal's VAT system.",
    tdsNote:
      "TDS is deducted from the payment to the supplier and deposited with IRD by the 25th of the following month. Common rates: 1.5% (contractor/service), 10% (rent), 15% (consultancy). Sutra creates a TDS Payable liability entry.",
  },

  "receipt-voucher": {
    id: "receipt-voucher",
    displayName: "Receipt Voucher",
    route: "receipt",
    category: "transaction",
    description:
      "Records money received from customers, either against specific outstanding invoices or as an advance payment.",
    purpose:
      "To reduce the outstanding receivable balance from a customer and record the corresponding increase in cash or bank balance.",
    howToAccess: ["Transactions → Receipt Voucher", "Press F7 from any screen"],
    keyFields: [
      {
        name: "Party (Customer)",
        fieldKey: "partyId",
        type: "select",
        required: true,
        description: "The customer making the payment.",
        validation: "Required. Drives the debit to the debtor ledger.",
      },
      {
        name: "Receipt Date",
        fieldKey: "date",
        type: "date",
        required: true,
        description: "Date the money was received in BS format.",
        validation: "Must be within the open fiscal year.",
      },
      {
        name: "Amount Received",
        fieldKey: "amount",
        type: "number",
        required: true,
        description: "Total amount received from the customer.",
        validation: "Must be a positive number.",
      },
      {
        name: "Received In",
        fieldKey: "accountId",
        type: "select",
        required: true,
        description: "Cash account or Bank account where the money is deposited.",
        validation: "Must be a Cash or Bank type account.",
      },
      {
        name: "Cheque / Reference No",
        fieldKey: "chequeNo",
        type: "text",
        required: false,
        description: "Cheque number, NEFT reference, or digital payment ID if paid by bank.",
        validation: "Recommended for audit trail on bank receipts.",
      },
      {
        name: "Cheque Date",
        fieldKey: "chequeDate",
        type: "date",
        required: false,
        description:
          "Date on the cheque. For post-dated cheques (PDC), this will be a future date.",
        validation: "Must be present if cheque number is entered.",
      },
      {
        name: "Against Bill (Bill-by-Bill)",
        fieldKey: "billAllocations",
        type: "select",
        required: false,
        description: "Allocate the received amount against specific outstanding sales invoices.",
        validation: "Total allocation cannot exceed amount received.",
      },
      {
        name: "Narration",
        fieldKey: "narration",
        type: "textarea",
        required: false,
        description: "Payment description, e.g. 'Received by NEFT against Invoice SI-0042'.",
        validation: "Max 500 characters.",
      },
    ],
    workflow: {
      steps: [
        "Select the customer party",
        "Enter the date of receipt",
        "Select the Cash or Bank account where payment was received",
        "Enter the amount received",
        "Enter cheque/reference number if payment was by cheque or bank transfer",
        "Optionally, allocate the amount against specific outstanding invoices in the Bill Allocation panel",
        "Add narration",
        "Press F2 to post",
      ],
      postingEffect:
        "Dr Cash or Bank Account (amount received); Cr Customer/Debtor Ledger (reduces outstanding receivable). If bill-by-bill allocation is done, the specific invoices' payment status is updated to Paid or Partial.",
      canEdit: false,
      canDelete: false,
      printAvailable: true,
    },
    accountingImpact:
      "DEBIT: Cash Account OR Bank Account = Amount Received. CREDIT: Customer/Debtor Ledger Account = Amount Received. Payment status on linked invoices updated: Unpaid → Partial or Partial → Paid.",
    validationRules: [
      "Party is mandatory",
      "Amount must be positive",
      "Received-In account must be a Cash or Bank type account",
      "Bill allocation total cannot exceed the receipt amount",
      "Date must be within the open fiscal year",
    ],
    keyboardShortcuts: {
      F2: "Post receipt",
      F7: "New receipt (from other screens)",
      Esc: "Cancel",
    },
    relatedModules: [
      "sales-invoice",
      "outstanding-receivables",
      "parties",
      "bank-reconciliation",
      "day-book",
    ],
    commonErrors: [
      {
        error: "Customer balance not reducing after receipt",
        solution:
          "Ensure the correct customer party is selected and the receipt is posted (not in draft). Check that the Cr account is the customer's linked ledger.",
      },
      {
        error: "Post-dated cheque handling",
        solution:
          "Enter the receipt with the cheque date. Use the PDC Management module to track and process it on the due date.",
      },
    ],
  },

  "payment-voucher": {
    id: "payment-voucher",
    displayName: "Payment Voucher",
    route: "payment",
    category: "transaction",
    description:
      "Records money paid to suppliers or for expenses, reducing cash/bank and settling payable balances.",
    purpose:
      "To record outgoing payments to suppliers for purchases, or to expense accounts for direct costs, and update the bank/cash balance accordingly.",
    howToAccess: ["Transactions → Payment Voucher", "Press F6"],
    keyFields: [
      {
        name: "Pay To (Party or Account)",
        fieldKey: "partyId",
        type: "select",
        required: true,
        description:
          "Supplier or expense account being paid. Can be a party or a direct GL account.",
        validation: "Required.",
      },
      {
        name: "Payment Date",
        fieldKey: "date",
        type: "date",
        required: true,
        description: "Date of payment in BS.",
        validation: "Must be within open fiscal year.",
      },
      {
        name: "Amount",
        fieldKey: "amount",
        type: "number",
        required: true,
        description: "Total amount being paid.",
        validation: "Must be positive.",
      },
      {
        name: "Paid From",
        fieldKey: "accountId",
        type: "select",
        required: true,
        description: "Cash or Bank account from which payment is made.",
        validation: "Balance must be sufficient (if overdraft not allowed).",
      },
      {
        name: "Cheque No",
        fieldKey: "chequeNo",
        type: "text",
        required: false,
        description: "Cheque number if payment is by cheque.",
        validation: "Recommended for bank payments.",
      },
      {
        name: "TDS Deducted",
        fieldKey: "tdsAmount",
        type: "number",
        required: false,
        description: "TDS withheld from the payment. Reduces what is paid out.",
        validation: "TDS section must be selected.",
      },
      {
        name: "Bill Allocation",
        fieldKey: "billAllocations",
        type: "select",
        required: false,
        description: "Allocate payment against specific purchase invoices.",
        validation: "Cannot exceed payment amount.",
      },
      {
        name: "Narration",
        fieldKey: "narration",
        type: "textarea",
        required: false,
        description: "Description of the payment.",
        validation: "Max 500 characters.",
      },
    ],
    workflow: {
      steps: [
        "Select supplier or expense account",
        "Set payment date",
        "Select the paying bank or cash account",
        "Enter the payment amount",
        "Enter cheque details if paying by cheque",
        "Enter TDS amount and section if TDS is being deducted",
        "Allocate against specific purchase invoices if bill-by-bill is enabled",
        "Add narration",
        "Post with F2",
      ],
      postingEffect:
        "Dr Supplier/Expense Account; Cr Cash/Bank. If TDS: Dr Supplier full amount, Cr Bank (amount - TDS), Cr TDS Payable (TDS amount). Updates payment status on linked purchase invoices.",
      canEdit: false,
      canDelete: false,
      printAvailable: true,
    },
    accountingImpact:
      "DEBIT: Supplier/Expense Ledger = Gross Amount. CREDIT: Cash/Bank Account = Net Amount (Gross - TDS). CREDIT: TDS Payable Account = TDS Amount (if applicable).",
    validationRules: [
      "Party or account is mandatory",
      "Amount must be positive",
      "Paid-From must be a Cash or Bank account",
      "Cash account balance must be sufficient unless overdraft is enabled",
      "TDS section required when TDS amount is entered",
    ],
    keyboardShortcuts: { F2: "Post", F6: "New payment (from other screens)", Esc: "Cancel" },
    relatedModules: [
      "purchase-invoice",
      "outstanding-payables",
      "chart-of-accounts",
      "bank-reconciliation",
    ],
    commonErrors: [
      {
        error: "Cash balance going negative",
        solution:
          "Check the Cash account's current balance in General Ledger. Either the payment amount is wrong or the cash receipts were not recorded.",
      },
      {
        error: "TDS not depositing to correct account",
        solution:
          "Verify in Chart of Accounts that a 'TDS Payable' account exists and is mapped in the TDS configuration settings.",
      },
    ],
    tdsNote:
      "TDS deducted in Payment Vouchers accumulates in the TDS Payable account. This must be deposited to IRD by the 25th of the following month. Use the TDS Report to get the challan details.",
  },

  "journal-voucher": {
    id: "journal-voucher",
    displayName: "Journal Voucher",
    route: "journal",
    category: "transaction",
    description:
      "General-purpose double-entry accounting voucher for manual adjustments, provisions, accruals, depreciation, and any entry not covered by other voucher types.",
    purpose:
      "To make any accounting entry that does not involve a direct sales/purchase transaction — such as adjustments, opening entries, provisions, depreciation, inter-account transfers, and year-end closing entries.",
    howToAccess: ["Transactions → Journal Entry", "Press F5"],
    keyFields: [
      {
        name: "Voucher Date",
        fieldKey: "date",
        type: "date",
        required: true,
        description: "Date of the journal entry in BS.",
        validation: "Must be within the open fiscal year.",
      },
      {
        name: "Voucher No",
        fieldKey: "voucherNo",
        type: "text",
        required: true,
        description: "Auto-generated reference number for the journal entry.",
        validation: "Must be unique within the fiscal year.",
      },
      {
        name: "Debit Lines",
        fieldKey: "debitLines",
        type: "select",
        required: true,
        description: "One or more accounts to be debited with their amounts.",
        validation: "At least one debit line required.",
      },
      {
        name: "Credit Lines",
        fieldKey: "creditLines",
        type: "select",
        required: true,
        description: "One or more accounts to be credited with their amounts.",
        validation: "At least one credit line required.",
      },
      {
        name: "Debit Account",
        fieldKey: "accountId",
        type: "select",
        required: true,
        description: "The GL account to debit. Selected from Chart of Accounts.",
        validation: "Must be an active ledger (not a group).",
      },
      {
        name: "Debit Amount",
        fieldKey: "debit",
        type: "number",
        required: true,
        description: "Amount to debit for this line.",
        validation: "Must be positive.",
      },
      {
        name: "Credit Account",
        fieldKey: "accountId",
        type: "select",
        required: true,
        description: "The GL account to credit.",
        validation: "Must be an active ledger account.",
      },
      {
        name: "Credit Amount",
        fieldKey: "credit",
        type: "number",
        required: true,
        description: "Amount to credit for this line.",
        validation: "Must be positive.",
      },
      {
        name: "Line Narration",
        fieldKey: "lineNarration",
        type: "text",
        required: false,
        description: "Description for each individual line of the journal.",
        validation: "Optional but recommended.",
      },
      {
        name: "Overall Narration",
        fieldKey: "narration",
        type: "textarea",
        required: false,
        description: "Summary description of the entire journal entry.",
        validation: "Max 500 characters.",
      },
    ],
    workflow: {
      steps: [
        "Set the voucher date",
        "Add the first debit line: select account and enter debit amount",
        "Add the corresponding credit line: select account and enter credit amount",
        "Add more lines if needed (compound journal entry)",
        "Verify the totals: Total Debits MUST equal Total Credits",
        "Add narration for each line and an overall narration",
        "Press F2 to post the journal",
      ],
      postingEffect:
        "Updates the balance of every account mentioned in the journal. Debited accounts increase if debit-nature (Assets/Expenses) or decrease if credit-nature (Liabilities/Income). Vice versa for credits. Every posted journal appears in the Day Book and individual account ledgers.",
      canEdit: false,
      canDelete: false,
      printAvailable: true,
    },
    accountingImpact:
      "Custom — depends entirely on the accounts selected. The golden rule: Total Debits = Total Credits. The system enforces this before allowing posting.",
    validationRules: [
      "CRITICAL: Total Debit amount must equal Total Credit amount — the entry must balance",
      "At least one debit line and one credit line are required",
      "All selected accounts must be active leaf-level ledger accounts (not group accounts)",
      "Date must be within the open fiscal year",
      "Cannot use a group account — only individual ledger accounts can receive entries",
      "Amount on each line must be positive (direction is determined by the Debit or Credit column)",
    ],
    keyboardShortcuts: {
      F2: "Post",
      F3: "Add new line",
      F5: "New journal (from other screens)",
      F8: "Delete line",
      Esc: "Cancel",
    },
    relatedModules: [
      "chart-of-accounts",
      "day-book",
      "trial-balance",
      "general-ledger",
      "balance-sheet",
    ],
    commonErrors: [
      {
        error: "'Entry not balanced' error on posting",
        solution:
          "Check that the sum of all debit amounts exactly equals the sum of all credit amounts. Even a 1 paisa difference will prevent posting.",
      },
      {
        error: "Account cannot be selected (greyed out or not found)",
        solution:
          "You may be trying to select a Group account. Only individual ledger accounts (the leaf nodes in Chart of Accounts) can receive journal entries.",
      },
      {
        error: "Depreciation journal not reflecting in Fixed Assets",
        solution:
          "Depreciation journals posted here update the General Ledger but the Fixed Asset register requires you to run depreciation from the Fixed Assets module separately.",
      },
    ],
  },

  "contra-voucher": {
    id: "contra-voucher",
    displayName: "Contra Voucher",
    route: "contra",
    category: "transaction",
    description:
      "Records transfers between cash and bank accounts. Used exclusively for internal fund movements — cash deposits to bank, cash withdrawals from bank, or inter-bank transfers.",
    purpose:
      "To record when money moves between the company's own cash and bank accounts without any external party involvement.",
    howToAccess: ["Transactions → Contra Voucher", "Press F8"],
    keyFields: [
      {
        name: "From Account",
        fieldKey: "fromAccountId",
        type: "select",
        required: true,
        description: "The Cash or Bank account from which funds are being transferred.",
        validation: "Must be a Cash or Bank type account.",
      },
      {
        name: "To Account",
        fieldKey: "toAccountId",
        type: "select",
        required: true,
        description: "The Cash or Bank account receiving the funds.",
        validation: "Must be a Cash or Bank type account. Cannot be same as From Account.",
      },
      {
        name: "Amount",
        fieldKey: "amount",
        type: "number",
        required: true,
        description: "Amount being transferred.",
        validation: "Must be positive.",
      },
      {
        name: "Date",
        fieldKey: "date",
        type: "date",
        required: true,
        description: "Date of the transfer in BS.",
        validation: "Must be within open fiscal year.",
      },
      {
        name: "Narration",
        fieldKey: "narration",
        type: "textarea",
        required: false,
        description: "E.g. 'Cash deposit to HDFC Bank for daily collections'.",
        validation: "Max 500 characters.",
      },
    ],
    workflow: {
      steps: [
        "Select the source account (the account being reduced)",
        "Select the destination account (the account being increased)",
        "Enter the transfer amount",
        "Set the date",
        "Add narration describing the transfer",
        "Post with F2",
      ],
      postingEffect:
        "Dr To-Account (bank or cash receiving funds); Cr From-Account (bank or cash giving funds). Net effect: no change in total assets, just redistribution between cash/bank accounts.",
      canEdit: false,
      canDelete: false,
      printAvailable: true,
    },
    accountingImpact:
      "DEBIT: To-Account (Cash or Bank) = Transfer Amount. CREDIT: From-Account (Cash or Bank) = Transfer Amount. Net effect on total assets is zero — it is purely an internal reclassification.",
    validationRules: [
      "Both From-Account and To-Account must be Cash or Bank type accounts",
      "From-Account and To-Account cannot be the same account",
      "Amount must be positive",
      "From-Account must have sufficient balance",
    ],
    keyboardShortcuts: { F2: "Post", F8: "New contra (from other screens)", Esc: "Cancel" },
    relatedModules: ["chart-of-accounts", "bank-reconciliation", "day-book"],
    commonErrors: [
      {
        error: "Account type not allowed",
        solution:
          "Contra Voucher ONLY allows Cash and Bank type accounts. If you need to transfer to any other account type, use a Journal Voucher instead.",
      },
    ],
  },

  "chart-of-accounts": {
    id: "chart-of-accounts",
    displayName: "Chart of Accounts",
    route: "accounts",
    category: "master",
    description:
      "Manages the complete hierarchy of financial accounts: primary groups, sub-groups, and individual ledger accounts. The foundation of the entire accounting system.",
    purpose:
      "To define and organize all financial accounts that will be used in vouchers and reports. Every debit and credit in the system must reference an account from this master.",
    howToAccess: ["Masters → Chart of Accounts", "Press F4 from most transaction screens"],
    keyFields: [
      {
        name: "Account Name",
        fieldKey: "name",
        type: "text",
        required: true,
        description: "The full name of the account.",
        validation: "Must be unique within the system.",
      },
      {
        name: "Account Code",
        fieldKey: "code",
        type: "text",
        required: false,
        description: "Short alphanumeric code for quick identification.",
        validation: "Must be unique if entered.",
      },
      {
        name: "Account Group",
        fieldKey: "groupId",
        type: "select",
        required: true,
        description: "The parent group (e.g., Sundry Debtors, Current Assets, Sales Accounts).",
        validation: "Must select an existing group from the 15 primary BUSY-style groups.",
      },
      {
        name: "Opening Balance",
        fieldKey: "openingBalance",
        type: "number",
        required: false,
        description: "The balance this account starts with at the beginning of the fiscal year.",
        validation: "Must specify Dr or Cr along with the amount.",
      },
      {
        name: "Opening Dr/Cr",
        fieldKey: "openingType",
        type: "select",
        required: false,
        description: "Whether the opening balance is a Debit (Dr) or Credit (Cr).",
        validation: "Required if opening balance is non-zero.",
      },
      {
        name: "Is Group",
        fieldKey: "isGroup",
        type: "checkbox",
        required: false,
        description:
          "If checked, this is a group account (cannot receive direct entries) used only for grouping sub-accounts.",
        validation: "Group accounts cannot be used in journal entries or vouchers.",
      },
      {
        name: "Currency",
        fieldKey: "currency",
        type: "select",
        required: false,
        description: "For multi-currency accounts. Defaults to the company's base currency (NPR).",
        validation: "Relevant only if Multi-Currency feature is enabled.",
      },
    ],
    workflow: {
      steps: [
        "Navigate to Chart of Accounts",
        "To add a Group: click Add Group, enter group name, select parent group, save",
        "To add a Ledger: click Add Ledger, enter account name, select the account group, enter opening balance if any, save",
        "To modify: double-click the account in the list, make changes, save",
        "To delete: select account, press F8 (only allowed if no transactions exist against it)",
      ],
      postingEffect:
        "Creating accounts does not create any accounting entries. Opening balances are reflected in the Balance Sheet and Trial Balance as of the fiscal year start date.",
      canEdit: true,
      canDelete: true,
      printAvailable: true,
    },
    accountingImpact:
      "No direct accounting impact from creating accounts. Opening balances contribute to the Balance Sheet opening position. All vouchers reference accounts from this master.",
    validationRules: [
      "Account names must be unique",
      "Group accounts cannot have direct transactions",
      "Cannot delete an account that has transactions posted against it",
      "Cannot delete a group that has sub-accounts or ledgers under it",
      "Opening balance Dr/Cr must be consistent with the account's nature (Assets/Expenses are typically Dr; Liabilities/Income are typically Cr)",
    ],
    keyboardShortcuts: {
      F3: "Add new account",
      F8: "Delete selected account",
      "Ctrl+P": "Print account list",
      F4: "Open account master from voucher screen",
    },
    relatedModules: [
      "journal-voucher",
      "balance-sheet",
      "trial-balance",
      "general-ledger",
      "all-vouchers",
    ],
    commonErrors: [
      {
        error: "Cannot find account in voucher dropdown",
        solution:
          "The account may be a Group account (not a leaf ledger). Check in Chart of Accounts and ensure it is set as a Ledger, not a Group.",
      },
      {
        error: "Account cannot be deleted",
        solution:
          "The account has transactions posted. First delete or move those transactions, or archive the account (mark as inactive) instead of deleting.",
      },
    ],
  },

  parties: {
    id: "parties",
    displayName: "Parties Directory",
    route: "parties",
    category: "master",
    description:
      "Master list of all customers and suppliers. Each party is linked to a debtor or creditor ledger account in the Chart of Accounts.",
    purpose:
      "To centralize all customer and supplier information so that transactions auto-populate party details, credit limits are enforced, and outstanding balances can be tracked per party.",
    howToAccess: [
      "Masters → Parties Directory",
      "Press F3 in any Party selection dropdown to add on the fly",
    ],
    keyFields: [
      {
        name: "Party Name",
        fieldKey: "name",
        type: "text",
        required: true,
        description: "Legal or trading name of the customer/supplier.",
        validation: "Must be unique.",
      },
      {
        name: "Type",
        fieldKey: "type",
        type: "select",
        required: true,
        description: "Customer (for sales), Supplier (for purchases), or Both.",
        validation: "Required. Determines which transactions this party appears in.",
      },
      {
        name: "PAN Number",
        fieldKey: "pan",
        type: "text",
        required: false,
        description: "Permanent Account Number (9-digit for Nepal). Required for TDS compliance.",
        validation: "9 digits if entered.",
      },
      {
        name: "VAT Number",
        fieldKey: "vatNo",
        type: "text",
        required: false,
        description:
          "VAT registration number. Required to claim input VAT on purchases from this supplier.",
        validation: "9 digits for Nepal VAT.",
      },
      {
        name: "Phone",
        fieldKey: "phone",
        type: "text",
        required: false,
        description: "Primary contact phone number.",
        validation: "Optional.",
      },
      {
        name: "Credit Limit",
        fieldKey: "creditLimit",
        type: "number",
        required: false,
        description:
          "Maximum credit allowed. System warns or blocks sales if customer exceeds this limit.",
        validation: "0 means no limit.",
      },
      {
        name: "Credit Days",
        fieldKey: "creditDays",
        type: "number",
        required: false,
        description:
          "Standard payment terms in days. Used to auto-calculate the due date on invoices.",
        validation: "Must be 0 or positive integer.",
      },
      {
        name: "Opening Balance",
        fieldKey: "openingBalance",
        type: "number",
        required: false,
        description: "The outstanding balance this party carries at the start of the fiscal year.",
        validation: "Must specify Dr (they owe us) or Cr (we owe them).",
      },
      {
        name: "Address",
        fieldKey: "address",
        type: "textarea",
        required: false,
        description: "Mailing address for invoices and communications.",
        validation: "Optional.",
      },
    ],
    workflow: {
      steps: [
        "Go to Masters → Parties",
        "Click Add New",
        "Fill in name, type, contact details",
        "Enter PAN/VAT if available",
        "Set credit limit and credit days",
        "Enter opening balance if migrating from another system",
        "Save",
      ],
      postingEffect:
        "Creates a party record. Automatically creates (or links to) a Sundry Debtors (if Customer) or Sundry Creditors (if Supplier) ledger in Chart of Accounts.",
      canEdit: true,
      canDelete: true,
      printAvailable: true,
    },
    accountingImpact:
      "Each party is backed by a ledger account. Customer transactions debit/credit the Sundry Debtors group. Supplier transactions debit/credit the Sundry Creditors group. Opening balances appear in the Balance Sheet.",
    validationRules: [
      "Party name is mandatory and must be unique",
      "Type (Customer/Supplier/Both) is mandatory",
      "PAN must be exactly 9 digits if entered",
      "Credit limit of 0 means no limit is applied",
    ],
    keyboardShortcuts: { F3: "Add new party from dropdown", "Ctrl+P": "Print party list" },
    relatedModules: [
      "sales-invoice",
      "purchase-invoice",
      "receipt-voucher",
      "payment-voucher",
      "outstanding-receivables",
      "outstanding-payables",
      "aging-report",
    ],
    commonErrors: [
      {
        error: "Customer not appearing in Sales Invoice dropdown",
        solution:
          "Check the party's Type field in Parties master. It must be 'Customer' or 'Both' to appear in Sales Invoice.",
      },
      {
        error: "VAT input credit not available for a supplier",
        solution:
          "The supplier's VAT number must be entered in the Parties master. Without it, the system may not allow VAT input claim on their invoices.",
      },
    ],
  },

  items: {
    id: "items",
    displayName: "Item / Stock Master",
    route: "items",
    category: "master",
    description:
      "Master catalog of all goods and services that the company buys and sells. Controls stock tracking, pricing, VAT categories, and batch/serial number requirements.",
    purpose:
      "To define every product or service so that it can be used in transaction lines with pre-populated rates, VAT categories, and to track inventory movement across warehouses.",
    howToAccess: ["Masters → Item Master", "Press F3 in Item line of a voucher to add on the fly"],
    keyFields: [
      {
        name: "Item Name",
        fieldKey: "name",
        type: "text",
        required: true,
        description: "Product or service name.",
        validation: "Must be unique.",
      },
      {
        name: "Item Code / SKU",
        fieldKey: "code",
        type: "text",
        required: false,
        description: "Short identifier for the item. Used for barcode scanning in POS.",
        validation: "Must be unique if entered.",
      },
      {
        name: "Item Group",
        fieldKey: "group",
        type: "select",
        required: false,
        description: "Category for grouping similar items in reports.",
        validation: "Optional but recommended.",
      },
      {
        name: "Unit",
        fieldKey: "unit",
        type: "select",
        required: true,
        description: "Base unit of measure (Kg, Ltr, Pcs, Box, etc.)",
        validation: "Must exist in the Units master.",
      },
      {
        name: "Sale Rate",
        fieldKey: "saleRate",
        type: "number",
        required: false,
        description:
          "Default selling price per unit. Auto-populated in sales invoice lines but editable.",
        validation: "Must be ≥ 0.",
      },
      {
        name: "Purchase Rate",
        fieldKey: "purchaseRate",
        type: "number",
        required: false,
        description: "Default purchase cost per unit.",
        validation: "Must be ≥ 0.",
      },
      {
        name: "VAT Category",
        fieldKey: "vatCategory",
        type: "select",
        required: true,
        description:
          "Taxable (13% VAT applies), Exempt (no VAT, no credit), or Zero-Rated (0% VAT, credit allowed for exports).",
        validation: "Must be one of: taxable, exempt, zero-rated.",
      },
      {
        name: "HSN Code",
        fieldKey: "hsnCode",
        type: "text",
        required: false,
        description: "Harmonized System Nomenclature code for customs and tax classification.",
        validation: "Optional.",
      },
      {
        name: "Reorder Level",
        fieldKey: "reorderLevel",
        type: "number",
        required: false,
        description: "Minimum stock quantity. System alerts when stock falls below this level.",
        validation: "Must be ≥ 0.",
      },
      {
        name: "Track Batch",
        fieldKey: "trackBatch",
        type: "checkbox",
        required: false,
        description:
          "Enable batch number tracking. Required for pharmaceuticals and perishables with expiry dates.",
        validation: "Cannot be changed after stock entries exist.",
      },
      {
        name: "Track Serial",
        fieldKey: "trackSerial",
        type: "checkbox",
        required: false,
        description: "Enable individual serial number tracking for high-value items.",
        validation: "Cannot be changed after stock entries exist.",
      },
      {
        name: "Opening Stock",
        fieldKey: "openingStock",
        type: "number",
        required: false,
        description: "Quantity on hand at the start of the fiscal year.",
        validation: "Requires opening rate to value the stock.",
      },
    ],
    workflow: {
      steps: [
        "Go to Masters → Item Master",
        "Click Add New",
        "Enter item name, code, and unit",
        "Select the appropriate VAT category",
        "Enter sale rate and purchase rate",
        "Enable batch/serial tracking if required",
        "Enter opening stock and warehouse",
        "Save",
      ],
      postingEffect:
        "Creates item record. Opening stock creates an initial stock movement entry. Item is now available in all transaction modules.",
      canEdit: true,
      canDelete: true,
      printAvailable: true,
    },
    accountingImpact:
      "Stock items are valued at cost using the selected costing method (FIFO/Weighted Average). The stock value appears in Balance Sheet under 'Stock-in-Hand' (Current Assets). Each purchase increases the stock value; each sale decreases it (COGS is recognized).",
    validationRules: [
      "Item name is mandatory and must be unique",
      "Unit is mandatory and must exist in the Units master",
      "VAT category is mandatory",
      "Opening stock requires a corresponding opening rate (cost price)",
      "Batch/serial tracking cannot be changed once transactions exist for the item",
    ],
    keyboardShortcuts: { F3: "Add new item from transaction line" },
    relatedModules: [
      "sales-invoice",
      "purchase-invoice",
      "stock-summary",
      "stock-summary",
      "warehouses",
      "units",
      "batch-management",
    ],
    commonErrors: [
      {
        error: "Item not showing in invoice dropdown",
        solution: "Item may be inactive. Check 'Is Active' checkbox in item master.",
      },
      {
        error: "Negative stock showing",
        solution:
          "Sales were entered before purchases. Enter purchase invoices for the relevant period. Or check 'Allow Negative Stock' in inventory settings.",
      },
    ],
    vatNote:
      "The VAT Category on each item drives the VAT calculation in invoices automatically. Always set this correctly: most retail goods are Taxable (13%); basic food, medicine, and some services are Exempt.",
  },

  "balance-sheet": {
    id: "balance-sheet",
    displayName: "Balance Sheet",
    route: "balance-sheet",
    category: "report",
    description:
      "The primary financial statement showing the company's financial position — what it owns (Assets) and what it owes (Liabilities + Equity) — at a specific point in time.",
    purpose:
      "To provide a snapshot of the company's financial health on a specific date. Must always balance: Total Assets = Total Liabilities + Owner's Equity.",
    howToAccess: ["Reports → Balance Sheet", "Press Ctrl+B from most screens"],
    keyFields: [
      {
        name: "As Of Date",
        fieldKey: "asOfDate",
        type: "date",
        required: true,
        description:
          "The date for which the balance sheet is prepared. All transactions up to this date are included.",
        validation: "Must be within or at the end of a fiscal year.",
      },
      {
        name: "Comparison Period",
        fieldKey: "comparePeriod",
        type: "select",
        required: false,
        description: "Optionally compare with the previous year's balance sheet.",
        validation: "Optional.",
      },
      {
        name: "Show Zero Balances",
        fieldKey: "showZero",
        type: "checkbox",
        required: false,
        description: "Whether to show accounts with zero balance.",
        validation: "Optional.",
      },
    ],
    workflow: {
      steps: [
        "Navigate to Reports → Balance Sheet",
        "Select the 'As of Date'",
        "Optionally enable comparison period",
        "Click Generate or press Enter",
        "Click any account line to drill down to the General Ledger detail",
      ],
      postingEffect: "Read-only report. No accounting entries created.",
      canEdit: false,
      canDelete: false,
      printAvailable: true,
    },
    accountingImpact: "None — this is a read-only report compiled from all posted vouchers.",
    validationRules: [
      "If Total Assets ≠ Total Liabilities + Equity, there is a data integrity issue — usually caused by unbalanced journal entries or corrupted data",
    ],
    keyboardShortcuts: {
      "Ctrl+B": "Open Balance Sheet from any screen",
      "Ctrl+P": "Print as PDF",
      "Ctrl+E": "Export to Excel",
    },
    relatedModules: ["profit-loss", "trial-balance", "chart-of-accounts", "general-ledger"],
    commonErrors: [
      {
        error: "Balance Sheet doesn't balance (Assets ≠ Liabilities + Equity)",
        solution:
          "Run the Trial Balance to find any unbalanced entries. Check for any manually entered journal entries where Dr ≠ Cr.",
      },
      {
        error: "Opening balances not showing",
        solution:
          "Verify that opening balances were entered in Chart of Accounts or via the Opening Balance voucher for the fiscal year start date.",
      },
    ],
  },

  "profit-loss": {
    id: "profit-loss",
    displayName: "Profit & Loss Statement",
    route: "profit-loss",
    category: "report",
    description:
      "Shows the company's financial performance over a period — all revenues earned and all expenses incurred — resulting in either a net profit or net loss.",
    purpose:
      "To measure the profitability of the business over a defined period. The net profit from this statement flows into the Balance Sheet's Reserves & Surplus / Retained Earnings.",
    howToAccess: ["Reports → Profit & Loss"],
    keyFields: [
      {
        name: "From Date",
        fieldKey: "fromDate",
        type: "date",
        required: true,
        description: "Start date of the reporting period.",
        validation: "Must be within fiscal year.",
      },
      {
        name: "To Date",
        fieldKey: "toDate",
        type: "date",
        required: true,
        description: "End date of the reporting period.",
        validation: "Must be ≥ From Date.",
      },
    ],
    workflow: {
      steps: [
        "Go to Reports → Profit & Loss",
        "Select From Date and To Date",
        "Generate report",
        "Drill down on any line to see individual transactions",
      ],
      postingEffect: "Read-only. No entries created.",
      canEdit: false,
      canDelete: false,
      printAvailable: true,
    },
    accountingImpact:
      "None — read-only. Net Profit = Total Income − Total Expenses. This figure transfers to Balance Sheet Equity section.",
    validationRules: [
      "Date range must be within the fiscal year or span multiple years if multi-year data exists",
    ],
    keyboardShortcuts: { "Ctrl+P": "Print", "Ctrl+E": "Export to Excel" },
    relatedModules: ["balance-sheet", "trial-balance", "vat-reports"],
    commonErrors: [
      {
        error: "Sales figures seem too low",
        solution:
          "Check that all sales invoices are Posted (not Draft). Also verify the date range covers the period you expect.",
      },
    ],
  },

  "trial-balance": {
    id: "trial-balance",
    displayName: "Trial Balance",
    route: "trial-balance",
    category: "report",
    description:
      "Lists all accounts with their debit and credit totals for a period. Total debits must equal total credits — confirming arithmetic correctness of all posted entries.",
    purpose:
      "To verify that the books are in balance (no posting errors) and to serve as the source document for preparing final financial statements.",
    howToAccess: ["Reports → Trial Balance", "Press Ctrl+T"],
    keyFields: [
      {
        name: "From Date",
        fieldKey: "fromDate",
        type: "date",
        required: true,
        description: "Period start date.",
        validation: "Within fiscal year.",
      },
      {
        name: "To Date",
        fieldKey: "toDate",
        type: "date",
        required: true,
        description: "Period end date.",
        validation: "≥ From Date.",
      },
      {
        name: "Show Opening",
        fieldKey: "showOpening",
        type: "checkbox",
        required: false,
        description: "Include opening balance column in the report.",
        validation: "Optional.",
      },
    ],
    workflow: {
      steps: [
        "Reports → Trial Balance",
        "Select date range",
        "Generate",
        "Verify total Dr = total Cr at bottom",
      ],
      postingEffect: "Read-only.",
      canEdit: false,
      canDelete: false,
      printAvailable: true,
    },
    accountingImpact: "None — read-only.",
    validationRules: ["Total Debit column must equal Total Credit column"],
    keyboardShortcuts: { "Ctrl+T": "Open Trial Balance" },
    relatedModules: ["balance-sheet", "profit-loss", "journal-voucher"],
    commonErrors: [
      {
        error: "Trial Balance is out of balance",
        solution:
          "Find the unbalanced entry by running the Day Book for the period and looking for any voucher where Dr ≠ Cr.",
      },
    ],
  },

  "vat-reports": {
    id: "vat-reports",
    displayName: "VAT Reports",
    route: "vat-reports",
    category: "report",
    description:
      "Generates VAT-compliant reports required for filing with Nepal's Inland Revenue Department (IRD): Sales Register (Annexure A), Purchase Register (Annexure B), and VAT Return Summary.",
    purpose:
      "To produce the official documents required for periodic VAT filing with IRD Nepal. The VAT payable (output VAT minus input VAT) is determined from these reports.",
    howToAccess: ["Reports → VAT Reports", "Press Ctrl+G"],
    keyFields: [
      {
        name: "Period",
        fieldKey: "period",
        type: "select",
        required: true,
        description: "Monthly or quarterly period for the VAT return.",
        validation: "Must match the company's VAT filing frequency registered with IRD.",
      },
      {
        name: "From Date / To Date",
        fieldKey: "dateRange",
        type: "date",
        required: true,
        description: "The start and end dates of the reporting period.",
        validation: "Must be within the fiscal year.",
      },
    ],
    workflow: {
      steps: [
        "Reports → VAT Reports",
        "Select the period (month or quarter)",
        "Review Sales Register for output VAT",
        "Review Purchase Register for input VAT",
        "Check VAT Return Summary for net payable to IRD",
        "Export to Excel in IRD-prescribed format",
        "File with IRD",
      ],
      postingEffect: "Read-only.",
      canEdit: false,
      canDelete: false,
      printAvailable: true,
    },
    accountingImpact:
      "None directly. When you pay the VAT to IRD, create a Payment Voucher: Dr VAT Payable, Cr Bank.",
    validationRules: [
      "Period must correspond to the company's registered VAT filing frequency",
      "All invoices for the period must be posted before generating the report",
    ],
    keyboardShortcuts: { "Ctrl+G": "Open VAT Reports" },
    relatedModules: ["sales-invoice", "purchase-invoice", "payment-voucher"],
    commonErrors: [
      {
        error: "Invoice missing from VAT register",
        solution:
          "Check that the invoice is Posted (not Draft). Also verify the invoice date falls within the selected period.",
      },
    ],
    vatNote:
      "Nepal VAT Act 2052 requires separate Annexure A (Sales) and Annexure B (Purchase) registers. The net VAT (Output minus Input) must be deposited with IRD by the 25th of the following month for monthly filers.",
  },

  "day-book": {
    id: "day-book",
    displayName: "Day Book",
    route: "day-book",
    category: "report",
    description:
      "A chronological listing of ALL transactions posted on a given date or date range, across all voucher types. The primary audit trail for daily operations.",
    purpose:
      "To verify all transactions for the day, check for any missing entries, and provide a complete audit trail sorted by time/voucher number.",
    howToAccess: ["Reports → Day Book"],
    keyFields: [
      {
        name: "Date",
        fieldKey: "date",
        type: "date",
        required: true,
        description: "The date for which to view all transactions.",
        validation: "Must have posted vouchers on this date.",
      },
      {
        name: "Voucher Type Filter",
        fieldKey: "voucherType",
        type: "select",
        required: false,
        description: "Optionally filter to show only one type of voucher.",
        validation: "Optional.",
      },
    ],
    workflow: {
      steps: [
        "Reports → Day Book",
        "Select date",
        "View all transactions",
        "Click any line to drill into the voucher detail",
      ],
      postingEffect: "Read-only.",
      canEdit: false,
      canDelete: false,
      printAvailable: true,
    },
    accountingImpact: "None — read-only.",
    validationRules: [],
    keyboardShortcuts: { "Ctrl+P": "Print Day Book" },
    relatedModules: ["all-vouchers", "general-ledger", "trial-balance"],
    commonErrors: [],
  },

  "general-ledger": {
    id: "general-ledger",
    displayName: "General Ledger",
    route: "ledger-report",
    category: "report",
    description:
      "Shows all transactions for a specific account over a period with a running balance — the full account statement.",
    purpose:
      "To review the complete history of any account — how the balance built up over time, each debit and credit, and the closing balance.",
    howToAccess: ["Reports → General Ledger", "Press Ctrl+L"],
    keyFields: [
      {
        name: "Account",
        fieldKey: "accountId",
        type: "select",
        required: true,
        description: "The GL account to view.",
        validation: "Must select one ledger account.",
      },
      {
        name: "From Date",
        fieldKey: "fromDate",
        type: "date",
        required: true,
        description: "Period start.",
        validation: "Within fiscal year.",
      },
      {
        name: "To Date",
        fieldKey: "toDate",
        type: "date",
        required: true,
        description: "Period end.",
        validation: "≥ From Date.",
      },
    ],
    workflow: {
      steps: [
        "Reports → General Ledger",
        "Select the account",
        "Set the date range",
        "View opening balance, each transaction, running balance, and closing balance",
      ],
      postingEffect: "Read-only.",
      canEdit: false,
      canDelete: false,
      printAvailable: true,
    },
    accountingImpact: "None — read-only.",
    validationRules: [],
    keyboardShortcuts: { "Ctrl+L": "Open General Ledger" },
    relatedModules: ["chart-of-accounts", "day-book", "trial-balance"],
    commonErrors: [],
  },

  "outstanding-receivables": {
    id: "outstanding-receivables",
    displayName: "Outstanding Receivables",
    route: "outstanding-receivables",
    category: "report",
    description:
      "Customer-wise list of all unpaid and partially-paid sales invoices with the outstanding amount due.",
    purpose:
      "To track money owed to the company by customers, identify overdue accounts, and prioritize collection efforts.",
    howToAccess: ["Reports → Outstanding Receivables"],
    keyFields: [
      {
        name: "As Of Date",
        fieldKey: "asOfDate",
        type: "date",
        required: true,
        description: "Show receivables outstanding as of this date.",
        validation: "Must be within fiscal year.",
      },
      {
        name: "Party Filter",
        fieldKey: "partyId",
        type: "select",
        required: false,
        description: "Filter for a specific customer.",
        validation: "Optional.",
      },
    ],
    workflow: {
      steps: [
        "Reports → Outstanding Receivables",
        "Select As Of Date",
        "View customer-wise outstanding amounts with invoice details and due dates",
      ],
      postingEffect: "Read-only.",
      canEdit: false,
      canDelete: false,
      printAvailable: true,
    },
    accountingImpact:
      "None — read-only. To clear an outstanding, post a Receipt Voucher allocating payment against the invoice.",
    validationRules: [],
    keyboardShortcuts: { "Ctrl+P": "Print" },
    relatedModules: ["sales-invoice", "receipt-voucher", "aging-report", "parties"],
    commonErrors: [],
  },

  "stock-summary": {
    id: "stock-summary",
    displayName: "Stock Summary",
    route: "stock-summary",
    category: "report",
    description: "Item-wise current stock position showing quantity and value in each warehouse.",
    purpose:
      "To see how much stock is available for each item, its current value, and which warehouse holds it.",
    howToAccess: ["Reports → Stock Summary"],
    keyFields: [
      {
        name: "As Of Date",
        fieldKey: "asOfDate",
        type: "date",
        required: true,
        description: "Stock position as of this date.",
        validation: "Within fiscal year.",
      },
      {
        name: "Warehouse Filter",
        fieldKey: "warehouseId",
        type: "select",
        required: false,
        description: "Filter for a specific warehouse.",
        validation: "Optional.",
      },
    ],
    workflow: {
      steps: [
        "Reports → Stock Summary",
        "Select As Of Date",
        "View item-wise stock quantity and value",
      ],
      postingEffect: "Read-only.",
      canEdit: false,
      canDelete: false,
      printAvailable: true,
    },
    accountingImpact: "None — read-only.",
    validationRules: [],
    keyboardShortcuts: { "Ctrl+P": "Print" },
    relatedModules: ["items", "sales-invoice", "purchase-invoice", "stock-journal", "warehouses"],
    commonErrors: [
      {
        error: "Stock shows negative quantity",
        solution:
          "Sales were recorded before corresponding purchases. Enter backdated purchase invoices or check for entry errors.",
      },
    ],
  },

  payroll: {
    id: "payroll",
    displayName: "Payroll",
    route: "payroll",
    category: "transaction",
    description:
      "Manages employee master data, salary structures (pay heads), monthly payroll processing, and automatic payroll journal posting.",
    purpose:
      "To calculate employee net salaries considering basic pay, allowances, and deductions (including PF, TDS, other deductions), generate payslips, and post the payroll accounting entries.",
    howToAccess: ["Transactions → Payroll (or Utilities → Payroll)"],
    keyFields: [
      {
        name: "Employee",
        fieldKey: "employeeId",
        type: "select",
        required: true,
        description: "Select the employee from the employee master.",
        validation: "Must exist in employee master.",
      },
      {
        name: "Pay Period",
        fieldKey: "period",
        type: "text",
        required: true,
        description:
          "The month and year for which payroll is being processed (e.g., Baisakh 2081).",
        validation: "Cannot process payroll twice for the same employee in the same period.",
      },
      {
        name: "Basic Salary",
        fieldKey: "basicSalary",
        type: "number",
        required: true,
        description: "Basic monthly salary before allowances and deductions.",
        validation: "Must be positive.",
      },
      {
        name: "Allowances",
        fieldKey: "allowances",
        type: "number",
        required: false,
        description: "Total allowances (HRA, transport, etc.).",
        validation: "Must be ≥ 0.",
      },
      {
        name: "Deductions",
        fieldKey: "deductions",
        type: "number",
        required: false,
        description: "Total deductions (PF, TDS, CIT, advances, etc.).",
        validation: "Cannot exceed gross salary.",
      },
      {
        name: "Net Salary",
        fieldKey: "netSalary",
        type: "number",
        required: true,
        description: "Auto-calculated: Basic + Allowances − Deductions.",
        validation: "Must be ≥ 0.",
      },
    ],
    workflow: {
      steps: [
        "Set up employees in Employee Master with salary structure",
        "Go to Payroll → Process Payroll",
        "Select the period",
        "Review auto-calculated salary for each employee",
        "Adjust any variable pay or deductions",
        "Generate payroll",
        "Post payroll journal entries",
        "Print payslips",
      ],
      postingEffect:
        "Creates payroll entries in payrollEntries table. Posts journal: Dr Salary Expense (gross), Cr Employee Payable (net), Cr PF Payable, Cr TDS Payable.",
      canEdit: false,
      canDelete: false,
      printAvailable: true,
    },
    accountingImpact:
      "DEBIT: Salary Expense Account = Gross Salary. CREDIT: Employee Payable Account = Net Salary (after all deductions). CREDIT: PF Payable = PF deduction. CREDIT: TDS Payable = TDS on salary. When salary is paid out: Dr Employee Payable, Cr Bank/Cash.",
    validationRules: [
      "Cannot process payroll for the same employee twice in the same period",
      "Net salary cannot be negative",
      "TDS on salary must follow the applicable income tax slab rates",
    ],
    keyboardShortcuts: { "Ctrl+P": "Print payslip" },
    relatedModules: ["chart-of-accounts", "journal-voucher", "payment-voucher"],
    commonErrors: [
      {
        error: "TDS on salary not calculating",
        solution:
          "Employee's annual salary must be projected and compared to the tax-free threshold. Configure the TDS slab in the employee's salary structure.",
      },
    ],
    tdsNote:
      "TDS on employment income is calculated based on the annual salary projection and the applicable tax slab. The TDS amount for the year is divided across monthly payments. The employer deposits TDS with IRD by the 25th of the following month.",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// ERP_ACCOUNTING_RULES — Standard accounting entries for all operations
// ─────────────────────────────────────────────────────────────────────────────

export const ERP_ACCOUNTING_RULES: AccountingRule[] = [
  {
    operation: "sales-invoice-credit",
    debit: "Customer / Debtor Ledger (full invoice amount including VAT)",
    credit: "Sales Account (net taxable amount) + VAT Payable Account (13% VAT)",
    example:
      "Invoice Rs. 11,300 (Rs. 10,000 sale + Rs. 1,300 VAT 13%): Dr Debtor 11,300 | Cr Sales 10,000 + Cr VAT Payable 1,300",
    notes:
      "For cash sales: Dr Cash instead of Dr Debtor. For bank payment: Dr Bank. Stock is reduced by the quantity sold.",
  },
  {
    operation: "purchase-invoice-credit",
    debit: "Purchases Account (net amount) + VAT Input Account (input tax credit)",
    credit: "Supplier / Creditor Ledger (total payable) OR Cash/Bank (if immediate payment)",
    example:
      "Purchase Rs. 5,650 (Rs. 5,000 + Rs. 650 VAT): Dr Purchases 5,000 + Dr VAT Input 650 | Cr Supplier 5,650",
    notes:
      "Stock increases with the purchase. Input VAT offsets against Output VAT (Sales VAT) when computing net VAT payable to IRD.",
  },
  {
    operation: "cash-receipt",
    debit: "Cash Account (amount received)",
    credit: "Customer / Debtor Ledger (reduces outstanding receivable)",
    example: "Customer pays Rs. 11,300 cash: Dr Cash 11,300 | Cr Debtor 11,300",
    notes:
      "Cash balance increases; customer outstanding decreases. If bill-by-bill: specific invoice is marked Paid.",
  },
  {
    operation: "bank-receipt",
    debit: "Bank Account (amount received)",
    credit: "Customer / Debtor Ledger",
    example: "Customer transfers Rs. 50,000 to bank: Dr Bank 50,000 | Cr Debtor 50,000",
    notes: "Same as cash receipt but Dr Bank instead of Dr Cash. Cheque number should be recorded.",
  },
  {
    operation: "cash-payment",
    debit: "Supplier Ledger OR Expense Account (amount paid)",
    credit: "Cash Account",
    example: "Pay supplier Rs. 5,650 cash: Dr Supplier 5,650 | Cr Cash 5,650",
    notes: "Cash balance decreases; supplier outstanding decreases (or expense is recognized).",
  },
  {
    operation: "bank-payment",
    debit: "Supplier Ledger OR Expense Account",
    credit: "Bank Account",
    example: "Pay rent Rs. 20,000 by cheque: Dr Rent Expense 20,000 | Cr Bank 20,000",
    notes:
      "Same as cash payment but from bank. Cheque number should be recorded for reconciliation.",
  },
  {
    operation: "journal-adjustment",
    debit: "The account being increased (debit-nature) or decreased (credit-nature)",
    credit: "The account being decreased (debit-nature) or increased (credit-nature)",
    example: "Accrue salary Rs. 30,000: Dr Salary Expense 30,000 | Cr Salary Payable 30,000",
    notes:
      "Manual journal entries require total debits = total credits. Used for provisions, accruals, corrections, year-end adjustments.",
  },
  {
    operation: "contra-cash-to-bank",
    debit: "Bank Account (money deposited)",
    credit: "Cash Account (cash going out)",
    example: "Deposit Rs. 15,000 cash to bank: Dr Bank 15,000 | Cr Cash 15,000",
    notes:
      "No change in total assets. Just moves money between cash and bank. Net effect on liquidity is zero.",
  },
  {
    operation: "contra-bank-to-cash",
    debit: "Cash Account (cash received from bank withdrawal)",
    credit: "Bank Account (bank balance reduced)",
    example: "Withdraw Rs. 5,000 cash from bank: Dr Cash 5,000 | Cr Bank 5,000",
    notes: "ATM withdrawal or cash drawing from bank account.",
  },
  {
    operation: "debit-note",
    debit: "Supplier / Creditor Ledger (supplier owes us the returned amount)",
    credit:
      "Purchase Returns Account (reduces purchase expense) + VAT Input Reversal (if VAT was claimed)",
    example:
      "Return goods worth Rs. 2,000 + Rs. 260 VAT: Dr Supplier 2,260 | Cr Purchase Returns 2,000 + Cr VAT Input 260",
    notes:
      "Reduces the liability to the supplier and reverses the purchase. VAT input already claimed must be reversed.",
  },
  {
    operation: "credit-note",
    debit: "Sales Returns Account (reduces sales revenue) + VAT Payable Reversal",
    credit: "Customer / Debtor Ledger (we owe the customer the returned amount)",
    example:
      "Accept customer return Rs. 1,000 + Rs. 130 VAT: Dr Sales Returns 1,000 + Dr VAT Payable 130 | Cr Debtor 1,130",
    notes:
      "Reduces revenue and the customer's outstanding. Stock increases as goods are returned to inventory.",
  },
  {
    operation: "depreciation",
    debit: "Depreciation Expense Account (income statement impact)",
    credit: "Accumulated Depreciation Account (balance sheet — contra asset)",
    example:
      "Annual depreciation Rs. 12,000: Dr Depreciation Expense 12,000 | Cr Accumulated Depreciation 12,000",
    notes:
      "The fixed asset's cost remains unchanged. Accumulated Depreciation is deducted from cost to show Net Book Value on Balance Sheet.",
  },
  {
    operation: "stock-adjustment",
    debit: "Stock Account (if increasing stock) OR Stock Loss/Wastage Account (if decreasing)",
    credit:
      "Stock Loss/Wastage Account (if increasing due to adjustment) OR Stock Account (if decreasing)",
    example: "Write off damaged stock Rs. 3,000: Dr Stock Loss 3,000 | Cr Stock/Inventory 3,000",
    notes:
      "Physical stock count discrepancies are corrected via stock adjustment entries. The stock movement is recorded in the inventory.",
  },
  {
    operation: "opening-balance",
    debit: "The asset/expense account (for Dr balances)",
    credit: "The liability/income account (for Cr balances)",
    example:
      "Opening balance of Debtor A Rs. 25,000: Dr Debtor A 25,000 | Cr Opening Balance Equity 25,000",
    notes:
      "Opening balances are entered when migrating from another system. They must balance across all accounts.",
  },
  {
    operation: "payroll-payment",
    debit: "Employee Payable Account (clearing the payable)",
    credit: "Bank Account (or Cash) (outgoing payment)",
    example: "Pay salary Rs. 45,000 to employees: Dr Employee Payable 45,000 | Cr Bank 45,000",
    notes:
      "This clears the Employee Payable that was created when payroll was processed. The payroll processing itself debits Salary Expense and credits Employee Payable.",
  },
  {
    operation: "tds-deduction",
    debit: "Supplier Account (full invoice amount — before TDS)",
    credit: "Bank Account (net amount paid after TDS) + TDS Payable Account (TDS withheld)",
    example:
      "Pay consultant Rs. 30,000, TDS 15% = Rs. 4,500: Dr Consultant 30,000 | Cr Bank 25,500 + Cr TDS Payable 4,500",
    notes:
      "TDS Payable is then remitted to IRD by the 25th of the following month: Dr TDS Payable | Cr Bank.",
  },
  {
    operation: "vat-payment-to-ird",
    debit: "VAT Payable Account (net VAT liability — output minus input)",
    credit: "Bank Account (payment to IRD)",
    example: "Pay VAT of Rs. 8,500 to IRD: Dr VAT Payable 8,500 | Cr Bank 8,500",
    notes:
      "Net VAT = Output VAT (from sales) - Input VAT (from purchases). If input > output, a VAT refund claim can be filed with IRD.",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// ERP_FORMULAS — Mathematical formulas used throughout the system
// ─────────────────────────────────────────────────────────────────────────────

export const ERP_FORMULAS: FormulaDoc[] = [
  {
    id: "vat-calculation",
    topic: "VAT Calculation",
    formula: "VAT Amount = Taxable Amount × 13%",
    example:
      "Taxable Amount = Rs. 10,000 → VAT = 10,000 × 0.13 = Rs. 1,300 → Invoice Total = Rs. 11,300",
    context:
      "Applied to each taxable line item in sales and purchase invoices. Exempt and zero-rated items do not attract VAT. The 13% rate is fixed under Nepal's VAT Act 2052.",
  },
  {
    id: "line-total",
    topic: "Invoice Line Total",
    formula: "Line Total = (Qty × Rate) − Line Discount + VAT on that line",
    example:
      "Qty=5, Rate=Rs.200, Discount=5%, VAT=13%: Gross=1,000; Disc=50; Taxable=950; VAT=123.50; Line Total=Rs.1,073.50",
    context:
      "Calculated for each line in a sales or purchase invoice. Discount is applied to the gross amount before VAT is calculated.",
  },
  {
    id: "invoice-grand-total",
    topic: "Invoice Grand Total",
    formula: "Grand Total = Sum of Line Totals − Bill Discount ± Bill Sundries ± Round Off",
    example:
      "Line Totals sum = Rs. 15,000; Bill Discount = Rs. 500; Freight Sundry = Rs. 200; Net = Rs. 14,700; Round Off = Rs. 0.00; Grand Total = Rs. 14,700",
    context:
      "Bill Discount is applied at invoice level (after all lines). Bill Sundries (freight, insurance) are added. Round Off adjusts to the nearest rupee.",
  },
  {
    id: "tds-deduction",
    topic: "TDS Deduction",
    formula: "TDS Amount = Taxable Amount × TDS Rate%",
    example:
      "Contractor payment Rs. 50,000, TDS rate 1.5%: TDS = 50,000 × 0.015 = Rs. 750; Net Payable = 50,000 − 750 = Rs. 49,250",
    context:
      "TDS is deducted at source when making specified payments. Common Nepal TDS rates: 1.5% (contracts), 10% (rent), 15% (consultancy). TDS deposited with IRD by 25th of following month.",
  },
  {
    id: "net-payable-with-tds",
    topic: "Net Payable After TDS",
    formula: "Net Payable = Invoice Grand Total − TDS Amount",
    example:
      "Invoice = Rs. 11,300; TDS 1.5% on Rs. 10,000 base = Rs. 150; Net Payable = Rs. 11,150",
    context:
      "The supplier receives only the net amount. The TDS is the company's liability to IRD, not the supplier.",
  },
  {
    id: "depreciation-slm",
    topic: "Straight Line Method (SLM) Depreciation",
    formula: "Annual Depreciation = (Cost − Residual Value) ÷ Useful Life (years)",
    example:
      "Machine Cost Rs. 1,00,000; Residual Value Rs. 10,000; Life 10 years: Annual Dep = (1,00,000 − 10,000) ÷ 10 = Rs. 9,000/year",
    context:
      "Equal depreciation charge every year. Simple to calculate. Commonly used for buildings and machinery with predictable wear.",
  },
  {
    id: "depreciation-wdv",
    topic: "Written Down Value (WDV) Depreciation",
    formula: "Annual Depreciation = Book Value at Start of Year × Depreciation Rate%",
    example:
      "Vehicle cost Rs. 10,00,000; WDV rate 20%: Year 1 = 10,00,000×20%=Rs.2,00,000; Year 2 = 8,00,000×20%=Rs.1,60,000; Year 3 = 6,40,000×20%=Rs.1,28,000",
    context:
      "Higher depreciation in early years. Nepal Income Tax Act mandates WDV for tax depreciation with specific rates by asset class (vehicles 20%, computers 33.33%, furniture 25%, buildings 5%).",
  },
  {
    id: "gross-profit",
    topic: "Gross Profit",
    formula: "Gross Profit = Net Revenue − Cost of Goods Sold (COGS)",
    example:
      "Revenue Rs. 5,00,000; COGS Rs. 3,00,000; Gross Profit = Rs. 2,00,000; Gross Margin = 40%",
    context:
      "Appears as the first subtotal in the Profit & Loss statement. COGS includes opening stock + purchases − closing stock for a trading business.",
  },
  {
    id: "net-profit",
    topic: "Net Profit",
    formula: "Net Profit = Gross Profit − Operating Expenses − Finance Costs + Other Income − Tax",
    example:
      "Gross Profit Rs. 2,00,000; Operating Expenses Rs. 80,000; Finance Costs Rs. 10,000; Other Income Rs. 5,000; Tax Rs. 34,500; Net Profit = Rs. 80,500",
    context:
      "The bottom line. This figure transfers to the Balance Sheet as Retained Earnings / Reserves & Surplus.",
  },
  {
    id: "current-ratio",
    topic: "Current Ratio",
    formula: "Current Ratio = Current Assets ÷ Current Liabilities",
    example:
      "Current Assets Rs. 4,00,000; Current Liabilities Rs. 2,00,000; Current Ratio = 2.0 (Healthy — above 1.5 is generally good)",
    context:
      "Measures short-term liquidity. A ratio < 1 means the company cannot meet its short-term obligations from current assets alone.",
  },
  {
    id: "debt-to-equity",
    topic: "Debt-to-Equity Ratio",
    formula: "D/E Ratio = Total Debt ÷ Total Equity",
    example:
      "Total Debt Rs. 5,00,000; Equity Rs. 10,00,000; D/E = 0.5 (Low leverage — company is mostly equity-funded)",
    context:
      "Measures financial leverage. High D/E (> 2) indicates high financial risk. Lower is generally safer for lenders and investors.",
  },
  {
    id: "inventory-turnover",
    topic: "Inventory Turnover Ratio",
    formula: "Inventory Turnover = Cost of Goods Sold ÷ Average Inventory",
    example:
      "COGS Rs. 12,00,000; Avg Inventory Rs. 2,00,000; Turnover = 6 times per year (inventory is sold and restocked 6 times)",
    context:
      "Higher turnover = more efficient inventory management. Low turnover may indicate overstocking or slow sales.",
  },
  {
    id: "fifo-cost",
    topic: "FIFO Inventory Valuation",
    formula:
      "FIFO Cost = Oldest purchase price used first; Closing stock valued at most recent purchase price",
    example:
      "Buy 100 units @ Rs.10 (Jan), buy 100 units @ Rs.12 (Feb). Sell 120 units. FIFO COGS = 100×10 + 20×12 = Rs.1,240. Closing stock = 80 units @ Rs.12 = Rs.960",
    context:
      "First In First Out. Matches older costs to current sales. In periods of inflation, FIFO gives lower COGS and higher profits than LIFO.",
  },
  {
    id: "weighted-average-cost",
    topic: "Weighted Average Inventory Cost",
    formula: "Weighted Average Rate = Total Cost of All Stock ÷ Total Quantity Available",
    example:
      "100 units @ Rs.10 + 100 units @ Rs.12 = Rs.2,200 total cost ÷ 200 units = Rs.11 per unit (WAC). Sell 120 units: COGS = 120 × 11 = Rs.1,320",
    context:
      "Average cost method. Sutra ERP's default inventory costing method. Simple and consistent. Updates the average cost every time new stock arrives.",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns formatted context about a specific ERP module for injection into Falcon's prompt.
 */
export function getModuleContext(route: string): string {
  const normalized = route.toLowerCase().trim().replace(/\//g, "");

  // Try exact match
  let doc = ERP_MODULES[normalized];

  // Try route match
  if (!doc) {
    doc = Object.values(ERP_MODULES).find((m) => m.route === normalized || m.id === normalized);
  }

  // Try partial match
  if (!doc) {
    const keys = Object.keys(ERP_MODULES);
    const partialKey = keys.find((k) => k.includes(normalized) || normalized.includes(k));
    if (partialKey) doc = ERP_MODULES[partialKey];
  }

  if (!doc) {
    return `=== CURRENT PAGE: ${route} ===\nThis is a Sutra ERP page. Answer questions about it based on your general ERP knowledge.`;
  }

  const fields = doc.keyFields.map((f) => `${f.name}${f.required ? "*" : ""}`).join(", ");
  const steps = doc.workflow.steps.map((s, i) => `  ${i + 1}. ${s}`).join("\n");
  const errors = doc.commonErrors.map((e) => `  • ${e.error} → ${e.solution}`).join("\n");
  const rules = doc.validationRules.map((r) => `  • ${r}`).join("\n");

  return [
    `=== CURRENT PAGE: ${doc.displayName} ===`,
    `Category: ${doc.category.toUpperCase()}`,
    `Purpose: ${doc.purpose}`,
    ``,
    `Key fields (* = required): ${fields}`,
    ``,
    `Typical workflow:`,
    steps,
    ``,
    `Accounting effect: ${doc.accountingImpact}`,
    ``,
    `Validation rules:`,
    rules || "  None specified",
    ``,
    errors ? `Common errors & solutions:\n${errors}` : "",
    doc.vatNote ? `\nVAT Note: ${doc.vatNote}` : "",
    doc.tdsNote ? `\nTDS Note: ${doc.tdsNote}` : "",
    doc.nepaliCalendarNote ? `\nNepali Calendar Note: ${doc.nepaliCalendarNote}` : "",
  ]
    .filter((line) => line !== undefined)
    .join("\n")
    .trim();
}

/**
 * Returns the accounting rule for a specific operation as a readable string.
 */
export function getAccountingRule(operation: string): string {
  const normalized = operation.toLowerCase().trim().replace(/\s+/g, "-");

  const rule = ERP_ACCOUNTING_RULES.find(
    (r) =>
      r.operation === normalized ||
      r.operation.includes(normalized) ||
      normalized.includes(r.operation),
  );

  if (!rule) {
    return `No specific accounting rule found for "${operation}". Use the double-entry principle: every transaction has equal and opposite debits and credits.`;
  }

  return [
    `Accounting Rule: ${rule.operation.replace(/-/g, " ").toUpperCase()}`,
    `DEBIT:  ${rule.debit}`,
    `CREDIT: ${rule.credit}`,
    `Example: ${rule.example}`,
    `Notes: ${rule.notes}`,
  ].join("\n");
}

/**
 * Returns formula documentation for a given accounting or calculation topic.
 */
export function formulaExplainer(topic: string): string {
  const normalized = topic.toLowerCase().trim();

  const matches = ERP_FORMULAS.filter(
    (f) =>
      f.topic.toLowerCase().includes(normalized) ||
      f.id.toLowerCase().includes(normalized) ||
      normalized.includes(f.id.toLowerCase()) ||
      normalized.split(" ").some((word) => word.length > 3 && f.topic.toLowerCase().includes(word)),
  );

  if (matches.length === 0) {
    return `No formula found for "${topic}". Please describe the calculation you need help with, and I will work through it step by step.`;
  }

  return matches
    .map((f) =>
      [
        `📐 ${f.topic}`,
        `Formula: ${f.formula}`,
        `Example: ${f.example}`,
        `Context: ${f.context}`,
      ].join("\n"),
    )
    .join("\n\n");
}
