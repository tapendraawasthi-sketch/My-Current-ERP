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

export function computeTrialBalance(
  accounts: Account[],
  vouchers: JournalEntry[],
  startDate: string,
  endDate: string,
): TrialBalanceRow[] {
  try {
    const ledgerAccounts = accounts.filter((acc) => !acc.isGroup);
    const postedVouchers = vouchers.filter((v) => v.status === VoucherStatus.POSTED);

    const startMs = new Date(startDate).getTime();
    const endMs = new Date(endDate).getTime();

    return ledgerAccounts
      .map((acc) => {
        const openingDrInitial = acc.openingBalanceDr || 0;
        const openingCrInitial = acc.openingBalanceCr || 0;

        let preDebitSum = 0;
        let preCreditSum = 0;
        let periodDebit = 0;
        let periodCredit = 0;

        for (const v of postedVouchers) {
          const vTime = new Date(v.date).getTime();
          for (const line of v.lines) {
            if (line.accountId === acc.id) {
              if (vTime < startMs) {
                preDebitSum += line.debit;
                preCreditSum += line.credit;
              } else if (vTime >= startMs && vTime <= endMs) {
                periodDebit += line.debit;
                periodCredit += line.credit;
              }
            }
          }
        }

        const initDr = round2(openingDrInitial + preDebitSum);
        const initCr = round2(openingCrInitial + preCreditSum);

        let openingDr = 0;
        let openingCr = 0;

        if (initDr >= initCr) {
          openingDr = round2(initDr - initCr);
        } else {
          openingCr = round2(initCr - initDr);
        }

        const netClosingDebitTotal = round2(initDr + periodDebit);
        const netClosingCreditTotal = round2(initCr + periodCredit);

        let closingDr = 0;
        let closingCr = 0;

        if (netClosingDebitTotal >= netClosingCreditTotal) {
          closingDr = round2(netClosingDebitTotal - netClosingCreditTotal);
        } else {
          closingCr = round2(netClosingCreditTotal - netClosingDebitTotal);
        }

        return {
          accountId: acc.id,
          accountCode: acc.code,
          accountName: acc.name,
          level: acc.level,
          openingDr,
          openingCr,
          debit: round2(periodDebit),
          credit: round2(periodCredit),
          closingDr,
          closingCr,
        };
      })
      .sort((a, b) => a.accountCode.localeCompare(b.accountCode));
  } catch (error) {
    console.error("computeTrialBalance error:", error);
    return [];
  }
}

// ==========================================
// 3. PROFIT & LOSS STATEMENT
// ==========================================

export function computeProfitLoss(
  accounts: Account[],
  vouchers: JournalEntry[],
  startDate: string,
  endDate: string,
): {
  income: ProfitLossRow[];
  expenses: ProfitLossRow[];
  grossProfit: number;
  netProfit: number;
  totalIncome: number;
  totalExpenses: number;
} {
  try {
    const isolatedAccounts = accounts.map((acc) => ({ ...acc, balance: 0 }));
    const postedVouchers = vouchers.filter(
      (v) => v.status === VoucherStatus.POSTED && v.date >= startDate && v.date <= endDate,
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

    const incomeLedgels = isolatedAccounts.filter(
      (acc) => !acc.isGroup && acc.type === AccountType.INCOME,
    );
    const expenseLedgers = isolatedAccounts.filter(
      (acc) => !acc.isGroup && acc.type === AccountType.EXPENSE,
    );

    const salesAccounts = incomeLedgels.filter(
      (acc) =>
        acc.group?.toLowerCase().includes("sales") || acc.name.toLowerCase().includes("sales"),
    );
    const otherIncomes = incomeLedgels.filter((acc) => !salesAccounts.includes(acc));

    const purchaseAccounts = expenseLedgers.filter(
      (acc) =>
        acc.group?.toLowerCase().includes("purchase") ||
        acc.name.toLowerCase().includes("purchase"),
    );

    const directExpenses = expenseLedgers.filter(
      (acc) =>
        acc.group?.toLowerCase().includes("direct") || acc.name.toLowerCase().includes("direct"),
    );

    const operatingExpenses = expenseLedgers.filter(
      (acc) => !purchaseAccounts.includes(acc) && !directExpenses.includes(acc),
    );

    const salesTotal = round2(salesAccounts.reduce((sum, item) => sum + item.balance, 0));
    const purchasesTotal = round2(purchaseAccounts.reduce((sum, item) => sum + item.balance, 0));
    const directCostsTotal = round2(directExpenses.reduce((sum, item) => sum + item.balance, 0));
    const otherIncomeTotal = round2(otherIncomes.reduce((sum, item) => sum + item.balance, 0));
    const operatingExpensesTotal = round2(
      operatingExpenses.reduce((sum, item) => sum + item.balance, 0),
    );

    const grossProfit = round2(salesTotal - purchasesTotal - directCostsTotal);
    const totalIncome = round2(salesTotal + otherIncomeTotal);
    const totalExpenses = round2(purchasesTotal + directCostsTotal + operatingExpensesTotal);
    const netProfit = round2(grossProfit + otherIncomeTotal - operatingExpensesTotal);

    const incomeRows: ProfitLossRow[] = [
      {
        accountId: "inc-sales",
        accountName: "Revenue from Sales Operations",
        amount: salesTotal,
        isGroup: true,
        level: 1,
        children: salesAccounts.map((a) => ({
          accountId: a.id,
          accountName: a.code + " - " + a.name,
          amount: a.balance,
          isGroup: false,
          level: 2,
        })),
      },
      {
        accountId: "inc-other",
        accountName: "Other non-operating Income",
        amount: otherIncomeTotal,
        isGroup: true,
        level: 1,
        children: otherIncomes.map((a) => ({
          accountId: a.id,
          accountName: a.code + " - " + a.name,
          amount: a.balance,
          isGroup: false,
          level: 2,
        })),
      },
    ];

    const expenseRows: ProfitLossRow[] = [
      {
        accountId: "exp-purchase-cogs",
        accountName: "Purchases (COGS Components)",
        amount: purchasesTotal,
        isGroup: true,
        level: 1,
        children: purchaseAccounts.map((a) => ({
          accountId: a.id,
          accountName: a.code + " - " + a.name,
          amount: a.balance,
          isGroup: false,
          level: 2,
        })),
      },
      {
        accountId: "exp-direct",
        accountName: "Direct Manufacturing / Sourcing Expenses",
        amount: directCostsTotal,
        isGroup: true,
        level: 1,
        children: directExpenses.map((a) => ({
          accountId: a.id,
          accountName: a.code + " - " + a.name,
          amount: a.balance,
          isGroup: false,
          level: 2,
        })),
      },
      {
        accountId: "exp-operating",
        accountName: "Administrative and Operating Expenses",
        amount: operatingExpensesTotal,
        isGroup: true,
        level: 1,
        children: operatingExpenses.map((a) => ({
          accountId: a.id,
          accountName: a.code + " - " + a.name,
          amount: a.balance,
          isGroup: false,
          level: 2,
        })),
      },
    ];

    return {
      income: incomeRows,
      expenses: expenseRows,
      grossProfit,
      netProfit,
      totalIncome,
      totalExpenses,
    };
  } catch (error) {
    console.error("computeProfitLoss error:", error);
    return {
      income: [],
      expenses: [],
      grossProfit: 0,
      netProfit: 0,
      totalIncome: 0,
      totalExpenses: 0,
    };
  }
}

// ==========================================
// 4. BALANCE SHEET
// ==========================================

export function computeBalanceSheet(
  accounts: Account[],
  vouchers: JournalEntry[],
  asOfDate: string,
): {
  assets: BalanceSheetRow[];
  liabilities: BalanceSheetRow[];
  equity: BalanceSheetRow[];
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  isBalanced: boolean;
} {
  try {
    const staticClones = accounts.map((a) => ({ ...a, balance: 0 }));
    const cutoffTime = new Date(asOfDate).getTime();
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

    const groupsAndSubgroups = staticClones.filter((acc) => acc.isGroup);
    let balanceChanged = true;
    let iterations = 0;
    while (balanceChanged && iterations < 10) {
      balanceChanged = false;
      iterations++;
      for (const parent of groupsAndSubgroups) {
        const children = staticClones.filter((acc) => acc.parentId === parent.id);
        let calcVal = 0;
        for (const child of children) {
          if (child.type === parent.type) {
            calcVal = round2(calcVal + child.balance);
          } else {
            const converted = isDebitNature(parent.type)
              ? isDebitNature(child.type)
                ? child.balance
                : -child.balance
              : isDebitNature(child.type)
                ? -child.balance
                : child.balance;
            calcVal = round2(calcVal + converted);
          }
        }
        if (parent.balance !== calcVal) {
          parent.balance = calcVal;
          balanceChanged = true;
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

    const fixedAssetSub = assetLedgers.filter((a) => a.group?.toLowerCase().includes("fixed"));
    const currentAssetSub = assetLedgers.filter((a) => !fixedAssetSub.includes(a));

    const currentLiabilitySub = liabilityLedgers.filter(
      (a) =>
        a.group?.toLowerCase().includes("current") || a.group?.toLowerCase().includes("duties"),
    );
    const termLiabilitiesSub = liabilityLedgers.filter((a) => !currentLiabilitySub.includes(a));

    const totalAssets = round2(assetLedgers.reduce((sum, item) => sum + item.balance, 0));
    const totalLiabilities = round2(liabilityLedgers.reduce((sum, item) => sum + item.balance, 0));
    const baseEquity = round2(equityLedgers.reduce((sum, item) => sum + item.balance, 0));
    const totalEquity = round2(baseEquity + currentPeriodNetProfit);

    const assetsTree: BalanceSheetRow[] = [
      {
        accountId: "bs-fa",
        accountName: "Non-Current Assets / Fixed Assets",
        amount: round2(fixedAssetSub.reduce((s, i) => s + i.balance, 0)),
        isGroup: true,
        level: 1,
        children: fixedAssetSub.map((a) => ({
          accountId: a.id,
          accountName: `${a.code} - ${a.name}`,
          amount: a.balance,
          isGroup: false,
          level: 2,
        })),
      },
      {
        accountId: "bs-ca",
        accountName: "Current Assets",
        amount: round2(currentAssetSub.reduce((s, i) => s + i.balance, 0)),
        isGroup: true,
        level: 1,
        children: currentAssetSub.map((a) => ({
          accountId: a.id,
          accountName: `${a.code} - ${a.name}`,
          amount: a.balance,
          isGroup: false,
          level: 2,
        })),
      },
    ];

    const liabilitiesTree: BalanceSheetRow[] = [
      {
        accountId: "bs-tl",
        accountName: "Secured/Long-term Loans & Liabilities",
        amount: round2(termLiabilitiesSub.reduce((s, i) => s + i.balance, 0)),
        isGroup: true,
        level: 1,
        children: termLiabilitiesSub.map((a) => ({
          accountId: a.id,
          accountName: `${a.code} - ${a.name}`,
          amount: a.balance,
          isGroup: false,
          level: 2,
        })),
      },
      {
        accountId: "bs-cl",
        accountName: "Current Liabilities & Duties",
        amount: round2(currentLiabilitySub.reduce((s, i) => s + i.balance, 0)),
        isGroup: true,
        level: 1,
        children: currentLiabilitySub.map((a) => ({
          accountId: a.id,
          accountName: `${a.code} - ${a.name}`,
          amount: a.balance,
          isGroup: false,
          level: 2,
        })),
      },
    ];

    const equityTree: BalanceSheetRow[] = [
      {
        accountId: "bs-eq-cap",
        accountName: "Share Capital / Partners Investment",
        amount: baseEquity,
        isGroup: true,
        level: 1,
        children: equityLedgers.map((a) => ({
          accountId: a.id,
          accountName: `${a.code} - ${a.name}`,
          amount: a.balance,
          isGroup: false,
          level: 2,
        })),
      },
      {
        accountId: "bs-eq-re",
        accountName: "Retained Earnings (Current Period surplus)",
        amount: currentPeriodNetProfit,
        isGroup: false,
        level: 1,
        children: [],
      },
    ];

    const isBalanced = Math.abs(totalAssets - (totalLiabilities + totalEquity)) <= 0.05;

    return {
      assets: assetsTree,
      liabilities: liabilitiesTree,
      equity: equityTree,
      totalAssets,
      totalLiabilities,
      totalEquity,
      isBalanced,
    };
  } catch (error) {
    console.error("computeBalanceSheet error:", error);
    return {
      assets: [],
      liabilities: [],
      equity: [],
      totalAssets: 0,
      totalLiabilities: 0,
      totalEquity: 0,
      isBalanced: true,
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
