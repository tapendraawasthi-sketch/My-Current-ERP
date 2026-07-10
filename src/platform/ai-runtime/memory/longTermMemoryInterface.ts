import type { ILongTermMemory, MemoryEntry, MemoryScope } from "../contracts/memoryContract";
import { createImmutable } from "../types/immutable";

/**
 * Long-term memory interface — architecture only.
 * Vector database integration is a future extension point.
 */
export class LongTermMemoryInterface implements ILongTermMemory {
  private entries = new Map<string, MemoryEntry>();

  isAvailable(): boolean {
    return false;
  }

  async store(entry: Omit<MemoryEntry, "id" | "createdAt">): Promise<MemoryEntry> {
    const id = `ltm-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const stored = createImmutable({
      ...entry,
      id,
      createdAt: new Date().toISOString(),
    });
    this.entries.set(id, stored);
    return stored;
  }

  async recall(
    query: string,
    options?: { limit?: number; scope?: MemoryScope },
  ): Promise<readonly MemoryEntry[]> {
    const limit = options?.limit ?? 10;
    const scope = options?.scope;
    const q = query.toLowerCase();

    return [...this.entries.values()]
      .filter((e) => !scope || e.scope === scope)
      .filter(
        (e) =>
          e.key.toLowerCase().includes(q) ||
          String(e.value).toLowerCase().includes(q) ||
          e.tags.some((t) => t.toLowerCase().includes(q)),
      )
      .slice(0, limit);
  }

  async forget(id: string): Promise<boolean> {
    return this.entries.delete(id);
  }
}
