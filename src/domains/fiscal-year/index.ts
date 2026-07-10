import type { JsonObject } from "@fios/kernel";
import { executeCommandVoid, CommandTypes, AggregateTypes } from "@fios/command-bus";
import { executeQuerySync, QueryTypes } from "@fios/query-bus";
import { isMigrationFlagEnabled } from "@/platform/flags/registry";
import { createLegacyStateReader } from "@fios/legacy";

const state = createLegacyStateReader();

export const fiscalYearDomain = {
  setCurrent(fiscalYear: JsonObject) {
    return executeCommandVoid({
      commandType: CommandTypes.SET_CURRENT_FISCAL_YEAR,
      aggregateType: AggregateTypes.FISCAL_YEAR,
      payload: fiscalYear,
    });
  },
  getCurrent() {
    if (isMigrationFlagEnabled("MIGRATION_QUERY_BUS")) {
      return executeQuerySync({ queryType: QueryTypes.FISCAL_YEAR, payload: {} });
    }
    return state.getCurrentFiscalYear();
  },
};

export type FiscalYearDomain = typeof fiscalYearDomain;
