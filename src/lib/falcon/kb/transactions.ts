import type { KBEntry } from "../types";

export const KB_TRANSACTIONS: KBEntry[] = [
  {
    id: "inv-001", category: "transactions",
    q: "How do I create a sales invoice?",
    keywords: ["create sales invoice", "new invoice", "billing"],
    a: "Go to Billing / Sales Invoice, select the Customer, confirm the date, add line items (item, quantity, rate auto-fills, discount %, VAT toggle, warehouse), add Bill Sundries if needed, choose Payment Mode (Cash/Bank/Credit), add narration, then click 'Post Invoice'. A print option appears after posting."
  },
  {
    id: "inv-002", category: "transactions",
    q: "What happens when I post a sales invoice?",
    keywords: ["posting effects", "invoice posted accounting entries"],
    a: "Posting debits Customer/Cash/Bank and credits Sales plus VAT Payable, decreases stock for the items sold, generates an invoice number, sets payment status (Paid/Partial/Unpaid), logs an audit entry, and — if enabled — auto-submits to CBMS for an IRN."
  },
  {
    id: "inv-003", category: "transactions",
    q: "How do I create a purchase invoice?",
    keywords: ["create purchase invoice", "purchase bill entry"],
    a: "Go to Purchase Invoice, select the Supplier, add items with quantity/rate/VAT, choose payment mode, and post. This debits Purchase/VAT Input and credits Supplier/Cash/Bank, and increases stock quantity."
  },
  {
    id: "inv-004", category: "transactions",
    q: "How do sales returns and purchase returns work?",
    keywords: ["sales return", "purchase return", "credit note goods return"],
    a: "Use the same invoice form, switching to the Return tab. Sales Return increases stock and decreases the customer's balance; Purchase Return decreases stock and decreases the supplier's balance — both reverse the original invoice's accounting entries."
  },
  {
    id: "inv-005", category: "transactions",
    q: "How is VAT calculated on an invoice line?",
    keywords: ["vat calculation formula", "how vat is computed"],
    a: "Gross = Qty × Rate. Line Discount = Gross × Discount%. Taxable = Gross − Discount. VAT = Taxable × VAT Rate% (default 13%) if the line's Taxable checkbox is on. Line Total = Taxable + VAT. Bill-level discounts and sundries are applied afterward proportionally."
  },
  {
    id: "inv-006", category: "transactions",
    q: "How do bill sundries affect the invoice total?",
    keywords: ["sundry effect on total", "additive subtractive charge"],
    a: "Sundries are applied after item totals and bill discount: Additive sundries increase the grand total, Subtractive sundries decrease it. Sundries do not affect VAT (VAT is computed only on item taxable amounts). Final total is rounded, with any paisa difference shown as Round Off."
  },
  {
    id: "inv-007", category: "transactions",
    q: "How does TDS work on a purchase invoice?",
    keywords: ["tds on invoice", "deduct tds purchase"],
    a: "If the supplier is subject to TDS, enable the 'Deduct TDS' checkbox, choose a TDS section (Service Contract, House Rent, Consultancy, etc.), and the rate auto-fills. TDS Amount = Taxable Amount × Rate%, and Net Payable = Grand Total − TDS Amount."
  },
  {
    id: "inv-008", category: "transactions",
    q: "What payment modes are available on invoices?",
    keywords: ["payment mode invoice", "cash bank credit"],
    a: "Cash (immediate, simple), Bank Transfer (requires selecting a bank account, plus optional cheque details), and Credit (deferred — you can optionally record a partial amount paid now, with the remainder shown as balance due)."
  },
  {
    id: "inv-009", category: "transactions",
    q: "How do I print a posted invoice?",
    keywords: ["print invoice", "invoice pdf", "generate invoice pdf"],
    a: "After posting, click Print. The generated PDF (via jsPDF) includes company header/logo/PAN, buyer details, item table with HSN/qty/rate/discount/VAT/total, amount in words, bank details (if configured), totals, and a signature section."
  },
  {
    id: "inv-010", category: "transactions",
    q: "How do I cancel or void an invoice?",
    keywords: ["cancel invoice", "void invoice", "delete posted invoice"],
    a: "Open the invoice, click 'Cancel/Void Bill', enter a mandatory reason, and confirm. This reverses the ledger postings and restores inventory stock levels; the status changes to Cancelled and the reason is recorded in the audit log."
  },
  {
    id: "inv-011", category: "transactions",
    q: "How do delivery challans work?",
    keywords: ["delivery challan", "goods dispatch", "dc voucher"],
    a: "A Delivery Challan tracks goods dispatched before invoicing: select customer/warehouse, add items and quantities, enter vehicle/driver details, and set status Draft → Dispatched → Received. Dispatch decreases stock; later create the Sales Invoice referencing the challan."
  },
  {
    id: "inv-012", category: "transactions",
    q: "How do Goods Receipt Notes (GRN) work?",
    keywords: ["goods receipt note", "grn", "receive purchase goods"],
    a: "A GRN tracks goods received from a supplier before billing: enter Ordered/Received/Accepted/Rejected quantities (Rejected = Received − Accepted), record the Inspector name, and post — only Accepted quantity enters stock. Later create the Purchase Invoice referencing the GRN."
  },
  {
    id: "inv-013", category: "transactions",
    q: "How do sales orders and purchase orders work?",
    keywords: ["sales order", "purchase order", "order voucher"],
    a: "Sales/Purchase Orders are pre-invoice commitments tracking item quantities, rates, and status. They typically flow into Delivery Challans/GRNs and then into invoices. Outstanding Order reports show pending fulfillment, flagging orders older than 7 days."
  },
  {
    id: "inv-014", category: "transactions",
    q: "How do quotations work and how do I convert one to an order?",
    keywords: ["quotation", "estimate", "convert quotation to order"],
    a: "Create a Sales/Purchase Quotation with items and validity dates — no accounting effect, just an estimate. Open it and click 'Convert to Order' to pre-fill a Sales/Purchase Order with the same items for confirmed fulfillment."
  },
  {
    id: "inv-015", category: "transactions",
    q: "How does CBMS invoice submission work?",
    keywords: ["cbms", "irn", "e-billing nepal", "qr code invoice"],
    a: "When CBMS is enabled, posted sales invoices auto-submit to Nepal's Central Billing Management System, which returns an IRN and generates a QR code. The invoice shows a status badge (Pending/Submitted/Failed); click it to view details or click Resubmit on failures."
  },
  {
    id: "vou-001", category: "transactions",
    q: "How do I create a journal voucher?",
    keywords: ["journal voucher", "journal entry", "double entry"],
    a: "Go to Journal Voucher, select the date, add at least 2 lines (each with an Account and either a Debit or Credit amount — never both), ensure Total Debit equals Total Credit, add a narration, then Post. F2 saves; the balance indicator turns green when balanced."
  },
  {
    id: "vou-002", category: "transactions",
    q: "Why can't I enter both debit and credit on the same journal line?",
    keywords: ["debit credit mutual exclusion", "cannot enter both"],
    a: "Each journal line enforces mutual exclusion — entering a Debit clears that line's Credit field automatically (and vice versa), which keeps double-entry bookkeeping clean and prevents accidental double-posting on a single line."
  },
  {
    id: "vou-003", category: "transactions",
    q: "How do I create a payment voucher?",
    keywords: ["payment voucher", "pay supplier", "record payment"],
    a: "Go to Payment Voucher (F6), select date and the supplier/party, enter the amount, choose Cash/Bank/Cheque, optionally allocate against outstanding bills via the Bill Allocation Panel, add narration, and Post. This debits the party and credits Cash/Bank."
  },
  {
    id: "vou-004", category: "transactions",
    q: "How do I create a receipt voucher?",
    keywords: ["receipt voucher", "receive payment", "record receipt"],
    a: "Go to Receipt Voucher (F7), select the customer/party receiving from, enter the amount and mode, optionally allocate against outstanding invoices, add narration, and Post. This debits Cash/Bank and credits the party."
  },
  {
    id: "vou-005", category: "transactions",
    q: "What is a contra voucher used for?",
    keywords: ["contra voucher", "cash deposit bank", "internal transfer"],
    a: "Contra vouchers record transfers between your own cash and bank accounts: cash deposited to bank (Dr. Bank / Cr. Cash), cash withdrawn (Dr. Cash / Cr. Bank), or bank-to-bank transfers. No external party is involved."
  },
  {
    id: "vou-006", category: "transactions",
    q: "What are debit notes and credit notes?",
    keywords: ["debit note", "credit note", "supplier return note"],
    a: "A Debit Note is issued to a supplier (e.g., for returns or overcharges), increasing the amount receivable from them. A Credit Note is issued to a customer (returns, discounts, corrections), reducing what they owe."
  },
  {
    id: "vou-007", category: "transactions",
    q: "How do recurring vouchers work?",
    keywords: ["recurring voucher", "auto repeat entry", "monthly rent depreciation"],
    a: "Create a template with accounts/amounts and a frequency (Daily/Weekly/Monthly/Quarterly/Yearly) plus start (and optional end) date under Recurring Vouchers. When due, select templates and click 'Generate Selected' to auto-create and post the actual voucher entries."
  },
  {
    id: "vou-008", category: "transactions",
    q: "How does the Bill Allocation Panel and FIFO auto-fill work?",
    keywords: ["bill allocation", "fifo allocation", "allocate payment to bills"],
    a: "When paying/receiving from a party, the Bill Allocation Panel lists their outstanding bills with due dates and overdue days. Click 'Auto-fill (FIFO)' to allocate the payment to the oldest bills first automatically, or manually enter allocation amounts per bill; any unallocated balance posts as an advance."
  },
  {
    id: "vou-009", category: "transactions",
    q: "How does the voucher approval workflow work?",
    keywords: ["approval workflow", "draft submitted approved posted"],
    a: "Vouchers move through Draft → Submitted → Under Review → Approved → Posted. Accountants submit; Managers review/approve or reject; Admins can perform any step. A rejected voucher returns to Draft with a reason banner for correction and resubmission."
  },
  {
    id: "vou-010", category: "transactions",
    q: "How do I clone a voucher?",
    keywords: ["clone voucher", "duplicate voucher", "copy entry"],
    a: "Click 'Clone This Voucher' on a saved voucher — it creates an exact copy with today's date, a cleared voucher number, and Draft status. Edit and post the clone independently, which is handy for recurring similar entries."
  },
  {
    id: "pos-001", category: "transactions",
    q: "How do I open a POS session?",
    keywords: ["open pos session", "pos opening cash"],
    a: "Go to POS Mode and click 'Open Session', then enter the Opening Cash (drawer float) and confirm. You must have an open session before creating any POS sales."
  },
  {
    id: "pos-002", category: "transactions",
    q: "What is POS Mode?",
    keywords: ["pos mode", "point of sale"],
    a: "POS (Point of Sale) Mode is a fast retail billing interface with barcode scanning support, item grid display for quick selection, cart management, split payments, bill holding and recall, day close, session management, and receipt printing."
  },
  {
    id: "pos-003", category: "transactions",
    q: "How do I process a POS sale?",
    keywords: ["process pos sale", "create pos bill"],
    a: "Ensure POS session is open. Select date and warehouse. Choose customer or leave as 'Walk-in Customer'. Scan barcode or search/select items. Adjust quantities/rates/discounts. Apply bill-level discount. Select payment modes (must be >= total). Click Save Bill."
  },
  {
    id: "pos-004", category: "transactions",
    q: "What payment methods are supported in POS?",
    keywords: ["payment methods pos", "split payments"],
    a: "Cash, Card, Wallet (eSewa/Khalti/Fonepay QR), Bank Transfer, and Credit. You can split a single bill across multiple payment methods. Quick-set buttons auto-fill the bill total to the selected payment mode."
  },
  {
    id: "pos-005", category: "transactions",
    q: "How do held bills work?",
    keywords: ["held bills", "hold bill"],
    a: "Held Bills allow suspending a cart for later recall. Click 'Hold', enter a name (e.g., 'Table 4'). Later, go to 'Held Bills' tab and click 'Recall' to restore the cart and complete the sale, or 'Delete' to remove it."
  },
  {
    id: "pos-006", category: "transactions",
    q: "How does day close work?",
    keywords: ["day close", "close session"],
    a: "Day Close reconciles POS sales. It shows Opening Cash + Cash Sales = Expected Cash. You enter Actual Closing Cash. The variance is recorded. The session is closed and a day report can be exported."
  },
  {
    id: "pos-007", category: "transactions",
    q: "How does POS session history work?",
    keywords: ["session history", "past sessions"],
    a: "Session History shows all past POS sessions with Date, Cashier, Opened/Closed time, Opening/Expected/Closing Cash, Variance, and Status. Variances >1 are highlighted in red."
  },
  {
    id: "pos-008", category: "transactions",
    q: "How do I print a POS receipt?",
    keywords: ["print pos receipt", "thermal print"],
    a: "After saving a bill, the receipt modal appears showing company details, items, totals, and payment breakdown. Click 'Print' to open in a new window for printing (thermal-style or A4)."
  },
  {
    id: "vou-011", category: "transactions",
    q: "How do I perform a stock transfer?",
    keywords: ["stock transfer", "inter branch transfer"],
    a: "Go to Transactions → Inventory → Stock Transfer. Select From and To Warehouses, add items with qty/rate, and post. This creates stock-transfer-out and stock-transfer-in movements."
  },
  {
    id: "vou-012", category: "transactions",
    q: "What is a stock journal?",
    keywords: ["stock journal", "inventory adjustment"],
    a: "A stock journal is used for inventory adjustments without affecting financial accounts directly. Use cases: adjusting stock quantities (write-off, damage), correcting stock valuation, recording opening stock."
  },
  {
    id: "vou-013", category: "transactions",
    q: "How does physical stock counting work?",
    keywords: ["physical stock", "stock count"],
    a: "Physical Stock pages let you record actual counted quantities. Select warehouse, enter counted qty per item. The system compares with book quantity and records surplus or shortage. Adjustments can be posted to correct stock."
  },
  {
    id: "vou-014", category: "transactions",
    q: "How does production voucher work?",
    keywords: ["production voucher", "manufacturing"],
    a: "Production vouchers record manufacturing. Input (Consumption): Raw materials consumed from stock. Output (Production): Finished goods produced and added to stock. BOM can auto-fill requirements."
  },
  {
    id: "vou-015", category: "transactions",
    q: "How does the document workflow chain work?",
    keywords: ["workflow chain", "document trail"],
    a: "Sales: Quotation → Sales Order → Delivery Challan → Sales Invoice. Purchase: Purchase Requisition → Purchase Order → GRN → Purchase Invoice. DocumentTrailPanel shows the complete chain."
  },
  {
    id: "vou-016", category: "transactions",
    q: "What are workflow alerts?",
    keywords: ["workflow alerts", "pending actions"],
    a: "WorkflowAlertsWidget shows pending actions like Purchase Orders pending GRN >7 days, GRNs pending billing, Sales Orders pending dispatch >7 days, Delivery Challans pending billing."
  },
  {
    id: "vou-017", category: "transactions",
    q: "How do I resubmit a failed CBMS invoice?",
    keywords: ["resubmit cbms", "retry cbms sync"],
    a: "Click the CBMS status badge on the invoice. In the CBMS Status modal, click 'Resubmit'. The system re-attempts submission. On success, IRN is updated."
  }
];
