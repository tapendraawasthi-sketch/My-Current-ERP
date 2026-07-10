import type { SyncEventEnvelope } from "./syncServerContracts";

export function serializeSyncEnvelope(envelope: SyncEventEnvelope): string {
  return JSON.stringify(envelope);
}

export function serializeSyncBatch(envelopes: SyncEventEnvelope[]): string {
  return JSON.stringify({ envelopes });
}

export function deserializeSyncEnvelope(raw: string): SyncEventEnvelope | null {
  try {
    return JSON.parse(raw) as SyncEventEnvelope;
  } catch {
    return null;
  }
}

export function deserializeSyncBatch(raw: string): SyncEventEnvelope[] {
  try {
    const parsed = JSON.parse(raw) as { envelopes?: SyncEventEnvelope[] };
    return Array.isArray(parsed.envelopes) ? parsed.envelopes : [];
  } catch {
    return [];
  }
}
