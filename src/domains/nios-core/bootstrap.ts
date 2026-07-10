import { isMigrationFlagEnabled } from "@/platform/flags/registry";
import { markKernelInitialized } from "./niosKernel";
import { initializeRuntime } from "./niosRuntime";
import { clearExpiredSessions } from "./sessionManager";
import { checkHealth } from "./health";
import { niosLogger } from "./logger";

let bootstrapComplete = false;
let sessionCleanupInterval: ReturnType<typeof setInterval> | null = null;

export function bootstrapNiosCore(): void {
  if (!isMigrationFlagEnabled("MIGRATION_NIOS_CORE")) return;
  if (bootstrapComplete) return;

  niosLogger.info("nios-core-bootstrap");
  initializeRuntime();
  markKernelInitialized();
  bootstrapComplete = true;

  sessionCleanupInterval = setInterval(() => {
    clearExpiredSessions();
    checkHealth();
  }, 300_000);
}

export function shutdownNiosCore(): void {
  if (sessionCleanupInterval) {
    clearInterval(sessionCleanupInterval);
    sessionCleanupInterval = null;
  }
  bootstrapComplete = false;
}

export function isNiosCoreBootstrapped(): boolean {
  return bootstrapComplete;
}
