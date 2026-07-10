import type { ICommandResult } from "@fios/kernel";

interface CachedCommand {
  result: ICommandResult;
  storedAt: number;
}

const MAX_ENTRIES = 5000;
const TTL_MS = 24 * 60 * 60 * 1000;

export class IdempotencyStore {
  private readonly cache = new Map<string, CachedCommand>();

  get(commandId: string): ICommandResult | null {
    const entry = this.cache.get(commandId);
    if (!entry) return null;
    if (Date.now() - entry.storedAt > TTL_MS) {
      this.cache.delete(commandId);
      return null;
    }
    return entry.result;
  }

  set(commandId: string, result: ICommandResult): void {
    if (this.cache.size >= MAX_ENTRIES) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }
    this.cache.set(commandId, { result, storedAt: Date.now() });
  }

  clear(): void {
    this.cache.clear();
  }
}
