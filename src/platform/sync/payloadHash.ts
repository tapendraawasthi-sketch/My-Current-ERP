/**
 * Deterministic payload hashing for Phase 5 sync integrity.
 * Excludes mutable sync-status metadata from the hash input.
 */

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(obj[key])}`).join(",")}}`;
}

export async function sha256Hex(canonical: string): Promise<string> {
  const data = new TextEncoder().encode(canonical);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/** Hash of authoritative event content only (no sync.* fields). */
export async function computePayloadHash(payload: unknown): Promise<string> {
  return sha256Hex(stableStringify(payload));
}

/**
 * Device/company stream hash chain:
 * event_hash = hash(previous_event_hash + payload_hash + event metadata)
 */
export async function computeEventChainHash(input: {
  previousEventHash: string | null;
  payloadHash: string;
  eventId: string;
  eventType: string;
  aggregateId: string;
  aggregateVersion: number;
  localSequence: number;
  companyId: string;
  deviceId: string;
  occurredAt: string;
}): Promise<string> {
  return sha256Hex(
    stableStringify({
      previousEventHash: input.previousEventHash,
      payloadHash: input.payloadHash,
      eventId: input.eventId,
      eventType: input.eventType,
      aggregateId: input.aggregateId,
      aggregateVersion: input.aggregateVersion,
      localSequence: input.localSequence,
      companyId: input.companyId,
      deviceId: input.deviceId,
      occurredAt: input.occurredAt,
    }),
  );
}
