import type { IWorkingMemory } from "../contracts/memoryContract";
import { createImmutable } from "../types/immutable";

interface WorkingEntry {
  value: unknown;
  expiresAt?: number;
}

export class WorkingMemory implements IWorkingMemory {
  private store = new Map<string, WorkingEntry>();

  get(key: string): unknown | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: unknown, ttlMs?: number): void {
    this.store.set(key, {
      value,
      expiresAt: ttlMs ? Date.now() + ttlMs : undefined,
    });
  }

  delete(key: string): boolean {
    return this.store.delete(key);
  }

  snapshot(): ReturnType<IWorkingMemory["snapshot"]> {
    const result: Record<string, unknown> = {};
    for (const [key, entry] of this.store) {
      if (!entry.expiresAt || Date.now() <= entry.expiresAt) {
        result[key] = entry.value;
      }
    }
    return createImmutable(result);
  }

  clear(): void {
    this.store.clear();
  }
}
