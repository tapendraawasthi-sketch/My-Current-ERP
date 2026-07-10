export const aiMetrics = {
  requests: 0,
  completed: 0,
  refused: 0,
  approvalsRequired: 0,
  commandsProposed: 0,
  stageLatencies: {} as Record<string, number[]>,

  incrementRequests(): void {
    this.requests += 1;
  },

  incrementCompleted(): void {
    this.completed += 1;
  },

  incrementRefused(): void {
    this.refused += 1;
  },

  incrementApprovalsRequired(): void {
    this.approvalsRequired += 1;
  },

  incrementCommandsProposed(): void {
    this.commandsProposed += 1;
  },

  recordStageLatency(stage: string, ms: number): void {
    if (!this.stageLatencies[stage]) this.stageLatencies[stage] = [];
    this.stageLatencies[stage].push(ms);
  },

  reset(): void {
    this.requests = 0;
    this.completed = 0;
    this.refused = 0;
    this.approvalsRequired = 0;
    this.commandsProposed = 0;
    this.stageLatencies = {};
  },
};
