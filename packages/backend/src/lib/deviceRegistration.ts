/**
 * Server-controlled device registration for event sync (Phase 6.5.9).
 * Client installation UUID remains stable; push/pull require an active registration.
 */

import fs from "fs";
import path from "path";
import { query } from "./db.js";

export type DeviceRegistrationStatus = "pending" | "active" | "revoked" | "disabled";

export interface DeviceRegistration {
  device_id: string;
  tenant_id: string;
  company_id: string;
  user_id: string;
  device_name: string;
  installation_id: string;
  status: DeviceRegistrationStatus;
  registered_at: string;
  approved_at: string | null;
  approved_by: string | null;
  last_seen_at: string | null;
  revoked_at: string | null;
  revoked_by: string | null;
}

interface DeviceFileStore {
  devices: Record<string, DeviceRegistration>;
}

function useFileStore(): boolean {
  return (
    process.env.ORBIX_SYNC_TEST_MODE === "true" ||
    process.env.ORBIX_SYNC_USE_FILE_STORE === "true" ||
    !process.env.DATABASE_URL
  );
}

function deviceStorePath(): string {
  const dir = process.env.ORBIX_SYNC_STORE_PATH || path.join(process.cwd(), ".data");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, "device-registrations.json");
}

function readDeviceStore(): DeviceFileStore {
  const file = deviceStorePath();
  if (!fs.existsSync(file)) return { devices: {} };
  return JSON.parse(fs.readFileSync(file, "utf8")) as DeviceFileStore;
}

function writeDeviceStore(store: DeviceFileStore): void {
  fs.writeFileSync(deviceStorePath(), JSON.stringify(store, null, 2), "utf8");
}

function scopeKey(tenantId: string, companyId: string, deviceId: string): string {
  return `${tenantId}|${companyId}|${deviceId}`;
}

export async function ensureDeviceRegistrationTable(): Promise<void> {
  if (useFileStore()) return;
  await query(`
    CREATE TABLE IF NOT EXISTS device_registrations (
      device_id TEXT NOT NULL,
      tenant_id TEXT NOT NULL,
      company_id TEXT NOT NULL,
      user_id TEXT,
      device_name TEXT,
      installation_id TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      approved_at TIMESTAMPTZ,
      approved_by TEXT,
      last_seen_at TIMESTAMPTZ,
      revoked_at TIMESTAMPTZ,
      revoked_by TEXT,
      PRIMARY KEY (tenant_id, company_id, device_id)
    );
  `);
}

/**
 * Register or resolve a device. In test mode / auto-activate policy, status becomes active.
 */
export async function registerOrResolveDevice(input: {
  deviceId: string;
  tenantId: string;
  companyId: string;
  userId: string;
  deviceName?: string;
  installationId?: string;
  autoActivate?: boolean;
}): Promise<DeviceRegistration> {
  const now = new Date().toISOString();
  const auto =
    input.autoActivate !== false &&
    (process.env.ORBIX_SYNC_TEST_MODE === "true" ||
      process.env.ORBIX_DEVICE_AUTO_ACTIVATE === "true");
  const key = scopeKey(input.tenantId, input.companyId, input.deviceId);

  if (useFileStore()) {
    const store = readDeviceStore();
    const existing = store.devices[key];
    if (existing) {
      if (existing.status === "revoked" || existing.status === "disabled") {
        return existing;
      }
      existing.last_seen_at = now;
      if (auto && existing.status === "pending") {
        existing.status = "active";
        existing.approved_at = now;
        existing.approved_by = "system_auto";
      }
      writeDeviceStore(store);
      return existing;
    }
    const created: DeviceRegistration = {
      device_id: input.deviceId,
      tenant_id: input.tenantId,
      company_id: input.companyId,
      user_id: input.userId,
      device_name: input.deviceName || `Device ${input.deviceId.slice(0, 8)}`,
      installation_id: input.installationId || input.deviceId,
      status: auto ? "active" : "pending",
      registered_at: now,
      approved_at: auto ? now : null,
      approved_by: auto ? "system_auto" : null,
      last_seen_at: now,
      revoked_at: null,
      revoked_by: null,
    };
    store.devices[key] = created;
    writeDeviceStore(store);
    return created;
  }

  await ensureDeviceRegistrationTable();
  const existing = await query<DeviceRegistration>(
    `SELECT device_id, tenant_id, company_id, user_id, device_name, installation_id, status,
            registered_at::text, approved_at::text, approved_by, last_seen_at::text,
            revoked_at::text, revoked_by
     FROM device_registrations
     WHERE tenant_id = $1 AND company_id = $2 AND device_id = $3`,
    [input.tenantId, input.companyId, input.deviceId],
  );
  if (existing.rows[0]) {
    const row = existing.rows[0];
    if (row.status !== "revoked" && row.status !== "disabled") {
      await query(
        `UPDATE device_registrations SET last_seen_at = NOW(),
          status = CASE WHEN $4::boolean AND status = 'pending' THEN 'active' ELSE status END,
          approved_at = CASE WHEN $4::boolean AND status = 'pending' THEN NOW() ELSE approved_at END
         WHERE tenant_id = $1 AND company_id = $2 AND device_id = $3`,
        [input.tenantId, input.companyId, input.deviceId, auto],
      );
    }
    return row;
  }

  const status: DeviceRegistrationStatus = auto ? "active" : "pending";
  await query(
    `INSERT INTO device_registrations
      (device_id, tenant_id, company_id, user_id, device_name, installation_id, status,
       registered_at, approved_at, approved_by, last_seen_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),$8,$9,NOW())`,
    [
      input.deviceId,
      input.tenantId,
      input.companyId,
      input.userId,
      input.deviceName || `Device ${input.deviceId.slice(0, 8)}`,
      input.installationId || input.deviceId,
      status,
      auto ? now : null,
      auto ? "system_auto" : null,
    ],
  );
  return {
    device_id: input.deviceId,
    tenant_id: input.tenantId,
    company_id: input.companyId,
    user_id: input.userId,
    device_name: input.deviceName || `Device ${input.deviceId.slice(0, 8)}`,
    installation_id: input.installationId || input.deviceId,
    status,
    registered_at: now,
    approved_at: auto ? now : null,
    approved_by: auto ? "system_auto" : null,
    last_seen_at: now,
    revoked_at: null,
    revoked_by: null,
  };
}

export async function assertDeviceAuthorized(input: {
  deviceId: string;
  tenantId: string;
  companyId: string;
}): Promise<
  | { ok: true; registration: DeviceRegistration }
  | { ok: false; code: string; registration?: DeviceRegistration }
> {
  const key = scopeKey(input.tenantId, input.companyId, input.deviceId);

  if (useFileStore()) {
    const store = readDeviceStore();
    const reg = store.devices[key];
    if (!reg) return { ok: false, code: "device_unknown" };
    if (reg.status === "pending") return { ok: false, code: "device_pending", registration: reg };
    if (reg.status === "revoked") return { ok: false, code: "device_revoked", registration: reg };
    if (reg.status === "disabled") return { ok: false, code: "device_disabled", registration: reg };
    if (reg.status !== "active") return { ok: false, code: "device_not_authorized", registration: reg };
    reg.last_seen_at = new Date().toISOString();
    writeDeviceStore(store);
    return { ok: true, registration: reg };
  }

  await ensureDeviceRegistrationTable();
  const result = await query<DeviceRegistration>(
    `SELECT device_id, tenant_id, company_id, user_id, device_name, installation_id, status,
            registered_at::text, approved_at::text, approved_by, last_seen_at::text,
            revoked_at::text, revoked_by
     FROM device_registrations
     WHERE tenant_id = $1 AND company_id = $2 AND device_id = $3`,
    [input.tenantId, input.companyId, input.deviceId],
  );
  const reg = result.rows[0];
  if (!reg) return { ok: false, code: "device_unknown" };
  if (reg.status === "pending") return { ok: false, code: "device_pending", registration: reg };
  if (reg.status === "revoked") return { ok: false, code: "device_revoked", registration: reg };
  if (reg.status === "disabled") return { ok: false, code: "device_disabled", registration: reg };
  if (reg.status !== "active") return { ok: false, code: "device_not_authorized", registration: reg };
  await query(
    `UPDATE device_registrations SET last_seen_at = NOW()
     WHERE tenant_id = $1 AND company_id = $2 AND device_id = $3`,
    [input.tenantId, input.companyId, input.deviceId],
  );
  return { ok: true, registration: reg };
}

export async function revokeDevice(input: {
  deviceId: string;
  tenantId: string;
  companyId: string;
  revokedBy: string;
}): Promise<DeviceRegistration | null> {
  const now = new Date().toISOString();
  const key = scopeKey(input.tenantId, input.companyId, input.deviceId);

  if (useFileStore()) {
    const store = readDeviceStore();
    const reg = store.devices[key];
    if (!reg) return null;
    reg.status = "revoked";
    reg.revoked_at = now;
    reg.revoked_by = input.revokedBy;
    writeDeviceStore(store);
    return reg;
  }

  await ensureDeviceRegistrationTable();
  await query(
    `UPDATE device_registrations
     SET status = 'revoked', revoked_at = NOW(), revoked_by = $4
     WHERE tenant_id = $1 AND company_id = $2 AND device_id = $3`,
    [input.tenantId, input.companyId, input.deviceId, input.revokedBy],
  );
  const result = await query<DeviceRegistration>(
    `SELECT device_id, tenant_id, company_id, user_id, device_name, installation_id, status,
            registered_at::text, approved_at::text, approved_by, last_seen_at::text,
            revoked_at::text, revoked_by
     FROM device_registrations
     WHERE tenant_id = $1 AND company_id = $2 AND device_id = $3`,
    [input.tenantId, input.companyId, input.deviceId],
  );
  return result.rows[0] ?? null;
}

/** E2E helper: clear device registrations for a tagged company. */
export async function resetE2EDeviceRegistrations(companyId: string): Promise<number> {
  if (!companyId.startsWith("orbix-") && !companyId.includes("e2e")) {
    throw new Error("Refuse to reset non-E2E device registrations");
  }
  if (useFileStore()) {
    const store = readDeviceStore();
    const before = Object.keys(store.devices).length;
    for (const key of Object.keys(store.devices)) {
      if (store.devices[key].company_id === companyId) delete store.devices[key];
    }
    writeDeviceStore(store);
    return before - Object.keys(store.devices).length;
  }
  const result = await query(`DELETE FROM device_registrations WHERE company_id = $1`, [
    companyId,
  ]);
  return result.rowCount ?? 0;
}
