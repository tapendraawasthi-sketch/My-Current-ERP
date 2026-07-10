const tokenBudgets = new Map<string, { used: number; limit: number }>();

export function setTokenBudget(sessionId: string, limit: number): void {
  tokenBudgets.set(sessionId, { used: 0, limit });
}

export function recordTokenUsage(sessionId: string, tokens: number): boolean {
  const budget = tokenBudgets.get(sessionId) ?? { used: 0, limit: 8192 };
  budget.used += tokens;
  tokenBudgets.set(sessionId, budget);
  return budget.used <= budget.limit;
}

export function getTokenUsage(sessionId: string): { used: number; limit: number; remaining: number } {
  const budget = tokenBudgets.get(sessionId) ?? { used: 0, limit: 8192 };
  return { ...budget, remaining: Math.max(0, budget.limit - budget.used) };
}

export function resetTokenBudget(sessionId: string): void {
  tokenBudgets.delete(sessionId);
}
