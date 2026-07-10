import type { JsonObject } from "@fios/kernel";
import { executeCommand, executeCommandVoid, CommandTypes, AggregateTypes } from "@fios/command-bus";
import { executeQuerySync, QueryTypes } from "@fios/query-bus";
import { isMigrationFlagEnabled } from "@/platform/flags/registry";
import { readLegacyState } from "@fios/legacy";

export const taxDomain = {
  addEntry(entry: JsonObject) {
    return executeCommand({
      commandType: CommandTypes.ADD_TDS_ENTRY,
      aggregateType: AggregateTypes.TAX,
      payload: entry,
    });
  },
  updateEntry(id: string, updates: JsonObject) {
    return executeCommandVoid({
      commandType: CommandTypes.UPDATE_TDS_ENTRY,
      aggregateType: AggregateTypes.TAX,
      aggregateId: id,
      payload: { id, updates },
    });
  },
  listEntries() {
    if (isMigrationFlagEnabled("MIGRATION_QUERY_BUS")) {
      const summary = executeQuerySync<{ entries: unknown[] }>({
        queryType: QueryTypes.TAX_SUMMARY,
        payload: {},
      });
      return summary?.entries ?? [];
    }
    return readLegacyState().tdsEntries;
  },
};

export type TaxDomain = typeof taxDomain;
