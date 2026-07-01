import type { KBEntry } from "../types";

export const KB_EXTENDED: KBEntry[] = [
  {
    id: "ext-130", category: "general",
    q: "Can I use Sutra ERP on a tablet?",
    keywords: ["tablet", "mobile", "responsive"],
    a: "Yes. The responsive design adapts to tablet screens. On screens between mobile and desktop widths (768px+), the standard desktop layout activates with the full sidebar and menu bars."
  },
  {
    id: "ext-131", category: "general",
    q: "What happens if IndexedDB is not available?",
    keywords: ["indexeddb", "database error", "initialization"],
    a: "Sutra ERP requires IndexedDB. If not available: The initialization screen shows 'Initializing database...', an error message may appear. Check that your browser supports IndexedDB, ensure private mode allows it, or clear browser storage if corrupted."
  },
  {
    id: "ext-132", category: "general",
    q: "How do I recover from a database error?",
    keywords: ["database error", "recover", "corrupted"],
    a: "Try refreshing the page. Check browser console for errors (F12). If persistent, use Factory Reset to clear and reseed the database. Restore from a backup if available. Clear browser site data as a last resort."
  },
  {
    id: "ext-133", category: "general",
    q: "What does the ErrorBoundary component do?",
    keywords: ["error boundary", "crash", "refresh page"],
    a: "The ErrorBoundary catches React rendering errors and shows: Error icon and message, 'Refresh Page' button, 'Try Again' button, and expandable error details. This prevents the entire app from crashing."
  },
  {
    id: "ext-134", category: "general",
    q: "Why is my Trial Balance not balancing?",
    keywords: ["trial balance mismatch", "not balancing", "difference"],
    a: "Common causes: Unbalanced journal vouchers, missing contra entries, incorrect opening balances, deleted/modified posted vouchers. Check Day Book for the period and verify all vouchers have equal debits and credits."
  },
  {
    id: "ext-135", category: "transactions",
    q: "Why is my invoice not saving?",
    keywords: ["invoice not saving", "validation error", "save failed"],
    a: "Check: All required fields are filled, date is within current fiscal year, quantity > 0 and rate >= 0, at least one line item added, payment amount <= grand total, bank selected for bank transfer, and party ledger is active."
  },
  {
    id: "ext-136", category: "general",
    q: "Why can't I print?",
    keywords: ["print failed", "popup blocked", "pdf error"],
    a: "Check: Popup blocker may be blocking the print window. Allow popups for your Sutra ERP site. Try clicking Print again. If PDF generation fails, check browser console (jsPDF memory issues on large invoices)."
  },
  {
    id: "ext-137", category: "general",
    q: "Why are my stock quantities wrong?",
    keywords: ["stock wrong", "inventory mismatch", "incorrect stock"],
    a: "Check: All purchase and sales invoices are posted, stock transfers are correct, stock journals are posted, physical stock counts match. Check Stock Ledger for the specific item to trace movements."
  },
  {
    id: "ext-138", category: "general",
    q: "What is Falcon AI?",
    keywords: ["falcon ai", "assistant", "chatbot"],
    a: "Falcon AI is the built-in assistant chatbot. It provides step-by-step guidance for ERP features, read-only knowledge base, page-aware context, chat history saved in localStorage, and feedback options."
  },
  {
    id: "ext-139", category: "general",
    q: "How do I open Falcon?",
    keywords: ["open falcon", "start chat"],
    a: "Click the blue chat bubble button in the bottom-right corner of the screen. Falcon only appears when you're logged in and the database is ready. Click again or press Esc to close."
  },
  {
    id: "ext-140", category: "general",
    q: "What can I ask Falcon?",
    keywords: ["ask falcon", "falcon capabilities"],
    a: "Falcon can answer questions about: creating invoices/vouchers, adding masters, generating reports, configuring settings, using POS mode, VAT/TDS calculations, printing, shortcuts, and troubleshooting."
  },
  {
    id: "ext-141", category: "masters",
    q: "What are Voucher Types?",
    keywords: ["voucher types", "serial numbering", "prefixes"],
    a: "Voucher Types define serial numbering and configuration for different voucher categories (Journal, Payment, Receipt). Manages numbering series, prefixes, and default settings."
  },
  {
    id: "ext-142", category: "masters",
    q: "What are Sale Types and Purchase Types?",
    keywords: ["sale types", "purchase types", "interstate", "export"],
    a: "They categorize transactions (Local, Interstate, Export/Import), affecting tax calculation and reporting. Configured in SaleTypeMaster and PurchaseTypeMaster."
  },
  {
    id: "ext-143", category: "masters",
    q: "What are Tax Categories?",
    keywords: ["tax categories", "composition", "sez", "vat treatment"],
    a: "Tax Categories define tax treatment for parties and items: Regular, Composition, Unregistered, Consumer, SEZ, Deemed Export. Affects VAT/GST calculation."
  },
  {
    id: "ext-144", category: "masters",
    q: "What are Standard Narrations?",
    keywords: ["standard narrations", "narration template", "reusable narration"],
    a: "Standard Narrations are pre-defined narration templates for vouchers. Create reusable text to quick-select when creating vouchers. Managed in StandardNarrationMaster."
  },
  {
    id: "ext-145", category: "masters",
    q: "What are Schemes/Offers?",
    keywords: ["schemes", "offers", "promotions", "discounts"],
    a: "Schemes are promotional offers applied to sales: Buy X Get Y free, quantity-based discounts, value-based discounts, date-range specific offers. Managed in SchemeMaster."
  },
  {
    id: "ext-146", category: "masters",
    q: "What are Misc Masters?",
    keywords: ["misc masters", "material centres", "bom"],
    a: "Misc Masters contains miscellaneous configuration like Material Centres (for production), Bill of Material (BOM) definitions, and other auxiliary data."
  },
  {
    id: "ext-147", category: "masters",
    q: "What are Cost Centers?",
    keywords: ["cost centers", "department tracking", "project tracking"],
    a: "Cost Centers track expenses and revenues by department, project, or branch. Assign to voucher lines during entry. Enable in Company Settings first."
  },
  {
    id: "ext-148", category: "masters",
    q: "What are Sales Persons?",
    keywords: ["sales persons", "sales reps", "commission"],
    a: "Sales Persons master tracks sales representatives: Name, contact, commission rates. Link to sales invoices for sales analysis by salesperson."
  },
  {
    id: "ext-149", category: "masters",
    q: "What is Budget Master?",
    keywords: ["budget master", "financial targets", "budgeting"],
    a: "Budget Master sets financial targets per account or group (monthly/quarterly/yearly). Compare with actuals in Budget vs Actual report."
  },
  {
    id: "ext-150", category: "transactions",
    q: "What is the Quotation/Estimate feature?",
    keywords: ["quotation", "estimate", "sales estimate"],
    a: "Quotations are pre-sales estimates. Similar to invoices but not posted to ledgers. Can be converted to Sales/Purchase Orders. Managed through QuotationPage."
  },
  {
    id: "ext-151", category: "reports",
    q: "How is stock valuation calculated?",
    keywords: ["stock valuation", "weighted average", "closing stock value"],
    a: "Stock valuation uses the configured method (default: weighted average). Total available value = Opening + Purchases. Weighted average rate = Total value / Total qty. Closing stock value = Closing qty x Weighted average rate."
  },
  {
    id: "ext-152", category: "masters",
    q: "What is the difference between purchase rate and sales rate?",
    keywords: ["purchase rate", "sales rate", "cost price", "selling price"],
    a: "Purchase Rate is the cost price (used in purchase invoices/GRNs, affects stock valuation). Sales Rate is the selling price (used in sales invoices/POS, affects revenue)."
  },
  {
    id: "ext-153", category: "transactions",
    q: "How does negative stock work?",
    keywords: ["negative stock", "allow negative stock"],
    a: "The 'allowNegativeStock' company setting controls if sales can be made below zero stock. If disabled, sales are blocked. If enabled, stock goes negative (useful for backorders)."
  },
  {
    id: "ext-154", category: "transactions",
    q: "What is the reorder level?",
    keywords: ["reorder level", "min stock level", "low stock alert"],
    a: "Reorder level (min stock level) triggers dashboard alerts when stock falls below it. Set per item in the item master to maintain adequate inventory."
  },
  {
    id: "ext-155", category: "transactions",
    q: "How does stock transfer between branches work?",
    keywords: ["stock transfer", "inter branch", "branch transfer"],
    a: "Select From/To Branch/Warehouse, add items. Toggle 'Is Inter Branch'. On posting, stock movements are created for both sides. An accounting journal entry is also created (Dr Branch Transfer Rec, Cr Branch Transfer Pay)."
  },
  {
    id: "ext-156", category: "reports",
    q: "How do I view stock across all warehouses?",
    keywords: ["all warehouses", "consolidated stock"],
    a: "Go to Reports → Inventory → Stock Status/Summary. Select 'All Warehouses'. Shows each item with columns for each warehouse's quantity or a consolidated view. The Inventory Report page also provides multi-warehouse views."
  },
  {
    id: "ext-157", category: "transactions",
    q: "What happens to stock when I cancel a posted invoice?",
    keywords: ["cancel invoice", "stock effect cancellation"],
    a: "When a posted invoice is cancelled, all stock movements created by it are reversed (sales return to stock, purchases remove from stock). Accounting entries are reversed, and the reason is recorded in audit logs."
  },
  {
    id: "ext-158", category: "transactions",
    q: "How do I handle damaged or expired stock?",
    keywords: ["damaged stock", "expired stock", "write off", "stock journal"],
    a: "Use a Stock Journal. Select item and warehouse, enter negative quantity to write off damaged/expired stock, add narration, and post. This reduces stock without direct financial entry."
  },
  {
    id: "ext-159", category: "transactions",
    q: "How do serial numbers work for items?",
    keywords: ["serial numbers", "serial tracking"],
    a: "Serial tracking (if enabled) assigns unique serial numbers to individual units. Tracked from purchase to sale, appear in stock movements, searchable in stock ledger (useful for electronics)."
  },
  {
    id: "ext-160", category: "transactions",
    q: "What is the difference between Stock Journal and Physical Stock?",
    keywords: ["stock journal vs physical stock", "inventory difference"],
    a: "Stock Journal is a direct adjustment for single item/warehouse (damages, found items). Physical Stock is a bulk counting process (enter counted qtys, system compares to book stock and posts batch adjustments)."
  },
  {
    id: "ext-161", category: "masters",
    q: "How do I set item opening stock?",
    keywords: ["opening stock", "initial stock"],
    a: "When creating an item, enter Opening Stock quantity and Opening Stock Rate. System calculates Value = Qty x Rate. This creates an initial stock movement record with type 'opening'."
  },
  {
    id: "ext-162", category: "masters",
    q: "Can items have multiple barcodes?",
    keywords: ["multiple barcodes", "alternative scan codes"],
    a: "Each item has one primary barcode field. However, POS scanner matches against barcode, code, SKU, or name. Multiple codes can be entered in the code field separated by commas."
  },
  {
    id: "ext-163", category: "masters",
    q: "How does the Bill of Material (BOM) work?",
    keywords: ["bom", "bill of material", "manufacturing recipe"],
    a: "BOM defines manufacturing recipes (parent finished product + child raw materials). Used in Production Voucher to auto-calculate raw material consumption. Managed in Misc Masters."
  },
  {
    id: "ext-164", category: "transactions",
    q: "How is production cost calculated?",
    keywords: ["production cost", "manufacturing cost"],
    a: "Production cost = Sum of (Raw Material Qty x Cost Rate). When production voucher is posted, raw materials are consumed, and finished goods are added to stock at the calculated cost."
  },
  {
    id: "ext-165", category: "transactions",
    q: "How do I track stock by batch/lot number?",
    keywords: ["batch tracking", "lot number", "expiry date"],
    a: "Enable Batch Management. Create batches, assign to purchase/GRN, select batches on sale (FIFO default). Track batch-wise stock in Stock Ledger and monitor near-expiry alerts."
  },
  {
    id: "ext-166", category: "reports",
    q: "What reports help with inventory analysis?",
    keywords: ["inventory reports", "stock analysis"],
    a: "Stock Summary (overall), Stock Ledger (movement history), Inventory Report (multi-warehouse), Sales Analysis, Stock Aging, Critical Level (below reorder), Unmoved Items."
  },
  {
    id: "ext-167", category: "transactions",
    q: "How does POS barcode scanning work?",
    keywords: ["pos barcode", "scan item"],
    a: "Focus on barcode input field in POS, scan barcode (or type). System searches barcode → code → SKU → name. Found item adds to cart (qty 1). Checks stock availability first."
  },
  {
    id: "ext-168", category: "transactions",
    q: "How does POS cart management work?",
    keywords: ["pos cart", "edit cart"],
    a: "Cart lines show item, qty (editable), rate, discount %, VAT toggle, total, and remove button. All edits auto-recalculate the bill summary instantly."
  },
  {
    id: "ext-169", category: "transactions",
    q: "How does POS bill discount work?",
    keywords: ["pos discount", "bill discount", "line discount"],
    a: "Line Discount: per-item percentage. Bill Discount: applied to total after line discounts (percentage or fixed amount). Both can be used together. Bill discount reduces taxable base proportionally."
  },
  {
    id: "ext-170", category: "transactions",
    q: "How does POS split payment work?",
    keywords: ["pos split payment", "multiple payment modes"],
    a: "Divide bill across Cash, Card, Wallet, Bank, Credit fields. Quick-set buttons auto-fill total. Change is calculated if cash paid > total. Credit sales require a customer selection."
  },
  {
    id: "ext-171", category: "transactions",
    q: "What are POS held bills and when to use them?",
    keywords: ["pos held bills", "suspend transaction", "park bill"],
    a: "Suspend a cart (Hold) when customer steps away or table service. Retains items, customer, discounts, payments. Later, recall from 'Held Bills' tab to complete sale or delete."
  },
  {
    id: "ext-172", category: "transactions",
    q: "How does POS day close reconciliation work?",
    keywords: ["pos day close", "reconcile cash", "close pos session"],
    a: "End of day: Go to Day Close tab. Expected Cash = Opening Cash + Cash Sales. Enter Actual Closing Cash. System records Variance (Actual - Expected). Closes session and logs history."
  },
  {
    id: "ext-173", category: "transactions",
    q: "What data does the POS day report include?",
    keywords: ["pos day report", "export pos report"],
    a: "Excel export contains 2 sheets: POS Sales (date, invoice no, customer, amounts, payment breakdown, cashier) and Summary (bills count, sales totals, payment mode totals, expected cash)."
  },
  {
    id: "ext-174", category: "transactions",
    q: "How does POS customer selection work?",
    keywords: ["pos customer", "walk-in customer"],
    a: "Default is 'Walk-in Customer'. Select specific customer to track sales, enable credit, apply specific pricing, and generate proper tax invoice with customer PAN."
  },
  {
    id: "ext-175", category: "transactions",
    q: "How does POS VAT calculation work?",
    keywords: ["pos vat calculation"],
    a: "Each line has a VAT checkbox (default based on item). VAT = 13% of taxable amount. Bill discount reduces taxable base. Exempt items not charged VAT. Breakdown clearly shown on receipt."
  },
  {
    id: "ext-176", category: "transactions",
    q: "Can I refund a POS sale?",
    keywords: ["pos refund", "pos return"],
    a: "Handle refunds by creating a Sales Return invoice (BillingInvoice page) referencing original POS sale (returns stock/payment), or process a negative sale in POS mode if configured."
  },
  {
    id: "ext-177", category: "transactions",
    q: "How does POS warehouse selection work?",
    keywords: ["pos warehouse"],
    a: "Select warehouse from dropdown at top. Stock checks use this warehouse, and items are reduced from it. Different POS terminals can use different warehouses."
  },
  {
    id: "ext-178", category: "transactions",
    q: "What happens if POS internet disconnects?",
    keywords: ["pos offline", "internet disconnect pos"],
    a: "Sutra ERP uses local IndexedDB, so POS continues working offline. Sales save locally and sync to backend (Render) when reconnected. No data loss during outages."
  },
  {
    id: "ext-179", category: "reports",
    q: "How do I review past POS transactions?",
    keywords: ["past pos transactions", "pos history"],
    a: "Day Close tab shows today's. Sales Register (Reports) shows all (filter by 'POS' channel). Session History shows past sessions with opening/closing cash amounts."
  },
  {
    id: "ext-180", category: "transactions",
    q: "How does POS pricing work?",
    keywords: ["pos pricing", "pos rate priority"],
    a: "POS uses item's price in this priority: sellingPrice → salePrice → mrp → rate → price. If no price exists, it shows 0 and user can manually enter."
  },
  {
    id: "ext-181", category: "transactions",
    q: "How does POS receipt printing work?",
    keywords: ["pos receipt printing", "thermal printer"],
    a: "Thermal receipt style (310px wide window, monospace font, auto-triggers print) or A4/Letter standard invoice format. Includes header, items, VAT, payment summary."
  },
  {
    id: "ext-182", category: "general",
    q: "What is double-entry accounting and how does Sutra enforce it?",
    keywords: ["double entry", "accounting principle", "enforce balance"],
    a: "Every transaction affects >= 2 accounts with equal debits/credits. Journal vouchers must balance (Debit=Credit). Invoices auto-create balanced entries. Unbalanced posting is blocked."
  },
  {
    id: "ext-183", category: "general",
    q: "How does Sutra handle accounting periods?",
    keywords: ["accounting periods", "fiscal year logic"],
    a: "Based on fiscal years. Active FY used as default. Dates must fall within FY range. Closed FYs prevent new postings. Year-end transfers P&L balances to retained earnings."
  },
  {
    id: "ext-184", category: "general",
    q: "What are the accounting entries created by a sales invoice?",
    keywords: ["sales invoice entries", "accounting impact sales"],
    a: "Debit: Customer/Debtor (if credit) or Cash/Bank (if paid). Credit: Sales Account (taxable amount) and VAT Payable (VAT amount). Returns reverse these entries."
  },
  {
    id: "ext-185", category: "general",
    q: "What accounting entries does a purchase invoice create?",
    keywords: ["purchase invoice entries", "accounting impact purchase"],
    a: "Debit: Purchase Account (taxable) and VAT Input (VAT amount). Credit: Supplier/Creditor (if credit) or Cash/Bank (if paid)."
  },
  {
    id: "ext-186", category: "general",
    q: "What accounting entries does a payment voucher create?",
    keywords: ["payment voucher entries", "accounting impact payment", "tds entry"],
    a: "Debit: Supplier/Creditor (party account). Credit: Cash/Bank Account. If TDS applies: Dr Supplier (full amount), Dr TDS Expense, Cr Cash/Bank (net paid), Cr TDS Payable."
  },
  {
    id: "ext-187", category: "general",
    q: "What accounting entries does a receipt voucher create?",
    keywords: ["receipt voucher entries", "accounting impact receipt"],
    a: "Debit: Cash/Bank Account. Credit: Customer/Debtor. If TCS applies, additional tax entries are created."
  },
  {
    id: "ext-188", category: "general",
    q: "What accounting entries does a contra voucher create?",
    keywords: ["contra voucher entries", "accounting impact contra"],
    a: "Cash deposit: Dr Bank, Cr Cash. Cash withdrawal: Dr Cash, Cr Bank. Bank-to-bank: Dr Bank (receiving), Cr Bank (sending)."
  },
  {
    id: "ext-189", category: "general",
    q: "How does the system calculate ledger balances?",
    keywords: ["calculate ledger balance", "running balance formula"],
    a: "Balance = Opening Balance + Sum(posted debits) - Sum(posted credits). Computed dynamically from master opening balances and all posted voucher/invoice lines. Excludes draft/cancelled."
  },
  {
    id: "ext-190", category: "general",
    q: "What is the difference between posted and draft status?",
    keywords: ["posted vs draft", "voucher status difference"],
    a: "Draft: Saved but doesn't affect ledgers/stock, editable, hidden from reports. Posted: Finalized, affects ledgers/stock/reports, uneditable (only cancelable). Cancelled: Reversal entries applied."
  },
  {
    id: "ext-191", category: "general",
    q: "How does round-off work on invoices?",
    keywords: ["round off", "decimal difference", "invoice rounding"],
    a: "RoundOff = Rounded Grand Total (Math.round) - Exact Total. Paisa differences displayed separately in totals. Can be disabled in settings for exact accounting."
  },
  {
    id: "ext-192", category: "general",
    q: "What VAT rates are supported?",
    keywords: ["vat rates", "exempt vat"],
    a: "Default 13% for Nepal. Supports 0% (exempt). Configurable per item. Per-line VAT toggle in invoices. Rate can be overridden on individual lines."
  },
  {
    id: "ext-193", category: "general",
    q: "How does input VAT vs output VAT work?",
    keywords: ["input vat", "output vat", "net vat payable"],
    a: "Output VAT = VAT collected on sales (Payable). Input VAT = VAT paid on purchases (Receivable). Net VAT Payable = Output - Input (pay to IRD). Net VAT Receivable = Input - Output (refund)."
  },
  {
    id: "ext-194", category: "general",
    q: "How are VAT-exempt items handled?",
    keywords: ["vat exempt", "non taxable item"],
    a: "Marked as vatExempt: true (or isTaxable off). No VAT calculated on line. Tracked separately as 'Exempt Non-VAT Billed'. Included in gross/discount calculations."
  },
  {
    id: "ext-195", category: "general",
    q: "How does TDS (Tax Deducted at Source) work in Nepal?",
    keywords: ["tds nepal", "tds rates", "tds sections"],
    a: "TDS rates: Service Contract (1.5%), House Rent (10%), Consultancy (15%), Dividend (5%). Deducted at payment time, not invoice. Certificates generated per party per fiscal year."
  },
  {
    id: "ext-196", category: "general",
    q: "How do I record TDS in a payment voucher?",
    keywords: ["record tds payment", "deduct tds"],
    a: "In payment voucher to supplier, enable 'Deduct TDS' checkbox, select TDS section. TDS rate auto-fills. Net payment = Gross - TDS. Posting creates TDS payable liability entry."
  },
  {
    id: "ext-197", category: "general",
    q: "How do I generate a TDS certificate?",
    keywords: ["tds certificate", "generate tds cert"],
    a: "From party statement or TDS reports: Select party/FY, click 'Generate TDS Certificate'. Shows deductor/deductee details, list of payments/sections/amounts, total gross/TDS, print-ready A4."
  },
  {
    id: "ext-198", category: "reports",
    q: "What are the Nepal VAT filing annexes?",
    keywords: ["vat filing annex", "annex a", "annex b", "annex c"],
    a: "VAT Reports support Annex A (Sales register), Annex B (Purchase register), Annex C (VAT summary). Exportable for IRD filing by tax period (monthly)."
  },
  {
    id: "ext-199", category: "general",
    q: "How does party registration type affect tax?",
    keywords: ["party registration type", "composition", "sez party"],
    a: "Types: Regular (standard 13%), Composition (special rates), Unregistered (no input credit), Consumer (VAT included), SEZ (zero-rated), Deemed Export."
  },
  {
    id: "ext-200", category: "general",
    q: "How does reverse charge mechanism work?",
    keywords: ["reverse charge", "unregistered supplier vat"],
    a: "Applies when purchasing from unregistered suppliers. Mark invoice 'Reverse Charge Applicable'. Buyer pays VAT instead of supplier. Both output/input VAT recorded (net zero effect)."
  },
  {
    id: "ext-201", category: "reports",
    q: "How do I filter reports by date range?",
    keywords: ["date filter", "report date range", "custom date"],
    a: "Use ReportPeriodSelector preset periods (Today, This Month, This FY) or Custom range (From/To dates). Supports BS Nepali dates and auto-detects current FY."
  },
  {
    id: "ext-202", category: "reports",
    q: "How do I drill down from Trial Balance to Ledger?",
    keywords: ["drill down trial balance", "navigate to ledger"],
    a: "In Trial Balance, click any account name. Navigates to General Ledger for that account, pre-filtered with same dates. Drill further to individual vouchers."
  },
  {
    id: "ext-203", category: "reports",
    q: "How do I drill down from P&L to transactions?",
    keywords: ["drill down profit loss", "navigate from pl"],
    a: "In P&L, click any income/expense ledger to view the ledger details showing all transactions. Click group level to see constituent ledgers."
  },
  {
    id: "ext-204", category: "reports",
    q: "How do I export reports?",
    keywords: ["export reports", "excel export", "pdf export"],
    a: "Reports export to Excel (.xlsx) using Export buttons. Invoices/vouchers export to PDF via 'Print PDF' button. Direct browser print uses print-specific CSS."
  },
  {
    id: "ext-205", category: "reports",
    q: "How does the Day Book report organize transactions?",
    keywords: ["day book format", "chronological report"],
    a: "Shows all vouchers/invoices in chronological date order. Displays date, ref number, type, narration, debit, credit. Filters for voucher types. Useful for daily audit."
  },
  {
    id: "ext-206", category: "reports",
    q: "How do outstanding reports calculate amounts?",
    keywords: ["outstanding calculation", "unpaid amount"],
    a: "Outstanding = Total Invoice Amount - Total Amount Paid. Only posted invoices included. Aging groups by buckets. Interest calculation uses outstanding + overdue days."
  },
  {
    id: "ext-207", category: "reports",
    q: "How does the Balance Sheet categorize accounts?",
    keywords: ["balance sheet categories", "assets liabilities structure"],
    a: "Liabilities: Capital, Reserves, Loans, Current Liabilities, Provisions. Assets: Fixed Assets, Current Assets, Investments, Loans & Advances. Net Profit shown under Capital."
  },
  {
    id: "ext-208", category: "reports",
    q: "How does P&L categorize accounts?",
    keywords: ["profit loss categories", "income expense structure"],
    a: "Income: Direct/Indirect. Expenses: Direct (Mfg), Purchase, Indirect (Admin). Gross Profit = Sales - Direct Exp. Net Profit = Gross + Indirect Inc - Indirect Exp."
  },
  {
    id: "ext-209", category: "reports",
    q: "How does Cash Flow Statement work?",
    keywords: ["cash flow statement", "operating investing financing"],
    a: "Categorizes movements: Operating (sales/purchases/expenses), Investing (assets/investments), Financing (capital/loans/dividends). Net Cash Flow + Opening = Closing Cash."
  },
  {
    id: "ext-210", category: "reports",
    q: "How accurate are ratio calculations?",
    keywords: ["ratio calculations", "financial ratios accuracy"],
    a: "Calculated from current balances: Current/Quick Ratio, Debt-Equity, Gross/Net Profit Margin, Return on Assets/Equity, Inventory/Debtor Turnover."
  },
  {
    id: "ext-211", category: "transactions",
    q: "What is the complete flow from Sales Order to Invoice?",
    keywords: ["sales workflow", "order to invoice flow"],
    a: "Quotation → Sales Order (qty reserved) → Delivery Challan (dispatched, stock decreases, vehicle recorded) → Sales Invoice (billing, challan status = invoiced)."
  },
  {
    id: "ext-212", category: "transactions",
    q: "What information does a Delivery Challan contain?",
    keywords: ["delivery challan details", "dc fields"],
    a: "Challan number, date, customer, sales order ref, vehicle/driver details, line items (qty/warehouse), status (Draft/Dispatched/Received/Invoiced), total qty."
  },
  {
    id: "ext-213", category: "transactions",
    q: "What happens when a Delivery Challan is dispatched?",
    keywords: ["dispatch challan", "challan stock movement"],
    a: "Status changes to 'dispatched'. Stock movements (stock-transfer-out) decrease inventory at source. Available as reference for sales invoice. Action logged."
  },
  {
    id: "ext-214", category: "transactions",
    q: "What is the GRN process flow?",
    keywords: ["grn process flow", "goods receipt workflow"],
    a: "Purchase Order → GRN (goods received, track ordered/received/accepted/rejected). Accepted qty increases stock. Inspector recorded. → Purchase Invoice (billing, status = invoiced)."
  },
  {
    id: "ext-215", category: "transactions",
    q: "How does GRN quality inspection work?",
    keywords: ["grn inspection", "accepted rejected qty"],
    a: "Tracks Ordered, Received, Accepted (enters stock), and Rejected (Received - Accepted, doesn't enter stock, returned to supplier)."
  },
  {
    id: "ext-216", category: "transactions",
    q: "Can I create an invoice directly from a challan/GRN?",
    keywords: ["invoice from challan", "invoice from grn"],
    a: "Yes. In Challan/GRN form, click 'Create Invoice'. Navigates to invoice form pre-filled with reference and items. Complete pricing/VAT/payment and post."
  },
  {
    id: "ext-217", category: "general",
    q: "How do I add a new user?",
    keywords: ["add user", "create user account"],
    a: "Utilities → Users Management → Add User. Enter Full Name, Username (min 4 chars), Password (min 6, letters+numbers), Role (admin/accountant/manager/operator), Active status, Save."
  },
  {
    id: "ext-218", category: "general",
    q: "What can each user role do?",
    keywords: ["user roles", "permissions", "admin accountant operator"],
    a: "Admin/Owner: Full access. Accountant: All entry/reports, no system settings/users. Manager: Approve vouchers, view reports, limited master creation. Operator: Basic transaction entry."
  },
  {
    id: "ext-219", category: "general",
    q: "How do I change my password?",
    keywords: ["change password", "reset password"],
    a: "Click profile icon in header → Settings/Change Password. Enter current password, new password (min 6 chars, letters+numbers), confirm, and Save."
  },
  {
    id: "ext-220", category: "general",
    q: "What is the login security?",
    keywords: ["login security", "failed attempts", "lockout"],
    a: "Failed tracking: 5 failed attempts locks account for 30 seconds (countdown timer). Credentials stored securely. Session clears on logout/browser close."
  },
  {
    id: "ext-221", category: "general",
    q: "How does the login screen work?",
    keywords: ["login screen details"],
    a: "Shows company name/PAN. Username/password fields. Show/hide password. Back to Gateway (Esc). Error messages/lockout countdown. Last login info."
  },
  {
    id: "ext-222", category: "general",
    q: "What is the Gateway screen?",
    keywords: ["gateway screen", "company selection"],
    a: "Company selection page shown when not logged in. Shows company name, PAN, last login. 'Open' button proceeds to login. 'Create New Company' at bottom."
  },
  {
    id: "ext-223", category: "general",
    q: "How does the BusyMenuBar navigation work?",
    keywords: ["top menu bar", "busymenubar"],
    a: "Horizontal menu below title bar with dropdowns: Company, Masters, Transactions, Reports, Utilities, Data, Exchange, Share, Settings, Support. Used for quick navigation."
  },
  {
    id: "ext-224", category: "general",
    q: "How does the sidebar navigation work?",
    keywords: ["sidebar navigation", "left menu"],
    a: "Expandable sections (Gateway, Masters, Transactions, Reports, etc.). Highlights active page. Collapsible to 60px icon-only mode (persists in localStorage). Dark theme."
  },
  {
    id: "ext-225", category: "general",
    q: "How does the Title Bar work?",
    keywords: ["title bar", "minimize fullscreen close"],
    a: "Top of desktop layout. Shows logo, 'Sutra ERP', company name/FY. Buttons: Minimize (hides content), Fullscreen (browser API), Close (clears session with confirm dialog)."
  },
  {
    id: "ext-226", category: "general",
    q: "What does the Status Bar show?",
    keywords: ["status bar details", "bottom status"],
    a: "Bottom of desktop layout. Shows brand name, company name/FY, VAT number, current user, State/Currency, weekday, BS/AD dates."
  },
  {
    id: "ext-227", category: "general",
    q: "What does the Command Hint Bar show?",
    keywords: ["command hint bar", "bottom shortcut hints"],
    a: "Below main content. Shows keyboard shortcut hints (Esc-Quit, F2-Save, F5-List, F3-Add New). Configurable per screen for quick reference."
  },
  {
    id: "ext-228", category: "general",
    q: "What is the standard form save workflow?",
    keywords: ["form save workflow", "save process"],
    a: "Fill fields/lines. Validation on save (errors as toasts). On success: 'Saved successfully' toast, form resets/switches to edit mode, ref number appears, print offered. F2/Ctrl+S to save."
  },
  {
    id: "ext-229", category: "general",
    q: "How do I add line items in invoice/voucher forms?",
    keywords: ["add line item", "insert row"],
    a: "Click 'Add Line'. Fill item/account and amounts. Press Tab on last field of last row to auto-add another row. Trash icon to remove row. Changes auto-recalculate totals."
  },
  {
    id: "ext-230", category: "general",
    q: "How does the Nepali Date Picker work?",
    keywords: ["nepali date picker", "bs date input"],
    a: "Shows BS dates. Calendar popup with Nepali months. Returns date string in BS format, converts AD dates. Used globally in all date fields."
  },
  {
    id: "ext-231", category: "general",
    q: "How do account/party/item dropdowns work?",
    keywords: ["dropdown selectors", "select input filtering"],
    a: "Search/filter as you type. PartySelect filters by type (cust/supp). AccountSelect shows hierarchy. ItemSelect shows active items/rates. Recently used appear first."
  },
  {
    id: "ext-232", category: "general",
    q: "What are the inline editing patterns?",
    keywords: ["inline edit", "list view edit", "double click edit"],
    a: "In list views: Click row to select (bottom panel details). Double-click row to open edit modal (pre-filled). Save updates, Cancel closes. Delete button available in modal."
  },
  {
    id: "ext-233", category: "general",
    q: "How does the form dirty state tracking work?",
    keywords: ["dirty state", "unsaved changes prompt"],
    a: "dirty flag true on field change. 'Discard changes?' confirmation on back navigation or Esc key. Prevents accidental data loss. Resets after save."
  },
  {
    id: "ext-234", category: "general",
    q: "What is the Excel export format for vouchers?",
    keywords: ["export vouchers excel", "voucher excel format"],
    a: "Contains: Voucher No, Date (BS/AD), Type, Narration, Total Debit/Credit, Status. Matches active filters. Uses XLSX (SheetJS)."
  },
  {
    id: "ext-235", category: "general",
    q: "What is the Excel export format for invoices?",
    keywords: ["export invoices excel", "invoice excel format"],
    a: "Contains: Invoice No, Date, Customer/Supplier, PAN, Type, Gross, Discount, Taxable, VAT, Grand Total, Payment Mode, Status. Matches filters."
  },
  {
    id: "ext-236", category: "general",
    q: "How do I import parties from Excel?",
    keywords: ["import parties", "bulk upload parties excel"],
    a: "Data Import/Export → Download template. Fill Code, Name, Type, PAN, etc., and Opening Balance. Upload to validate. Valid parties created, duplicates flagged."
  },
  {
    id: "ext-237", category: "general",
    q: "How do I import items from Excel?",
    keywords: ["import items", "bulk upload items excel"],
    a: "Download template. Fill Code, Name, Unit, Rates, Opening Stock/Rate, Taxable, Barcode, etc. Upload. Items created with stock movements for opening stock."
  },
  {
    id: "ext-238", category: "general",
    q: "Can I export the Chart of Accounts?",
    keywords: ["export chart of accounts", "coa excel"],
    a: "Yes. Chart of Accounts page → Export. Excel shows groups/ledgers hierarchically (indented). Columns: Name, Type, Parent, Nature, Account Type, Balance."
  },
  {
    id: "ext-239", category: "general",
    q: "How do I create a backup?",
    keywords: ["create backup", "export database json"],
    a: "Utilities → Backup & Restore → Create Backup. Exports all IndexedDB data (masters, transactions, settings) to JSON file for download. Store safely off-device."
  },
  {
    id: "ext-240", category: "general",
    q: "How do I restore from backup?",
    keywords: ["restore backup", "import database json"],
    a: "Backup & Restore → Restore Backup. Select JSON file. Validates format. Confirm restoration (replaces current data!). Data clears, backup imports, page reloads."
  },
  {
    id: "ext-241", category: "general",
    q: "What data is included in a backup?",
    keywords: ["backup contents", "what gets backed up"],
    a: "All DB tables: company settings, users, FYs, accounts, parties, items, vouchers, invoices, stock movements, challans, orders, POS sessions, audit logs, shortcuts, etc."
  },
  {
    id: "ext-242", category: "general",
    q: "How often should I backup?",
    keywords: ["backup frequency", "when to backup"],
    a: "Daily recommended. Before major changes (year-end, import), after significant entry. Keep multiple copies (7 days) off-device. Test restore periodically."
  },
  {
    id: "ext-243", category: "general",
    q: "What actions are logged in the audit trail?",
    keywords: ["audit trail contents", "what gets audited"],
    a: "CREATE, UPDATE, DELETE (masters/transactions), LOGIN, LOGOUT. Log includes timestamp, user, action, description, status."
  },
  {
    id: "ext-244", category: "general",
    q: "How are audit logs protected?",
    keywords: ["audit log protection", "immutable log security"],
    a: "Append-only (no update/delete). Stored in separate auditLogs table. Admin-only view. Include risk levels. System auto-logs key operations."
  },
  {
    id: "ext-245", category: "general",
    q: "What does the audit log show for invoice posting?",
    keywords: ["audit log invoice", "invoice posting log"],
    a: "Timestamp, User, Action: CREATE, Description: 'SI-00123 Rs. 15,000.00 Cash', Module: Sales Invoice, Status: Success, Risk: Medium."
  },
  {
    id: "ext-246", category: "general",
    q: "How does immutable accounting work?",
    keywords: ["immutable accounting", "event sourcing ledger"],
    a: "Backend (Render/Postgres): ledger_postings and inventory_postings are INSERT-only. Corrections via reversal entries, never UPDATE/DELETE. Ensures complete audit trail."
  },
  {
    id: "ext-247", category: "general",
    q: "What is the Period Lock feature?",
    keywords: ["period lock", "lock dates", "prevent editing"],
    a: "Prevents modifying transactions in closed periods. Lock dates configured in Security settings. Prevents edits/deletes before lock date (usually post-audit)."
  },
  {
    id: "ext-248", category: "general",
    q: "How does PDF invoice generation work?",
    keywords: ["pdf generation", "jspdf invoice", "how pdf works"],
    a: "Uses jsPDF. Gathers company, party, and invoice data. Renders lines with jsPDF-AutoTable. Calculates totals, adds logo/bank/signatures. Outputs Blob in new window."
  },
  {
    id: "ext-249", category: "general",
    q: "Can I customize the invoice print template?",
    keywords: ["customize invoice print", "invoice template settings"],
    a: "Uses standard A4 layout. Configurable via company settings: toggle print bank details, terms & conditions text, invoice footer text, company logo upload."
  },
  {
    id: "ext-250", category: "general",
    q: "How does thermal receipt printing work?",
    keywords: ["thermal receipt", "pos print styling"],
    a: "HTML template with inline CSS. 310px fixed width, monospace font. Auto window.print(). Format: header, items, totals, payment summary. Designed for 80mm printers."
  },
  {
    id: "ext-251", category: "general",
    q: "How do I print reports?",
    keywords: ["print reports", "report printing css"],
    a: "Uses browser native print. @media print CSS hides .no-print elements, shows .print-only headers. Configured for A4/A3 sizes with 12mm margins and white background."
  },
  {
    id: "ext-252", category: "general",
    q: "Why does my PDF not show Nepali characters?",
    keywords: ["nepali font pdf", "jspdf devanagari issue"],
    a: "jsPDF default font lacks Devanagari script. Ensure PDF uses Unicode fonts for Nepali text, otherwise Latin chars substitute. Known client-side PDF limitation."
  },
  {
    id: "ext-253", category: "general",
    q: "What does 'Voucher unbalanced' mean?",
    keywords: ["voucher unbalanced error", "fix unbalanced journal"],
    a: "Total Debit ≠ Total Credit on a journal voucher. The difference is shown in the error. All journals must balance exactly. Check line amounts."
  },
  {
    id: "ext-254", category: "general",
    q: "What does 'Date must be within fiscal year' mean?",
    keywords: ["date out of fiscal year", "fy date error"],
    a: "Selected date is outside active FY range. Check FY start/end dates. Change date to fall within FY or update FY dates. Current FY shown in status bar."
  },
  {
    id: "ext-255", category: "general",
    q: "What does 'Party ledger is inactive' mean?",
    keywords: ["inactive party ledger", "ledger inactive error"],
    a: "Party's linked account ledger is inactive. Go to Chart of Accounts, find ledger, edit and check 'Active', save. Now invoices can be posted."
  },
  {
    id: "ext-256", category: "general",
    q: "What does 'CBMS submission failed' mean?",
    keywords: ["cbms failed error", "resubmit cbms"],
    a: "CBMS integration error. Check internet or credentials in settings. Invoice is posted locally. Retry by clicking CBMS badge and 'Resubmit'."
  },
  {
    id: "ext-257", category: "general",
    q: "What does 'Insufficient stock' mean?",
    keywords: ["insufficient stock error", "stock check failed"],
    a: "In POS/Sales: Available stock (In - Out) in selected warehouse is < entered qty. Options: Reduce qty, change warehouse, or enable Allow Negative Stock (not recommended)."
  },
  {
    id: "ext-258", category: "general",
    q: "What does 'Popup blocked' mean?",
    keywords: ["popup blocked error", "allow popups print"],
    a: "Browser blocking print/PDF window. Allow popups for Sutra ERP site (Chrome: address bar icon → Always allow). Try printing again."
  },
  {
    id: "ext-259", category: "transactions",
    q: "How does the voucher approval stepper work?",
    keywords: ["approval stepper", "voucher stages"],
    a: "5 stages: Draft (gray, unsubmitted), Submitted (blue, pending review), Under Review (blue), Approved (green, ready to post), Posted (green, finalized). Completed show checkmarks."
  },
  {
    id: "ext-260", category: "transactions",
    q: "Who can approve vouchers?",
    keywords: ["approve vouchers", "workflow approver"],
    a: "Manager: Submitted → Under Review → Approved. Admin: Full control. Accountant: Submit drafts only. Operator: None. Rejection returns to Draft."
  },
  {
    id: "ext-261", category: "transactions",
    q: "How do I submit a voucher for approval?",
    keywords: ["submit voucher approval", "advance to submitted"],
    a: "Create/save Draft. Click 'Advance to submitted'. Status moves to Submitted, appears in approver's pending queue. Once approved, it can be posted."
  },
  {
    id: "ext-262", category: "transactions",
    q: "What happens when a voucher is rejected?",
    keywords: ["rejected voucher", "workflow rejection"],
    a: "Status changes to Draft/Rejected. Red banner appears: '...Please correct...'. Voucher becomes editable. Make corrections, re-submit. Reason logged in audit."
  },
  {
    id: "ext-263", category: "transactions",
    q: "How does bill-wise tracking work?",
    keywords: ["bill wise tracking", "invoice reference tracking"],
    a: "Each invoice creates a bill reference. Payment/receipts allocate against specific bills (FIFO or manual). Enables accurate aging reports and interest calculation."
  },
  {
    id: "ext-264", category: "transactions",
    q: "How does the Bill Allocation Panel work?",
    keywords: ["bill allocation panel", "allocate payment to invoices"],
    a: "Opens on payment/receipt for party. Loads outstanding bills (Due Date, Overdue, Outstanding). Auto-fill (FIFO) or manual entry. Green (valid) / Red (over-allocated). Unallocated = advance."
  }
];
