const counters: Record<string, number> = {
  executed: 0,
  failed: 0,
  blocked: 0,
};

export const executionMetrics = {
  incrementExecuted(): void {
    counters.executed += 1;
  },
  incrementFailed(): void {
    counters.failed += 1;
  },
  incrementBlocked(): void {
    counters.blocked += 1;
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
