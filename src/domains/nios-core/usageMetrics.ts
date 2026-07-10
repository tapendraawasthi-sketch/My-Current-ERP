const counters: Record<string, number> = {
  requests: 0,
  proposals: 0,
  approvals: 0,
  rejections: 0,
  errors: 0,
  tokens: 0,
};

export const usageMetrics = {
  incrementRequests(): void {
    counters.requests += 1;
  },
  incrementProposals(count = 1): void {
    counters.proposals += count;
  },
  incrementApprovals(): void {
    counters.approvals += 1;
  },
  incrementRejections(): void {
    counters.rejections += 1;
  },
  incrementErrors(): void {
    counters.errors += 1;
  },
  incrementTokens(count: number): void {
    counters.tokens += count;
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
