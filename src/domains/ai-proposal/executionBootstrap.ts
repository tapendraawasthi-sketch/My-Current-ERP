import { isMigrationFlagEnabled } from "@/platform/flags/registry";
import { executionLogger } from "./executionLogger";
import { resetExecutingProposals } from "./executionRecovery";

let bootstrapComplete = false;

export function bootstrapExecutionPipeline(): void {
  if (!isMigrationFlagEnabled("MIGRATION_AI_PROPOSALS")) return;
  if (bootstrapComplete) return;

  executionLogger.info("execution-pipeline-bootstrap", {
    executionEnabled: isMigrationFlagEnabled("MIGRATION_AI_EXECUTION"),
  });
  resetExecutingProposals();
  bootstrapComplete = true;
}

export function isExecutionPipelineBootstrapped(): boolean {
  return bootstrapComplete;
}

export function isExecutionEnabled(): boolean {
  return isMigrationFlagEnabled("MIGRATION_AI_EXECUTION");
}
