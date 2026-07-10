import { isMigrationFlagEnabled } from "@/platform/flags/registry";

export type MemoryLevel = "working" | "episodic" | "semantic" | "procedural";

export interface MemoryRecord {
  id: string;
  sessionId: string;
  level: MemoryLevel;
  key: string;
  value: unknown;
  createdAt: string;
}

const memoryStore = new Map<string, MemoryRecord[]>();

export function storeMemory(
  sessionId: string,
  level: MemoryLevel,
  key: string,
  value: unknown,
): MemoryRecord {
  const record: MemoryRecord = {
    id: crypto.randomUUID(),
    sessionId,
    level,
    key,
    value,
    createdAt: new Date().toISOString(),
  };
  const existing = memoryStore.get(sessionId) ?? [];
  existing.push(record);
  memoryStore.set(sessionId, existing);
  return record;
}

export function getMemorySnapshot(sessionId: string): Record<string, unknown> {
  if (!isMigrationFlagEnabled("MIGRATION_NIOS_MEMORY")) return {};
  const records = memoryStore.get(sessionId) ?? [];
  const snapshot: Record<string, unknown> = {};
  for (const record of records) {
    snapshot[`${record.level}:${record.key}`] = record.value;
  }
  return snapshot;
}

export function clearSessionMemory(sessionId: string): void {
  memoryStore.delete(sessionId);
}

export function listMemoryRecords(sessionId: string): MemoryRecord[] {
  return [...(memoryStore.get(sessionId) ?? [])];
}
