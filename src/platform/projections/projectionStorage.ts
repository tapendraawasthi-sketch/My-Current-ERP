import { getDB } from "@/lib/db";
import type { JsonObject } from "@fios/kernel";

export async function upsertProjectionRow(
  tableName: string,
  row: Record<string, unknown>,
  dryRun: boolean,
): Promise<void> {
  if (dryRun) return;
  const db = getDB() as Record<string, { put: (r: unknown) => Promise<unknown> }>;
  const table = db[tableName];
  if (!table) return;
  await table.put(row);
}

export async function deleteProjectionRow(
  tableName: string,
  id: string,
  dryRun: boolean,
): Promise<void> {
  if (dryRun) return;
  const db = getDB() as Record<string, { delete: (id: string) => Promise<unknown> }>;
  const table = db[tableName];
  if (!table) return;
  await table.delete(id);
}

export async function readProjectionRows<T extends Record<string, unknown>>(
  tableName: string,
): Promise<T[]> {
  const db = getDB() as Record<string, { toArray: () => Promise<T[]> }>;
  const table = db[tableName];
  if (!table) return [];
  return table.toArray();
}

export async function readProjectionRow<T extends Record<string, unknown>>(
  tableName: string,
  id: string,
): Promise<T | null> {
  const db = getDB() as Record<string, { get: (id: string) => Promise<T | undefined> }>;
  const table = db[tableName];
  if (!table) return null;
  return (await table.get(id)) ?? null;
}

export function payloadAsObject(payload: JsonObject): Record<string, unknown> {
  return payload as Record<string, unknown>;
}

export function extractGlobalSequence(event: { globalSequence?: number }, fallback: number): number {
  return event.globalSequence ?? fallback;
}
