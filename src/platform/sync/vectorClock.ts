const DEVICE_ID_KEY = "fios_sync_device_id";
const REPLICA_ID_KEY = "fios_sync_replica_id";

export function getOrCreateDeviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    return "local-device";
  }
}

export function getOrCreateReplicaId(): string {
  try {
    let id = localStorage.getItem(REPLICA_ID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(REPLICA_ID_KEY, id);
    }
    return id;
  } catch {
    return "local-replica";
  }
}

export type VectorClock = Record<string, number>;

export function createEmptyVectorClock(deviceId: string): VectorClock {
  return { [deviceId]: 0 };
}

export function incrementVectorClock(clock: VectorClock, deviceId: string): VectorClock {
  return { ...clock, [deviceId]: (clock[deviceId] ?? 0) + 1 };
}

export function mergeVectorClocks(a: VectorClock, b: VectorClock): VectorClock {
  const merged: VectorClock = { ...a };
  for (const [key, value] of Object.entries(b)) {
    merged[key] = Math.max(merged[key] ?? 0, value);
  }
  return merged;
}

export function compareVectorClocks(
  local: VectorClock,
  remote: VectorClock,
): "before" | "after" | "concurrent" | "equal" {
  let localGreater = false;
  let remoteGreater = false;
  const keys = new Set([...Object.keys(local), ...Object.keys(remote)]);
  for (const key of keys) {
    const lv = local[key] ?? 0;
    const rv = remote[key] ?? 0;
    if (lv > rv) localGreater = true;
    if (rv > lv) remoteGreater = true;
  }
  if (localGreater && remoteGreater) return "concurrent";
  if (localGreater) return "after";
  if (remoteGreater) return "before";
  return "equal";
}

export function vectorClockToString(clock: VectorClock): string {
  return JSON.stringify(clock);
}

export function vectorClockFromString(raw: string | null | undefined): VectorClock {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as VectorClock;
  } catch {
    return {};
  }
}
