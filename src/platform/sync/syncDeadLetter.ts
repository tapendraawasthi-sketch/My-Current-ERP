import { getDB } from "@/lib/db";

export interface DBEventSyncDeadLetterRow {
  id: string;
  eventId: string;
  reason: string;
  createdAt: string;
}

export async function writeDeadLetter(eventId: string, reason: string): Promise<void> {
  const db = getDB() as Record<string, { put: (row: DBEventSyncDeadLetterRow) => Promise<unknown> }>;
  if (!db.eventSyncDeadLetter) return;
  await db.eventSyncDeadLetter.put({
    id: `${eventId}:${Date.now()}`,
    eventId,
    reason,
    createdAt: new Date().toISOString(),
  });
}

export async function listDeadLetters(limit = 50): Promise<DBEventSyncDeadLetterRow[]> {
  const db = getDB() as Record<string, { toArray: () => Promise<DBEventSyncDeadLetterRow[]> }>;
  if (!db.eventSyncDeadLetter) return [];
  const rows = await db.eventSyncDeadLetter.toArray();
  return rows.slice(-limit);
}
