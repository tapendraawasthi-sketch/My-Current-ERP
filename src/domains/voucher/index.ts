import type { JsonObject } from "@fios/kernel";
import { executeCommand, executeCommandVoid, CommandTypes, AggregateTypes } from "@fios/command-bus";
import { executeQuerySync, QueryTypes } from "@fios/query-bus";
import { isMigrationFlagEnabled } from "@/platform/flags/registry";
import { createLegacyStateReader } from "@fios/legacy";

const state = createLegacyStateReader();

export const voucherDomain = {
  post(voucher: JsonObject) {
    return executeCommand({
      commandType: CommandTypes.POST_VOUCHER,
      aggregateType: AggregateTypes.VOUCHER,
      payload: voucher,
    });
  },
  update(id: string, updates: JsonObject) {
    return executeCommandVoid({
      commandType: CommandTypes.UPDATE_VOUCHER,
      aggregateType: AggregateTypes.VOUCHER,
      aggregateId: id,
      payload: { id, updates },
    });
  },
  cancel(id: string, reason: string) {
    return executeCommandVoid({
      commandType: CommandTypes.CANCEL_VOUCHER,
      aggregateType: AggregateTypes.VOUCHER,
      aggregateId: id,
      payload: { id, reason },
    });
  },
  list() {
    if (isMigrationFlagEnabled("MIGRATION_QUERY_BUS")) {
      return executeQuerySync({ queryType: QueryTypes.LIST_VOUCHERS, payload: {} });
    }
    return state.getVouchers();
  },
  getById(id: string) {
    if (isMigrationFlagEnabled("MIGRATION_QUERY_BUS")) {
      return executeQuerySync({ queryType: QueryTypes.GET_VOUCHER, payload: { id } });
    }
    return state.getVouchers().find((v) => (v as { id?: string }).id === id) ?? null;
  },
};

export type VoucherDomain = typeof voucherDomain;
