import { isMigrationFlagEnabled } from "@/platform/flags/registry";
import { expireStaleProposals } from "./proposalLifecycle";
import { proposalLogger } from "./proposalLogger";

let bootstrapComplete = false;

export function bootstrapProposalPipeline(): void {
  if (!isMigrationFlagEnabled("MIGRATION_AI_PROPOSALS")) return;
  if (bootstrapComplete) return;
  proposalLogger.info("proposal-pipeline-bootstrap");
  bootstrapComplete = true;
}

export function isProposalPipelineBootstrapped(): boolean {
  return bootstrapComplete;
}

export function runProposalMaintenance(): number {
  return expireStaleProposals();
}
