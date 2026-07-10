import type { IDomainEvent, IEventHandler } from "@fios/kernel";
import { isMigrationFlagEnabled } from "@/platform/flags/registry";
import { getProjectionEngine } from "./projectionEngine";
import { startProjectionScheduler } from "./projectionScheduler";

let bootstrapComplete = false;
let stopScheduler: (() => void) | null = null;

export function createProjectionEventHandler(): IEventHandler {
  return {
    eventType: "*",
    async handle(event: IDomainEvent) {
      if (!isMigrationFlagEnabled("MIGRATION_PROJECTIONS")) return;
      const engine = getProjectionEngine();
      await engine.processEvent(event);
    },
  };
}

export function bootstrapProjections(): void {
  if (!isMigrationFlagEnabled("MIGRATION_PROJECTIONS")) return;
  if (bootstrapComplete) return;
  getProjectionEngine();
  stopScheduler = startProjectionScheduler({ intervalMs: 300_000 });
  bootstrapComplete = true;
}

export function shutdownProjections(): void {
  if (stopScheduler) {
    stopScheduler();
    stopScheduler = null;
  }
  bootstrapComplete = false;
}

export function isProjectionsBootstrapped(): boolean {
  return bootstrapComplete;
}
