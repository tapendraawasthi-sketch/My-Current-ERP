/**
 * NIOS Memory Bus — 7-level cognitive memory API (Phase 0 stub).
 */

import type { MemoryLevel } from "../contracts/types";

export interface MemoryRecord {
  id: string;
  level: MemoryLevel;
  key: string;
  value: unknown;
  tenantId?: string;
  companyId?: string;
  sessionId?: string;
  createdAt: string;
  expiresAt?: string;
}

const store = new Map<string, MemoryRecord>();

function memoryKey(level: MemoryLevel, key: string, tenantId?: string, companyId?: string): string {
  return [level, tenantId || "_", companyId || "_", key].join(":");
}

export async function memoryWrite(
  level: MemoryLevel,
  key: string,
  value: unknown,
  scope?: { tenantId?: string; companyId?: string; sessionId?: string; ttlMs?: number },
): Promise<MemoryRecord> {
  const id = crypto.randomUUID();
  const record: MemoryRecord = {
    id,
    level,
    key,
    value,
    tenantId: scope?.tenantId,
    companyId: scope?.companyId,
    sessionId: scope?.sessionId,
    createdAt: new Date().toISOString(),
    expiresAt: scope?.ttlMs ? new Date(Date.now() + scope.ttlMs).toISOString() : undefined,
  };
  store.set(memoryKey(level, key, scope?.tenantId, scope?.companyId), record);
  return record;
}

export async function memoryRead(
  level: MemoryLevel,
  key: string,
  scope?: { tenantId?: string; companyId?: string },
): Promise<MemoryRecord | undefined> {
  const record = store.get(memoryKey(level, key, scope?.tenantId, scope?.companyId));
  if (!record) return undefined;
  if (record.expiresAt && new Date(record.expiresAt) < new Date()) {
    store.delete(memoryKey(level, key, scope?.tenantId, scope?.companyId));
    return undefined;
  }
  return record;
}

export async function memoryQuery(
  level: MemoryLevel,
  scope?: { tenantId?: string; companyId?: string; sessionId?: string },
): Promise<MemoryRecord[]> {
  return Array.from(store.values()).filter((r) => {
    if (r.level !== level) return false;
    if (scope?.tenantId && r.tenantId !== scope.tenantId) return false;
    if (scope?.companyId && r.companyId !== scope.companyId) return false;
    if (scope?.sessionId && r.sessionId !== scope.sessionId) return false;
    if (r.expiresAt && new Date(r.expiresAt) < new Date()) return false;
    return true;
  });
}

export function clearMemoryBus(): void {
  store.clear();
}
