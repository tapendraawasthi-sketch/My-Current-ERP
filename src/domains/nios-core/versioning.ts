export const NIOS_CORE_SCHEMA_VERSION = 1;

export interface VersionedPayload<T> {
  engineVersion: string;
  schemaVersion: number;
  payload: T;
}

export function versionPayload<T>(payload: T, schemaVersion = NIOS_CORE_SCHEMA_VERSION): VersionedPayload<T> {
  return {
    engineVersion: "1.0.0",
    schemaVersion,
    payload,
  };
}
