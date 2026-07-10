import { nextEventVersion } from "./accountingSnapshot";

export const ACCOUNTING_ENGINE_VERSION = "1.0.0";

export interface VersionedPayload {
  engineVersion: string;
  schemaVersion: number;
  payload: Record<string, unknown>;
}

export function versionPayload(payload: Record<string, unknown>, schemaVersion = 1): VersionedPayload {
  return {
    engineVersion: ACCOUNTING_ENGINE_VERSION,
    schemaVersion,
    payload,
  };
}

export function unwrapVersioned(data: VersionedPayload | Record<string, unknown>): Record<string, unknown> {
  if ("payload" in data && "engineVersion" in data) {
    return (data as VersionedPayload).payload;
  }
  return data as Record<string, unknown>;
}

export function currentEventVersion(): number {
  return nextEventVersion();
}
