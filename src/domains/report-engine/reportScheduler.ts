import { isMigrationFlagEnabled } from "@/platform/flags/registry";
import { runFullReportParityValidation } from "./reportParityRunner";
import { reportLogger } from "./reportLogger";

let parityInterval: ReturnType<typeof setInterval> | null = null;
let schedulerActive = false;

export function startReportScheduler(intervalMs = 300_000): () => void {
  if (schedulerActive) return stopReportScheduler;
  if (!isMigrationFlagEnabled("MIGRATION_REPORT_ENGINE")) return () => undefined;

  parityInterval = setInterval(() => {
    if (isMigrationFlagEnabled("MIGRATION_REPORT_PARITY")) {
      runFullReportParityValidation().catch((error) => {
        reportLogger.error("scheduled-parity-error", {
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }
  }, intervalMs);

  schedulerActive = true;
  reportLogger.info("report-scheduler-started", { intervalMs });
  return stopReportScheduler;
}

export function stopReportScheduler(): void {
  if (parityInterval) {
    clearInterval(parityInterval);
    parityInterval = null;
  }
  schedulerActive = false;
}

export function isReportSchedulerActive(): boolean {
  return schedulerActive;
}
