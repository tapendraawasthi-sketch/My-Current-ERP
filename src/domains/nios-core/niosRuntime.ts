import type { NiosRequest, NiosResponse } from "./niosKernel";
import { isMigrationFlagEnabled } from "@/platform/flags/registry";
import { getOrCreateSession } from "./sessionManager";
import { buildContext } from "./contextEngine";
import { runOrchestration } from "./orchestrationEngine";
import { recordDiagnostic } from "./diagnostics";
import { usageMetrics } from "./usageMetrics";
import { niosLogger } from "./logger";

let runtimeReady = false;

export function isNiosRuntimeReady(): boolean {
  return runtimeReady && isMigrationFlagEnabled("MIGRATION_NIOS_CORE");
}

export async function processNiosRequest(request: NiosRequest): Promise<NiosResponse> {
  if (!isMigrationFlagEnabled("MIGRATION_NIOS_CORE")) {
    throw new Error("MIGRATION_NIOS_CORE is disabled");
  }

  usageMetrics.incrementRequests();
  const session = getOrCreateSession(request.sessionId);
  const context = await buildContext(request, session);
  recordDiagnostic({ stage: "request-received", sessionId: request.sessionId, timestamp: new Date().toISOString() });

  const result = await runOrchestration({ request, session, context });
  recordDiagnostic({ stage: "request-complete", sessionId: request.sessionId, timestamp: new Date().toISOString() });
  niosLogger.debug("nios-request-processed", { sessionId: request.sessionId });
  return result;
}

export function initializeRuntime(): void {
  if (!isMigrationFlagEnabled("MIGRATION_NIOS_CORE")) return;
  runtimeReady = true;
  niosLogger.info("nios-runtime-initialized");
}

export function shutdownRuntime(): void {
  runtimeReady = false;
}
