let projectionLockHeld = false;
let lockOwner: string | null = null;

export async function acquireProjectionLock(owner: string): Promise<boolean> {
  if (projectionLockHeld) return false;
  projectionLockHeld = true;
  lockOwner = owner;
  return true;
}

export function releaseProjectionLock(owner: string): void {
  if (lockOwner === owner) {
    projectionLockHeld = false;
    lockOwner = null;
  }
}

export function isProjectionLocked(): boolean {
  return projectionLockHeld;
}

export function getProjectionLockOwner(): string | null {
  return lockOwner;
}
