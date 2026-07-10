export interface EventMetricsSnapshot {
  published: number;
  dispatched: number;
  handlerSuccess: number;
  handlerFailure: number;
  dlqEntries: number;
  retried: number;
  byEventType: Record<string, number>;
}

const metrics: EventMetricsSnapshot = {
  published: 0,
  dispatched: 0,
  handlerSuccess: 0,
  handlerFailure: 0,
  dlqEntries: 0,
  retried: 0,
  byEventType: {},
};

function bumpEventType(eventType: string): void {
  metrics.byEventType[eventType] = (metrics.byEventType[eventType] ?? 0) + 1;
}

export const eventMetrics = {
  incrementPublished(eventType: string): void {
    metrics.published += 1;
    bumpEventType(eventType);
  },
  incrementDispatched(): void {
    metrics.dispatched += 1;
  },
  incrementHandlerSuccess(): void {
    metrics.handlerSuccess += 1;
  },
  incrementHandlerFailure(): void {
    metrics.handlerFailure += 1;
  },
  incrementDlq(): void {
    metrics.dlqEntries += 1;
  },
  incrementRetried(): void {
    metrics.retried += 1;
  },
  snapshot(): EventMetricsSnapshot {
    return {
      ...metrics,
      byEventType: { ...metrics.byEventType },
    };
  },
  reset(): void {
    metrics.published = 0;
    metrics.dispatched = 0;
    metrics.handlerSuccess = 0;
    metrics.handlerFailure = 0;
    metrics.dlqEntries = 0;
    metrics.retried = 0;
    metrics.byEventType = {};
  },
};
