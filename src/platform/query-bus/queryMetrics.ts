const counters: Record<string, number> = {
  dispatched: 0,
  ok: 0,
  not_found: 0,
  rejected: 0,
};

export const queryMetrics = {
  incrementDispatched(): void {
    counters.dispatched += 1;
  },
  incrementOk(): void {
    counters.ok += 1;
  },
  incrementNotFound(): void {
    counters.not_found += 1;
  },
  incrementRejected(): void {
    counters.rejected += 1;
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
