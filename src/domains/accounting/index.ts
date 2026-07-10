import type { JsonObject } from "@fios/kernel";
import { executeCommand, executeCommandVoid, CommandTypes, AggregateTypes } from "@fios/command-bus";
import { executeQuerySync, QueryTypes } from "@fios/query-bus";
import { isMigrationFlagEnabled } from "@/platform/flags/registry";
import { createLegacyStateReader } from "@fios/legacy";
import { validateVoucherBalance, assertDateInFiscalYear } from "@/store/store.types";

const state = createLegacyStateReader();

export const accountingDomain = {
  createAccount(account: JsonObject) {
    return executeCommand({
      commandType: CommandTypes.CREATE_ACCOUNT,
      aggregateType: AggregateTypes.ACCOUNT,
      payload: account,
    });
  },
  updateAccount(id: string, updates: JsonObject) {
    return executeCommandVoid({
      commandType: CommandTypes.UPDATE_ACCOUNT,
      aggregateType: AggregateTypes.ACCOUNT,
      aggregateId: id,
      payload: { id, updates },
    });
  },
  deleteAccount(id: string) {
    return executeCommand<boolean>({
      commandType: CommandTypes.DELETE_ACCOUNT,
      aggregateType: AggregateTypes.ACCOUNT,
      aggregateId: id,
      payload: { id },
    });
  },
  postVoucher(voucher: JsonObject) {
    return executeCommand({
      commandType: CommandTypes.POST_VOUCHER,
      aggregateType: AggregateTypes.VOUCHER,
      payload: voucher,
    });
  },
  validateBalance(lines: JsonObject[], isDraft = false) {
    return validateVoucherBalance(lines, isDraft);
  },
  assertDateInFiscalYear(date: string) {
    return assertDateInFiscalYear(date, state.getCurrentFiscalYear() as never);
  },
  listAccounts() {
    if (isMigrationFlagEnabled("MIGRATION_QUERY_BUS")) {
      return executeQuerySync({ queryType: QueryTypes.LIST_ACCOUNTS, payload: {} });
    }
    return state.getAccounts();
  },
  listVouchers() {
    if (isMigrationFlagEnabled("MIGRATION_QUERY_BUS")) {
      return executeQuerySync({ queryType: QueryTypes.LIST_VOUCHERS, payload: {} });
    }
    return state.getVouchers();
  },
};

export type AccountingDomain = typeof accountingDomain;
