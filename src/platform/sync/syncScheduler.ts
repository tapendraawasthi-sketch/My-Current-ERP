import { isMigrationFlagEnabled } from "@/platform/flags/registry";
import { runEventSyncCycle } from "./syncCoordinator";

const BASE_INTERVAL_MS = 30_000;
let timer: ReturnType<typeof setInterval> | null = null;

export function startEventSyncScheduler(intervalMs = BASE_INTERVAL_MS): () => void {
  if (!isMigrationFlagEnabled("MIGRATION_EVENT_SYNC")) return () => {};
  if (timer) clearInterval(timer);
  timer = setInterval(() => {
    void runEventSyncCycle();
  }, intervalMs);
  return () => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

export function stopEventSyncScheduler(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
