import type { DateRangeQuery } from "@fios/kernel";
import { createLegacyStateReader, readLegacyState } from "@fios/legacy";
import {
  computeTrialBalance,
  computeProfitLoss,
  computeBalanceSheet,
  computeLedgerBalance,
  getAccountBalance,
} from "@/lib/accounting";
import {
  computeStockSummary,
  computeTotalClosingStockValue,
  mapConfigMethodToValuation,
  movementsToStockRaw,
  type ValuationMethod,
} from "@/lib/stockValuation";

const state = createLegacyStateReader();

export function vouchersInRange(range?: DateRangeQuery) {
  const vouchers = state.getVouchers() as Array<{ date?: string; status?: string }>;
  if (!range?.fromDate && !range?.toDate) return vouchers;
  return vouchers.filter((v) => {
    const d = v.date ?? "";
    if (range.fromDate && d < range.fromDate) return false;
    if (range.toDate && d > range.toDate) return false;
    return true;
  });
}

export function postedVouchersInRange(range?: DateRangeQuery) {
  return vouchersInRange(range).filter((v) => v.status === "posted");
}

export function buildLedgerRows(accountId: string, range?: DateRangeQuery) {
  const accounts = state.getAccounts() as Array<Record<string, unknown>>;
  const account = accounts.find((a) => a.id === accountId);
  if (!account) return { rows: [], openingBalance: 0, closingBalance: 0, account: null };

  const obDr = Number(account.openingBalanceDr ?? 0);
  const obCr = Number(account.openingBalanceCr ?? 0);
  let runningBalance = obDr - obCr;

  const rows: Array<Record<string, unknown>> = [
    {
      id: "opening",
      date: "",
      particulars: "Opening Balance",
      voucherNo: "",
      debit: obDr,
      credit: obCr,
      balance: runningBalance,
      isOpening: true,
    },
  ];

  const relevant = (postedVouchersInRange(range) as Array<Record<string, unknown>>)
    .filter((v) =>
      ((v.lines as Array<{ accountId?: string }>) || []).some((line) => line.accountId === accountId),
    )
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));

  for (const voucher of relevant) {
    const lines = (voucher.lines as Array<Record<string, unknown>>) || [];
    const lineForAccount = lines.find((line) => line.accountId === accountId);
    const debit = Number(lineForAccount?.debit ?? 0);
    const credit = Number(lineForAccount?.credit ?? 0);
    runningBalance += debit - credit;

    const otherNames = lines
      .filter((line) => line.accountId !== accountId)
      .map((line) => {
        const acc = accounts.find((a) => a.id === line.accountId);
        return acc?.name ?? "Unknown";
      })
      .join(", ");

    rows.push({
      id: voucher.id,
      date: voucher.date,
      particulars: otherNames || voucher.narration || "",
      voucherNo: voucher.voucherNo,
      voucherType: voucher.type,
      debit,
      credit,
      balance: runningBalance,
      narration: voucher.narration,
    });
  }

  return {
    rows,
    openingBalance: obDr - obCr,
    closingBalance: computeLedgerBalance(
      accountId,
      postedVouchersInRange(range),
      Number(account.openingBalance ?? 0),
      obDr,
      obCr,
    ),
    account,
  };
}

export function buildDayBookEntries(range?: DateRangeQuery) {
  const vouchers = postedVouchersInRange(range) as Array<Record<string, unknown>>;
  const invoices = (state.getInvoices() as Array<Record<string, unknown>>).filter((inv) => {
    const d = String(inv.date ?? "");
    if (range?.fromDate && d < range.fromDate) return false;
    if (range?.toDate && d > range.toDate) return false;
    return inv.status === "posted" || inv.status === "active";
  });

  const entries: Array<Record<string, unknown>> = [];

  for (const voucher of vouchers) {
    entries.push({
      id: voucher.id,
      date: voucher.date,
      type: "voucher",
      subType: voucher.type,
      number: voucher.voucherNo,
      partyName: voucher.partyName,
      amount: voucher.totalAmount ?? voucher.amount,
      narration: voucher.narration,
      lines: voucher.lines,
      source: voucher,
    });
  }

  for (const invoice of invoices) {
    entries.push({
      id: invoice.id,
      date: invoice.date,
      type: "invoice",
      subType: invoice.type ?? invoice.invoiceType,
      number: invoice.invoiceNo,
      partyName: invoice.partyName,
      amount: invoice.grandTotal ?? invoice.totalAmount,
      narration: invoice.narration,
      lines: invoice.lines,
      source: invoice,
    });
  }

  return entries.sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

export function readTrialBalance(range?: DateRangeQuery) {
  return computeTrialBalance(state.getAccounts() as never[], vouchersInRange(range));
}

export function readProfitLoss(range?: DateRangeQuery) {
  return computeProfitLoss(
    state.getAccounts() as never[],
    state.getVouchers(),
    range?.fromDate,
    range?.toDate,
  );
}

export function readBalanceSheet(asOfDate?: string) {
  return computeBalanceSheet(state.getAccounts() as never[], state.getVouchers(), asOfDate);
}

export function readLedgerBalance(accountId: string, range?: DateRangeQuery) {
  const account = (state.getAccounts() as Array<Record<string, unknown>>).find(
    (a) => a.id === accountId,
  );
  if (!account) return 0;
  return computeLedgerBalance(
    accountId,
    vouchersInRange(range),
    Number(account.openingBalance ?? 0),
    Number(account.openingBalanceDr ?? 0),
    Number(account.openingBalanceCr ?? 0),
  );
}

export function readAccountBalance(accountId: string) {
  return getAccountBalance(accountId, state.getVouchers(), state.getAccounts());
}

export function readStockSummary(
  method: ValuationMethod,
  fromDate?: string,
  toDate?: string,
  itemId?: string,
) {
  const movements = movementsToStockRaw(state.getStockMovements());
  const filtered = itemId ? movements.filter((m) => m.itemId === itemId) : movements;
  return computeStockSummary(filtered, method, fromDate, toDate);
}

export function readInventoryValuation(method: ValuationMethod, asAtDate?: string) {
  return computeTotalClosingStockValue(state.getStockMovements(), method, asAtDate);
}

export function readTaxSummary() {
  const entries = readLegacyState().tdsEntries || [];
  const totalTds = (entries as Array<{ tdsAmount?: number; amount?: number }>).reduce(
    (sum, entry) => sum + Number(entry.tdsAmount ?? entry.amount ?? 0),
    0,
  );
  return { entries, totalTds, count: entries.length };
}

export function resolveValuationMethod(): ValuationMethod {
  const settings = state.getCompanySettings() as Record<string, unknown> | null;
  return mapConfigMethodToValuation(String(settings?.stockValuationMethod ?? "fifo"));
}
