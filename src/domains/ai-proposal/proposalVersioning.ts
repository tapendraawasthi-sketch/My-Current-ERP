export const PROPOSAL_SCHEMA_VERSION = 1;

export function bumpVersion(current: number): number {
  return current + 1;
}

export function isCompatibleVersion(version: number): boolean {
  return version <= PROPOSAL_SCHEMA_VERSION;
}
