import type { JsonObject } from "@fios/kernel";
import { executeCommandVoid, CommandTypes, AggregateTypes } from "@fios/command-bus";
import { executeQuerySync, QueryTypes } from "@fios/query-bus";
import { isMigrationFlagEnabled } from "@/platform/flags/registry";
import { createLegacyStateReader } from "@fios/legacy";

const state = createLegacyStateReader();

export const companyDomain = {
  updateSettings(settings: JsonObject) {
    return executeCommandVoid({
      commandType: CommandTypes.UPDATE_COMPANY_SETTINGS,
      aggregateType: AggregateTypes.COMPANY,
      payload: settings,
    });
  },
  getSettings() {
    if (isMigrationFlagEnabled("MIGRATION_QUERY_BUS")) {
      return executeQuerySync({ queryType: QueryTypes.COMPANY_SETTINGS, payload: {} });
    }
    return state.getCompanySettings();
  },
};

export type CompanyDomain = typeof companyDomain;
