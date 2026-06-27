import { computeLedgerTotals } from "./reportingHierarchy";

export type AccountType = "asset" | "liability" | "equity" | "income" | "expense";
export type AccountLevel = "group" | "subgroup" | "ledger";

export interface DBAccount {
  id: string;
  code: string;
  name: string;
  nameNepali?: string;
  type: AccountType;
  level: AccountLevel;
  parentId?: string;
  isGroup: boolean;
  isActive: boolean;
  balance?: number;
  openingBalance?: number;
  openingBalanceDr?: number;
  openingBalanceCr?: number;
  isSystemAccount?: boolean;
}

export interface DBVoucherLine {
  accountId: string;
  debit: number;
  credit: number;
}

export interface DBVoucher {
  id: string;
  voucherNo?: string;
  date: string;
  dateNepali?: string;
  status?: string;
  type?: string;
  lines: DBVoucherLine[];
}

export type NepalReportSection =
  | "equity"
  | "non-current-liability"
  | "current-liability"
  | "fixed-asset"
  | "non-current-asset"
  | "current-asset"
  | "revenue"
  | "cogs"
  | "indirect-expense"
  | "other-income";

export interface NepalGroupMapping {
  section: NepalReportSection;
  sortOrder: number;
}

export interface NepalStatementLine {
  id: string;
  label: string;
  labelNepali?: string;
  currentYear: number;
  previousYear: number;
  isTotal?: boolean;
  isGrandTotal?: boolean;
  isDeduction?: boolean;
  indent?: number;
  children?: NepalStatementLine[];
}

export interface BalanceSheetData {
  equity: NepalStatementLine[];
  nonCurrentLiabilities: NepalStatementLine[];
  currentLiabilities: NepalStatementLine[];
  nonCurrentAssets: NepalStatementLine[];
  fixedAssets: NepalStatementLine[];
  currentAssets: NepalStatementLine[];

  totalEquity: number;
  totalNonCurrentLiabilities: number;
  totalCurrentLiabilities: number;
  totalEquityAndLiabilities: number;

  totalNonCurrentAssets: number;
  totalFixedAssets: number;
  totalCurrentAssets: number;
  totalAssets: number;

  difference: number;
}

export interface ProfitLossData {
  revenue: NepalStatementLine[];
  otherIncome: NepalStatementLine[];
  cogs: NepalStatementLine[];
  indirectExpenses: NepalStatementLine[];
  taxExpenses: NepalStatementLine[];

  netSales: number;
  totalOtherIncome: number;
  totalIncome: number;
  costOfGoodsSold: number;
  totalIndirectExpenses: number;
  totalExpenses: number;
  profitBeforeTax: number;
  incomeTaxProvision: number;
  netProfitAfterTax: number;
}

function normalize(text: string): string {
  return (text || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[-_/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Maps your NAS-standard account group names to Nepal Companies Act / NAS vertical report sections.
 */
export function mapGroupToNepalFormat(groupName: string): NepalGroupMapping {
  const g = normalize(groupName);

  // =========================
  // EQUITY
  // =========================
  if (
    g.includes("equity") ||
    g.includes("capital account") ||
    g.includes("owner capital") ||
    g.includes("partner capital") ||
    g.includes("proprietor") ||
    g.includes("share capital")
  ) {
    return { section: "equity", sortOrder: 10 };
  }

  if (
    g.includes("reserves") ||
    g.includes("surplus") ||
    g.includes("retained earnings") ||
    g.includes("accumulated profit")
  ) {
    return { section: "equity", sortOrder: 20 };
  }

  // =========================
  // NON-CURRENT LIABILITIES
  // =========================
  if (
    g.includes("secured loans") ||
    g.includes("term loans") ||
    g.includes("long term loan") ||
    g.includes("long-term loan") ||
    g.includes("bank overdraft")
  ) {
    return { section: "non-current-liability", sortOrder: 110 };
  }

  if (
    g.includes("debenture") ||
    g.includes("bond")
  ) {
    return { section: "non-current-liability", sortOrder: 120 };
  }

  if (
    g.includes("deferred tax liability")
  ) {
    return { section: "non-current-liability", sortOrder: 130 };
  }

  if (
    g.includes("unsecured loans") ||
    g.includes("unsecured loan")
  ) {
    return { section: "non-current-liability", sortOrder: 140 };
  }

  // =========================
  // CURRENT LIABILITIES
  // =========================
  if (
    g.includes("current liabilities") ||
    g.includes("sundry creditors") ||
    g.includes("creditors") ||
    g.includes("bills payable") ||
    g.includes("advance from customers")
  ) {
    return { section: "current-liability", sortOrder: 210 };
  }

  if (
    g.includes("duties") ||
    g.includes("taxes") ||
    g.includes("vat payable") ||
    g.includes("tds payable") ||
    g.includes("income tax payable") ||
    g.includes("ssf payable") ||
    g.includes("pf payable") ||
    g.includes("custom duty")
  ) {
    return { section: "current-liability", sortOrder: 220 };
  }

  if (
    g.includes("provision") ||
    g.includes("gratuity") ||
    g.includes("leave") ||
    g.includes("tax provision")
  ) {
    return { section: "current-liability", sortOrder: 230 };
  }

  // =========================
  // FIXED ASSETS
  // =========================
  if (
    g.includes("fixed assets") ||
    g.includes("land") ||
    g.includes("building") ||
    g.includes("plant") ||
    g.includes("machinery") ||
    g.includes("furniture") ||
    g.includes("fixtures") ||
    g.includes("vehicles") ||
    g.includes("computer equipment") ||
    g.includes("office equipment") ||
    g.includes("intangible") ||
    g.includes("goodwill") ||
    g.includes("software") ||
    g.includes("accumulated depreciation") ||
    g.includes("accumulated amortization")
  ) {
    return { section: "fixed-asset", sortOrder: 310 };
  }

  // =========================
  // NON-CURRENT ASSETS
  // =========================
  if (
    g.includes("capital work in progress") ||
    g.includes("capital wip")
  ) {
    return { section: "non-current-asset", sortOrder: 320 };
  }

  if (
    g.includes("long term investment") ||
    g.includes("long-term investment")
  ) {
    return { section: "non-current-asset", sortOrder: 330 };
  }

  // =========================
  // CURRENT ASSETS
  // =========================
  if (
    g.includes("current assets") ||
    g.includes("inventories") ||
    g.includes("inventory") ||
    g.includes("closing stock") ||
    g.includes("sundry debtors") ||
    g.includes("debtors") ||
    g.includes("bills receivable") ||
    g.includes("advance to suppliers") ||
    g.includes("advance to employees") ||
    g.includes("prepaid") ||
    g.includes("tds receivable") ||
    g.includes("vat receivable") ||
    g.includes("input vat") ||
    g.includes("cash") ||
    g.includes("bank accounts") ||
    g.includes("bank balances") ||
    g.includes("short term investment") ||
    g.includes("short-term investment") ||
    g.includes("loans and advances")
  ) {
    return { section: "current-asset", sortOrder: 410 };
  }

  // =========================
  // REVENUE
  // =========================
  if (
    g.includes("sales accounts") ||
    g.includes("local taxable sales") ||
    g.includes("local exempt sales") ||
    g.includes("export sales") ||
    g.includes("sales")
  ) {
    return { section: "revenue", sortOrder: 510 };
  }

  // =========================
  // OTHER INCOME
  // =========================
  if (
    g.includes("other income") ||
    g.includes("interest income") ||
    g.includes("discount received") ||
    g.includes("commission received") ||
    g.includes("miscellaneous income")
  ) {
    return { section: "other-income", sortOrder: 520 };
  }

  // =========================
  // COGS / DIRECT EXPENSES
  // =========================
  if (
    g.includes("purchase accounts") ||
    g.includes("local taxable purchase") ||
    g.includes("local exempt purchase") ||
    g.includes("import purchase") ||
    g.includes("direct expenses") ||
    g.includes("freight inward") ||
    g.includes("cartage") ||
    g.includes("labour") ||
    g.includes("wages") ||
    g.includes("manufacturing")
  ) {
    return { section: "cogs", sortOrder: 610 };
  }

  // =========================
  // INDIRECT EXPENSES
  // =========================
  if (
    g.includes("indirect expenses") ||
    g.includes("admin") ||
    g.includes("administrative") ||
    g.includes("rent") ||
    g.includes("electricity") ||
    g.includes("telephone") ||
    g.includes("office supplies") ||
    g.includes("printing") ||
    g.includes("stationery") ||
    g.includes("postage") ||
    g.includes("salary") ||
    g.includes("staff") ||
    g.includes("allowance") ||
    g.includes("ssf employer") ||
    g.includes("pf employer") ||
    g.includes("staff welfare") ||
    g.includes("dashain bonus") ||
    g.includes("gratuity expense") ||
    g.includes("leave encashment") ||
    g.includes("financial expenses") ||
    g.includes("bank charges") ||
    g.includes("interest expense") ||
    g.includes("loan processing") ||
    g.includes("depreciation")
  ) {
    return { section: "indirect-expense", sortOrder: 620 };
  }

  if (
    g.includes("tax expenses") ||
    g.includes("income tax expense") ||
    g.includes("deferred tax")
  ) {
    return { section: "indirect-expense", sortOrder: 630 };
  }

  // Safe fallback
  return { section: "current-asset", sortOrder: 999 };
}

/**
 * Adapter for unknown computeLedgerTotals() output shapes.
 * Supports:
 * - Record<accountId, number>
 * - Array<{ accountId, closingBalance | balance | amount }>
 */
export function normalizeLedgerTotals(raw: any): Record<string, number> {
  if (!raw) return {};

  if (Array.isArray(raw)) {
    return raw.reduce<Record<string, number>>((acc, row) => {
      const id = row.accountId || row.id;
      acc[id] = Number(row.closingBalance ?? row.balance ?? row.amount ?? 0);
      return acc;
    }, {});
  }

  return Object.fromEntries(
    Object.entries(raw).map(([key, value]: [string, any]) => [
      key,
      Number(value?.closingBalance ?? value?.balance ?? value ?? 0),
    ]),
  );
}

function getChildren(accounts: DBAccount[], parentId?: string): DBAccount[] {
  return accounts
    .filter((a) => a.parentId === parentId)
    .sort((a, b) => a.code.localeCompare(b.code));
}

function getDescendants(accounts: DBAccount[], parentId: string): DBAccount[] {
  const children = getChildren(accounts, parentId);
  return children.flatMap((child) => [
    child,
    ...getDescendants(accounts, child.id),
  ]);
}

function getAccountBalance(
  account: DBAccount,
  accounts: DBAccount[],
  totals: Record<string, number>,
): number {
  if (!account.isGroup) {
    return Number(totals[account.id] || 0);
  }

  const descendants = getDescendants(accounts, account.id).filter((a) => !a.isGroup);
  return descendants.reduce((sum, ledger) => sum + Number(totals[ledger.id] || 0), 0);
}

function buildSectionLines(
  accounts: DBAccount[],
  currentTotals: Record<string, number>,
  previousTotals: Record<string, number>,
  section: NepalReportSection,
  options?: {
    accountType?: AccountType[];
    invertSign?: boolean;
    deductionKeywords?: string[];
  },
): NepalStatementLine[] {
  const accountTypes = options?.accountType || [];
  const deductionKeywords = options?.deductionKeywords || [];

  const roots = accounts
    .filter((a) => {
      if (!a.isGroup) return false;
      if (a.parentId) return false;
      if (accountTypes.length && !accountTypes.includes(a.type)) return false;
      return true;
    })
    .flatMap((root) => [root, ...getDescendants(accounts, root.id)])
    .filter((a) => a.isGroup)
    .filter((a) => mapGroupToNepalFormat(a.name).section === section)
    .sort((a, b) => {
      const ma = mapGroupToNepalFormat(a.name);
      const mb = mapGroupToNepalFormat(b.name);
      if (ma.sortOrder !== mb.sortOrder) return ma.sortOrder - mb.sortOrder;
      return a.code.localeCompare(b.code);
    });

  const unique = Array.from(new Map(roots.map((a) => [a.id, a])).values());

  return unique
    .map<NepalStatementLine>((account) => {
      const rawCurrent = getAccountBalance(account, accounts, currentTotals);
      const rawPrevious = getAccountBalance(account, accounts, previousTotals);

      const isDeduction = deductionKeywords.some((k) =>
        normalize(account.name).includes(normalize(k)),
      );

      const sign = options?.invertSign ? -1 : 1;
      const deductionSign = isDeduction ? -1 : 1;

      const children = getDescendants(accounts, account.id)
        .filter((a) => !a.isGroup)
        .map<NepalStatementLine>((ledger) => ({
          id: ledger.id,
          label: ledger.name,
          labelNepali: ledger.nameNepali,
          currentYear: Number(totalsRound((currentTotals[ledger.id] || 0) * sign * deductionSign)),
          previousYear: Number(totalsRound((previousTotals[ledger.id] || 0) * sign * deductionSign)),
          indent: 1,
        }))
        .filter((x) => x.currentYear !== 0 || x.previousYear !== 0);

      return {
        id: account.id,
        label: account.name,
        labelNepali: account.nameNepali,
        currentYear: totalsRound(rawCurrent * sign * deductionSign),
        previousYear: totalsRound(rawPrevious * sign * deductionSign),
        isDeduction,
        children,
      };
    })
    .filter((x) => x.currentYear !== 0 || x.previousYear !== 0 || (x.children?.length || 0) > 0);
}

function totalsRound(value: number): number {
  return Math.round(value * 100) / 100;
}

function total(lines: NepalStatementLine[]): number {
  return totalsRound(lines.reduce((sum, line) => sum + line.currentYear, 0));
}

function totalPrevious(lines: NepalStatementLine[]): number {
  return totalsRound(lines.reduce((sum, line) => sum + line.previousYear, 0));
}

export function buildBalanceSheetData(args: {
  accounts: DBAccount[];
  currentVouchers: DBVoucher[];
  previousVouchers: DBVoucher[];
  asAtDate?: string;
  previousAsAtDate?: string;
}): BalanceSheetData {
  const currentTotals = normalizeLedgerTotals(
    computeLedgerTotals(args.accounts, args.currentVouchers, args.asAtDate),
  );

  const previousTotals = normalizeLedgerTotals(
    computeLedgerTotals(args.accounts, args.previousVouchers, args.previousAsAtDate),
  );

  const equity = buildSectionLines(
    args.accounts,
    currentTotals,
    previousTotals,
    "equity",
    { accountType: ["equity"], invertSign: true }, // Adjusted per hint in point 6 if engine uses negative for Cr
  );

  const nonCurrentLiabilities = buildSectionLines(
    args.accounts,
    currentTotals,
    previousTotals,
    "non-current-liability",
    { accountType: ["liability"], invertSign: true },
  );

  const currentLiabilities = buildSectionLines(
    args.accounts,
    currentTotals,
    previousTotals,
    "current-liability",
    { accountType: ["liability"], invertSign: true },
  );

  const fixedAssets = buildSectionLines(
    args.accounts,
    currentTotals,
    previousTotals,
    "fixed-asset",
    {
      accountType: ["asset"],
      invertSign: false,
      deductionKeywords: ["accumulated depreciation", "accumulated amortization"],
    },
  );

  const nonCurrentAssets = buildSectionLines(
    args.accounts,
    currentTotals,
    previousTotals,
    "non-current-asset",
    { accountType: ["asset"], invertSign: false },
  );

  const currentAssets = buildSectionLines(
    args.accounts,
    currentTotals,
    previousTotals,
    "current-asset",
    { accountType: ["asset"], invertSign: false },
  );

  const totalEquity = total(equity);
  const totalNonCurrentLiabilities = total(nonCurrentLiabilities);
  const totalCurrentLiabilities = total(currentLiabilities);
  const totalEquityAndLiabilities = totalsRound(
    totalEquity + totalNonCurrentLiabilities + totalCurrentLiabilities,
  );

  const totalFixedAssets = total(fixedAssets);
  const totalNonCurrentAssets = total(nonCurrentAssets);
  const totalCurrentAssets = total(currentAssets);
  const totalAssets = totalsRound(
    totalFixedAssets + totalNonCurrentAssets + totalCurrentAssets,
  );

  return {
    equity,
    nonCurrentLiabilities,
    currentLiabilities,
    nonCurrentAssets,
    fixedAssets,
    currentAssets,

    totalEquity,
    totalNonCurrentLiabilities,
    totalCurrentLiabilities,
    totalEquityAndLiabilities,

    totalNonCurrentAssets,
    totalFixedAssets,
    totalCurrentAssets,
    totalAssets,

    difference: totalsRound(totalAssets - totalEquityAndLiabilities),
  };
}

export function buildProfitLossData(args: {
  accounts: DBAccount[];
  currentVouchers: DBVoucher[];
  previousVouchers: DBVoucher[];
  fromDate?: string;
  toDate?: string;
  previousFromDate?: string;
  previousToDate?: string;
  openingStockCurrent?: number;
  openingStockPrevious?: number;
  closingStockCurrent?: number;
  closingStockPrevious?: number;
}): ProfitLossData {
  const currentTotals = normalizeLedgerTotals(
    computeLedgerTotals(args.accounts, args.currentVouchers, args.toDate, args.fromDate),
  );

  const previousTotals = normalizeLedgerTotals(
    computeLedgerTotals(args.accounts, args.previousVouchers, args.previousToDate, args.previousFromDate),
  );

  const revenue = buildSectionLines(
    args.accounts,
    currentTotals,
    previousTotals,
    "revenue",
    { accountType: ["income"], invertSign: true }, // Based on point 6
  );

  const otherIncome = buildSectionLines(
    args.accounts,
    currentTotals,
    previousTotals,
    "other-income",
    { accountType: ["income"], invertSign: true },
  );

  const cogs = buildSectionLines(
    args.accounts,
    currentTotals,
    previousTotals,
    "cogs",
    { accountType: ["expense"], invertSign: false },
  );

  const indirectExpenses = buildSectionLines(
    args.accounts,
    currentTotals,
    previousTotals,
    "indirect-expense",
    { accountType: ["expense"], invertSign: false },
  );

  const taxExpenses = indirectExpenses.filter((x) =>
    normalize(x.label).includes("tax"),
  );

  const revenueTotal = total(revenue);
  const otherIncomeTotal = total(otherIncome);

  const openingStock = totalsRound(args.openingStockCurrent || 0);
  const closingStock = totalsRound(args.closingStockCurrent || 0);

  const cogsBeforeStock = total(cogs);
  const costOfGoodsSold = totalsRound(openingStock + cogsBeforeStock - closingStock);

  const indirectExpenseTotal = total(indirectExpenses);
  const totalExpenses = totalsRound(costOfGoodsSold + indirectExpenseTotal);

  const totalIncome = totalsRound(revenueTotal + otherIncomeTotal);
  const profitBeforeTax = totalsRound(totalIncome - totalExpenses);

  const incomeTaxProvision = taxExpenses.reduce(
    (sum, row) => sum + row.currentYear,
    0,
  );

  const netProfitAfterTax = totalsRound(profitBeforeTax - incomeTaxProvision);

  return {
    revenue,
    otherIncome,
    cogs: [
      {
        id: "opening-stock",
        label: "Opening Stock",
        labelNepali: "सुरु मौज्दात",
        currentYear: openingStock,
        previousYear: args.openingStockPrevious || 0,
      },
      ...cogs,
      {
        id: "closing-stock",
        label: "Less: Closing Stock",
        labelNepali: "घटाउनुहोस्: अन्तिम मौज्दात",
        currentYear: -closingStock,
        previousYear: -(args.closingStockPrevious || 0),
        isDeduction: true,
      },
    ],
    indirectExpenses,
    taxExpenses,

    netSales: revenueTotal,
    totalOtherIncome: otherIncomeTotal,
    totalIncome,
    costOfGoodsSold,
    totalIndirectExpenses: indirectExpenseTotal,
    totalExpenses,
    profitBeforeTax,
    incomeTaxProvision,
    netProfitAfterTax,
  };
}
