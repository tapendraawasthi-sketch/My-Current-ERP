import { isMigrationFlagEnabled } from "@/platform/flags/registry";

export type SyncLogLevel = "debug" | "info" | "warn" | "error";

export function logSync(
  level: SyncLogLevel,
  message: string,
  extra?: Record<string, unknown>,
): void {
  if (!isMigrationFlagEnabled("MIGRATION_EVENT_SYNC")) return;
  const line = `[FIOS:EventSync] ${message}`;
  const payload = { message, ...extra };
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
