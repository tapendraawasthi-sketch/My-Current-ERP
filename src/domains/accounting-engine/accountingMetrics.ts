const counters: Record<string, number> = {
  eventsProcessed: 0,
  postingsApplied: 0,
  postingRejections: 0,
  doubleEntryViolations: 0,
  parityChecks: 0,
  parityFailures: 0,
  integrityFailures: 0,
  replays: 0,
  errors: 0,
};

export const accountingMetrics = {
  incrementEventsProcessed(count = 1): void {
    counters.eventsProcessed += count;
  },
  incrementPostingsApplied(count = 1): void {
    counters.postingsApplied += count;
  },
  incrementPostingRejections(count = 1): void {
    counters.postingRejections += count;
  },
  incrementDoubleEntryViolations(count = 1): void {
    counters.doubleEntryViolations += count;
  },
  incrementParityChecks(): void {
    counters.parityChecks += 1;
  },
  incrementParityFailures(count = 1): void {
    counters.parityFailures += count;
  },
  incrementIntegrityFailures(count = 1): void {
    counters.integrityFailures += count;
  },
  incrementReplays(): void {
    counters.replays += 1;
  },
  incrementErrors(): void {
    counters.errors += 1;
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
