import type { IDomainEvent } from "@fios/kernel";
import { getProjectionEngine } from "./projectionEngine";

export interface ProjectionRunResult {
  eventsProcessed: number;
  dryRun: boolean;
}

export async function runProjectionForEvent(
  event: IDomainEvent,
  dryRun = false,
): Promise<ProjectionRunResult> {
  const engine = getProjectionEngine();
  await engine.processEvent(event, { dryRun });
  return { eventsProcessed: 1, dryRun };
}
