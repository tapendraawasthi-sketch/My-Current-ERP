// @ts-nocheck
import {
  Account,
  AccountType,
  AccountLevel,
  JournalEntry,
  Invoice,
  Party,
  VoucherStatus,
  VoucherType,
  VoucherSeries,
  LedgerEntry,
  TrialBalanceRow,
  ProfitLossRow,
  BalanceSheetRow,
  DayBookEntry,
  PartyAging,
  PaymentStatus,
  RecurringVoucher,
  FiscalYear,
} from "./types";

// ==========================================
// PRECISION ROUNDING HELPER
// ==========================================

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

// ==========================================
// 1. ACCOUNT BALANCE HELPERS
// ==========================================

export function isDebitNature(type: AccountType): boolean {
  return type === AccountType.ASSET || type === AccountType.EXPENSE;
}

export function getAccountEffect(accountType: AccountType, debit: number, credit: number): number {
  if (isDebitNature(accountType)) {
    return round2(debit - credit);
  } else {
    return round2(credit - debit);
  }
}

export function recalculateAccountBalances(
  accounts: Account[],
  vouchers: JournalEntry[],
): Account[] {
  const accMap = new Map<string, Account>();
  for (const acc of accounts) {
    const openingDr = acc.openingBalanceDr || 0;
    const openingCr = acc.openingBalanceCr || 0;
    let initialBalance = 0;

    if (isDebitNature(acc.type)) {
      initialBalance = round2(openingDr - openingCr);
    } else {
      initialBalance = round2(openingCr - openingDr);
    }

    accMap.set(acc.id, {
      ...acc,
      balance: initialBalance,
    });
  }

  const postedVouchers = vouchers.filter((v) => v.status === VoucherStatus.POSTED);

  for (const v of postedVouchers) {
    for (const line of v.lines) {
      const liveAcc = accMap.get(line.accountId);
      if (liveAcc) {
        const effect = getAccountEffect(liveAcc.type, line.debit, line.credit);
        liveAcc.balance = round2(liveAcc.balance + effect);
      }
    }
  }

  const allAccounts = Array.from(accMap.values());
  const groupsAndSubgroups = allAccounts.filter((acc) => acc.isGroup);

  let balanceChanged = true;
  let iterations = 0;
  const maxIterations = 10;

  while (balanceChanged && iterations < maxIterations) {
    balanceChanged = false;
    iterations++;

    for (const parent of groupsAndSubgroups) {
      const children = allAccounts.filter((acc) => acc.parentId === parent.id);
      let calculatedBalance = 0;

      for (const child of children) {
        if (child.type === parent.type) {
          calculatedBalance = round2(calculatedBalance + child.balance);
        } else {
          const convertedBalance = isDebitNature(parent.type)
            ? isDebitNature(child.type)
              ? child.balance
              : -child.balance
            : isDebitNature(child.type)
              ? -child.balance
              : child.balance;
          calculatedBalance = round2(calculatedBalance + convertedBalance);
        }
      }

      if (parent.balance !== calculatedBalance) {
        parent.balance = calculatedBalance;
        balanceChanged = true;
      }
    }
  }

  return allAccounts;
}

export function getAccountBalance(account: Account): {
  dr: number;
  cr: number;
  net: number;
  sign: "Dr" | "Cr";
} {
  const net = account.balance;
  const isDr = isDebitNature(account.type);

  if (isDr) {
    if (net >= 0) {
      return { dr: net, cr: 0, net, sign: "Dr" };
    } else {
      return { dr: 0, cr: Math.abs(net), net: Math.abs(net), sign: "Cr" };
    }
  } else {
    if (net >= 0) {
      return { dr: 0, cr: net, net, sign: "Cr" };
    } else {
      return { dr: Math.abs(net), cr: 0, net: Math.abs(net), sign: "Dr" };
    }
  }
}

// ==========================================
// 2. TRIAL BALANCE
// ==========================================

// Removed old computeTrialBalance

// ==========================================
// 3. PROFIT & LOSS STATEMENT
// ==========================================

export function computeProfitLoss(
  accounts: Account[],
  vouchers: JournalEntry[],
  invoices: Invoice[],
  fromDate: string,
  toDate: string
): {
  grossProfit: number;
  operatingProfit: number;
  netProfit: number;
  sections: {
    salesRevenue: number;
    purchaseReturns: number;
    costOfGoodsSold: number;
    grossProfit: number;
    operatingExpenses: number;
    adminExpenses: number;
    financingCosts: number;
    otherIncome: number;
    taxProvision: number;
    netProfit: number;
  };
  ledgerBreakdown: Array<{ groupName: string; ledgerName: string; amount: number }>;
} {
  try {
    let salesRevenue = 0;
    let purchaseReturns = 0;
    let costOfGoodsSold = 0;
    let operatingExpenses = 0;
    let adminExpenses = 0;
    let financingCosts = 0;
    let otherIncome = 0;
    let taxProvision = 0;
    
    const ledgerBreakdown: Array<{ groupName: string; ledgerName: string; amount: number }> = [];

    for (const acc of accounts) {
      if (acc.isGroup) continue;

      if (acc.type !== AccountType.INCOME && acc.type !== AccountType.EXPENSE) continue;

      const baseOp = acc.openingBalanceDr ? acc.openingBalanceDr : (acc.openingBalanceCr || 0);
      const baseOpSign = acc.openingBalanceDr ? "DR" : "CR";
      const ledger = computeLedgerBalance(acc.id, vouchers, invoices, fromDate, toDate, baseOp, baseOpSign);
      
      let amount = 0;
      if (acc.type === AccountType.INCOME) {
        amount = ledger.closingDrCr === "CR" ? ledger.closingBalance : -ledger.closingBalance;
      } else {
        amount = ledger.closingDrCr === "DR" ? ledger.closingBalance : -ledger.closingBalance;
      }

      if (amount === 0) continue;

      const groupLower = (acc.group || "").toLowerCase();
      const nameLower = acc.name.toLowerCase();

      if (acc.type === AccountType.INCOME) {
        if (groupLower.includes("sales") || nameLower.includes("sales")) {
          salesRevenue += amount;
        } else if (groupLower.includes("purchase return") || nameLower.includes("purchase return")) {
          purchaseReturns += amount;
        } else {
          otherIncome += amount;
        }
      } else {
        if (groupLower.includes("cost of goods") || groupLower.includes("purchase") || nameLower.includes("cogs") || groupLower.includes("direct")) {
          costOfGoodsSold += amount;
        } else if (groupLower.includes("admin") || nameLower.includes("admin") || groupLower.includes("office")) {
          adminExpenses += amount;
        } else if (groupLower.includes("finance") || groupLower.includes("interest") || nameLower.includes("interest")) {
          financingCosts += amount;
        } else if (groupLower.includes("tax") || nameLower.includes("tax provision")) {
          taxProvision += amount;
        } else {
          operatingExpenses += amount;
        }
      }

      ledgerBreakdown.push({
        groupName: acc.group || "Uncategorized",
        ledgerName: acc.name,
        amount
      });
    }

    const grossProfit = salesRevenue + purchaseReturns - costOfGoodsSold;
    const operatingProfit = grossProfit - operatingExpenses - adminExpenses;
    const profitBeforeTax = operatingProfit + otherIncome - financingCosts;
    const netProfit = profitBeforeTax - taxProvision;

    return {
      grossProfit,
      operatingProfit,
      netProfit,
      sections: {
        salesRevenue,
        purchaseReturns,
        costOfGoodsSold,
        grossProfit,
        operatingExpenses,
        adminExpenses,
        financingCosts,
        otherIncome,
        taxProvision,
        netProfit
      },
      ledgerBreakdown
    };
  } catch (error) {
    console.error("computeProfitLoss error:", error);
    return {
      grossProfit: 0, operatingProfit: 0, netProfit: 0,
      sections: { salesRevenue: 0, purchaseReturns: 0, costOfGoodsSold: 0, grossProfit: 0, operatingExpenses: 0, adminExpenses: 0, financingCosts: 0, otherIncome: 0, taxProvision: 0, netProfit: 0 },
      ledgerBreakdown: []
    };
  }
}

// ==========================================
// 4. BALANCE SHEET
// ==========================================

export function computeBalanceSheet(
  accounts: Account[],
  vouchers: JournalEntry[],
  invoices: Invoice[],
  asOfDate: string,
  netProfit: number
): {
  assets: {
    fixedAssets: number;
    currentAssets: number;
    investments: number;
    total: number;
    breakdown: Array<{ groupName: string; amount: number; isGroup: boolean; ledgerName?: string }>;
  };
  liabilities: {
    shareCapital: number;
    retainedEarnings: number;
    longTermLoans: number;
    currentLiabilities: number;
    total: number;
    breakdown: Array<{ groupName: string; amount: number; isGroup: boolean; ledgerName?: string }>;
  };
  isBalanced: boolean;
  difference: number;
} {
  try {
    let fixedAssets = 0;
    let currentAssets = 0;
    let investments = 0;

    let shareCapital = 0;
    let retainedEarnings = netProfit;
    let longTermLoans = 0;
    let currentLiabilities = 0;

    const assetsBreakdown: Array<{ groupName: string; amount: number; isGroup: boolean; ledgerName?: string }> = [];
    const liabilitiesBreakdown: Array<{ groupName: string; amount: number; isGroup: boolean; ledgerName?: string }> = [];

    // The fiscalStartDate doesn't matter for balance sheet as we compute absolute running balance from opening.
    // We just pass asOfDate as the upper bound.
    const earliestDate = "1970-01-01"; 

    for (const acc of accounts) {
      if (acc.isGroup) continue;

      if (acc.type !== AccountType.ASSET && acc.type !== AccountType.LIABILITY && acc.type !== AccountType.EQUITY) continue;

      const baseOp = acc.openingBalanceDr ? acc.openingBalanceDr : (acc.openingBalanceCr || 0);
      const baseOpSign = acc.openingBalanceDr ? "DR" : "CR";
      const ledger = computeLedgerBalance(acc.id, vouchers, invoices, earliestDate, asOfDate, baseOp, baseOpSign);
      
      let amount = 0;
      if (acc.type === AccountType.ASSET) {
        amount = ledger.closingDrCr === "DR" ? ledger.closingBalance : -ledger.closingBalance;
      } else {
        amount = ledger.closingDrCr === "CR" ? ledger.closingBalance : -ledger.closingBalance;
      }

      if (amount === 0) continue;

      const groupLower = (acc.group || "").toLowerCase();

      if (acc.type === AccountType.ASSET) {
        if (groupLower.includes("fixed") || groupLower.includes("non-current")) {
          fixedAssets += amount;
        } else if (groupLower.includes("investment")) {
          investments += amount;
        } else {
          currentAssets += amount;
        }
        assetsBreakdown.push({ groupName: acc.group || "Current Assets", ledgerName: acc.name, amount, isGroup: false });
      } else {
        if (acc.type === AccountType.EQUITY || groupLower.includes("capital") || groupLower.includes("equity")) {
          shareCapital += amount;
        } else if (groupLower.includes("retained") || groupLower.includes("reserve")) {
          retainedEarnings += amount;
        } else if (groupLower.includes("long term") || groupLower.includes("secured loan") || groupLower.includes("non-current")) {
          longTermLoans += amount;
        } else {
          currentLiabilities += amount;
        }
        liabilitiesBreakdown.push({ groupName: acc.group || "Current Liabilities", ledgerName: acc.name, amount, isGroup: false });
      }
    }

    liabilitiesBreakdown.push({
      groupName: "Reserves & Surplus",
      ledgerName: "Retained Earnings (Current Period Profit)",
      amount: netProfit,
      isGroup: false
    });

    const totalAssets = fixedAssets + currentAssets + investments;
    const totalLiabilities = shareCapital + retainedEarnings + longTermLoans + currentLiabilities;
    const difference = Math.abs(totalAssets - totalLiabilities);

    return {
      assets: { fixedAssets, currentAssets, investments, total: totalAssets, breakdown: assetsBreakdown },
      liabilities: { shareCapital, retainedEarnings, longTermLoans, currentLiabilities, total: totalLiabilities, breakdown: liabilitiesBreakdown },
      isBalanced: difference < 1,
      difference
    };
  } catch (error) {
    console.error("computeBalanceSheet error:", error);
    return {
      assets: { fixedAssets: 0, currentAssets: 0, investments: 0, total: 0, breakdown: [] },
      liabilities: { shareCapital: 0, retainedEarnings: 0, longTermLoans: 0, currentLiabilities: 0, total: 0, breakdown: [] },
      isBalanced: false,
      difference: 0
    };
  }
}


// ==========================================
// 5. CASH FLOW STATEMENT (Indirect Method)
// ==========================================

export function computeCashFlow(
  accounts: Account[],
  vouchers: JournalEntry[],
  startDate: string,
  endDate: string,
): {
  operating: { items: { label: string; amount: number }[]; total: number };
  investing: { items: { label: string; amount: number }[]; total: number };
  financing: { items: { label: string; amount: number }[]; total: number };
  openingCash: number;
  closingCash: number;
  netChange: number;
} {
  const plResult = computeProfitLoss(accounts, vouchers, startDate, endDate);
  const netEarnings = plResult.netProfit;

  const filterAccountsByGroup = (matchStr: string) =>
    accounts.filter((a) => !a.isGroup && a.group?.toLowerCase().includes(matchStr));

  const debtors = filterAccountsByGroup("debtors");
  const creditors = filterAccountsByGroup("creditors");
  const fixedAssets = filterAccountsByGroup("fixed");
  const termLoans = filterAccountsByGroup("loan");
  const shareCapital = filterAccountsByGroup("capital");

  const getBalanceDifference = (accList: Account[], isDr: boolean) => {
    let diffSum = 0;
    for (const acc of accList) {
      const initialBal = getLedgerAtDate(acc.id, accounts, vouchers, startDate).closingBalance;
      const closingBal = getLedgerAtDate(acc.id, accounts, vouchers, endDate).closingBalance;
      const elementDiff = closingBal - initialBal;
      diffSum = round2(diffSum + (isDr ? -elementDiff : elementDiff));
    }
    return diffSum;
  };

  const debtorImpact = getBalanceDifference(debtors, true);
  const creditorImpact = getBalanceDifference(creditors, false);
  const fixedAssetImpact = getBalanceDifference(fixedAssets, true);
  const loanImpact = getBalanceDifference(termLoans, false);
  const capitalImpact = getBalanceDifference(shareCapital, false);

  const cashAndBanks = accounts.filter(
    (a) =>
      !a.isGroup &&
      (a.group?.toLowerCase().includes("cash") || a.group?.toLowerCase().includes("bank")),
  );

  let openingCash = 0;
  let closingCash = 0;

  for (const acc of cashAndBanks) {
    openingCash = round2(
      openingCash + getLedgerAtDate(acc.id, accounts, vouchers, startDate).openingBalance,
    );
    closingCash = round2(
      closingCash + getLedgerAtDate(acc.id, accounts, vouchers, endDate).closingBalance,
    );
  }

  const operatingItems = [
    { label: "Net Profit before taxations", amount: netEarnings },
    { label: "Adjustments for Trade Receivables (Sundry Debtors)", amount: debtorImpact },
    { label: "Adjustments for Trade Payables (Sundry Creditors)", amount: creditorImpact },
  ];
  const operatingTotal = round2(netEarnings + debtorImpact + creditorImpact);

  const investingItems = [
    { label: "Purchase or sale of Non-Current Fixed Assets", amount: fixedAssetImpact },
  ];
  const investingTotal = fixedAssetImpact;

  const financingItems = [
    { label: "Increases / Repayments of secured term loans", amount: loanImpact },
    { label: "Receipts / Redemptions from equity share capital", amount: capitalImpact },
  ];
  const financingTotal = round2(loanImpact + capitalImpact);

  const netChange = round2(operatingTotal + investingTotal + financingTotal);

  return {
    operating: { items: operatingItems, total: operatingTotal },
    investing: { items: investingItems, total: investingTotal },
    financing: { items: financingItems, total: financingTotal },
    openingCash,
    closingCash,
    netChange,
  };
}

// ==========================================
// 6. GENERAL LEDGER
// ==========================================

export function computeLedger(
  accountId: string,
  accounts: Account[],
  vouchers: JournalEntry[],
  startDate: string,
  endDate: string,
): {
  openingBalance: number;
  openingType: "Dr" | "Cr";
  entries: LedgerEntry[];
  closingBalance: number;
  closingType: "Dr" | "Cr";
  totalDebit: number;
  totalCredit: number;
} {
  const matchAcc = accounts.find((a) => a.id === accountId);
  if (!matchAcc) {
    return {
      openingBalance: 0,
      openingType: "Dr",
      entries: [],
      closingBalance: 0,
      closingType: "Dr",
      totalDebit: 0,
      totalCredit: 0,
    };
  }

  const matchesPrev = (acc: Account) => isDebitNature(acc.type);
  const isDr = matchesPrev(matchAcc);

  const openingDrInitial = matchAcc.openingBalanceDr || 0;
  const openingCrInitial = matchAcc.openingBalanceCr || 0;

  let preDebit = 0;
  let preCredit = 0;

  const preStartDateCutoff = new Date(startDate).getTime();
  const postedVouchers = vouchers.filter((v) => v.status === VoucherStatus.POSTED);

  for (const v of postedVouchers) {
    if (new Date(v.date).getTime() < preStartDateCutoff) {
      for (const line of v.lines) {
        if (line.accountId === accountId) {
          preDebit = round2(preDebit + line.debit);
          preCredit = round2(preCredit + line.credit);
        }
      }
    }
  }

  const initialDrVal = round2(openingDrInitial + preDebit);
  const initialCrVal = round2(openingCrInitial + preCredit);

  let openingBalance = 0;
  let openingType: "Dr" | "Cr" = "Dr";

  if (isDr) {
    const net = round2(initialDrVal - initialCrVal);
    if (net >= 0) {
      openingBalance = net;
      openingType = "Dr";
    } else {
      openingBalance = Math.abs(net);
      openingType = "Cr";
    }
  } else {
    const net = round2(initialCrVal - initialDrVal);
    if (net >= 0) {
      openingBalance = net;
      openingType = "Cr";
    } else {
      openingBalance = Math.abs(net);
      openingType = "Dr";
    }
  }

  const rangeEntries: LedgerEntry[] = [];
  let runningSigned = isDr
    ? openingType === "Dr"
      ? openingBalance
      : -openingBalance
    : openingType === "Cr"
      ? openingBalance
      : -openingBalance;

  let totalDebit = 0;
  let totalCredit = 0;

  const activeVouchers = vouchers
    .filter((v) => {
      const vt = v.date;
      return vt >= startDate && vt <= endDate;
    })
    .sort((a, b) => {
      const dDiff = a.date.localeCompare(b.date);
      if (dDiff !== 0) return dDiff;
      return a.voucherNo.localeCompare(b.voucherNo);
    });

  for (const v of activeVouchers) {
    for (const line of v.lines) {
      if (line.accountId === accountId) {
        const debit = line.debit;
        const credit = line.credit;

        const isCancelled = v.status === VoucherStatus.CANCELLED;
        const isDraft = v.status === VoucherStatus.DRAFT;

        if (!isCancelled && !isDraft) {
          totalDebit = round2(totalDebit + debit);
          totalCredit = round2(totalCredit + credit);

          const effect = isDr ? round2(debit - credit) : round2(credit - debit);
          runningSigned = round2(runningSigned + effect);
        }

        const counters = v.lines
          .filter((l) => l.accountId !== accountId)
          .map((l) => l.accountName || "Multiple Accounts")
          .join(", ");

        const runningNetAbs = Math.abs(runningSigned);
        const runningSign: "Dr" | "Cr" = isDr
          ? runningSigned >= 0
            ? "Dr"
            : "Cr"
          : runningSigned >= 0
            ? "Cr"
            : "Dr";

        rangeEntries.push({
          date: v.date,
          dateNepali: v.dateNepali,
          voucherNo: v.voucherNo,
          voucherType: v.type,
          narration: v.narration || line.narration || "",
          partyName: counters || v.partyName,
          debit,
          credit,
          balance: runningNetAbs,
          balanceType: runningSign,
          voucherId: v.id,
        });
      }
    }
  }

  const finalSigned = runningSigned;
  const closingBalance = Math.abs(finalSigned);
  let closingType: "Dr" | "Cr" = "Dr";

  if (isDr) {
    closingType = finalSigned >= 0 ? "Dr" : "Cr";
  } else {
    closingType = finalSigned >= 0 ? "Cr" : "Dr";
  }

  return {
    openingBalance,
    openingType,
    entries: rangeEntries,
    closingBalance,
    closingType,
    totalDebit,
    totalCredit,
  };
}

function getLedgerAtDate(
  accountId: string,
  accounts: Account[],
  vouchers: JournalEntry[],
  date: string,
) {
  return computeLedger(accountId, accounts, vouchers, "2000-01-01", date);
}

// ==========================================
// 7. DAY BOOK
// ==========================================

export function computeDayBook(
  vouchers: JournalEntry[],
  accounts: Account[],
  date: string,
): DayBookEntry[] {
  const result: DayBookEntry[] = [];
  const active = vouchers.filter((v) => v.date === date && v.status === VoucherStatus.POSTED);

  for (const v of active) {
    for (const line of v.lines) {
      const mate = accounts.find((a) => a.id === line.accountId);

      let displayParty = v.partyName || "";
      if (!displayParty) {
        const oppoNode = v.lines.find((ol) => ol.accountId !== line.accountId);
        if (oppoNode) {
          displayParty = oppoNode.accountName || oppoNode.accountId;
        }
      }

      result.push({
        date: v.date,
        dateNepali: v.dateNepali,
        voucherNo: v.voucherNo,
        voucherType: v.type,
        partyName: displayParty,
        narration: line.narration || v.narration || "",
        debit: line.debit,
        credit: line.credit,
        voucherId: v.id,
      });
    }
  }

  return result.sort((a, b) => a.voucherNo.localeCompare(b.voucherNo));
}

// ==========================================
// 8. VOUCHER NUMBER GENERATOR
// ==========================================

export function generateVoucherNo(
  type: VoucherType,
  series: Record<string, VoucherSeries>,
  existingVouchers: JournalEntry[],
  fiscalYear?: FiscalYear | null,
): { voucherNo: string; updatedSeries: any } {
  const fyState = fiscalYear?.voucherSeriesState?.[type];
  const config = series[type] || { prefix: "JV-", nextNumber: 1, padding: 4 };
  const prefix = fyState ? fyState.prefix || "" : config.prefix || "";
  const padding = config.padding || 4;
  let currentNum = fyState ? fyState.nextNumber : config.nextNumber;

  let attemptStr = "";
  let uniqueFound = false;

  const countLimit = 1000;
  let safety = 0;

  while (!uniqueFound && safety < countLimit) {
    safety++;
    const valuePadded = String(currentNum).padStart(padding, "0");
    attemptStr = `${prefix}${valuePadded}`;

    const exists = existingVouchers.find((v) => v.voucherNo === attemptStr && v.type === type);
    if (!exists) {
      uniqueFound = true;
    } else {
      currentNum++;
    }
  }

  if (fiscalYear) {
    const updatedFYSeries = {
      ...(fiscalYear.voucherSeriesState || {}),
      [type]: {
        prefix,
        nextNumber: currentNum + 1,
      },
    };
    return {
      voucherNo: attemptStr,
      updatedSeries: updatedFYSeries,
    };
  }

  const updatedSeries = {
    ...series,
    [type]: {
      ...config,
      nextNumber: currentNum + 1,
    },
  };

  return {
    voucherNo: attemptStr,
    updatedSeries,
  };
}

export function generateInvoiceNo(
  type:
    | VoucherType.SALES_INVOICE
    | VoucherType.PURCHASE_INVOICE
    | VoucherType.SALES_RETURN
    | VoucherType.PURCHASE_RETURN,
  series: Record<string, VoucherSeries>,
  existingInvoices: Invoice[],
): { invoiceNo: string; updatedSeries: Record<string, VoucherSeries> } {
  const config = series[type] || { prefix: "INV-", nextNumber: 1, padding: 4 };
  let currentNum = config.nextNumber;

  let attemptStr = "";
  let uniqueFound = false;

  const countLimit = 1000;
  let safety = 0;

  while (!uniqueFound && safety < countLimit) {
    safety++;
    const valuePadded = String(currentNum).padStart(config.padding, "0");
    attemptStr = `${config.prefix}${valuePadded}`;

    const exists = existingInvoices.find(
      (inv) => inv.invoiceNo === attemptStr && inv.type === type,
    );
    if (!exists) {
      uniqueFound = true;
    } else {
      currentNum++;
    }
  }

  const updatedSeries = {
    ...series,
    [type]: {
      ...config,
      nextNumber: currentNum + 1,
    },
  };

  return {
    invoiceNo: attemptStr,
    updatedSeries,
  };
}

// ==========================================
// 9. PARTY STATEMENT
// ==========================================

export function computePartyStatement(
  party: Party,
  accounts: Account[],
  vouchers: JournalEntry[],
  invoices: Invoice[],
  startDate: string,
  endDate: string,
): {
  openingBalance: number;
  openingType: "Dr" | "Cr";
  entries: (LedgerEntry & { invoiceRef?: string; billAmount?: number })[];
  closingBalance: number;
  closingType: "Dr" | "Cr";
  totalDebit: number;
  totalCredit: number;
} {
  const baseStatement = computeLedger(party.accountId, accounts, vouchers, startDate, endDate);

  const enrichedEntries = baseStatement.entries.map((entry) => {
    const matchingInv = invoices.find((inv) => inv.journalEntryId === entry.voucherId);
    return {
      ...entry,
      invoiceRef: matchingInv?.invoiceNo,
      billAmount: matchingInv?.grandTotal,
    };
  });

  return {
    ...baseStatement,
    entries: enrichedEntries,
  };
}

export function generateTrialBalance(
  accounts: Account[],
  vouchers: JournalEntry[],
  invoices: Invoice[],
) {
  const rows = computeTrialBalance(accounts, vouchers, "2026-07-16", "2027-07-15");
  const totals = rows.reduce(
    (sum, r) => {
      sum.debit += r.debit;
      sum.credit += r.credit;
      return sum;
    },
    { debit: 0, credit: 0 },
  );
  return { rows, totalDebit: totals.debit, totalCredit: totals.credit };
}

export function generateProfitAndLoss(
  accounts: Account[],
  vouchers: JournalEntry[],
  invoices: Invoice[],
) {
  const isolatedAccounts = accounts.map((acc) => ({ ...acc, balance: 0 }));
  const postedVouchers = vouchers.filter(
    (v) => v.status === VoucherStatus.POSTED && v.date >= "2026-07-16" && v.date <= "2027-07-15",
  );

  for (const v of postedVouchers) {
    for (const line of v.lines) {
      const match = isolatedAccounts.find((a) => a.id === line.accountId);
      if (match) {
        const effect = getAccountEffect(match.type, line.debit, line.credit);
        match.balance = round2(match.balance + effect);
      }
    }
  }

  const incomeLedgers = isolatedAccounts.filter(
    (acc) => !acc.isGroup && acc.type === AccountType.INCOME,
  );
  const expenseLedgers = isolatedAccounts.filter(
    (acc) => !acc.isGroup && acc.type === AccountType.EXPENSE,
  );

  const salesAccounts = incomeLedgers.filter(
    (acc) => acc.group?.toLowerCase().includes("sales") || acc.name.toLowerCase().includes("sales"),
  );
  const otherIncomes = incomeLedgers.filter((acc) => !salesAccounts.includes(acc));

  const purchaseAccounts = expenseLedgers.filter(
    (acc) =>
      acc.group?.toLowerCase().includes("purchase") || acc.name.toLowerCase().includes("purchase"),
  );
  const directExpenses = expenseLedgers.filter(
    (acc) =>
      acc.group?.toLowerCase().includes("direct") || acc.name.toLowerCase().includes("direct"),
  );
  const operatingExpenses = expenseLedgers.filter(
    (acc) => !purchaseAccounts.includes(acc) && !directExpenses.includes(acc),
  );

  const salesTotal = round2(salesAccounts.reduce((sum, item) => sum + item.balance, 0));
  const otherIncomeTotal = round2(otherIncomes.reduce((sum, item) => sum + item.balance, 0));
  const purchasesTotal = round2(purchaseAccounts.reduce((sum, item) => sum + item.balance, 0));
  const directCostsTotal = round2(directExpenses.reduce((sum, item) => sum + item.balance, 0));
  const operatingExpensesTotal = round2(
    operatingExpenses.reduce((sum, item) => sum + item.balance, 0),
  );

  const grossProfit = round2(salesTotal - purchasesTotal - directCostsTotal);
  const netProfit = round2(grossProfit + otherIncomeTotal - operatingExpensesTotal);

  return {
    revenue: {
      items: [...salesAccounts, ...otherIncomes].map((a) => ({
        accountId: a.id,
        accountName: `${a.code} - ${a.name}`,
        balance: a.balance,
      })),
      total: round2(salesTotal + otherIncomeTotal),
    },
    costOfSales: {
      items: [...purchaseAccounts, ...directExpenses].map((a) => ({
        accountId: a.id,
        accountName: `${a.code} - ${a.name}`,
        balance: a.balance,
      })),
      total: round2(purchasesTotal + directCostsTotal),
    },
    expenses: {
      items: operatingExpenses.map((a) => ({
        accountId: a.id,
        accountName: `${a.code} - ${a.name}`,
        balance: a.balance,
      })),
      total: operatingExpensesTotal,
    },
    grossProfit,
    netProfit,
  };
}

export function generateBalanceSheet(
  accounts: Account[],
  vouchers: JournalEntry[],
  invoices: Invoice[],
) {
  const staticClones = accounts.map((a) => ({ ...a, balance: 0 }));
  const cutoffTime = new Date("2027-07-15").getTime();
  const postedVouchers = vouchers.filter(
    (v) => v.status === VoucherStatus.POSTED && new Date(v.date).getTime() <= cutoffTime,
  );

  for (const v of postedVouchers) {
    for (const line of v.lines) {
      const live = staticClones.find((a) => a.id === line.accountId);
      if (live) {
        const effect = getAccountEffect(live.type, line.debit, line.credit);
        live.balance = round2(live.balance + effect);
      }
    }
  }

  let historicalIncome = 0;
  let historicalExpense = 0;
  for (const v of postedVouchers) {
    for (const line of v.lines) {
      const act = staticClones.find((a) => a.id === line.accountId);
      if (act) {
        if (act.type === AccountType.INCOME) {
          historicalIncome = round2(
            historicalIncome + getAccountEffect(AccountType.INCOME, line.debit, line.credit),
          );
        } else if (act.type === AccountType.EXPENSE) {
          historicalExpense = round2(
            historicalExpense + getAccountEffect(AccountType.EXPENSE, line.debit, line.credit),
          );
        }
      }
    }
  }

  const currentPeriodNetProfit = round2(historicalIncome - historicalExpense);

  const assetLedgers = staticClones.filter((a) => !a.isGroup && a.type === AccountType.ASSET);
  const liabilityLedgers = staticClones.filter(
    (a) => !a.isGroup && a.type === AccountType.LIABILITY,
  );
  const equityLedgers = staticClones.filter((a) => !a.isGroup && a.type === AccountType.EQUITY);

  const totalAssets = round2(assetLedgers.reduce((sum, item) => sum + item.balance, 0));
  const totalLiabilities = round2(liabilityLedgers.reduce((sum, item) => sum + item.balance, 0));
  const totalEquity = round2(equityLedgers.reduce((sum, item) => sum + item.balance, 0));

  return {
    assets: {
      items: assetLedgers.map((a) => ({
        accountId: a.id,
        accountName: `${a.code} - ${a.name}`,
        balance: a.balance,
      })),
      total: totalAssets,
    },
    liabilities: {
      items: [...liabilityLedgers, ...equityLedgers].map((a) => ({
        accountId: a.id,
        accountName: `${a.code} - ${a.name}`,
        balance: a.balance,
      })),
      total: round2(totalLiabilities + totalEquity),
    },
    netProfit: currentPeriodNetProfit,
  };
}

export function computeOutstandingReceivables(
  parties: Party[],
  invoices: Invoice[],
  vouchers?: JournalEntry[],
) {
  const customerInvoices = (invoices || []).filter(
    (inv) =>
      inv.type === VoucherType.SALES_INVOICE &&
      inv.status === VoucherStatus.POSTED &&
      inv.paymentStatus !== PaymentStatus.PAID,
  );

  const partyAmounts: { [partyId: string]: { name: string; amount: number; maxDays: number } } = {};

  for (const inv of customerInvoices) {
    const outstanding = inv.grandTotal - (inv.paidAmount || 0);
    if (outstanding > 0) {
      if (!partyAmounts[inv.partyId]) {
        partyAmounts[inv.partyId] = { name: inv.partyName, amount: 0, maxDays: 0 };
      }
      partyAmounts[inv.partyId].amount = round2(partyAmounts[inv.partyId].amount + outstanding);

      const invoiceDate = new Date(inv.date);
      const today = new Date();
      const diffTime = Math.abs(today.getTime() - invoiceDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays > partyAmounts[inv.partyId].maxDays) {
        partyAmounts[inv.partyId].maxDays = diffDays;
      }
    }
  }

  const results = Object.entries(partyAmounts)
    .map(([partyId, info]) => ({
      partyId,
      partyName: info.name,
      amount: info.amount,
      daysOverdue: info.maxDays,
    }))
    .sort((a, b) => b.amount - a.amount);

  const total = round2(results.reduce((sum, p) => sum + p.amount, 0));

  return { total, parties: results };
}

export function computeOutstandingPayables(
  parties: Party[],
  invoices: Invoice[],
  vouchers?: JournalEntry[],
) {
  const supplierInvoices = (invoices || []).filter(
    (inv) =>
      inv.type === VoucherType.PURCHASE_INVOICE &&
      inv.status === VoucherStatus.POSTED &&
      inv.paymentStatus !== PaymentStatus.PAID,
  );

  const partyAmounts: { [partyId: string]: { name: string; amount: number; maxDays: number } } = {};

  for (const inv of supplierInvoices) {
    const outstanding = inv.grandTotal - (inv.paidAmount || 0);
    if (outstanding > 0) {
      if (!partyAmounts[inv.partyId]) {
        partyAmounts[inv.partyId] = { name: inv.partyName, amount: 0, maxDays: 0 };
      }
      partyAmounts[inv.partyId].amount = round2(partyAmounts[inv.partyId].amount + outstanding);

      const invoiceDate = new Date(inv.date);
      const today = new Date();
      const diffTime = Math.abs(today.getTime() - invoiceDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays > partyAmounts[inv.partyId].maxDays) {
        partyAmounts[inv.partyId].maxDays = diffDays;
      }
    }
  }

  const results = Object.entries(partyAmounts)
    .map(([partyId, info]) => ({
      partyId,
      partyName: info.name,
      amount: info.amount,
      daysOverdue: info.maxDays,
    }))
    .sort((a, b) => b.amount - a.amount);

  const total = round2(results.reduce((sum, p) => sum + p.amount, 0));

  return { total, parties: results };
}

// ==========================================
// 9. OUTSTANDING ANALYSIS
// ==========================================

export interface BillWiseEntry {
  invoiceId: string;
  invoiceNo: string;
  invoiceDate: string;
  dueDate: string;
  partyId: string;
  partyName: string;
  partyPan?: string;
  originalAmount: number;
  paidAmount: number;
  balance: number;
  daysOverdue?: number;
}

function daysBetween(date1: string, date2: string): number {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffTime = d2.getTime() - d1.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

export function computeAgingBuckets(
  billWiseEntries: BillWiseEntry[],
  asOnDate: string,
  slabs: { from: number; to: number | null; label: string }[]
) {
  const activeSlabs = slabs.length > 0 ? slabs : [
    { from: 0, to: 30, label: "0-30 days" },
    { from: 31, to: 60, label: "31-60 days" },
    { from: 61, to: 90, label: "61-90 days" },
    { from: 91, to: 180, label: "91-180 days" },
    { from: 181, to: null, label: ">180 days" },
  ];

  const partyMap: {
    [partyId: string]: {
      partyId: string;
      partyName: string;
      partyPan?: string;
      buckets: { [label: string]: number };
      total: number;
      bills: BillWiseEntry[];
    };
  } = {};

  for (const entry of billWiseEntries) {
    if (entry.balance <= 0) continue;

    const refDate = entry.dueDate || entry.invoiceDate;
    const daysOverdue = daysBetween(refDate, asOnDate);

    let assignedLabel = "";
    for (const slab of activeSlabs) {
      if (daysOverdue >= slab.from && (slab.to === null || daysOverdue <= slab.to)) {
        assignedLabel = slab.label;
        break;
      }
    }

    if (!partyMap[entry.partyId]) {
      partyMap[entry.partyId] = {
        partyId: entry.partyId,
        partyName: entry.partyName,
        partyPan: entry.partyPan,
        buckets: {},
        total: 0,
        bills: [],
      };
      for (const slab of activeSlabs) {
        partyMap[entry.partyId].buckets[slab.label] = 0;
      }
    }

    if (assignedLabel) {
      partyMap[entry.partyId].buckets[assignedLabel] = round2(partyMap[entry.partyId].buckets[assignedLabel] + entry.balance);
    }
    partyMap[entry.partyId].total = round2(partyMap[entry.partyId].total + entry.balance);
    partyMap[entry.partyId].bills.push({
      ...entry,
      daysOverdue,
    });
  }

  return Object.values(partyMap).map((p) => ({
    partyId: p.partyId,
    partyName: p.partyName,
    partyPan: p.partyPan,
    buckets: activeSlabs.map((s) => ({
      label: s.label,
      amount: p.buckets[s.label] || 0,
    })),
    total: p.total,
    bills: p.bills.sort((a, b) => b.daysOverdue! - a.daysOverdue!),
  }));
}

export function computeOutstandingAnalysis(
  partyId: string,
  invoices: Invoice[],
  asOnDate: string = new Date().toISOString().split("T")[0]
) {
  const partyInvoices = (invoices || []).filter(
    (inv) =>
      inv.partyId === partyId &&
      inv.status === VoucherStatus.POSTED &&
      inv.paymentStatus !== PaymentStatus.PAID
  );

  let totalReceivable = 0;
  let totalPayable = 0;
  let oldestBill: Invoice | null = null;
  let oldestDays = -1;

  for (const inv of partyInvoices) {
    const balance = inv.grandTotal - (inv.paidAmount || 0);
    if (balance <= 0) continue;

    if (inv.type === VoucherType.SALES_INVOICE) {
      totalReceivable += balance;
    } else if (inv.type === VoucherType.PURCHASE_INVOICE) {
      totalPayable += balance;
    }

    const refDate = inv.dueDate || inv.date;
    const diffTime = new Date(asOnDate).getTime() - new Date(refDate).getTime();
    const days = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    if (days > oldestDays) {
      oldestDays = days;
      oldestBill = inv;
    }
  }

  return {
    totalReceivable: round2(totalReceivable),
    totalPayable: round2(totalPayable),
    netOutstanding: round2(totalReceivable - totalPayable),
    oldestBillNo: oldestBill ? oldestBill.invoiceNo : null,
    oldestBillDate: oldestBill ? oldestBill.dateNepali || oldestBill.date : null,
    oldestDays: oldestDays >= 0 ? oldestDays : 0,
  };
}

// ==========================================
// 10. RECURRING VOUCHERS
// ==========================================

export function calculateNextDueDate(
  lastDate: string,
  frequency: "daily" | "weekly" | "monthly" | "quarterly" | "yearly",
  dayOfMonth?: number,
): string {
  const date = new Date(lastDate);

  switch (frequency) {
    case "daily":
      date.setDate(date.getDate() + 1);
      break;
    case "weekly":
      date.setDate(date.getDate() + 7);
      break;
    case "monthly":
      if (dayOfMonth && dayOfMonth >= 1 && dayOfMonth <= 28) {
        date.setMonth(date.getMonth() + 1);
        date.setDate(dayOfMonth);
      } else {
        date.setMonth(date.getMonth() + 1);
      }
      break;
    case "quarterly":
      date.setMonth(date.getMonth() + 3);
      break;
    case "yearly":
      date.setFullYear(date.getFullYear() + 1);
      break;
  }

  return date.toISOString().split("T")[0];
}

export async function checkAndGenerateRecurringVouchers(
  recurringVouchers: RecurringVoucher[],
  templateVouchers: JournalEntry[],
  addVoucher: (voucher: any) => Promise<JournalEntry>,
  updateRecurring: (id: string, updates: Partial<RecurringVoucher>) => Promise<void>,
): Promise<{ generated: number; vouchers: JournalEntry[] }> {
  const today = new Date().toISOString().split("T")[0];
  const generatedVouchers: JournalEntry[] = [];

  const active = recurringVouchers.filter(
    (rv) =>
      rv.isActive &&
      rv.nextDueDate <= today &&
      (!rv.endDate || rv.nextDueDate <= rv.endDate) &&
      (!rv.totalOccurrences || rv.completedOccurrences < rv.totalOccurrences),
  );

  for (const recurring of active) {
    try {
      const template = templateVouchers.find((v) => v.id === recurring.templateVoucherId);
      if (!template) continue;

      // Clone the template voucher with new date
      const newVoucher = {
        ...template,
        id: undefined,
        voucherNo: undefined,
        date: recurring.nextDueDate,
        dateNepali: "", // Will be computed by the system
        status: recurring.autoPost ? VoucherStatus.POSTED : VoucherStatus.DRAFT,
        narration: `${template.narration} (Recurring: ${recurring.name})`,
        lines: template.lines.map((line) => ({ ...line, id: undefined })),
      };

      const created = await addVoucher(newVoucher);
      generatedVouchers.push(created);

      // Update recurring voucher
      const nextDue = calculateNextDueDate(
        recurring.nextDueDate,
        recurring.frequency,
        recurring.dayOfMonth,
      );
      await updateRecurring(recurring.id, {
        lastGeneratedDate: today,
        nextDueDate: nextDue,
        completedOccurrences: recurring.completedOccurrences + 1,
        generatedVoucherIds: [...recurring.generatedVoucherIds, created.id],
      });
    } catch (error) {
      console.error(`Failed to generate recurring voucher ${recurring.name}:`, error);
    }
  }

  return { generated: generatedVouchers.length, vouchers: generatedVouchers };
}

export function computeMultiYearTrialBalance(
  accounts: Account[],
  vouchers: JournalEntry[],
  currentFY: FiscalYear,
  priorFYVouchers?: JournalEntry[],
) {
  const currentStart = currentFY.startDate;
  const currentEnd = currentFY.endDate;

  // Determine prior FY1 range by subtracting 1 year
  const prev1S = new Date(currentStart);
  const prev1E = new Date(currentEnd);
  prev1S.setFullYear(prev1S.getFullYear() - 1);
  prev1E.setFullYear(prev1E.getFullYear() - 1);
  const priorStart = prev1S.toISOString().split("T")[0];
  const priorEnd = prev1E.toISOString().split("T")[0];

  // Determine prior FY2 range by subtracting 2 years
  const prev2S = new Date(currentStart);
  const prev2E = new Date(currentEnd);
  prev2S.setFullYear(prev2S.getFullYear() - 2);
  prev2E.setFullYear(prev2E.getFullYear() - 2);
  const prior2Start = prev2S.toISOString().split("T")[0];
  const prior2End = prev2E.toISOString().split("T")[0];

  const currentTB = computeTrialBalance(accounts, vouchers, currentStart, currentEnd);
  
  const priorVouchers = priorFYVouchers || vouchers;
  const priorTB = computeTrialBalance(accounts, priorVouchers, priorStart, priorEnd);
  const prior2TB = computeTrialBalance(accounts, priorVouchers, prior2Start, prior2End);

  const priorMap = new Map(priorTB.map((r) => [r.accountId, r]));
  const prior2Map = new Map(prior2TB.map((r) => [r.accountId, r]));

  return currentTB.map((row) => {
    const prior = priorMap.get(row.accountId);
    const prior2 = prior2Map.get(row.accountId);

    return {
      ...row,
      priorOpeningDr: prior?.openingDr || 0,
      priorOpeningCr: prior?.openingCr || 0,
      priorDebit: prior?.debit || 0,
      priorCredit: prior?.credit || 0,
      priorClosingDr: prior?.closingDr || 0,
      priorClosingCr: prior?.closingCr || 0,
      
      prior2OpeningDr: prior2?.openingDr || 0,
      prior2OpeningCr: prior2?.openingCr || 0,
      prior2Debit: prior2?.debit || 0,
      prior2Credit: prior2?.credit || 0,
      prior2ClosingDr: prior2?.closingDr || 0,
      prior2ClosingCr: prior2?.closingCr || 0,
    };
  });
}

export function computeRatios(
  balanceSheetData: any,
  profitLossData: any,
  accounts: Account[] = []
) {
  const assets = balanceSheetData.assets || [];
  const liabilities = balanceSheetData.liabilities || [];
  const equity = balanceSheetData.equity || [];
  
  const totalAssets = balanceSheetData.totalAssets || 0;
  const totalEquity = balanceSheetData.totalEquity || 0;
  
  const currentAssetsNode = assets.find((a: any) => a.accountId === "bs-ca");
  const currentAssets = currentAssetsNode ? currentAssetsNode.amount : 0;
  
  const currentLiabNode = liabilities.find((l: any) => l.accountId === "bs-cl");
  const currentLiabilities = currentLiabNode ? currentLiabNode.amount : 0;
  
  const termLiabNode = liabilities.find((l: any) => l.accountId === "bs-tl");
  const longTermLiabilities = termLiabNode ? termLiabNode.amount : 0;

  let inventory = 0;
  let cashAndBank = 0;
  let debtors = 0;
  let creditors = 0;

  if (currentAssetsNode && currentAssetsNode.children) {
    currentAssetsNode.children.forEach((c: any) => {
      const name = c.accountName.toLowerCase();
      if (name.includes("stock") || name.includes("inventory")) {
        inventory += c.amount;
      }
      if (name.includes("cash") || name.includes("bank")) {
        cashAndBank += c.amount;
      }
      if (name.includes("debtor") || name.includes("receivable")) {
        debtors += c.amount;
      }
    });
  }

  if (currentLiabNode && currentLiabNode.children) {
    currentLiabNode.children.forEach((c: any) => {
      const name = c.accountName.toLowerCase();
      if (name.includes("creditor") || name.includes("payable")) {
        creditors += c.amount;
      }
    });
  }

  const grossProfit = profitLossData.grossProfit || 0;
  const netProfit = profitLossData.netProfit || 0;
  
  const revenueNode = profitLossData.income?.find((i: any) => i.accountId === "inc-sales");
  const netSales = revenueNode ? revenueNode.amount : (profitLossData.totalIncome || 0);

  const purchaseNode = profitLossData.expenses?.find((e: any) => e.accountId === "exp-purchase-cogs");
  const purchases = purchaseNode ? purchaseNode.amount : 0;

  const directCostsNode = profitLossData.expenses?.find((e: any) => e.accountId === "exp-direct");
  const directCosts = directCostsNode ? directCostsNode.amount : 0;
  const cogs = purchases + directCosts;

  let interestExpense = 0;
  profitLossData.expenses?.forEach((g: any) => {
    if (g.children) {
      g.children.forEach((c: any) => {
        if (c.accountName.toLowerCase().includes("interest")) {
          interestExpense += c.amount;
        }
      });
    }
  });

  const ebit = netProfit + interestExpense;
  const capitalEmployed = totalAssets - currentLiabilities;
  const totalDebt = longTermLiabilities;

  const formatVal = (v: number) => Math.round(v * 100) / 100;

  const currentRatio = currentLiabilities > 0 ? (currentAssets / currentLiabilities) : 0;
  const currentRatioStatus = currentRatio > 2 ? "Good" : currentRatio >= 1.2 ? "Warning" : "Critical";

  const quickAssets = currentAssets - inventory;
  const quickRatio = currentLiabilities > 0 ? (quickAssets / currentLiabilities) : 0;
  const quickRatioStatus = quickRatio > 1 ? "Good" : quickRatio >= 0.8 ? "Warning" : "Critical";

  const cashRatio = currentLiabilities > 0 ? (cashAndBank / currentLiabilities) : 0;
  const cashRatioStatus = cashRatio >= 0.5 ? "Good" : cashRatio >= 0.2 ? "Warning" : "Critical";

  const gpRatio = netSales > 0 ? (grossProfit / netSales) * 100 : 0;
  const gpRatioStatus = gpRatio >= 20 ? "Good" : gpRatio >= 10 ? "Warning" : "Critical";

  const npRatio = netSales > 0 ? (netProfit / netSales) * 100 : 0;
  const npRatioStatus = npRatio >= 10 ? "Good" : npRatio >= 5 ? "Warning" : "Critical";

  const roce = capitalEmployed > 0 ? (ebit / capitalEmployed) * 100 : 0;
  const roceStatus = roce >= 15 ? "Good" : roce >= 8 ? "Warning" : "Critical";

  const roe = totalEquity > 0 ? (netProfit / totalEquity) * 100 : 0;
  const roeStatus = roe >= 15 ? "Good" : roe >= 8 ? "Warning" : "Critical";

  const debtorTurnover = debtors > 0 ? (netSales / debtors) : 0;
  const debtorCollectionDays = debtorTurnover > 0 ? (365 / debtorTurnover) : 0;
  const debtorCollectionStatus = debtorCollectionDays <= 45 ? "Good" : debtorCollectionDays <= 90 ? "Warning" : "Critical";

  const creditorPaymentDays = purchases > 0 && creditors > 0 ? (365 / (purchases / creditors)) : 0;
  const creditorPaymentStatus = creditorPaymentDays >= 30 && creditorPaymentDays <= 90 ? "Good" : "Warning";

  const inventoryTurnover = inventory > 0 ? (cogs / inventory) : 0;
  const inventoryDays = inventoryTurnover > 0 ? (365 / inventoryTurnover) : 0;
  const inventoryStatus = inventoryDays <= 60 ? "Good" : inventoryDays <= 120 ? "Warning" : "Critical";

  const debtEquity = totalEquity > 0 ? (totalDebt / totalEquity) : 0;
  const debtEquityStatus = debtEquity < 1.5 ? "Good" : debtEquity <= 2 ? "Warning" : "Critical";

  const proprietaryRatio = totalAssets > 0 ? (totalEquity / totalAssets) : 0;
  const proprietaryStatus = proprietaryRatio >= 0.4 ? "Good" : "Warning";

  const interestCoverage = interestExpense > 0 ? (ebit / interestExpense) : 0;
  const interestCoverageStatus = interestCoverage >= 3 ? "Good" : interestCoverage >= 1.5 ? "Warning" : "Critical";

  return {
    liquidity: [
      {
        name: "Current Ratio",
        formula: "Current Assets / Current Liabilities",
        value: formatVal(currentRatio),
        status: currentRatioStatus,
        benchmark: "> 2.0",
        interpretation: currentRatioStatus === "Good" 
          ? "Strong liquidity position to meet short-term commitments." 
          : "Low short-term liquidity; potential cash flow strain."
      },
      {
        name: "Quick Ratio (Acid Test)",
        formula: "(Current Assets - Inventory) / Current Liabilities",
        value: formatVal(quickRatio),
        status: quickRatioStatus,
        benchmark: "> 1.0",
        interpretation: quickRatioStatus === "Good"
          ? "Excellent ability to meet immediate cash needs without selling stock."
          : "Heavy reliance on inventory sales to meet immediate liabilities."
      },
      {
        name: "Cash Ratio",
        formula: "(Cash + Bank) / Current Liabilities",
        value: formatVal(cashRatio),
        status: cashRatioStatus,
        benchmark: "> 0.5",
        interpretation: "Indicates the proportion of short-term debt coverable directly by cash."
      }
    ],
    profitability: [
      {
        name: "Gross Profit Margin",
        formula: "Gross Profit / Net Sales × 100",
        value: `${formatVal(gpRatio)}%`,
        status: gpRatioStatus,
        benchmark: "> 20.0%",
        interpretation: "Measures manufacturing and pricing efficiency."
      },
      {
        name: "Net Profit Margin",
        formula: "Net Profit / Net Sales × 100",
        value: `${formatVal(npRatio)}%`,
        status: npRatioStatus,
        benchmark: "> 10.0%",
        interpretation: npRatioStatus === "Good"
          ? "Solid overall profitability and cost management."
          : "Low margin; verify operational overheads."
      },
      {
        name: "Return on Capital Employed (ROCE)",
        formula: "EBIT / Capital Employed × 100",
        value: `${formatVal(roce)}%`,
        status: roceStatus,
        benchmark: "> 15.0%",
        interpretation: "Efficacy of investment utilization across debt and equity."
      },
      {
        name: "Return on Equity (ROE)",
        formula: "Net Profit / Total Equity × 100",
        value: `${formatVal(roe)}%`,
        status: roeStatus,
        benchmark: "> 15.0%",
        interpretation: "Profit generated per rupee of shareholder capital."
      }
    ],
    efficiency: [
      {
        name: "Debtor Collection Period",
        formula: "365 / (Sales / Debtors)",
        value: `${formatVal(debtorCollectionDays)} Days`,
        status: debtorCollectionStatus,
        benchmark: "< 45 Days",
        interpretation: debtorCollectionStatus === "Good"
          ? "Healthy credit collection cycles."
          : "Delayed payments from customers; risk of bad debts."
      },
      {
        name: "Creditor Payment Period",
        formula: "365 / (Purchases / Creditors)",
        value: `${formatVal(creditorPaymentDays)} Days`,
        status: creditorPaymentStatus,
        benchmark: "30 - 90 Days",
        interpretation: "Average time taken to pay suppliers."
      },
      {
        name: "Inventory Holding Period",
        formula: "365 / (COGS / Inventory)",
        value: `${formatVal(inventoryDays)} Days`,
        status: inventoryStatus,
        benchmark: "< 60 Days",
        interpretation: "Average days inventory stays in warehouse."
      }
    ],
    solvency: [
      {
        name: "Debt-to-Equity Ratio",
        formula: "Total Debt / Shareholders Equity",
        value: formatVal(debtEquity),
        status: debtEquityStatus,
        benchmark: "< 2.0",
        interpretation: debtEquityStatus === "Good"
          ? "Low leverage; conservative financial risk."
          : "Highly leveraged; increased insolvency exposure."
      },
      {
        name: "Proprietary Ratio",
        formula: "Total Equity / Total Assets",
        value: formatVal(proprietaryRatio),
        status: proprietaryStatus,
        benchmark: "> 0.4",
        interpretation: "Indicates proportion of assets funded by owners."
      },
      {
        name: "Interest Coverage Ratio",
        formula: "EBIT / Interest Expense",
        value: formatVal(interestCoverage),
        status: interestCoverageStatus,
        benchmark: "> 3.0",
        interpretation: interestCoverageStatus === "Good"
          ? "Comfortable interest payment capacity."
          : "High risk; operating profit barely covers interest."
      }
    ]
  };
}

// ==========================================
// PURE COMPUTATION FOR LEDGER & TRIAL BALANCE
// ==========================================

export function computeLedgerBalance(
  accountId: string,
  vouchers: JournalEntry[],
  invoices: Invoice[],
  fromDate: string,
  toDate: string,
  openingBalance: number,
  openingDrCr: "DR" | "CR"
) {
  let runningBalance = openingDrCr === "DR" ? openingBalance : -openingBalance;
  let totalDebits = 0;
  let totalCredits = 0;
  const transactions: any[] = [];

  const startMs = new Date(fromDate).getTime();
  const endMs = new Date(toDate).getTime();

  const processLine = (date: string, dateBS: string, voucherNo: string, narration: string, debit: number, credit: number) => {
    const vTime = new Date(date).getTime();
    if (vTime >= startMs && vTime <= endMs) {
      runningBalance += debit - credit;
      totalDebits += debit;
      totalCredits += credit;
      transactions.push({
        date,
        dateBS,
        voucherNo,
        narration,
        debit,
        credit,
        runningBalance: Math.abs(runningBalance),
        runningDrCr: runningBalance >= 0 ? "DR" : "CR"
      });
    } else if (vTime < startMs) {
      runningBalance += debit - credit;
    }
  };

  vouchers.filter(v => v.status === "posted").forEach(v => {
    v.lines.forEach(l => {
      if (l.accountId === accountId) {
        processLine(v.date, v.dateNepali || "", v.voucherNo, l.narration || v.narration, l.debit || 0, l.credit || 0);
      }
    });
  });

  invoices.forEach(inv => {
    // Basic extraction if auto-posting enabled, simplified here
  });

  transactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  let currentBal = openingDrCr === "DR" ? openingBalance : -openingBalance;
  transactions.forEach(t => {
    currentBal += t.debit - t.credit;
    t.runningBalance = Math.abs(currentBal);
    t.runningDrCr = currentBal >= 0 ? "DR" : "CR";
  });

  return {
    openingBalance: Math.abs(openingDrCr === "DR" ? openingBalance : -openingBalance),
    openingDrCr: (openingDrCr === "DR" ? openingBalance : -openingBalance) >= 0 ? "DR" : "CR",
    totalDebits,
    totalCredits,
    closingBalance: Math.abs(runningBalance),
    closingDrCr: runningBalance >= 0 ? "DR" : "CR",
    transactions
  };
}

export function computeTrialBalance(
  accounts: Account[],
  vouchers: JournalEntry[],
  invoices: Invoice[],
  asOfDate: string,
  fiscalStartDate: string
) {
  const results: any[] = [];
  accounts.forEach(acc => {
    if (acc.isGroup) return;

    const baseOp = acc.openingBalanceDr ? acc.openingBalanceDr : (acc.openingBalanceCr || 0);
    const baseOpSign = acc.openingBalanceDr ? "DR" : "CR";
    
    const ledger = computeLedgerBalance(acc.id, vouchers, invoices, fiscalStartDate, asOfDate, baseOp, baseOpSign);
    
    let openingDr = 0, openingCr = 0;
    if (ledger.openingBalance !== 0) {
      if (ledger.openingDrCr === "DR") openingDr = ledger.openingBalance;
      else openingCr = ledger.openingBalance;
    }
    
    let closingDr = 0, closingCr = 0;
    if (ledger.closingBalance !== 0) {
      if (ledger.closingDrCr === "DR") closingDr = ledger.closingBalance;
      else closingCr = ledger.closingBalance;
    }

    if (openingDr !== 0 || openingCr !== 0 || ledger.totalDebits !== 0 || ledger.totalCredits !== 0 || closingDr !== 0 || closingCr !== 0) {
      results.push({
        accountId: acc.id,
        accountName: acc.name,
        groupName: acc.group || "",
        nature: acc.type,
        openingDr,
        openingCr,
        periodDebit: ledger.totalDebits,
        periodCredit: ledger.totalCredits,
        closingDr,
        closingCr
      });
    }
  });

  return results;
}



export async function generateSerialNumber(
  type: string,
  _unused: undefined,
  fiscalYearBS: string,
  previewOnly: boolean
): Promise<string> {
  try {
    const { getDB } = await import("./db");
    const db = getDB();
    const rows = await db.voucherSeries
      .filter((r: any) => r.voucherType === type && r.fiscalYearBS === fiscalYearBS)
      .toArray();
    const row = rows[0];

    if (row) {
      const padding = row.padding || 4;
      const serial = `${row.prefix}${String(row.currentNumber).padStart(padding, "0")}`;
      if (!previewOnly) {
        await db.voucherSeries.update(row.id, { currentNumber: row.currentNumber + 1 });
      }
      return serial;
    } else {
      const settingsArray = await db.companySettings.toArray();
      const settings = settingsArray[0];
      const config = settings?.voucherSeries?.[type] || { prefix: `${type}-`, nextNumber: 1, padding: 4 };
      const padding = config.padding || 4;
      const serial = `${config.prefix}${String(config.nextNumber).padStart(padding, "0")}`;
      if (!previewOnly && settings) {
        const updatedConfig = { ...config, nextNumber: config.nextNumber + 1 };
        const newSeries = { ...(settings.voucherSeries || {}), [type]: updatedConfig };
        await db.companySettings.update(settings.id, { voucherSeries: newSeries });
      }
      return serial;
    }
  } catch (error) {
    return `${type.toUpperCase().slice(0, 2)}-${Date.now().toString().slice(-6)}`;
  }
}

export function validateDoubleEntry(lines: any[]): { isValid: boolean; difference: number; message: string } {
  let dr = 0; let cr = 0;
  for (const l of lines) { dr += l.debit || 0; cr += l.credit || 0; }
  const diff = Math.abs(dr - cr);
  return {
    isValid: diff < 0.01,
    difference: diff,
    message: diff < 0.01 ? `Balanced` : `Unbalanced: Dr Rs.${dr} != Cr Rs.${cr}`
  };
}

export function resetAllSeriesForNewYear(): void {
  // Stub
}

export function computeAgingReport(
  invoices: Invoice[],
  parties: Party[],
  asOfDate: string,
  partyType?: "customer" | "supplier"
): Array<{
  partyId: string;
  partyName: string;
  partyPAN: string;
  current: number;
  days1to30: number;
  days31to60: number;
  days61to90: number;
  days91to180: number;
  days181to365: number;
  over365: number;
  total: number;
  oldestDueDate: string;
  contactPhone: string;
}> {
  const cutoffTime = new Date(asOfDate).getTime();

  const partyMap: Record<string, {
    partyId: string;
    partyName: string;
    partyPAN: string;
    current: number;
    days1to30: number;
    days31to60: number;
    days61to90: number;
    days91to180: number;
    days181to365: number;
    over365: number;
    total: number;
    oldestDueDate: string;
    contactPhone: string;
  }> = {};

  const filteredInvoices = invoices.filter(inv => {
    if (inv.paymentStatus !== PaymentStatus.UNPAID && inv.paymentStatus !== PaymentStatus.PARTIAL) return false;
    if (new Date(inv.date).getTime() > cutoffTime) return false;
    if (partyType) {
      if (partyType === "customer" && inv.type !== VoucherType.SALES_INVOICE) return false;
      if (partyType === "supplier" && inv.type !== VoucherType.PURCHASE_INVOICE) return false;
    }
    return true;
  });

  for (const inv of filteredInvoices) {
    const pendingAmount = inv.grandTotal - (inv.paidAmount || 0);
    if (pendingAmount <= 0.05) continue;

    const refDate = inv.dueDate || inv.date;
    const refTime = new Date(refDate).getTime();
    
    // Difference in days between asOfDate and dueDate
    const diffTime = cutoffTime - refTime;
    const overdueDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (!partyMap[inv.partyId]) {
      const party = parties.find(p => p.id === inv.partyId);
      partyMap[inv.partyId] = {
        partyId: inv.partyId,
        partyName: inv.partyName,
        partyPAN: party?.pan || party?.panNumber || inv.partyPan || "",
        current: 0,
        days1to30: 0,
        days31to60: 0,
        days61to90: 0,
        days91to180: 0,
        days181to365: 0,
        over365: 0,
        total: 0,
        oldestDueDate: refDate,
        contactPhone: party?.phone || ""
      };
    }

    const pm = partyMap[inv.partyId];

    if (overdueDays < 0) {
      pm.current += pendingAmount;
    } else if (overdueDays <= 30) {
      pm.days1to30 += pendingAmount;
    } else if (overdueDays <= 60) {
      pm.days31to60 += pendingAmount;
    } else if (overdueDays <= 90) {
      pm.days61to90 += pendingAmount;
    } else if (overdueDays <= 180) {
      pm.days91to180 += pendingAmount;
    } else if (overdueDays <= 365) {
      pm.days181to365 += pendingAmount;
    } else {
      pm.over365 += pendingAmount;
    }

    pm.total += pendingAmount;
    
    if (new Date(refDate).getTime() < new Date(pm.oldestDueDate).getTime()) {
      pm.oldestDueDate = refDate;
    }
  }

  return Object.values(partyMap).filter(p => p.total > 0.05);
}

