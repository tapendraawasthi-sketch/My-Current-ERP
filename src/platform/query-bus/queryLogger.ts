import type { IQuery } from "@fios/kernel";
import { isMigrationFlagEnabled } from "@/platform/flags/registry";

export type QueryLogLevel = "debug" | "info" | "warn" | "error";

export function logQuery(
  level: QueryLogLevel,
  message: string,
  query: IQuery,
  extra?: Record<string, unknown>,
): void {
  if (!isMigrationFlagEnabled("MIGRATION_QUERY_BUS")) return;

  const payload = {
    message,
    queryId: query.queryId,
    queryType: query.queryType,
    correlationId: query.correlationId,
    ...extra,
  };

  const line = `[FIOS:QueryBus] ${message}`;
  switch (level) {
    case "debug":
      console.debug(line, payload);
      break;
    case "info":
      console.info(line, payload);
      break;
    case "warn":
      console.warn(line, payload);
      break;
    case "error":
      console.error(line, payload);
      break;
  }
}
