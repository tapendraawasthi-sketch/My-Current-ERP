import type { JsonObject } from "@fios/kernel";
import { executeCommand, executeCommandVoid, CommandTypes, AggregateTypes } from "@fios/command-bus";
import { executeQuerySync, QueryTypes } from "@fios/query-bus";
import { isMigrationFlagEnabled } from "@/platform/flags/registry";
import { createLegacyStateReader } from "@fios/legacy";

const state = createLegacyStateReader();

export const mastersDomain = {
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
  listAccounts() {
    if (isMigrationFlagEnabled("MIGRATION_QUERY_BUS")) {
      return executeQuerySync({ queryType: QueryTypes.LIST_ACCOUNTS, payload: {} });
    }
    return state.getAccounts();
  },
};

export type MastersDomain = typeof mastersDomain;
