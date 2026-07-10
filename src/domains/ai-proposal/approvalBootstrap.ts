import { isMigrationFlagEnabled } from "@/platform/flags/registry";
import { ApprovalPolicies } from "./approvalPolicies";
import { expireStaleProposals } from "./proposalLifecycle";
import { proposalMetrics } from "./proposalMetrics";
import { proposalLogger } from "./proposalLogger";

let bootstrapComplete = false;
let expiryInterval: ReturnType<typeof setInterval> | null = null;

export function bootstrapApprovalPipeline(): void {
  if (!isMigrationFlagEnabled("MIGRATION_AI_APPROVAL")) return;
  if (bootstrapComplete) return;

  proposalLogger.info("approval-pipeline-bootstrap");
  bootstrapComplete = true;

  expiryInterval = setInterval(() => {
    const expired = expireStaleProposals();
    if (expired > 0) {
      proposalMetrics.incrementExpired(expired);
      proposalLogger.info("approval-auto-expire", { expired });
    }
  }, ApprovalPolicies.autoExpirePendingMs);
}

export function shutdownApprovalPipeline(): void {
  if (expiryInterval) {
    clearInterval(expiryInterval);
    expiryInterval = null;
  }
  bootstrapComplete = false;
}

export function isApprovalPipelineBootstrapped(): boolean {
  return bootstrapComplete;
}
