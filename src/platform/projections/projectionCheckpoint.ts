import { getDB } from "@/lib/db";
import type {
  DBProjectionCheckpoint,
  DBProjectionGlobalCursor,
  DBProjectionMeta,
  ProjectionName,
  ProjectionStatus,
} from "./projectionState";
import { GLOBAL_PROJECTION_CURSOR_ID, PROJECTION_ENGINE_VERSION } from "./projectionState";

export async function readGlobalProjectionCursor(): Promise<DBProjectionGlobalCursor | null> {
  const db = getDB() as Record<string, { get: (id: string) => Promise<DBProjectionGlobalCursor | undefined> }>;
  return (await db.projectionGlobalCursor?.get(GLOBAL_PROJECTION_CURSOR_ID)) ?? null;
}

export async function writeGlobalProjectionCursor(input: {
  lastGlobalSequence: number;
  status: ProjectionStatus;
}): Promise<void> {
  const db = getDB() as Record<string, { put: (row: DBProjectionGlobalCursor) => Promise<unknown> }>;
  await db.projectionGlobalCursor?.put({
    id: GLOBAL_PROJECTION_CURSOR_ID,
    lastGlobalSequence: input.lastGlobalSequence,
    projectionVersion: PROJECTION_ENGINE_VERSION,
    status: input.status,
    updatedAt: new Date().toISOString(),
  });
}

export async function readProjectionCheckpoint(
  projectionName: ProjectionName,
): Promise<DBProjectionCheckpoint | null> {
  const db = getDB() as Record<string, { get: (id: string) => Promise<DBProjectionCheckpoint | undefined> }>;
  return (await db.projectionCheckpoints?.get(projectionName)) ?? null;
}

export async function writeProjectionCheckpoint(
  checkpoint: DBProjectionCheckpoint,
): Promise<void> {
  const db = getDB() as Record<string, { put: (row: DBProjectionCheckpoint) => Promise<unknown> }>;
  await db.projectionCheckpoints?.put(checkpoint);
}

export async function readProjectionMeta(
  projectionName: ProjectionName,
): Promise<DBProjectionMeta | null> {
  const db = getDB() as Record<string, { get: (id: string) => Promise<DBProjectionMeta | undefined> }>;
  return (await db.projectionMeta?.get(projectionName)) ?? null;
}

export async function writeProjectionMeta(meta: DBProjectionMeta): Promise<void> {
  const db = getDB() as Record<string, { put: (row: DBProjectionMeta) => Promise<unknown> }>;
  await db.projectionMeta?.put(meta);
}

export async function updateProjectionStatus(
  projectionName: ProjectionName,
  status: ProjectionStatus,
  lastGlobalSequence?: number,
  errorMessage?: string,
): Promise<void> {
  const existing = await readProjectionMeta(projectionName);
  await writeProjectionMeta({
    id: projectionName,
    projectionName,
    version: existing?.version ?? PROJECTION_ENGINE_VERSION,
    status,
    lastGlobalSequence: lastGlobalSequence ?? existing?.lastGlobalSequence ?? 0,
    errorMessage,
    updatedAt: new Date().toISOString(),
  });
}

export function isProjectionSchemaReady(): boolean {
  try {
    const db = getDB() as Record<string, unknown>;
    return Boolean(db.projectionMeta && db.projectionGlobalCursor);
  } catch {
    return false;
  }
}

export async function clearProjectionTable(tableName: string): Promise<void> {
  const db = getDB() as Record<string, { clear: () => Promise<unknown> }>;
  const table = db[tableName];
  if (table) await table.clear();
}
