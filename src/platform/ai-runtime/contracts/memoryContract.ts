import type { DeepReadonly } from "../types";

export type MemoryScope = "session" | "tenant" | "user" | "global";

export interface MemoryEntry {
  readonly id: string;
  readonly key: string;
  readonly value: unknown;
  readonly scope: MemoryScope;
  readonly createdAt: string;
  readonly expiresAt?: string;
  readonly tags: readonly string[];
}

export interface IWorkingMemory {
  get(key: string): unknown | undefined;
  set(key: string, value: unknown, ttlMs?: number): void;
  delete(key: string): boolean;
  snapshot(): DeepReadonly<Record<string, unknown>>;
  clear(): void;
}

export interface IConversationMemory {
  appendTurn(sessionId: string, role: "user" | "assistant" | "system", content: string): void;
  getTurns(sessionId: string, limit?: number): readonly { role: string; content: string; timestamp: string }[];
  clearSession(sessionId: string): void;
}

export interface IBusinessMemory {
  getFact(tenantId: string, key: string): unknown | undefined;
  setFact(tenantId: string, key: string, value: unknown): void;
  listFacts(tenantId: string, prefix?: string): readonly MemoryEntry[];
}

/** Long-term memory interface — vector DB not yet implemented. */
export interface ILongTermMemory {
  store(entry: Omit<MemoryEntry, "id" | "createdAt">): Promise<MemoryEntry>;
  recall(query: string, options?: { limit?: number; scope?: MemoryScope }): Promise<readonly MemoryEntry[]>;
  forget(id: string): Promise<boolean>;
  isAvailable(): boolean;
}

export interface IMemoryStore {
  working: IWorkingMemory;
  conversation: IConversationMemory;
  business: IBusinessMemory;
  longTerm: ILongTermMemory;
}
