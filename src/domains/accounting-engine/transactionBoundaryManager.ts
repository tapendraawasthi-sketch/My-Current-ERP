export interface TransactionScope {
  id: string;
  startedAt: string;
  committed: boolean;
  rolledBack: boolean;
}

const activeScopes = new Map<string, TransactionScope>();

export function beginShadowTransaction(scopeId?: string): TransactionScope {
  const id = scopeId ?? crypto.randomUUID();
  const scope: TransactionScope = {
    id,
    startedAt: new Date().toISOString(),
    committed: false,
    rolledBack: false,
  };
  activeScopes.set(id, scope);
  return scope;
}

export function commitShadowTransaction(scopeId: string): void {
  const scope = activeScopes.get(scopeId);
  if (scope) {
    scope.committed = true;
    activeScopes.delete(scopeId);
  }
}

export function rollbackShadowTransaction(scopeId: string): void {
  const scope = activeScopes.get(scopeId);
  if (scope) {
    scope.rolledBack = true;
    activeScopes.delete(scopeId);
  }
}

export function getActiveScope(scopeId: string): TransactionScope | null {
  return activeScopes.get(scopeId) ?? null;
}

export async function runInShadowBoundary<T>(
  fn: (scope: TransactionScope) => Promise<T>,
): Promise<T> {
  const scope = beginShadowTransaction();
  try {
    const result = await fn(scope);
    commitShadowTransaction(scope.id);
    return result;
  } catch (error) {
    rollbackShadowTransaction(scope.id);
    throw error;
  }
}
