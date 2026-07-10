import { isMigrationFlagEnabled } from "@/platform/flags/registry";
import { isProjectionSchemaReady } from "@/platform/projections/projectionCheckpoint";
import type { ReportType } from "./reportRegistry";
import { buildReport, type ReportQueryParams } from "./reportBuilder";
import { getCachedReport, setCachedReport } from "./reportCache";
import { versionReport } from "./reportVersioning";
import { recordReportDiagnostic } from "./reportDiagnostics";
import { reportMetrics } from "./reportMetrics";
import { reportLogger } from "./reportLogger";
import { isReportCutoverActive } from "./reportEngine";

export interface ReportPipelineOptions {
  dryRun?: boolean;
  useCache?: boolean;
  forceProjection?: boolean;
}

export interface ReportPipelineResult<T = unknown> {
  data: T;
  source: "projection" | "legacy";
  dryRun: boolean;
  cached: boolean;
}

export async function runReportPipeline<T = unknown>(
  reportType: ReportType,
  params: ReportQueryParams = {},
  options: ReportPipelineOptions = {},
): Promise<ReportPipelineResult<T>> {
  const dryRun = Boolean(options.dryRun);
  const useCache = options.useCache !== false && !dryRun;

  reportMetrics.incrementReportsRun();
  reportLogger.debug("report-pipeline-start", { reportType, params, dryRun });

  if (!isMigrationFlagEnabled("MIGRATION_REPORT_ENGINE")) {
    throw new Error("MIGRATION_REPORT_ENGINE is disabled");
  }

  if (!isProjectionSchemaReady()) {
    recordReportDiagnostic({
      stage: "error",
      reportType,
      message: "Projection schema not ready",
      timestamp: new Date().toISOString(),
    });
    throw new Error("Projection schema not ready");
  }

  if (useCache) {
    const cached = getCachedReport<T>(reportType, params as Record<string, unknown>);
    if (cached) {
      reportMetrics.incrementCacheHits();
      return { data: cached, source: "projection", dryRun, cached: true };
    }
  }

  const data = (await buildReport(reportType, params)) as T;
  if (!dryRun && useCache) {
    setCachedReport(reportType, params as Record<string, unknown>, data);
  }

  recordReportDiagnostic({
    stage: "applied",
    reportType,
    message: `projection report built`,
    timestamp: new Date().toISOString(),
  });

  const versioned = versionReport(data);
  return {
    data: (isReportCutoverActive() ? versioned.data : data) as T,
    source: "projection",
    dryRun,
    cached: false,
  };
}
