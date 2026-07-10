const costs: Array<{ sessionId: string; modelId: string; tokens: number; cost: number; timestamp: string }> = [];

export function trackCost(sessionId: string, modelId: string, tokens: number, costPerToken = 0.0001): void {
  costs.push({
    sessionId,
    modelId,
    tokens,
    cost: tokens * costPerToken,
    timestamp: new Date().toISOString(),
  });
}

export function getSessionCost(sessionId: string): number {
  return costs.filter((c) => c.sessionId === sessionId).reduce((s, c) => s + c.cost, 0);
}

export function getTotalCost(): number {
  return costs.reduce((s, c) => s + c.cost, 0);
}

export function getCostBreakdown(): Record<string, number> {
  const breakdown: Record<string, number> = {};
  for (const entry of costs) {
    breakdown[entry.modelId] = (breakdown[entry.modelId] ?? 0) + entry.cost;
  }
  return breakdown;
}
