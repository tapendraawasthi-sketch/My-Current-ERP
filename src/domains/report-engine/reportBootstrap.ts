import { isMigrationFlagEnabled } from "@/platform/flags/registry";
import { reportLogger } from "./reportLogger";
import { startReportScheduler } from "./reportScheduler";
import { runFullReportParityValidation } from "./reportParityRunner";

let bootstrapComplete = false;
let stopScheduler: (() => void) | null = null;

export function bootstrapReportEngine(): void {
  if (!isMigrationFlagEnabled("MIGRATION_REPORT_ENGINE")) return;
  if (bootstrapComplete) return;

  reportLogger.info("report-engine-bootstrap");
  bootstrapComplete = true;
  stopScheduler = startReportScheduler();

  if (isMigrationFlagEnabled("MIGRATION_REPORT_PARITY")) {
    runFullReportParityValidation().catch((error) => {
      reportLogger.error("initial-parity-error", {
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }
}

export function shutdownReportEngine(): void {
  if (stopScheduler) {
    stopScheduler();
    stopScheduler = null;
  }
  bootstrapComplete = false;
}

export function isReportEngineBootstrapped(): boolean {
  return bootstrapComplete;
}
