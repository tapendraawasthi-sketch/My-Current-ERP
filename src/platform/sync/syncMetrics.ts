const counters: Record<string, number> = {
  cycles: 0,
  pushBatches: 0,
  pullBatches: 0,
  eventsPushed: 0,
  eventsPulled: 0,
  pushFailures: 0,
  pullFailures: 0,
  conflicts: 0,
};

export const syncMetrics = {
  incrementCycles(): void {
    counters.cycles += 1;
  },
  incrementPushBatches(): void {
    counters.pushBatches += 1;
  },
  incrementPullBatches(): void {
    counters.pullBatches += 1;
  },
  incrementEventsPushed(count = 1): void {
    counters.eventsPushed += count;
  },
  incrementEventsPulled(count = 1): void {
    counters.eventsPulled += count;
  },
  incrementPushFailures(): void {
    counters.pushFailures += 1;
  },
  incrementPullFailures(): void {
    counters.pullFailures += 1;
  },
  incrementConflicts(): void {
    counters.conflicts += 1;
  },
  snapshot(): Record<string, number> {
    return { ...counters };
  },
  reset(): void {
    for (const key of Object.keys(counters)) {
      counters[key] = 0;
    }
  },
};
