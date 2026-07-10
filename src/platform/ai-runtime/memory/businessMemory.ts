import type { IBusinessMemory, MemoryEntry } from "../contracts/memoryContract";
import { createImmutable } from "../types/immutable";

export class BusinessMemory implements IBusinessMemory {
  private facts = new Map<string, MemoryEntry>();

  private key(tenantId: string, key: string): string {
    return `${tenantId}::${key}`;
  }

  getFact(tenantId: string, key: string): unknown | undefined {
    return this.facts.get(this.key(tenantId, key))?.value;
  }

  setFact(tenantId: string, key: string, value: unknown): void {
    const entry = createImmutable({
      id: this.key(tenantId, key),
      key,
      value,
      scope: "tenant" as const,
      createdAt: new Date().toISOString(),
      tags: [] as readonly string[],
    });
    this.facts.set(this.key(tenantId, key), entry);
  }

  listFacts(tenantId: string, prefix?: string): readonly MemoryEntry[] {
    const prefixKey = `${tenantId}::${prefix ?? ""}`;
    return [...this.facts.entries()]
      .filter(([k]) => k.startsWith(prefixKey))
      .map(([, v]) => v);
  }
}
