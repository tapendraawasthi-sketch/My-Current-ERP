import type { JsonObject } from "@fios/kernel";
import { executeCommand, executeCommandVoid, CommandTypes, AggregateTypes } from "@fios/command-bus";
import { executeQuerySync, QueryTypes } from "@fios/query-bus";
import { isMigrationFlagEnabled } from "@/platform/flags/registry";
import { createLegacyStateReader } from "@fios/legacy";

const state = createLegacyStateReader();

export const partyDomain = {
  create(party: JsonObject) {
    return executeCommand({
      commandType: CommandTypes.CREATE_PARTY,
      aggregateType: AggregateTypes.PARTY,
      payload: party,
    });
  },
  update(id: string, updates: JsonObject) {
    return executeCommandVoid({
      commandType: CommandTypes.UPDATE_PARTY,
      aggregateType: AggregateTypes.PARTY,
      aggregateId: id,
      payload: { id, updates },
    });
  },
  list() {
    if (isMigrationFlagEnabled("MIGRATION_QUERY_BUS")) {
      return executeQuerySync({ queryType: QueryTypes.LIST_PARTIES, payload: {} });
    }
    return state.getParties();
  },
  getById(id: string) {
    if (isMigrationFlagEnabled("MIGRATION_QUERY_BUS")) {
      return executeQuerySync({ queryType: QueryTypes.GET_PARTY, payload: { id } });
    }
    return state.getParties().find((p) => (p as { id?: string }).id === id) ?? null;
  },
};

export type PartyDomain = typeof partyDomain;
