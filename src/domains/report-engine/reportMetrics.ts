const counters: Record<string, number> = {
  reportsRun: 0,
  cacheHits: 0,
  parityChecks: 0,
  parityFailures: 0,
  integrityFailures: 0,
  replays: 0,
  rollbacks: 0,
  exports: 0,
  errors: 0,
};

export const reportMetrics = {
  incrementReportsRun(): void {
    counters.reportsRun += 1;
  },
  incrementCacheHits(): void {
    counters.cacheHits += 1;
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
  incrementRollbacks(): void {
    counters.rollbacks += 1;
  },
  incrementExports(): void {
    counters.exports += 1;
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
