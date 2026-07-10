import { executeCommandVoid, CommandTypes, AggregateTypes } from "@fios/command-bus";
import { executeQuerySync, QueryTypes } from "@fios/query-bus";
import { isMigrationFlagEnabled } from "@/platform/flags/registry";
import { readLegacyState } from "@fios/legacy";

export const auditDomain = {
  load() {
    return executeCommandVoid({
      commandType: CommandTypes.LOAD_AUDIT_LOGS,
      aggregateType: AggregateTypes.AUDIT,
      payload: {},
    });
  },
  record(params: {
    action: string;
    resourceType: string;
    resourceId?: string;
    details?: Record<string, unknown>;
  }) {
    return executeCommandVoid({
      commandType: CommandTypes.ADD_AUDIT_LOG,
      aggregateType: AggregateTypes.AUDIT,
      aggregateId: params.resourceId,
      payload: params,
    });
  },
  list() {
    if (isMigrationFlagEnabled("MIGRATION_QUERY_BUS")) {
      return executeQuerySync({ queryType: QueryTypes.AUDIT_LOG, payload: {} });
    }
    return readLegacyState().auditLogs;
  },
};

export type AuditDomain = typeof auditDomain;
