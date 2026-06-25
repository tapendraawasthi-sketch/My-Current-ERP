// ============================================================
// ACCOUNTING UTILITY FUNCTIONS — Sutra ERP
// ============================================================

import {
  Account,
  AccountType,
  JournalEntry,
  Invoice,
  VoucherStatus,
  LedgerEntry,
  VoucherType,
  TrialBalanceRow,
  PartyAging,
  PaymentStatus,
} from "@/types";

// ── Precision Rounding ───────────────────────────────────────
export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

// ── Account Nature ───────────────────────────────────────────
export function isDebitNature(type: AccountType): boolean {
  return type === AccountType.ASSET || type === AccountType.EXPENSE;
}

export function getAccountEffect(
  accountType: AccountType,
  debit: number,
  credit: number
): number {
  if (isDebitNature(accountType)) {
    return round2(debit - credit);
  }
  return round2(credit - debit);
}

// ── Account Balance ──────────────────────────────────────────
export function getAccountBalance(account: Account): {
  dr: number;
  cr: number;
  net: number;
  sign: "Dr" | "Cr";
} {
  const net = account.balance;
  const isDr = isDebitNature(account.type);
  if (isDr) {
    if (net >= 0) return { dr: net, cr: 0, net, sign: "Dr" };
    return { dr: 0, cr: Math.abs(net), net: Math.abs(net), sign: "Cr" };
  } else {
    if (net >= 0) return { dr: 0, cr: net, net, sign: "Cr" };
    return { dr: Math.abs(net), cr: 0, net: Math.abs(net), sign: "Dr" };
  }
}

// ── Recalculate All Account Balances ─────────────────────────
export function recalculateAccountBalances(
  accounts: Account[],
  vouchers: JournalEntry[]
): Account[] {
  const accMap = new Map<string, Account>();
  for (const acc of accounts) {
    const openingDr = acc.openingBalanceDr || 0;
    const openingCr = acc.openingBalanceCr || 0;
    const initialBalance = isDebitNature(acc.type)
      ? round2(openingDr - openingCr)
      : round2(openingCr - openingDr);
    accMap.set(acc.id, { ...acc, balance: initialBalance });
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
  const groups = allAccounts.filter((acc) => acc.isGroup);

  let balanceChanged = true;
  let iterations = 0;
  while (balanceChanged && iterations < 10) {
    balanceChanged = false;
    iterations++;
    for (const parent of groups) {
      const children = allAccounts.filter((acc) => acc.parentId === parent.id);
      let calc = 0;
      for (const child of children) {
        if (child.type === parent.type) {
          calc = round2(calc + child.balance);
        } else {
          const converted = isDebitNature(parent.type)
            ? isDebitNature(child.type) ? child.balance : -child.balance
            : isDebitNature(child.type) ? -child.balance : child.balance;
          calc = round2(calc + converted);
        }
      }
      if (parent.balance !== calc) {
        parent.balance = calc;
        balanceChanged = true;
      }
    }
  }
  return allAccounts;
}

// ── Compute Ledger Balance (range) ───────────────────────────
export function computeLedgerBalance(
  accountId: string,
  vouchers: JournalEntry[],
  invoices: Invoice[],
  fromDate: string,
  toDate: string,
  openingBalance: number,
  openingSign: "DR" | "CR"
): {
  openingBalance: number;
  openingDrCr: string;
  periodDr: number;
  periodCr: number;
  closingBalance: number;
  closingDrCr: string;
} {
  let periodDr = 0;
  let periodCr = 0;

  const postedVouchers = vouchers.filter(
    (v) =>
      v.status === VoucherStatus.POSTED &&
      v.date >= fromDate &&
      v.date <= toDate
  );

  for (const v of postedVouchers) {
    for (const line of v.lines) {
      if (line.accountId === accountId) {
        periodDr = round2(periodDr + line.debit);
        periodCr = round2(periodCr + line.credit);
      }
    }
  }

  // Compute from invoices if any are posted
  for (const inv of invoices) {
    if (
      (inv.voucherStatus === VoucherStatus.POSTED ||
        inv.status === PaymentStatus.PAID) &&
      inv.date >= fromDate &&
      inv.date <= toDate
    ) {
      for (const line of inv.lines) {
        if (line.accountId === accountId) {
          periodDr = round2(periodDr + 0); // invoices handle through journal
          periodCr = round2(periodCr + 0);
        }
      }
    }
  }

  const openingVal = openingSign === "DR" ? openingBalance : -openingBalance;
  const net = round2(openingVal + periodDr - periodCr);
  const closingBalance = Math.abs(net);
  const closingDrCr = net >= 0 ? "DR" : "CR";

  return {
    openingBalance,
    openingDrCr: openingSign,
    periodDr,
    periodCr,
    closingBalance,
    closingDrCr,
  };
}

// ── Compute Ledger Entries (Statement) ───────────────────────
export function computeLedger(
  accountId: string,
  accounts: Account[],
  vouchers: JournalEntry[],
  startDate: string,
  endDate: string
): {
  openingBalance: number;
  openingType: "Dr" | "Cr";
  entries: LedgerEntry[];
  closingBalance: number;
  closingType: "Dr" | "Cr";
} {
  const account = accounts.find((a) => a.id === accountId);
  if (!account) {
    return {
      openingBalance: 0,
      openingType: "Dr",
      entries: [],
      closingBalance: 0,
      closingType: "Dr",
    };
  }

  const openingDr = account.openingBalanceDr || 0;
  const openingCr = account.openingBalanceCr || 0;
  let runningBalance = isDebitNature(account.type)
    ? round2(openingDr - openingCr)
    : round2(openingCr - openingDr);
  const openingBalance = Math.abs(runningBalance);
  const openingType = runningBalance >= 0
    ? (isDebitNature(account.type) ? "Dr" : "Cr")
    : (isDebitNature(account.type) ? "Cr" : "Dr");

  // Before-period posted vouchers to get opening balance at startDate
  const beforePeriod = vouchers.filter(
    (v) => v.status === VoucherStatus.POSTED && v.date < startDate
  );
  for (const v of beforePeriod) {
    for (const line of v.lines) {
      if (line.accountId === accountId) {
        const effect = getAccountEffect(account.type, line.debit, line.credit);
        runningBalance = round2(runningBalance + effect);
      }
    }
  }

  const openingBalanceAtStart = Math.abs(runningBalance);
  const openingTypeAtStart: "Dr" | "Cr" = runningBalance >= 0
    ? (isDebitNature(account.type) ? "Dr" : "Cr")
    : (isDebitNature(account.type) ? "Cr" : "Dr");

  // Period vouchers
  const periodVouchers = vouchers
    .filter(
      (v) =>
        v.status === VoucherStatus.POSTED &&
        v.date >= startDate &&
        v.date <= endDate
    )
    .sort((a, b) => a.date.localeCompare(b.date));

  const entries: LedgerEntry[] = [];
  for (const v of periodVouchers) {
    for (const line of v.lines) {
      if (line.accountId === accountId) {
        const effect = getAccountEffect(account.type, line.debit, line.credit);
        runningBalance = round2(runningBalance + effect);
        entries.push({
          id: line.id,
          date: v.date,
          voucherNumber: v.voucherNumber,
          voucherType: v.voucherType,
          narration: line.description || v.narration,
          debit: line.debit,
          credit: line.credit,
          balance: Math.abs(runningBalance),
          balanceType: runningBalance >= 0
            ? (isDebitNature(account.type) ? "Dr" : "Cr")
            : (isDebitNature(account.type) ? "Cr" : "Dr"),
          reference: v.referenceNumber,
        });
      }
    }
  }

  const closingBalance = Math.abs(runningBalance);
  const closingType: "Dr" | "Cr" = runningBalance >= 0
    ? (isDebitNature(account.type) ? "Dr" : "Cr")
    : (isDebitNature(account.type) ? "Cr" : "Dr");

  return {
    openingBalance: openingBalanceAtStart,
    openingType: openingTypeAtStart,
    entries,
    closingBalance,
    closingType,
  };
}

// ── Trial Balance ─────────────────────────────────────────────
export function computeTrialBalance(
  accounts: Account[],
  vouchers: JournalEntry[],
  fromDate: string,
  toDate: string
): TrialBalanceRow[] {
  const rows: TrialBalanceRow[] = [];

  const postedBefore = vouchers.filter(
    (v) => v.status === VoucherStatus.POSTED && v.date < fromDate
  );
  const postedInPeriod = vouchers.filter(
    (v) =>
      v.status === VoucherStatus.POSTED &&
      v.date >= fromDate &&
      v.date <= toDate
  );

  for (const acc of accounts) {
    // Opening
    let openingDr = acc.openingBalanceDr || 0;
    let openingCr = acc.openingBalanceCr || 0;
    for (const v of postedBefore) {
      for (const line of v.lines) {
        if (line.accountId === acc.id) {
          openingDr = round2(openingDr + line.debit);
          openingCr = round2(openingCr + line.credit);
        }
      }
    }

    // Period
    let periodDr = 0;
    let periodCr = 0;
    for (const v of postedInPeriod) {
      for (const line of v.lines) {
        if (line.accountId === acc.id) {
          periodDr = round2(periodDr + line.debit);
          periodCr = round2(periodCr + line.credit);
        }
      }
    }

    if (
      openingDr === 0 &&
      openingCr === 0 &&
      periodDr === 0 &&
      periodCr === 0
    )
      continue;

    const closingDr = round2(openingDr + periodDr);
    const closingCr = round2(openingCr + periodCr);

    rows.push({
      accountId: acc.id,
      accountName: acc.name,
      accountCode: acc.code,
      accountType: acc.type,
      openingDr,
      openingCr,
      periodDr,
      periodCr,
      closingDr,
      closingCr,
      level: 0,
      isGroup: acc.isGroup,
    });
  }

  return rows;
}

// ── Party Aging ───────────────────────────────────────────────
export function computePartyAging(
  invoices: Invoice[],
  asOfDate: string
): PartyAging[] {
  const agingMap = new Map<string, PartyAging>();
  const today = new Date(asOfDate);

  for (const inv of invoices) {
    if (
      inv.status === PaymentStatus.PAID ||
      inv.status === PaymentStatus.VOID ||
      inv.voucherStatus === VoucherStatus.VOID
    )
      continue;

    const outstanding = round2(inv.totalAmount - inv.amountPaid);
    if (outstanding <= 0) continue;

    const due = new Date(inv.dueDate);
    const daysPastDue = Math.floor(
      (today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (!agingMap.has(inv.partyId)) {
      agingMap.set(inv.partyId, {
        partyId: inv.partyId,
        partyName: inv.partyName || inv.partyId,
        current: 0,
        days1to30: 0,
        days31to60: 0,
        days61to90: 0,
        days91plus: 0,
        total: 0,
      });
    }

    const row = agingMap.get(inv.partyId)!;
    if (daysPastDue <= 0) row.current = round2(row.current + outstanding);
    else if (daysPastDue <= 30) row.days1to30 = round2(row.days1to30 + outstanding);
    else if (daysPastDue <= 60) row.days31to60 = round2(row.days31to60 + outstanding);
    else if (daysPastDue <= 90) row.days61to90 = round2(row.days61to90 + outstanding);
    else row.days91plus = round2(row.days91plus + outstanding);
    row.total = round2(
      row.current + row.days1to30 + row.days31to60 + row.days61to90 + row.days91plus
    );
  }

  return Array.from(agingMap.values()).sort((a, b) => b.total - a.total);
}

// ── Invoice Line Tax Calculation ─────────────────────────────
export function calculateInvoiceLine(
  quantity: number,
  unitPrice: number,
  discountPercent: number,
  taxPercent: number
): {
  lineTotal: number;
  discountAmount: number;
  taxAmount: number;
  lineTotalWithTax: number;
} {
  const gross = round2(quantity * unitPrice);
  const discountAmount = round2(gross * (discountPercent / 100));
  const lineTotal = round2(gross - discountAmount);
  const taxAmount = round2(lineTotal * (taxPercent / 100)); // line-level tax per blueprint
  const lineTotalWithTax = round2(lineTotal + taxAmount);
  return { lineTotal, discountAmount, taxAmount, lineTotalWithTax };
}

// ── Number Formatting ─────────────────────────────────────────
export function formatCurrency(
  amount: number,
  currency = "USD",
  locale = "en-US"
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatAmount(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

// ── Date Utilities ────────────────────────────────────────────
export function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

export function addMonthsEndOfMonth(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  endOfMonth.setDate(endOfMonth.getDate() + days);
  return endOfMonth.toISOString().split("T")[0];
}

export function today(): string {
  return new Date().toISOString().split("T")[0];
}

// ── Voucher Number Generator ──────────────────────────────────
export function generateVoucherNumber(
  prefix: string,
  next: number
): string {
  return `${prefix}-${String(next).padStart(5, "0")}`;
}

// ── Period Lock Validation ────────────────────────────────────
export function isPeriodLocked(
  date: string,
  hardLockDate?: string,
  softLockDate?: string,
  softLockOverride?: boolean
): { locked: boolean; type: "hard" | "soft" | null; message?: string } {
  if (hardLockDate && date <= hardLockDate) {
    return {
      locked: true,
      type: "hard",
      message: `Period is hard-locked up to ${hardLockDate}. No entries allowed.`,
    };
  }
  if (softLockDate && date <= softLockDate && !softLockOverride) {
    return {
      locked: true,
      type: "soft",
      message: `Period is soft-locked up to ${softLockDate}. An override password is required.`,
    };
  }
  return { locked: false, type: null };
}

// ── Double-Entry Validation ───────────────────────────────────
export function validateJournalBalance(
  lines: { debit: number; credit: number }[]
): { valid: boolean; totalDebit: number; totalCredit: number; difference: number } {
  const totalDebit = round2(lines.reduce((s, l) => s + (l.debit || 0), 0));
  const totalCredit = round2(lines.reduce((s, l) => s + (l.credit || 0), 0));
  const difference = round2(Math.abs(totalDebit - totalCredit));
  return { valid: difference === 0, totalDebit, totalCredit, difference };
}

// ── Duplicate Invoice Reference Check ────────────────────────
export function isDuplicateReference(
  reference: string,
  vendorId: string,
  existingInvoices: Invoice[]
): boolean {
  return existingInvoices.some(
    (inv) =>
      inv.billReference === reference &&
      inv.partyId === vendorId &&
      inv.voucherStatus !== "VOID"
  );
}
