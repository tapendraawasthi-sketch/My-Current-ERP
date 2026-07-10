import type { EntityId, JsonObject } from "@fios/kernel";
import type { DBEventSnapshot } from "./eventSchemas";

/** Snapshot store contract — stub implementation (F6+). */
export interface ISnapshotStore {
  getSnapshot(aggregateKey: string): Promise<DBEventSnapshot | null>;
  saveSnapshot(input: {
    aggregateKey: string;
    sequence: number;
    state: JsonObject;
  }): Promise<void>;
  deleteSnapshot(aggregateKey: string): Promise<void>;
}

export interface SnapshotPolicy {
  interval: number;
  enabled: boolean;
}

export const DEFAULT_SNAPSHOT_POLICY: SnapshotPolicy = {
  interval: 100,
  enabled: false,
};

export class StubSnapshotStore implements ISnapshotStore {
  async getSnapshot(_aggregateKey: string): Promise<DBEventSnapshot | null> {
    return null;
  }

  async saveSnapshot(_input: {
    aggregateKey: string;
    sequence: number;
    state: JsonObject;
  }): Promise<void> {
    /* F6 implements snapshot persistence */
  }

  async deleteSnapshot(_aggregateKey: string): Promise<void> {
    /* F6 implements snapshot deletion */
  }
}

export function buildAggregateKey(
  tenantId: EntityId,
  aggregateType: string,
  aggregateId: EntityId,
): string {
  return `${tenantId}:${aggregateType}:${aggregateId}`;
}

let snapshotStoreInstance: ISnapshotStore | null = null;

export function getSnapshotStore(): ISnapshotStore {
  if (!snapshotStoreInstance) {
    snapshotStoreInstance = new StubSnapshotStore();
  }
  return snapshotStoreInstance;
}

export function resetSnapshotStore(): void {
  snapshotStoreInstance = null;
}
