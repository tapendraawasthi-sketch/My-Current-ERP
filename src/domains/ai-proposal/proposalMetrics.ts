const counters: Record<string, number> = {
  created: 0,
  approved: 0,
  rejected: 0,
  revoked: 0,
  expired: 0,
  executed: 0,
  failed: 0,
};

export const proposalMetrics = {
  incrementCreated(): void {
    counters.created += 1;
  },
  incrementApproved(): void {
    counters.approved += 1;
  },
  incrementRejected(): void {
    counters.rejected += 1;
  },
  incrementRevoked(): void {
    counters.revoked += 1;
  },
  incrementExpired(count = 1): void {
    counters.expired += count;
  },
  incrementExecuted(): void {
    counters.executed += 1;
  },
  incrementFailed(): void {
    counters.failed += 1;
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
