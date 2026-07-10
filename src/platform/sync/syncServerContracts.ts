import type { EntityId, JsonObject } from "@fios/kernel";

export interface SyncEventEnvelope {
  eventId: EntityId;
  globalSequence: number;
  aggregateId: EntityId;
  aggregateType: string;
  aggregateVersion: number;
  tenantId: EntityId;
  principalId: EntityId;
  timestamp: string;
  eventType: string;
  payload: JsonObject;
  correlationId: EntityId;
  causationId?: EntityId;
  hash: string;
  signature: string;
}

export interface SyncPushRequest {
  deviceId: EntityId;
  replicaId: EntityId;
  tenantId: EntityId;
  vectorClock: Record<string, number>;
  envelopes: SyncEventEnvelope[];
}

export interface SyncPushResponse {
  accepted: number;
  rejected: number;
  conflicts: SyncConflictRecord[];
}

export interface SyncPullRequest {
  deviceId: EntityId;
  tenantId: EntityId;
  sinceGlobalSequence: number;
  vectorClock: Record<string, number>;
}

export interface SyncPullResponse {
  envelopes: SyncEventEnvelope[];
  vectorClock: Record<string, number>;
  lastGlobalSequence: number;
}

export interface SyncConflictRecord {
  eventId: EntityId;
  aggregateId: EntityId;
  aggregateType: string;
  classification: string;
  localVersion: number;
  remoteVersion: number;
}

export const SyncApiPaths = {
  PUSH: "/api/sync/events/push",
  PULL: "/api/sync/events/pull",
} as const;
