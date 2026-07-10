import { executeQuerySync, QueryTypes } from "@fios/query-bus";
import { isMigrationFlagEnabled } from "@/platform/flags/registry";
import {
  computeTrialBalance,
  computeProfitLoss,
  computeBalanceSheet,
  computeLedgerBalance,
  computePartyStatement,
  computeAgingReport,
  getAccountBalance,
} from "@/lib/accounting";
import { createLegacyStateReader } from "@fios/legacy";
import type { DateRangeQuery } from "@fios/kernel";

const state = createLegacyStateReader();

function vouchersInRange(range?: DateRangeQuery) {
  const vouchers = state.getVouchers() as Array<{ date?: string }>;
  if (!range?.fromDate && !range?.toDate) return vouchers;
  return vouchers.filter((v) => {
    const d = v.date ?? "";
    if (range.fromDate && d < range.fromDate) return false;
    if (range.toDate && d > range.toDate) return false;
    return true;
  });
}

function rangePayload(range?: DateRangeQuery) {
  return {
    fromDate: range?.fromDate,
    toDate: range?.toDate,
  };
}

export const reportingDomain = {
  trialBalance(range?: DateRangeQuery) {
    if (isMigrationFlagEnabled("MIGRATION_QUERY_BUS")) {
      return executeQuerySync({
        queryType: QueryTypes.TRIAL_BALANCE,
        payload: rangePayload(range),
      });
    }
    return computeTrialBalance(state.getAccounts() as never[], vouchersInRange(range));
  },
  profitAndLoss(range?: DateRangeQuery) {
    if (isMigrationFlagEnabled("MIGRATION_QUERY_BUS")) {
      return executeQuerySync({
        queryType: QueryTypes.PROFIT_LOSS,
        payload: rangePayload(range),
      });
    }
    return computeProfitLoss(
      state.getAccounts() as never[],
      state.getVouchers(),
      range?.fromDate,
      range?.toDate,
    );
  },
  balanceSheet(asOfDate?: string) {
    if (isMigrationFlagEnabled("MIGRATION_QUERY_BUS")) {
      return executeQuerySync({
        queryType: QueryTypes.BALANCE_SHEET,
        payload: { asOfDate },
      });
    }
    return computeBalanceSheet(state.getAccounts() as never[], state.getVouchers(), asOfDate);
  },
  ledgerBalance(accountId: string, range?: DateRangeQuery) {
    if (isMigrationFlagEnabled("MIGRATION_QUERY_BUS")) {
      const result = executeQuerySync<{ balance: number }>({
        queryType: QueryTypes.LEDGER,
        payload: { accountId, ...rangePayload(range) },
      });
      return result?.balance ?? 0;
    }
    const account = (state.getAccounts() as Array<Record<string, unknown>>).find(
      (a) => a.id === accountId,
    );
    const ob = Number(account?.openingBalance ?? 0);
    const obDr = Number(account?.openingBalanceDr ?? 0);
    const obCr = Number(account?.openingBalanceCr ?? 0);
    return computeLedgerBalance(accountId, vouchersInRange(range), ob, obDr, obCr);
  },
  accountBalance(accountId: string) {
    if (isMigrationFlagEnabled("MIGRATION_QUERY_BUS")) {
      const result = executeQuerySync<{ balance: number }>({
        queryType: QueryTypes.LEDGER,
        payload: { accountId },
      });
      return result?.balance ?? 0;
    }
    return getAccountBalance(accountId, state.getVouchers(), state.getAccounts());
  },
  partyStatement(partyId: string, range?: DateRangeQuery) {
    const party = (state.getParties() as Array<{ id?: string }>).find((p) => p.id === partyId);
    if (!party) {
      return { rows: [], openingBalance: 0, closingBalance: 0 };
    }
    return computePartyStatement(
      party,
      state.getAccounts() as never[],
      vouchersInRange(range),
      state.getInvoices() as never[],
      range?.fromDate,
      range?.toDate,
    );
  },
  agingReport(asOfDate?: string, partyType?: string) {
    return computeAgingReport(
      state.getInvoices() as never[],
      state.getParties() as never[],
      asOfDate,
      partyType,
    );
  },
};

export type ReportingDomain = typeof reportingDomain;
