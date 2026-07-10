const counters: Record<string, number> = {
  eventsProcessed: 0,
  movementsApplied: 0,
  parityChecks: 0,
  parityFailures: 0,
  integrityFailures: 0,
  errors: 0,
};

export const inventoryMetrics = {
  incrementEventsProcessed(count = 1): void {
    counters.eventsProcessed += count;
  },
  incrementMovementsApplied(count = 1): void {
    counters.movementsApplied += count;
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
