// src/store/falconStore.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type FalconRole = "user" | "assistant";

export interface FalconMessage {
  id: string;
  role: FalconRole;
  content: string;
  createdAt: string;
  suggestions?: string[];
  feedback?: 1 | -1;
}

interface FalconContext {
  route?: string;
  screenTitle?: string;
}

interface FalconState {
  isOpen: boolean;
  isTyping: boolean;
  messages: FalconMessage[];
  context: FalconContext;

  openPanel: () => void;
  closePanel: () => void;
  togglePanel: () => void;
  setContext: (context: Partial<FalconContext>) => void;

  sendMessage: (text: string) => Promise<void>;
  rateMessage: (id: string, feedback: 1 | -1) => void;
  clearHistory: () => void;
}

const now = () => new Date().toISOString();

const makeId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `falcon-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const WELCOME_MESSAGE: FalconMessage = {
  id: "welcome",
  role: "assistant",
  createdAt: now(),
  content:
    "Namaste! I’m Falcon, your Sutra ERP assistant. Ask me how to create vouchers, invoices, masters, reports, VAT reports, stock entries, company settings, users, audit logs, print/export, or shortcuts. I only guide you — I will not change your data.",
  suggestions: [
    "How do I create a sales invoice?",
    "How do I see Profit & Loss?",
    "How do I add a new party?",
    "How do I configure company settings?",
  ],
};

type KnowledgeDoc = {
  id: string;
  title: string;
  keywords: string[];
  answer: string;
  suggestions?: string[];
};

const docs: KnowledgeDoc[] = [
  {
    id: "overview",
    title: "Sutra ERP overview",
    keywords: ["overview", "what is sutra", "how works", "modules", "dashboard", "home"],
    answer: `Sutra ERP is an accounting and inventory ERP for Nepali businesses.

Main areas:
1. Masters — Chart of Accounts, Parties, Items, Units, Warehouses, Item Groups, Bill Sundries, Voucher Types.
2. Transactions — Sales Invoice, Purchase Invoice, Journal, Payment, Receipt, Contra, Debit/Credit Note, Stock Transfer, Delivery Challan, GRN.
3. Reports — Trial Balance, Profit & Loss, Balance Sheet, General Ledger, Day Book, VAT Reports, Stock Reports, Aging and Outstanding.
4. Company/Utilities — Fiscal Year, Company Settings, Users, Audit Logs, Backup/Restore, Inventory Configuration.
5. POS — Fast retail billing, split payment, held bills and day close.

Use the top menu or right shortcut bar to move around. Falcon can explain any screen step-by-step.`,
    suggestions: ["Explain masters", "Explain transactions", "Explain reports", "What are shortcuts?"],
  },
  {
    id: "company-settings",
    title: "Company settings",
    keywords: [
      "company settings",
      "company info",
      "pan",
      "vat number",
      "currency",
      "date format",
      "fiscal year",
      "features",
      "configuration",
      "settings",
    ],
    answer: `To update company settings:

1. Open Company / Utilities menu.
2. Go to Company Settings or System Settings.
3. Update company name, address, phone, email, PAN/VAT number, currency symbol and invoice prefix.
4. Enable features like:
   - Cost Center
   - Bill-wise tracking
   - Batch/expiry tracking
   - TDS
   - Multi-currency
5. Save settings.

Important:
- PAN should be 9 digits for Nepal.
- VAT and tax details are used in invoice printing and VAT reports.
- Fiscal year must be configured correctly because reports filter by date and fiscal period.`,
    suggestions: ["How to setup fiscal year?", "How to enable bill-wise tracking?", "How to see audit logs?"],
  },
  {
    id: "login-users",
    title: "Login, users and security",
    keywords: ["login", "user", "users", "password", "role", "roles", "security", "audit", "logout"],
    answer: `Sutra ERP uses company login and user roles.

Common tasks:
1. Add/edit users from Users Management.
2. Assign roles like admin/accountant/operator depending on access.
3. Use Change Password to update a user's password.
4. Audit Logs show who created, updated, deleted or logged in.
5. Logout from the profile/logout button or sidebar logout.

Security tips:
- Keep admin account limited to trusted users.
- Use audit logs for compliance checking.
- Do not share passwords.
- For suspicious activity, check Audit Log and user list.`,
    suggestions: ["How do I view audit logs?", "How do I change password?", "How do roles work?"],
  },
  {
    id: "chart-of-accounts",
    title: "Chart of Accounts",
    keywords: ["chart of accounts", "coa", "ledger", "account", "group", "account group", "capital", "cash", "bank"],
    answer: `Chart of Accounts stores all accounting ledgers and groups.

How to add a ledger:
1. Open Masters → Chart of Accounts.
2. Click Add Ledger.
3. Enter Account Name.
4. Select Account Group, such as Cash-in-Hand, Bank Accounts, Sundry Debtors, Sundry Creditors, Sales, Purchase, Expenses, etc.
5. Choose Account Type:
   - General Ledger
   - Party
   - Bank
   - Cash
6. Enter opening balance if required.
7. Save.

How to add a group:
1. Click Add Group.
2. Choose Primary Group or Sub-Group.
3. Select parent group if it is a sub-group.
4. Save.

Tip:
- Customers/suppliers are normally managed from Parties Directory, but linked ledgers affect accounting reports.`,
    suggestions: ["How do I add a party?", "Which ledger group for bank?", "How to view ledger report?"],
  },
  {
    id: "parties",
    title: "Parties Directory",
    keywords: ["party", "parties", "customer", "supplier", "debtor", "creditor", "pan", "vat", "opening balance"],
    answer: `Parties Directory is used for customers and suppliers.

To add a party:
1. Open Masters → Parties Directory.
2. Click Add Party.
3. Enter party name.
4. Select type: Customer, Supplier, or Both.
5. Enter PAN/VAT number, phone, email, address, province/district.
6. Enter opening balance if applicable.
7. Save.

Where parties are used:
- Sales invoices use customer parties.
- Purchase invoices use supplier parties.
- Receipts and payments can be allocated party-wise.
- Outstanding and Aging reports use party balances and bill-wise details.`,
    suggestions: ["How do I create sales invoice?", "How do I see aging report?", "How do I add opening balance?"],
  },
  {
    id: "items-stock",
    title: "Items, Stock Book and inventory masters",
    keywords: [
      "item",
      "items",
      "stock",
      "stock book",
      "inventory",
      "item master",
      "item group",
      "unit",
      "warehouse",
      "godown",
      "batch",
    ],
    answer: `Inventory is managed through item and stock screens.

Important screens:
1. Item Groups — categorise items.
2. Item Master / Stock Book — create and manage stock items.
3. Units — create units like PCS, KG, BOX.
4. Unit Conversion — define conversions if needed.
5. Warehouses — define godowns/stock locations.
6. Batch Management — track batch/expiry if enabled.

To add an item:
1. Open Masters → Item Master or Stock Book.
2. Add item name, code/SKU, unit, purchase rate, sales rate.
3. Set VAT/taxable status.
4. Configure opening stock if available.
5. Save.

Stock updates happen from purchase invoices, sales invoices, stock transfer, stock journal, GRN, delivery challan and physical stock.`,
    suggestions: ["How to do stock transfer?", "How to see stock summary?", "How to create purchase invoice?"],
  },
  {
    id: "sales-invoice",
    title: "Sales Invoice",
    keywords: ["sales invoice", "sale", "billing", "invoice", "customer invoice", "tax invoice", "print invoice"],
    answer: `To create a Sales Invoice:

1. Open Transactions → Sales → Sales Invoice, or page Billing.
2. Select Customer.
3. Confirm invoice date and due date.
4. Add line items:
   - Item
   - Qty
   - Unit
   - Rate
   - Discount %
   - VAT taxable status
   - Warehouse if enabled
5. Check bill sundries if you need freight, discount or other adjustments.
6. Choose payment mode:
   - Cash
   - Bank
   - Credit
7. Add narration or attachment if required.
8. Save as Draft or Post invoice.
9. After posting, print the invoice if needed.

What happens after posting:
- Sales ledger is credited.
- Customer/cash/bank is debited.
- VAT payable is recorded if VAT exists.
- Stock is reduced for inventory items.
- CBMS sync may run if enabled.`,
    suggestions: ["How do I print invoice?", "How does VAT calculate?", "How do I see sales report?"],
  },
  {
    id: "purchase-invoice",
    title: "Purchase Invoice",
    keywords: ["purchase invoice", "purchase", "supplier invoice", "buy", "input vat"],
    answer: `To create a Purchase Invoice:

1. Open Transactions → Purchase → Purchase Invoice.
2. Select Supplier.
3. Enter date, reference number and due date.
4. Add items with qty, rate, VAT and warehouse.
5. Add bill sundries if required.
6. Choose payment mode: Cash, Bank or Credit.
7. Save Draft or Post.

What happens after posting:
- Purchase account is debited.
- VAT input is recorded if taxable.
- Supplier/cash/bank is credited.
- Stock is increased for inventory items.

Use Purchase Register, General Ledger, Stock Summary and VAT Reports to verify results.`,
    suggestions: ["How do I see VAT report?", "How do I pay supplier?", "How do I create GRN?"],
  },
  {
    id: "returns",
    title: "Sales Return and Purchase Return",
    keywords: ["sales return", "purchase return", "return invoice", "credit note", "debit note"],
    answer: `Returns are handled from the billing invoice form using return tabs.

Sales Return:
- Used when customer returns sold goods.
- Stock increases.
- Customer balance decreases.
- Sales return/credit note effect is posted.

Purchase Return:
- Used when goods are returned to supplier.
- Stock decreases.
- Supplier balance decreases.
- Purchase return/debit note effect is posted.

Steps:
1. Open Billing / Invoice screen.
2. Choose Sales Return or Purchase Return tab.
3. Select party and items.
4. Enter quantities and rates.
5. Post and print if required.`,
    suggestions: ["How do I create credit note?", "How do I check stock ledger?", "How do I view party statement?"],
  },
  {
    id: "journal",
    title: "Journal Voucher",
    keywords: ["journal", "journal entry", "voucher", "debit", "credit", "adjustment", "entry"],
    answer: `Journal Voucher is used for accounting adjustments where debit and credit must balance.

Steps:
1. Open Transactions → Finance → Journal Voucher.
2. Select date.
3. Add ledger lines.
4. Enter Debit or Credit amount on each line.
5. Make sure Total Debit = Total Credit.
6. Add narration.
7. Save/Post.

Examples:
- Expense accrual
- Depreciation
- Opening adjustment
- Inter-branch adjustment
- TDS or VAT adjustment

Rule:
Every journal must be balanced. If unbalanced, Sutra ERP will not allow posting.`,
    suggestions: ["Show examples of journal entry", "How to see day book?", "How to view ledger report?"],
  },
  {
    id: "payment-receipt-contra",
    title: "Payment, Receipt and Contra Vouchers",
    keywords: ["payment", "receipt", "contra", "cash", "bank", "cheque", "receive money", "pay supplier"],
    answer: `Payment, Receipt and Contra are finance vouchers.

Receipt Voucher:
- Use when receiving money from customer or other source.
- Debit Cash/Bank.
- Credit Customer or income/ledger.

Payment Voucher:
- Use when paying supplier or expense.
- Debit Supplier/Expense.
- Credit Cash/Bank.

Contra Voucher:
- Use for cash-to-bank, bank-to-cash, or bank-to-bank transfers.
- Example: cash deposit to bank.

General steps:
1. Open the voucher screen.
2. Select date.
3. Choose party/ledger.
4. Enter amount.
5. Select cash/bank account.
6. Add cheque/reference details if required.
7. Save/Post.`,
    suggestions: ["How do I allocate bills?", "How do I see outstanding?", "How do I reconcile bank?"],
  },
  {
    id: "stock-transfer",
    title: "Stock Transfer and warehouses",
    keywords: ["stock transfer", "warehouse transfer", "godown transfer", "multi godown", "inter branch"],
    answer: `Stock Transfer moves stock from one warehouse/godown to another.

Steps:
1. Open Transactions → Inventory → Stock Transfer.
2. Select From Warehouse and To Warehouse.
3. Add items with quantity and rate.
4. Save/Post transfer.
5. Stock reduces from source and increases in destination.

For inter-branch transfer:
- Sutra may also create accounting voucher if inter-branch accounting is enabled.
- Use Stock Ledger and Stock Summary to verify movement.`,
    suggestions: ["How do I add warehouse?", "How do I see stock summary?", "How do I do physical stock?"],
  },
  {
    id: "challan-grn",
    title: "Delivery Challan and GRN",
    keywords: ["delivery challan", "challan", "grn", "goods receipt", "dispatch", "receive goods"],
    answer: `Delivery Challan and GRN manage goods movement before invoicing.

Delivery Challan:
1. Select customer.
2. Add items and warehouse.
3. Enter dispatch/vehicle/driver details.
4. Dispatch challan.
5. Inventory can be posted on dispatch.
6. Later create sales invoice from challan.

GRN:
1. Select supplier.
2. Add ordered, received, accepted and rejected quantities.
3. Select warehouse.
4. Mark received.
5. Inventory can be posted on receive.
6. Later create purchase invoice from GRN.`,
    suggestions: ["How to create sales invoice?", "How to create purchase invoice?", "How to view stock ledger?"],
  },
  {
    id: "reports",
    title: "Reports overview",
    keywords: ["report", "reports", "financial statements", "export", "print", "filter"],
    answer: `Sutra ERP reports are available from Reports menu.

Main reports:
- Trial Balance
- Profit & Loss
- Balance Sheet
- Cash Flow
- Day Book
- General Ledger
- Party Statement
- Outstanding Receivables/Payables
- Aging Report
- VAT Reports
- Stock Summary
- Stock Ledger
- Sales Analysis

Common report usage:
1. Open report.
2. Select date range or fiscal year.
3. Apply party/account/item/warehouse filters if available.
4. Generate or refresh.
5. Export/print if needed.

If report totals look wrong:
- Check voucher posting status.
- Confirm fiscal year/date range.
- Check ledger groups.
- Verify opening balances.`,
    suggestions: ["How to see Profit & Loss?", "How to see Balance Sheet?", "How to see VAT reports?"],
  },
  {
    id: "trial-balance",
    title: "Trial Balance",
    keywords: ["trial balance", "tb", "debit credit report"],
    answer: `Trial Balance shows all ledger debit and credit balances.

Steps:
1. Open Reports → Financial → Trial Balance.
2. Select date range/fiscal year.
3. Generate report.
4. Check total debit and total credit.

If Trial Balance does not match:
- Look for unbalanced vouchers.
- Check manually created journal entries.
- Verify opening balances.
- Review Day Book and General Ledger.`,
    suggestions: ["How to fix unbalanced voucher?", "How to see day book?", "How to add opening balance?"],
  },
  {
    id: "profit-loss",
    title: "Profit and Loss",
    keywords: ["profit loss", "profit & loss", "p&l", "income", "expense"],
    answer: `Profit & Loss shows income, expenses and net profit/loss.

Steps:
1. Open Reports → Financial → Profit & Loss.
2. Select date range.
3. Generate report.
4. Review direct income, indirect income, direct expenses and indirect expenses.

If figures are wrong:
- Make sure ledgers are under correct groups.
- Sales ledgers should be income.
- Purchase/expense ledgers should be expense.
- Check date range and posted status.`,
    suggestions: ["How do I group ledgers correctly?", "How to see Balance Sheet?", "How to export report?"],
  },
  {
    id: "balance-sheet",
    title: "Balance Sheet",
    keywords: ["balance sheet", "assets", "liabilities", "capital", "equity"],
    answer: `Balance Sheet shows Assets, Liabilities and Capital.

Steps:
1. Open Reports → Financial → Balance Sheet.
2. Select date/as-on date.
3. Generate report.
4. Review assets, liabilities, capital and current balances.

If Balance Sheet looks incorrect:
- Check opening balances.
- Check ledger group classification.
- Ensure P&L transfer/current profit is considered.
- Confirm fiscal year and date filters.`,
    suggestions: ["How do I set opening balances?", "How to see Trial Balance?", "How to classify accounts?"],
  },
  {
    id: "ledger-daybook",
    title: "General Ledger and Day Book",
    keywords: ["ledger report", "general ledger", "party statement", "day book", "book"],
    answer: `General Ledger:
1. Open Reports → Financial → General Ledger.
2. Select ledger/account.
3. Choose date range.
4. Generate to see all debit/credit entries.

Party Statement:
1. Open Party Statement.
2. Select customer/supplier.
3. Choose date range.
4. View invoice/payment history.

Day Book:
1. Open Day Book.
2. Select date range.
3. View all vouchers/invoices posted in date order.

Use these reports to trace wrong balances.`,
    suggestions: ["How do I trace wrong balance?", "How to see outstanding?", "How to export ledger?"],
  },
  {
    id: "vat",
    title: "VAT Reports and CBMS",
    keywords: ["vat", "tax", "cbms", "ird", "gstr", "annex", "vat report", "input vat", "output vat"],
    answer: `VAT Reports help verify taxable sales, taxable purchases, input VAT and output VAT.

Steps:
1. Open Reports → GST/VAT → VAT Reports.
2. Select date range.
3. Generate VAT summary or annex reports.
4. Review:
   - Sales taxable amount
   - Purchase taxable amount
   - Output VAT
   - Input VAT
   - Net VAT payable

For CBMS:
- Enable CBMS in company settings if available.
- Posted invoices may sync with CBMS.
- CBMS status badge shows pending/submitted/failed.

If VAT report is wrong:
- Check invoice VAT taxable checkbox.
- Check party PAN/VAT.
- Check date range.
- Check posted/cancelled status.`,
    suggestions: ["How does VAT calculate?", "How do I fix CBMS failed?", "How to print invoice?"],
  },
  {
    id: "outstanding-aging",
    title: "Outstanding and Aging reports",
    keywords: ["outstanding", "receivable", "payable", "aging", "ageing", "due", "bill wise"],
    answer: `Outstanding and Aging reports show unpaid customer/supplier balances.

Outstanding Receivables:
- Shows customer invoices still pending.

Outstanding Payables:
- Shows supplier bills still pending.

Aging Report:
- Groups balances by age, such as 0-30, 31-60, 61-90 days.

For best results:
1. Enable bill-wise tracking in company settings.
2. Use credit invoices correctly.
3. Record receipts/payments against parties.
4. Use due dates on invoices.`,
    suggestions: ["How to receive customer payment?", "How to pay supplier?", "How to enable bill-wise tracking?"],
  },
  {
    id: "pos",
    title: "POS Mode",
    keywords: ["pos", "retail", "barcode", "cashier", "day close", "hold bill", "session"],
    answer: `POS Mode is for fast retail billing.

Typical flow:
1. Open POS Mode.
2. Open POS Session with opening cash.
3. Select warehouse and customer or walk-in customer.
4. Scan barcode or search item.
5. Add items to cart.
6. Apply discount and VAT.
7. Select payment: cash/card/wallet/bank/credit.
8. Save bill and print receipt.
9. Use Held Bills to suspend/recall carts.
10. Use Day Close to reconcile cash.
11. Close POS Session at end of day.

Day Close shows bills, sales, cash, card/wallet/bank, credit and expected cash.`,
    suggestions: ["How do I close POS day?", "How do I print POS receipt?", "How does held bill work?"],
  },
  {
    id: "shortcuts",
    title: "Keyboard shortcuts",
    keywords: ["shortcut", "keyboard", "f1", "f2", "f3", "f12", "hotkey"],
    answer: `Common Sutra ERP shortcuts:
- F1: Help/Dashboard
- F2: Save/New Sales depending on screen
- F3: Items or add ledger depending on screen
- F4: Accounts
- F5: Journal
- F6: Payment
- F7: Receipt
- F8: Contra/Delete depending on screen
- F9: Sales Invoice or delete row depending on entry screen
- F10: Purchase
- F11: Balance Sheet
- F12: Screen configuration

Right-side Quick Actions also show shortcuts.

Tip: When typing inside Falcon, shortcuts should not change accounting screens.`,
    suggestions: ["What is F12 configuration?", "How to save voucher?", "How to open reports?"],
  },
  {
    id: "print-export",
    title: "Print and export",
    keywords: ["print", "pdf", "export", "excel", "xlsx", "download", "invoice print"],
    answer: `Printing and export are available on many screens.

Invoices:
- After posting invoice, click Print.
- PDF opens in a new tab/window.
- Allow popups if browser blocks it.

Reports:
- Use Export/Excel or Print button if available.
- Some reports support print-only headers and no-print filters.

POS:
- Receipt opens in a small print window.
- If popup is blocked, allow popups for the site.

Troubleshooting:
- If print does not open, check popup blocker.
- If export fails, verify browser download permission.`,
    suggestions: ["How to print invoice?", "How to export VAT report?", "How to print POS receipt?"],
  },
  {
    id: "troubleshooting",
    title: "Troubleshooting",
    keywords: ["bug", "not working", "wrong", "error", "refresh", "slow", "blank", "problem"],
    answer: `Troubleshooting checklist:

1. If a report looks wrong:
   - Check date range.
   - Confirm vouchers are posted.
   - Check ledger groups.
   - Review Day Book and General Ledger.

2. If invoice/voucher cannot save:
   - Check required fields.
   - Check party/item selection.
   - Check debit = credit for journal.
   - Check date is within fiscal year.

3. If print does not work:
   - Allow popup windows.
   - Try browser print again.

4. If Falcon chat affects background screens:
   - Replace Falcon files with the safe version.
   - This version does not call accounting actions, navigation, refresh or database mutations.

5. If web refreshes unexpectedly:
   - Check browser extensions.
   - Check any custom code calling window.location.reload().
   - Run build and fix console errors.`,
    suggestions: ["How to debug wrong report?", "How to fix invoice save?", "How to check audit logs?"],
  },
];

const normalize = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^\w\s&/-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const tokenize = (value: string) => normalize(value).split(" ").filter(Boolean);

const scoreDoc = (query: string, doc: KnowledgeDoc) => {
  const q = normalize(query);
  const tokens = tokenize(query);
  let score = 0;

  const haystack = normalize([doc.title, ...doc.keywords, doc.answer].join(" "));

  for (const keyword of doc.keywords) {
    const k = normalize(keyword);
    if (q.includes(k)) score += 10 + k.length / 4;
  }

  for (const token of tokens) {
    if (token.length < 2) continue;
    if (haystack.includes(token)) score += token.length > 4 ? 3 : 1;
  }

  return score;
};

const findBestDocs = (question: string, limit = 3) => {
  return docs
    .map((doc) => ({ doc, score: scoreDoc(question, doc) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.doc);
};

const getPageHint = (route?: string) => {
  if (!route) return "";
  const pretty = route.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return `\n\nCurrent screen context: You appear to be on **${pretty}**. If your question is about this screen, tell me exactly what you want to do here and I’ll guide step-by-step.`;
};

const getFallbackAnswer = (question: string, route?: string) => {
  return `I can help with Sutra ERP, but I need a little more detail.

You can ask things like:
- “How do I create a sales invoice?”
- “How do I add a customer?”
- “How do I see VAT report?”
- “Why is Trial Balance not matching?”
- “How do I post payment voucher?”
- “How do I configure company settings?”
- “How do I use POS day close?”

I will explain the exact screen, fields, posting effect, reports to verify, and common mistakes.${getPageHint(route)}`;
};

const buildAnswer = (question: string, context: FalconContext) => {
  const q = normalize(question);

  const greetings = ["hi", "hello", "hey", "namaste", "नमस्ते"];
  if (greetings.includes(q)) {
    return {
      content:
        "Namaste! I’m ready. Ask me anything about Sutra ERP — invoices, vouchers, masters, inventory, VAT, reports, settings, users, audit logs or POS.",
      suggestions: [
        "How do I create sales invoice?",
        "How do I make journal entry?",
        "How do I see VAT report?",
        "How do I add item master?",
      ],
    };
  }

  if (q.includes("what can you do") || q.includes("help me")) {
    return {
      content: docs[0].answer + getPageHint(context.route),
      suggestions: docs[0].suggestions,
    };
  }

  const matches = findBestDocs(question, 3);

  if (matches.length === 0) {
    return {
      content: getFallbackAnswer(question, context.route),
      suggestions: [
        "Explain sales invoice",
        "Explain voucher entry",
        "Explain reports",
        "Explain company settings",
      ],
    };
  }

  const primary = matches[0];
  let content = primary.answer;

  if (matches.length > 1) {
    const related = matches
      .slice(1)
      .map((d) => `- ${d.title}`)
      .join("\n");
    content += `\n\nRelated topics I can also explain:\n${related}`;
  }

  content += getPageHint(context.route);

  return {
    content,
    suggestions:
      primary.suggestions || [
        "Tell me step by step",
        "What report should I check?",
        "What mistakes should I avoid?",
      ],
  };
};

export const useFalconStore = create<FalconState>()(
  persist(
    (set, get) => ({
      isOpen: false,
      isTyping: false,
      messages: [WELCOME_MESSAGE],
      context: {},

      openPanel: () => set({ isOpen: true }),
      closePanel: () => set({ isOpen: false }),
      togglePanel: () => set((state) => ({ isOpen: !state.isOpen })),

      setContext: (context) =>
        set((state) => ({
          context: {
            ...state.context,
            ...context,
          },
        })),

      sendMessage: async (text: string) => {
        const clean = text.trim();
        if (!clean) return;

        const userMessage: FalconMessage = {
          id: makeId(),
          role: "user",
          content: clean,
          createdAt: now(),
        };

        set((state) => ({
          messages: [...state.messages, userMessage],
          isTyping: true,
        }));

        // Small delay so the chat feels natural. No network, no DB, no app mutation.
        await new Promise((resolve) => setTimeout(resolve, 250));

        const { content, suggestions } = buildAnswer(clean, get().context);

        const assistantMessage: FalconMessage = {
          id: makeId(),
          role: "assistant",
          content,
          suggestions,
          createdAt: now(),
        };

        set((state) => ({
          messages: [...state.messages, assistantMessage],
          isTyping: false,
        }));
      },

      rateMessage: (id, feedback) =>
        set((state) => ({
          messages: state.messages.map((message) =>
            message.id === id ? { ...message, feedback } : message,
          ),
        })),

      clearHistory: () =>
        set({
          messages: [
            {
              ...WELCOME_MESSAGE,
              createdAt: now(),
            },
          ],
          isTyping: false,
        }),
    }),
    {
      name: "sutra-falcon-chat-v2",
      partialize: (state) => ({
        messages: state.messages.slice(-60),
        context: state.context,
      }),
    },
  ),
);
