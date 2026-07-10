import { isMigrationFlagEnabled } from "@/platform/flags/registry";
import { getEventSyncClient } from "./syncClient";
import { recordSyncDiagnostic } from "./syncDiagnostics";
import { syncMetrics } from "./syncMetrics";

let cycleRunning = false;

export async function runEventSyncCycle(): Promise<void> {
  if (!isMigrationFlagEnabled("MIGRATION_EVENT_SYNC")) return;
  if (!navigator.onLine || cycleRunning) return;

  cycleRunning = true;
  syncMetrics.incrementCycles();
  recordSyncDiagnostic({
    stage: "cycle-start",
    timestamp: new Date().toISOString(),
  });

  try {
    const client = getEventSyncClient();
    await client.ingestFromEventStore();
    await client.pushPending();
    await client.pullRemote();
    recordSyncDiagnostic({
      stage: "cycle-complete",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    recordSyncDiagnostic({
      stage: "cycle-error",
      message: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    });
  } finally {
    cycleRunning = false;
  }
}

export function isSyncCycleRunning(): boolean {
  return cycleRunning;
}
