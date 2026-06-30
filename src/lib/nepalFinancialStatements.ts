// ─── Nepal Financial Statements Engine ────────────────────────────────────────
// Generates Balance Sheet, P&L, Income & Expenditure per Nepal accounting standards.
// Fixes BUG-011: string was passed where object expected.
// Fixes BUG-012: function called with wrong number of args.

import type { DBAccount, DBVoucher, DBInvoice, DBFiscalYear } from "./db";
import { ADToBSLong } from "./nepaliDate";

export interface StatementOptions {
  startDate?: string;       // AD ISO string — Fix BUG-011: was incorrectly receiving bare string
  endDate?: string;         // AD ISO string
  includeOpening?: boolean;
  includeZeroBalance?: boolean;
  comparativePeriod?: boolean;
  prevStartDate?: string;
  prevEndDate?: string;
  format?: "standard" | "schedule-vi" | "ifrs" | "non-corporate";
  roundToThousands?: boolean;
}

export interface NepalStatementLine {
  id: string;
  label: string;
  labelNepali?: string;
  currentYear: number;
  previousYear: number;
  indent: number;
  isTotal?: boolean;
  isGrandTotal?: boolean;
  isDeduction?: boolean;
  isSeparator?: boolean;
  children?: NepalStatementLine[];
  accountIds?: string[];
  note?: number;
}

// ─── Account Group Mapping ─────────────────────────────────────────────────────

const GROUP_PATTERNS = {
  // Assets
  fixedAssets:        /fixed.?asset|property|plant|equipment|furniture|vehicle|land|building|machinery/i,
  capitalWIP:         /capital.?wip|work.?in.?progress|cwip/i,
  investments:        /investment|mutual.?fund|shares?|securities?/i,
  longTermLoans:      /long.?term.?loan|term.?loan.?given/i,
  currentAssets:      /current.?asset|trade.?receivable|debtor|sundry.?debtor/i,
  cashAndBank:        /cash|bank(?!.?loan)|petty.?cash/i,
  inventories:        /stock|inventor|raw.?material|finished.?good|wip/i,
  shortTermLoans:     /short.?term.?loan|loan.?given/i,
  otherCurrentAssets: /advance|prepaid|other.?current/i,
  // Liabilities
  shareCapital:       /share.?capital|equity.?share|preference.?share|paid.?up.?capital/i,
  reserves:           /reserve|surplus|retained|general.?reserve|profit.?reserve/i,
  longTermBorrowings: /long.?term.?borrow|term.?loan.?taken|debenture/i,
  shortTermBorrowings:/short.?term.?borrow|overdraft|cash.?credit|working.?capital.?loan/i,
  tradePayables:      /creditor|sundry.?creditor|trade.?payable|accounts.?payable/i,
  otherCurrentLiab:   /other.?current.?liab|advance.?received|short.?term.?provision/i,
  provisions:         /provision|taxation|audit.?fee|gratuity.?provision/i,
  // P&L
  revenue:            /sales|revenue|income|turnover/i,
  otherIncome:        /other.?income|interest.?income|dividend|rent.?income/i,
  cogs:               /purchase|cost.?of.?good|cogs|direct.?cost/i,
  directExpenses:     /direct.?expense|wage|labour|freight.?inward/i,
  adminExpenses:      /admin|office|salary|electricity|rent.?expense|telephone|stationery/i,
  financialCosts:     /interest.?expense|bank.?charge|finance.?cost/i,
  depreciation:       /depreciation|amortization/i,
  otherExpenses:      /other.?expense|miscellaneous/i,
};

function matchGroup(account: DBAccount, patterns: RegExp[]): boolean {
  const text = `${account.name} ${account.group || ""} ${account.subGroup || ""} ${account.type || ""}`;
  return patterns.some((p) => p.test(text));
}

// ─── Balance Computation ───────────────────────────────────────────────────────

function computeAccountBalances(
  accounts: DBAccount[],
  vouchers: DBVoucher[],
  options: StatementOptions,   // Fix BUG-011: was receiving bare string
): Map<string, { current: number; previous: number }> {
  const { startDate, endDate, prevStartDate, prevEndDate } = options;

  const balanceMap = new Map<string, { current: number; previous: number }>();

  for (const acc of accounts) {
    balanceMap.set(acc.id, { current: 0, previous: 0 });
  }

  // Opening balances
  if (options.includeOpening) {
    for (const acc of accounts) {
      const entry = balanceMap.get(acc.id)!;
      entry.current += Number(acc.openingBalance ?? 0);
      entry.previous += Number(acc.openingBalance ?? 0);
    }
  }

  // Apply voucher lines
  for (const v of vouchers) {
    if (v.status !== "posted") continue;
    const vDate = v.date?.split("T")[0] ?? "";

    // Current period
    const inCurrent =
      (!startDate || vDate >= startDate) && (!endDate || vDate <= endDate);
    // Previous period
    const inPrevious =
      prevStartDate && prevEndDate
        ? vDate >= prevStartDate && vDate <= prevEndDate
        : false;

    for (const line of v.lines ?? []) {
      if (!line.accountId) continue;
      if (!balanceMap.has(line.accountId)) {
        balanceMap.set(line.accountId, { current: 0, previous: 0 });
      }
      const entry = balanceMap.get(line.accountId)!;
      const net = Number(line.debit ?? 0) - Number(line.credit ?? 0);

      if (inCurrent) entry.current += net;
      if (inPrevious) entry.previous += net;
    }
  }

  return balanceMap;
}

// ─── Sum by group pattern ──────────────────────────────────────────────────────

function sumGroup(
  accounts: DBAccount[],
  balanceMap: Map<string, { current: number; previous: number }>,
  patterns: RegExp[],
  excludePatterns: RegExp[] = [],
): { current: number; previous: number; accountIds: string[] } {
  let current = 0;
  let previous = 0;
  const accountIds: string[] = [];

  for (const acc of accounts) {
    if (!matchGroup(acc, patterns)) continue;
    if (excludePatterns.length && matchGroup(acc, excludePatterns)) continue;
    const bal = balanceMap.get(acc.id);
    if (!bal) continue;
    current += bal.current;
    previous += bal.previous;
    accountIds.push(acc.id);
  }

  return { current, previous, accountIds };
}

// ─── Balance Sheet Generator ───────────────────────────────────────────────────

/**
 * Generate Nepal-format Balance Sheet.
 * Fixes BUG-011: now receives StatementOptions object (not bare string).
 * Fixes BUG-012: takes exactly 3 parameters.
 */
export function generateNepalBalanceSheet(
  accounts: DBAccount[],
  vouchers: DBVoucher[],
  options: StatementOptions,           // Fix BUG-011: object not string
): NepalStatementLine[] {
  const balanceMap = computeAccountBalances(accounts, vouchers, options);

  const g = (patterns: RegExp[], excludes: RegExp[] = []) =>
    sumGroup(accounts, balanceMap, patterns, excludes);

  // ── Assets ─────────────────────────────────────────────────────────────────
  const fixedAssets    = g([GROUP_PATTERNS.fixedAssets]);
  const capitalWIP     = g([GROUP_PATTERNS.capitalWIP]);
  const investments    = g([GROUP_PATTERNS.investments]);
  const ltLoans        = g([GROUP_PATTERNS.longTermLoans]);
  const inventories    = g([GROUP_PATTERNS.inventories]);
  const tradeRec       = g([GROUP_PATTERNS.currentAssets], [GROUP_PATTERNS.cashAndBank]);
  const cashBank       = g([GROUP_PATTERNS.cashAndBank]);
  const stLoans        = g([GROUP_PATTERNS.shortTermLoans]);
  const otherCA        = g([GROUP_PATTERNS.otherCurrentAssets]);

  const totalNCA: NepalStatementLine = {
    id: "nca-total", label: "Total Non-Current Assets", labelNepali: "कुल गैर-चालु सम्पत्ति",
    currentYear: fixedAssets.current + capitalWIP.current + investments.current + ltLoans.current,
    previousYear: fixedAssets.previous + capitalWIP.previous + investments.previous + ltLoans.previous,
    indent: 1, isTotal: true,
  };

  const totalCA: NepalStatementLine = {
    id: "ca-total", label: "Total Current Assets", labelNepali: "कुल चालु सम्पत्ति",
    currentYear: inventories.current + tradeRec.current + cashBank.current + stLoans.current + otherCA.current,
    previousYear: inventories.previous + tradeRec.previous + cashBank.previous + stLoans.previous + otherCA.previous,
    indent: 1, isTotal: true,
  };

  const totalAssets: NepalStatementLine = {
    id: "total-assets", label: "TOTAL ASSETS", labelNepali: "कुल सम्पत्ति",
    currentYear: totalNCA.currentYear + totalCA.currentYear,
    previousYear: totalNCA.previousYear + totalCA.previousYear,
    indent: 0, isGrandTotal: true,
  };

  // ── Equity & Liabilities ────────────────────────────────────────────────────
  const shareCapital   = g([GROUP_PATTERNS.shareCapital]);
  const reserves       = g([GROUP_PATTERNS.reserves]);
  const ltBorrowings   = g([GROUP_PATTERNS.longTermBorrowings]);
  const stBorrowings   = g([GROUP_PATTERNS.shortTermBorrowings]);
  const tradePayables  = g([GROUP_PATTERNS.tradePayables]);
  const otherCL        = g([GROUP_PATTERNS.otherCurrentLiab]);
  const provisions     = g([GROUP_PATTERNS.provisions]);

  const totalEquity: NepalStatementLine = {
    id: "equity-total", label: "Total Equity", labelNepali: "कुल इक्विटी",
    currentYear: shareCapital.current + reserves.current,
    previousYear: shareCapital.previous + reserves.previous,
    indent: 1, isTotal: true,
  };

  const totalNCL: NepalStatementLine = {
    id: "ncl-total", label: "Total Non-Current Liabilities", labelNepali: "कुल गैर-चालु दायित्व",
    currentYear: ltBorrowings.current,
    previousYear: ltBorrowings.previous,
    indent: 1, isTotal: true,
  };

  const totalCL: NepalStatementLine = {
    id: "cl-total", label: "Total Current Liabilities", labelNepali: "कुल चालु दायित्व",
    currentYear: stBorrowings.current + tradePayables.current + otherCL.current + provisions.current,
    previousYear: stBorrowings.previous + tradePayables.previous + otherCL.previous + provisions.previous,
    indent: 1, isTotal: true,
  };

  const totalEquityLiab: NepalStatementLine = {
    id: "total-equity-liab", label: "TOTAL EQUITY AND LIABILITIES", labelNepali: "कुल इक्विटी र दायित्व",
    currentYear: totalEquity.currentYear + totalNCL.currentYear + totalCL.currentYear,
    previousYear: totalEquity.previousYear + totalNCL.previousYear + totalCL.previousYear,
    indent: 0, isGrandTotal: true,
  };

  return [
    // Assets section
    { id: "assets-hdr",  label: "ASSETS",               labelNepali: "सम्पत्ति",          currentYear: 0, previousYear: 0, indent: 0, isSeparator: true },
    { id: "nca-hdr",     label: "Non-Current Assets",   labelNepali: "गैर-चालु सम्पत्ति", currentYear: 0, previousYear: 0, indent: 0 },
    { id: "fixed-asset", label: "Property, Plant & Equipment", labelNepali: "स्थायी सम्पत्ति", ...fixedAssets, indent: 1 },
    { id: "cwip",        label: "Capital Work-in-Progress",    labelNepali: "पूँजीगत कार्य",   ...capitalWIP, indent: 1 },
    { id: "investments", label: "Investments",                 labelNepali: "लगानी",           ...investments, indent: 1 },
    { id: "lt-loans",    label: "Long-term Loans",            labelNepali: "दीर्घकालीन ऋण",   ...ltLoans, indent: 1 },
    totalNCA,
    { id: "ca-hdr",      label: "Current Assets",        labelNepali: "चालु सम्पत्ति",     currentYear: 0, previousYear: 0, indent: 0 },
    { id: "inventories", label: "Inventories",                labelNepali: "माल सूची",        ...inventories, indent: 1 },
    { id: "trade-rec",   label: "Trade Receivables",          labelNepali: "व्यापार प्राप्य", ...tradeRec, indent: 1 },
    { id: "cash-bank",   label: "Cash & Cash Equivalents",    labelNepali: "नगद र बैंक",     ...cashBank, indent: 1 },
    { id: "st-loans",    label: "Short-term Loans",           labelNepali: "अल्पकालीन ऋण",   ...stLoans, indent: 1 },
    { id: "other-ca",    label: "Other Current Assets",       labelNepali: "अन्य चालु सम्पत्ति", ...otherCA, indent: 1 },
    totalCA,
    totalAssets,
    // Equity & Liabilities
    { id: "el-hdr",       label: "EQUITY AND LIABILITIES",    labelNepali: "इक्विटी र दायित्व",  currentYear: 0, previousYear: 0, indent: 0, isSeparator: true },
    { id: "eq-hdr",       label: "Equity",                    labelNepali: "इक्विटी",            currentYear: 0, previousYear: 0, indent: 0 },
    { id: "share-cap",    label: "Share Capital",             labelNepali: "शेयर पुँजी",         ...shareCapital, indent: 1 },
    { id: "reserves",     label: "Reserves & Surplus",        labelNepali: "जगेडा र बचत",        ...reserves, indent: 1 },
    totalEquity,
    { id: "ncl-hdr",      label: "Non-Current Liabilities",   labelNepali: "गैर-चालु दायित्व",  currentYear: 0, previousYear: 0, indent: 0 },
    { id: "lt-borrow",    label: "Long-term Borrowings",      labelNepali: "दीर्घकालीन ऋण",     ...ltBorrowings, indent: 1 },
    totalNCL,
    { id: "cl-hdr",       label: "Current Liabilities",       labelNepali: "चालु दायित्व",      currentYear: 0, previousYear: 0, indent: 0 },
    { id: "st-borrow",    label: "Short-term Borrowings",     labelNepali: "अल्पकालीन ऋण",     ...stBorrowings, indent: 1 },
    { id: "trade-pay",    label: "Trade Payables",            labelNepali: "व्यापार देय",       ...tradePayables, indent: 1 },
    { id: "other-cl",     label: "Other Current Liabilities", labelNepali: "अन्य चालु दायित्व", ...otherCL, indent: 1 },
    { id: "provisions",   label: "Provisions",                labelNepali: "प्रावधान",          ...provisions, indent: 1 },
    totalCL,
    totalEquityLiab,
  ];
}

// ─── Profit & Loss Generator ───────────────────────────────────────────────────

/**
 * Generate Nepal-format Profit & Loss statement.
 * Fixes BUG-012: takes exactly 3 parameters (was being called with 4).
 */
export function generateNepalProfitLoss(
  accounts: DBAccount[],
  vouchers: DBVoucher[],
  options: StatementOptions,  // Fix BUG-012: 3rd param is options object, not a 4th separate param
): NepalStatementLine[] {
  const balanceMap = computeAccountBalances(accounts, vouchers, options);

  const g = (patterns: RegExp[], excludes: RegExp[] = []) =>
    sumGroup(accounts, balanceMap, patterns, excludes);

  const revenue        = g([GROUP_PATTERNS.revenue]);
  const otherIncome    = g([GROUP_PATTERNS.otherIncome]);
  const cogs           = g([GROUP_PATTERNS.cogs]);
  const directExp      = g([GROUP_PATTERNS.directExpenses]);
  const adminExp       = g([GROUP_PATTERNS.adminExpenses]);
  const financeCosts   = g([GROUP_PATTERNS.financialCosts]);
  const depreciation   = g([GROUP_PATTERNS.depreciation]);
  const otherExp       = g([GROUP_PATTERNS.otherExpenses]);

  const grossProfit = {
    current: revenue.current + otherIncome.current - cogs.current - directExp.current,
    previous: revenue.previous + otherIncome.previous - cogs.previous - directExp.previous,
  };

  const totalRevenue = {
    current: revenue.current + otherIncome.current,
    previous: revenue.previous + otherIncome.previous,
  };

  const totalExpenses = {
    current: cogs.current + directExp.current + adminExp.current + financeCosts.current + depreciation.current + otherExp.current,
    previous: cogs.previous + directExp.previous + adminExp.previous + financeCosts.previous + depreciation.previous + otherExp.previous,
  };

  const netProfit = {
    current: totalRevenue.current - totalExpenses.current,
    previous: totalRevenue.previous - totalExpenses.previous,
  };

  return [
    // Revenue
    { id: "rev-hdr",      label: "REVENUE",                   labelNepali: "राजस्व",          currentYear: 0, previousYear: 0, indent: 0, isSeparator: true },
    { id: "sales",        label: "Revenue from Operations",   labelNepali: "व्यापार राजस्व",  ...revenue,     indent: 1 },
    { id: "other-income", label: "Other Income",              labelNepali: "अन्य आम्दानी",    ...otherIncome, indent: 1 },
    { id: "total-rev",    label: "Total Revenue",             labelNepali: "कुल राजस्व",      currentYear: totalRevenue.current, previousYear: totalRevenue.previous, indent: 0, isTotal: true },
    // Expenses
    { id: "exp-hdr",      label: "EXPENSES",                  labelNepali: "खर्च",            currentYear: 0, previousYear: 0, indent: 0, isSeparator: true },
    { id: "cogs",         label: "Cost of Materials / Purchases", labelNepali: "माल खर्च",   ...cogs,         indent: 1 },
    { id: "direct-exp",   label: "Direct Expenses",           labelNepali: "प्रत्यक्ष खर्च",  ...directExp,   indent: 1 },
    { id: "admin-exp",    label: "Employee Benefits / Admin",  labelNepali: "प्रशासनिक खर्च", ...adminExp,    indent: 1 },
    { id: "depreciation", label: "Depreciation & Amortization", labelNepali: "ह्रास",         ...depreciation, indent: 1 },
    { id: "finance-cost", label: "Finance Costs",             labelNepali: "वित्त लागत",      ...financeCosts, indent: 1 },
    { id: "other-exp",    label: "Other Expenses",            labelNepali: "अन्य खर्च",       ...otherExp,    indent: 1 },
    { id: "total-exp",    label: "Total Expenses",            labelNepali: "कुल खर्च",        currentYear: totalExpenses.current, previousYear: totalExpenses.previous, indent: 0, isTotal: true },
    // Net Profit
    { id: "gross-profit", label: "Gross Profit",              labelNepali: "कुल मुनाफा",      currentYear: grossProfit.current, previousYear: grossProfit.previous, indent: 0, isTotal: true },
    { id: "net-profit",   label: "NET PROFIT / (LOSS)",       labelNepali: "खुद मुनाफा / (नोक्सान)", currentYear: netProfit.current, previousYear: netProfit.previous, indent: 0, isGrandTotal: true },
  ];
}

// ─── Trial Balance Generator ───────────────────────────────────────────────────

export interface TrialBalanceLine {
  accountId: string;
  accountCode?: string;
  accountName: string;
  group: string;
  openingDebit: number;
  openingCredit: number;
  periodDebit: number;
  periodCredit: number;
  closingDebit: number;
  closingCredit: number;
  balance: number;
  hasChildren?: boolean;
}

/**
 * Generate Trial Balance data.
 * Fixes BUG-069: properly filters by date to show balances at specific date.
 */
export function generateTrialBalance(
  accounts: DBAccount[],
  vouchers: DBVoucher[],
  options: StatementOptions,
): TrialBalanceLine[] {
  const { startDate, endDate, includeZeroBalance = false } = options;

  const lines: TrialBalanceLine[] = [];

  for (const acc of accounts) {
    // Opening balance (before startDate)
    let openingDebit = 0;
    let openingCredit = 0;
    const openingBal = Number(acc.openingBalance ?? 0);
    if (openingBal >= 0) openingDebit = openingBal;
    else openingCredit = Math.abs(openingBal);

    // Period movements
    let periodDebit = 0;
    let periodCredit = 0;

    for (const v of vouchers) {
      if (v.status !== "posted") continue;
      const vDate = v.date?.split("T")[0] ?? "";

      // Opening: all vouchers before startDate (Fix BUG-069)
      if (startDate && vDate < startDate) {
        for (const line of v.lines ?? []) {
          if (line.accountId !== acc.id) continue;
          openingDebit  += Number(line.debit  ?? 0);
          openingCredit += Number(line.credit ?? 0);
        }
      }

      // Period: vouchers within date range
      const inPeriod = (!startDate || vDate >= startDate) && (!endDate || vDate <= endDate);
      if (inPeriod) {
        for (const line of v.lines ?? []) {
          if (line.accountId !== acc.id) continue;
          periodDebit  += Number(line.debit  ?? 0);
          periodCredit += Number(line.credit ?? 0);
        }
      }
    }

    const closingDebit  = openingDebit  + periodDebit;
    const closingCredit = openingCredit + periodCredit;
    const balance       = closingDebit  - closingCredit;

    if (!includeZeroBalance && balance === 0 && openingDebit === 0 && periodDebit === 0) {
      continue;
    }

    lines.push({
      accountId:    acc.id,
      accountCode:  acc.code,
      accountName:  acc.name,
      group:        acc.group,
      openingDebit,
      openingCredit,
      periodDebit,
      periodCredit,
      closingDebit,
      closingCredit,
      balance,
    });
  }

  return lines.sort((a, b) => a.accountName.localeCompare(b.accountName));
}
