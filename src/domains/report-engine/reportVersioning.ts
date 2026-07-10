export const REPORT_ENGINE_VERSION = "1.0.0";

export interface VersionedReport<T> {
  engineVersion: string;
  schemaVersion: number;
  generatedAt: string;
  data: T;
}

export function versionReport<T>(data: T, schemaVersion = 1): VersionedReport<T> {
  return {
    engineVersion: REPORT_ENGINE_VERSION,
    schemaVersion,
    generatedAt: new Date().toISOString(),
    data,
  };
}
