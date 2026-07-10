import { isMigrationFlagEnabled } from "@/platform/flags/registry";
import { SyncQueryBus } from "./queryBus";
import { registerLegacyQueryHandlers } from "./handlers/legacyQueryHandlers";

let queryBusInstance: SyncQueryBus | null = null;

export function getQueryBus(): SyncQueryBus {
  if (!queryBusInstance) {
    queryBusInstance = new SyncQueryBus();
    registerLegacyQueryHandlers(queryBusInstance);
  }
  return queryBusInstance;
}

export function resetQueryBus(): void {
  queryBusInstance = null;
}

export function bootstrapQueryBus(): SyncQueryBus {
  return getQueryBus();
}

export function isQueryBusEnabled(): boolean {
  return isMigrationFlagEnabled("MIGRATION_QUERY_BUS");
}