import { PROJECTION_ENGINE_VERSION } from "./projectionState";

export function getProjectionEngineVersion(): number {
  return PROJECTION_ENGINE_VERSION;
}

export function isCompatibleProjectionVersion(version: number): boolean {
  return version === PROJECTION_ENGINE_VERSION;
}

export function bumpProjectionVersion(current: number): number {
  return current + 1;
}
