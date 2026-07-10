import { getDB } from "@/lib/db";
import {
  getOrCreateDeviceId,
  getOrCreateReplicaId,
  incrementVectorClock,
  mergeVectorClocks,
  vectorClockFromString,
  vectorClockToString,
  type VectorClock,
} from "./vectorClock";

export interface DBSyncCursorRow {
  id: string;
  deviceId: string;
  replicaId: string;
  tenantId: string;
  lastGlobalSequence: number;
  vectorClock: string;
  updatedAt: string;
}

export async function readSyncCursor(deviceId = getOrCreateDeviceId()): Promise<DBSyncCursorRow | null> {
  const db = getDB() as Record<string, { get: (id: string) => Promise<DBSyncCursorRow | undefined> }>;
  return (await db.eventSyncCursors?.get(deviceId)) ?? null;
}

export async function writeSyncCursor(input: {
  deviceId: string;
  replicaId: string;
  tenantId: string;
  lastGlobalSequence: number;
  vectorClock: VectorClock;
}): Promise<void> {
  const db = getDB() as Record<string, { put: (row: DBSyncCursorRow) => Promise<unknown> }>;
  await db.eventSyncCursors?.put({
    id: input.deviceId,
    deviceId: input.deviceId,
    replicaId: input.replicaId,
    tenantId: input.tenantId,
    lastGlobalSequence: input.lastGlobalSequence,
    vectorClock: vectorClockToString(input.vectorClock),
    updatedAt: new Date().toISOString(),
  });
}

export async function advanceSyncCursor(
  tenantId: string,
  globalSequence: number,
  remoteClock?: VectorClock,
): Promise<void> {
  const deviceId = getOrCreateDeviceId();
  const replicaId = getOrCreateReplicaId();
  const existing = await readSyncCursor(deviceId);
  const localClock = vectorClockFromString(existing?.vectorClock);
  const nextClock = remoteClock
    ? mergeVectorClocks(incrementVectorClock(localClock, deviceId), remoteClock)
    : incrementVectorClock(localClock, deviceId);

  await writeSyncCursor({
    deviceId,
    replicaId,
    tenantId,
    lastGlobalSequence: Math.max(existing?.lastGlobalSequence ?? 0, globalSequence),
    vectorClock: nextClock,
  });
}

export async function getLastSyncedGlobalSequence(): Promise<number> {
  const cursor = await readSyncCursor();
  return cursor?.lastGlobalSequence ?? 0;
}
