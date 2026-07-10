import { isMigrationFlagEnabled } from "@/platform/flags/registry";
import { readGlobalProjectionCursor } from "@/platform/projections/projectionCheckpoint";
import { invalidateReportCache } from "./reportCache";
import { runFullReportParityValidation } from "./reportParityRunner";
import { recordReportDiagnostic } from "./reportDiagnostics";
import { reportMetrics } from "./reportMetrics";
import { reportLogger } from "./reportLogger";
import { listReportTypes } from "./reportRegistry";
import { runReportPipeline } from "./reportPipeline";

export interface ReportReplayOptions {
  dryRun?: boolean;
  fromCheckpoint?: number;
}

export interface ReportReplayResult {
  reportsReplayed: number;
  dryRun: boolean;
  checkpointSequence: number;
  parityPassed: boolean;
}

export async function replayReportsAfterProjectionRebuild(
  options: ReportReplayOptions = {},
): Promise<ReportReplayResult> {
  if (!isMigrationFlagEnabled("MIGRATION_REPORT_ENGINE")) {
    return { reportsReplayed: 0, dryRun: true, checkpointSequence: 0, parityPassed: true };
  }

  const dryRun = Boolean(options.dryRun);
  reportMetrics.incrementReplays();
  recordReportDiagnostic({
    stage: "replay-start",
    message: `replay dryRun=${dryRun}`,
    timestamp: new Date().toISOString(),
  });

  invalidateReportCache();
  const cursor = await readGlobalProjectionCursor();
  const checkpointSequence = options.fromCheckpoint ?? cursor?.lastGlobalSequence ?? 0;

  let reportsReplayed = 0;
  if (!dryRun) {
    for (const reportType of listReportTypes()) {
      try {
        await runReportPipeline(reportType, {}, { dryRun: false, useCache: false });
        reportsReplayed += 1;
      } catch (error) {
        reportLogger.error("report-replay-error", {
          reportType,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  const parity = await runFullReportParityValidation();
  recordReportDiagnostic({
    stage: "replay-complete",
    message: `replayed ${reportsReplayed} reports parity=${parity.passed}`,
    timestamp: new Date().toISOString(),
  });

  return {
    reportsReplayed,
    dryRun,
    checkpointSequence,
    parityPassed: parity.passed,
  };
}

export async function dryRunReportReplay(): Promise<ReportReplayResult> {
  return replayReportsAfterProjectionRebuild({ dryRun: true });
}

export async function validateCheckpointReports(checkpointSequence: number): Promise<boolean> {
  const result = await replayReportsAfterProjectionRebuild({
    dryRun: true,
    fromCheckpoint: checkpointSequence,
  });
  return result.parityPassed;
}
