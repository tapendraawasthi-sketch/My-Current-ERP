import { isProjectionsEnabled } from "./projectionEngine";
import { runFullParityValidation } from "./projectionParity";
import { rebuildFromCheckpoint } from "./projectionRebuilder";
import { readGlobalProjectionCursor } from "./projectionCheckpoint";
import { ProjectionNames } from "./projectionState";

let schedulerTimer: ReturnType<typeof setInterval> | null = null;

export interface ProjectionSchedulerOptions {
  intervalMs?: number;
  runParity?: boolean;
}

export async function tickProjectionScheduler(): Promise<void> {
  if (!isProjectionsEnabled()) return;
  const cursor = await readGlobalProjectionCursor();
  if (!cursor) return;
  await rebuildFromCheckpoint(ProjectionNames.TRIAL_BALANCE, false);
  await runFullParityValidation();
}

export function startProjectionScheduler(options: ProjectionSchedulerOptions = {}): () => void {
  if (!isProjectionsEnabled()) return () => {};
  const intervalMs = options.intervalMs ?? 300_000;
  if (schedulerTimer) clearInterval(schedulerTimer);
  schedulerTimer = setInterval(() => {
    void tickProjectionScheduler();
  }, intervalMs);
  return () => {
    if (schedulerTimer) {
      clearInterval(schedulerTimer);
      schedulerTimer = null;
    }
  };
}

export function stopProjectionScheduler(): void {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
  }
}
