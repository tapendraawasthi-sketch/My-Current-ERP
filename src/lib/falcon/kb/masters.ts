import type { KBEntry } from "../types";

export const KB_MASTERS: KBEntry[] = [
  {
    id: "acc-001", category: "masters",
    q: "What is the Chart of Accounts and what groups does it have?",
    keywords: ["chart of accounts", "coa", "account groups", "15 groups"],
    a: "The Chart of Accounts is the master list of all ledgers organized under 15 predefined groups across 6 categories: Capital/Equity (Capital Account, Reserves & Surplus), Liabilities (Loans, Current Liabilities, Provisions), Assets (Fixed Assets, Current Assets, Investments, Loans & Advances), Income (Direct/Indirect Income), Expenses (Direct/Indirect Expenses, Purchase Accounts), and Miscellaneous (Suspense Account)."
  },
  {
    id: "acc-002", category: "masters",
    q: "How do I add a new ledger account?",
    keywords: ["add ledger", "create account", "new ledger"],
    a: "Go to Masters → Chart of Accounts → Add Ledger. Enter the Account Name (required), pick an Account Group, choose the Account Type (General Ledger, Party, Bank, or Cash), and optionally set Alias, Print Name, and Opening Balance with Dr/Cr. Configure Address/GST/Bank/Configuration tabs as needed, then press Save (F2)."
  },
  {
    id: "acc-003", category: "masters",
    q: "What account types are available?",
    keywords: ["account types", "general ledger party bank cash"],
    a: "General Ledger (standard accounts), Party (customers/suppliers — enables credit limit & credit period), Bank (adds bank name, branch, account no, IFSC, OD/CC limit), and Cash (simplest type, for cash-in-hand accounts)."
  },
  {
    id: "acc-004", category: "masters",
    q: "How do I set up a bank account ledger?",
    keywords: ["bank ledger setup", "add bank account", "ifsc branch"],
    a: "Add a new ledger, set Account Type to Bank, choose a group like Bank Accounts (under Current Assets), then in the Bank tab enter Bank Name, Branch, Account Number, IFSC Code, Account Type (Savings/Current/OD/CC), and OD/CC Limit if applicable."
  },
  {
    id: "acc-005", category: "masters",
    q: "What is the Master Configuration panel for accounts?",
    keywords: ["master configuration", "optional fields", "dropdown display"],
    a: "Accessible from Chart of Accounts, it lets you set the dropdown display style (Name/Name+Alias/etc.), add up to 3 extra dropdown columns, toggle a bottom detail panel, and define up to 10 custom Optional Fields (text/numeric/date/list/yes-no) that appear on ledger forms."
  },
  {
    id: "acc-006", category: "masters",
    q: "How do I add a new account group?",
    keywords: ["add account group", "create group", "primary sub group"],
    a: "In Chart of Accounts click Add Group, enter a name, choose Primary Group (top-level) or Sub-Group (select a parent), set Nature (Debit or Credit), and optionally add a narration, then save. System groups cannot be renamed or deleted."
  },
  {
    id: "acc-007", category: "masters",
    q: "Can I delete a group or ledger?",
    keywords: ["delete group", "delete ledger", "cannot delete"],
    a: "System (predefined) groups can never be deleted. User-created groups can be deleted only if they have no sub-groups and no ledgers under them. A ledger cannot be deleted if it has a non-zero balance — deactivate it instead by unchecking Active."
  },
  {
    id: "acc-008", category: "masters",
    q: "How do sub-ledgers work?",
    keywords: ["sub ledger", "child account", "parent ledger"],
    a: "When the Sub Ledgers feature is enabled, a ledger can be set to Ledger Type = Sub Ledger and linked to a Parent Account. Its balance automatically rolls up into the parent in reports, useful for detailed tracking without cluttering the main Chart of Accounts."
  },
  {
    id: "acc-009", category: "masters",
    q: "How do I set up VAT and TDS payable accounts?",
    keywords: ["vat payable account", "tds payable account", "tax accounts setup"],
    a: "Create 'VAT Payable' (Output VAT, Credit nature) and 'VAT Input' (Input VAT, Debit nature) under the Duties & Taxes sub-group. For TDS, create 'TDS Payable' (Credit) similarly. Sales invoices credit VAT Payable; purchase invoices debit VAT Input; payment vouchers with TDS credit TDS Payable."
  },
  {
    id: "acc-010", category: "masters",
    q: "Why can't I post an invoice for a party — inactive ledger error?",
    keywords: ["party ledger inactive", "cannot post inactive account"],
    a: "The party's linked ledger account is marked inactive. Open Chart of Accounts, find that ledger, tick the Active checkbox, save, then retry posting the invoice."
  },
  {
    id: "acc-011", category: "masters",
    q: "How do I enable Cost Centers?",
    keywords: ["enable cost center", "cost center feature toggle"],
    a: "Go to Company Settings and turn on 'Enable Cost Center Module', save, then create cost centers under Masters → Cost Centers. A Cost Center dropdown will appear on voucher/invoice lines afterward."
  },
  {
    id: "party-001", category: "masters",
    q: "How do I add a new party (customer or supplier)?",
    keywords: ["add party", "new customer", "new supplier", "create party"],
    a: "Go to Masters → Parties Directory → Add Party. Enter Party Name (required), select Type (Customer/Supplier/Both), PAN (9 digits), Phone, Email, Address, Province, District, Municipality, Ward No, Opening Balance, and toggle Active, then Save."
  },
  {
    id: "party-002", category: "masters",
    q: "What party types are available?",
    keywords: ["party types", "customer supplier both"],
    a: "Customer (for sales/receivables), Supplier (for purchases/payables), and Both (acts as both — a single ledger tracks the combined net balance)."
  },
  {
    id: "party-003", category: "masters",
    q: "How do I search and filter parties?",
    keywords: ["search parties", "filter parties", "province filter"],
    a: "On the Parties Directory page, use the search bar (matches name, code, or PAN), the type filter buttons (All/Customer/Supplier/Both), and the province dropdown. Results are paginated and clicking a row opens the edit modal."
  },
  {
    id: "party-004", category: "masters",
    q: "What is the PAN validation rule?",
    keywords: ["pan validation", "9 digit pan", "vat number format"],
    a: "For Nepal, PAN/VAT registration numbers must be exactly 9 numerical digits. The system validates this format when saving a party and rejects invalid entries with an error toast."
  },
  {
    id: "party-005", category: "masters",
    q: "How does a party's opening balance affect accounting?",
    keywords: ["party opening balance", "initial receivable payable"],
    a: "A customer's opening debit balance creates an initial receivable; a supplier's opening credit balance creates an initial payable. These appear in Trial Balance, Party Statement, Outstanding, and Aging reports from day one."
  },
  {
    id: "party-006", category: "masters",
    q: "How do I set a credit limit for a party?",
    keywords: ["credit limit", "credit period", "party credit control"],
    a: "Edit the party, and in the General tab set 'Credit Limit (Rs.)' (0 = unlimited) and 'Credit Period (Days)'. This is used for credit control monitoring and reporting on outstanding balances."
  },
  {
    id: "party-007", category: "masters",
    q: "How do I deactivate a party?",
    keywords: ["deactivate party", "hide party", "inactive party"],
    a: "Edit the party and uncheck 'Is Active Party'. It will no longer appear in transaction dropdowns, but existing transactions and history remain visible in reports. You can reactivate it any time."
  },
  {
    id: "item-001", category: "masters",
    q: "How do I add a new stock item?",
    keywords: ["add item", "new stock item", "create item", "item master"],
    a: "Go to Masters → Item Master / Stock Book and add: Item Name (required), Code/SKU, Barcode, Unit, Purchase Rate, Sales Rate, VAT/Taxable status, HSN Code, Category/Item Group, Opening Stock quantity/rate, and Reorder Level, then Save."
  },
  {
    id: "item-002", category: "masters",
    q: "How do item groups work?",
    keywords: ["item groups", "item categories", "hierarchy of items"],
    a: "Item Groups categorize inventory hierarchically (parent-child). They let you filter items in reports and the POS grid, and are managed under Item Group Master."
  },
  {
    id: "item-003", category: "masters",
    q: "How do units of measure and unit conversion work?",
    keywords: ["units of measure", "unit conversion", "box to pieces"],
    a: "Each item has a base unit (PCS, KG, LTR, BOX, etc.), configured in Units. Unit Conversion Master defines relationships like 1 Box = 12 PCS so items can be bought/sold in an alternate unit with automatic quantity conversion to the base unit for stock."
  },
  {
    id: "item-004", category: "masters",
    q: "How do warehouses/godowns work?",
    keywords: ["warehouses", "godowns", "multi location stock"],
    a: "Warehouses are storage locations managed in the Warehouses page — create multiple with codes/names, mark one as default, and use them across sales/purchase invoices, stock transfers, delivery challans, and GRNs to track location-specific stock."
  },
  {
    id: "item-005", category: "masters",
    q: "How does batch management and expiry tracking work?",
    keywords: ["batch management", "expiry date", "lot tracking"],
    a: "Enable Batch & Expiry Tracking in Company Settings, then create batches in Batch Management with batch number, MFG/EXP dates, and quantity. Sales use FIFO/FEFO selection by default, and items expiring within 30 days trigger a dashboard alert."
  },
  {
    id: "item-006", category: "masters",
    q: "How do price lists work?",
    keywords: ["price lists", "wholesale retail pricing", "customer pricing"],
    a: "Create multiple Price Lists (e.g., Wholesale, Retail) in Masters → Price Lists, set item-specific rates in each list, and assign a price list to a party. Sales invoices then auto-load the correct rate for that customer, overridable manually."
  },
  {
    id: "item-007", category: "masters",
    q: "What are Bill Sundries?",
    keywords: ["bill sundries", "freight charge", "additional invoice charges"],
    a: "Bill Sundries are extra charges or deductions on an invoice beyond line items — e.g., freight, packing, insurance (Additive, increases total) or special discounts (Subtractive, decreases total). Configure defaults in Bill Sundry Master and add them per invoice."
  },
  {
    id: "item-008", category: "masters",
    q: "What is the Voucher Type Master used for?",
    keywords: ["voucher type master", "numbering series", "voucher prefix"],
    a: "It configures each voucher type's name, numbering series/prefix, default narration, and print settings — for example separate 'Cash Payment' (CPV-) and 'Bank Payment' (BPV-) series both under the Payment voucher type."
  },
  {
    id: "item-009", category: "masters",
    q: "What are Sale Types, Purchase Types, and Tax Categories?",
    keywords: ["sale type", "purchase type", "tax category master"],
    a: "Sale/Purchase Types (Local, Interstate, Export/Import) categorize transactions for reporting and tax treatment. Tax Categories (Regular, Composition, Unregistered, SEZ, Deemed Export) define VAT rate and input-credit eligibility per party or invoice."
  },
  {
    id: "item-010", category: "masters",
    q: "What are Standard Narrations?",
    keywords: ["standard narration", "narration templates", "quick description"],
    a: "Pre-defined narration text templates configured in Standard Narration Master, selectable from a dropdown when creating vouchers to speed up repetitive entries like 'Being rent paid for the month of...'."
  },
  {
    id: "item-011", category: "masters",
    q: "What is the Bill of Material (BOM)?",
    keywords: ["bill of material", "bom", "production recipe"],
    a: "BOM defines a manufacturing recipe: a parent finished item plus a list of child raw materials with required quantities per unit produced. It is used by the Production Voucher to auto-calculate raw material consumption and finished goods output."
  },
  {
    id: "item-012", category: "masters",
    q: "What is the reorder level and how does negative stock work?",
    keywords: ["reorder level", "minimum stock", "negative stock allow"],
    a: "Reorder Level triggers a dashboard alert ('Items Below Reorder Level') when current stock falls to or below it. Allow Negative Stock is a company setting — when off (default), sales are blocked if insufficient stock exists in the selected warehouse; when on, stock can go negative."
  },
  {
    id: "item-013", category: "masters",
    q: "How is stock valued (weighted average, FIFO)?",
    keywords: ["stock valuation method", "weighted average", "fifo lifo"],
    a: "Set the valuation method in Inventory Configuration. Weighted Average (default) recalculates the average cost after every purchase; sales cost = quantity × current average. FIFO values sales using the oldest purchase cost first."
  },
  {
    id: "item-014", category: "masters",
    q: "How do I import items or parties from Excel?",
    keywords: ["import items excel", "import parties excel", "bulk upload"],
    a: "Go to Data Import/Export, download the relevant template (Items or Parties), fill it with your data (name, code, rates/PAN, opening balances, etc.), then upload — the system validates each row, creates valid records, and flags errors for correction."
  },
];
