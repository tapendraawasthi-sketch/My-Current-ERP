import { executeCommandVoid, CommandTypes, AggregateTypes } from "@fios/command-bus";
import { executeQuerySync, QueryTypes } from "@fios/query-bus";
import { isMigrationFlagEnabled } from "@/platform/flags/registry";
import { readLegacyState } from "@fios/legacy";

export const notificationDomain = {
  notify(message: string, type?: string) {
    return executeCommandVoid({
      commandType: CommandTypes.ADD_NOTIFICATION,
      aggregateType: AggregateTypes.NOTIFICATION,
      payload: { message, type },
    });
  },
  markRead(id: string) {
    return executeCommandVoid({
      commandType: CommandTypes.MARK_NOTIFICATION_READ,
      aggregateType: AggregateTypes.NOTIFICATION,
      aggregateId: id,
      payload: { id },
    });
  },
  clearAll() {
    return executeCommandVoid({
      commandType: CommandTypes.CLEAR_NOTIFICATIONS,
      aggregateType: AggregateTypes.NOTIFICATION,
      payload: {},
    });
  },
  list() {
    if (isMigrationFlagEnabled("MIGRATION_QUERY_BUS")) {
      return executeQuerySync({ queryType: QueryTypes.NOTIFICATIONS, payload: {} });
    }
    return readLegacyState().notifications;
  },
};

export type NotificationDomain = typeof notificationDomain;
