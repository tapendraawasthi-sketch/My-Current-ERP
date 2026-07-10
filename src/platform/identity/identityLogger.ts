import { isMigrationFlagEnabled } from "@/platform/flags/registry";

export type IdentityLogLevel = "debug" | "info" | "warn" | "error";

export function logIdentity(
  level: IdentityLogLevel,
  message: string,
  extra?: Record<string, unknown>,
): void {
  if (!isMigrationFlagEnabled("MIGRATION_IDENTITY")) return;

  const line = `[FIOS:Identity] ${message}`;
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
