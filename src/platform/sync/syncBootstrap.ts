import { isMigrationFlagEnabled } from "@/platform/flags/registry";
import { bootstrapIdentity } from "@/platform/identity/identityBootstrap";
import { startEventSyncScheduler } from "./syncScheduler";
import { recordSyncDiagnostic } from "./syncDiagnostics";
import { logSync } from "./syncLogger";

let bootstrapped = false;
let stopScheduler: (() => void) | null = null;

export function isEventSyncEnabled(): boolean {
  return isMigrationFlagEnabled("MIGRATION_EVENT_SYNC");
}

export function bootstrapEventSync(): void {
  if (!isEventSyncEnabled()) return;
  if (bootstrapped) return;

  bootstrapIdentity();
  stopScheduler = startEventSyncScheduler();

  recordSyncDiagnostic({
    stage: "bootstrap",
    message: "event sync platform started",
    timestamp: new Date().toISOString(),
  });

  logSync("info", "event sync bootstrapped", {
    vectorClocks: isMigrationFlagEnabled("MIGRATION_VECTOR_CLOCKS"),
    conflictEngine: isMigrationFlagEnabled("MIGRATION_CONFLICT_ENGINE"),
  });

  bootstrapped = true;
}

export function shutdownEventSync(): void {
  if (stopScheduler) {
    stopScheduler();
    stopScheduler = null;
  }
  bootstrapped = false;
}

export function isEventSyncBootstrapped(): boolean {
  return bootstrapped;
}
