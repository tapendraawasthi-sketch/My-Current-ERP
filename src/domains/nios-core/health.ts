import { isNiosRuntimeReady } from "./niosRuntime";
import { validateRegistry } from "./niosRegistry";
import { listPendingProposals } from "./proposalEngine";
import { listSessions } from "./sessionManager";
import { usageMetrics } from "./usageMetrics";
import { recordDiagnostic } from "./diagnostics";

export interface HealthStatus {
  healthy: boolean;
  runtimeReady: boolean;
  registryIssues: string[];
  activeSessions: number;
  pendingProposals: number;
  metrics: Record<string, number>;
}

export function checkHealth(): HealthStatus {
  const registryIssues = validateRegistry();
  const status: HealthStatus = {
    healthy: isNiosRuntimeReady() && registryIssues.length === 0,
    runtimeReady: isNiosRuntimeReady(),
    registryIssues,
    activeSessions: listSessions().length,
    pendingProposals: listPendingProposals().length,
    metrics: usageMetrics.snapshot(),
  };

  recordDiagnostic({
    stage: "health-check",
    message: `healthy=${status.healthy} sessions=${status.activeSessions}`,
    timestamp: new Date().toISOString(),
  });

  return status;
}
