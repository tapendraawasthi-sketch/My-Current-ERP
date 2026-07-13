/**
 * Minimal backend unit tests for device registration (Phase 6.5.9).
 * Uses file store under ORBIX_SYNC_TEST_MODE.
 */

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";

describe("deviceRegistration", () => {
  let tmpDir: string;
  let prevEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    prevEnv = { ...process.env };
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "orbix-device-"));
    process.env.ORBIX_SYNC_TEST_MODE = "true";
    process.env.ORBIX_SYNC_STORE_PATH = tmpDir;
  });

  afterEach(() => {
    process.env = prevEnv;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("auto-activates device in test mode and authorizes push", async () => {
    const {
      registerOrResolveDevice,
      assertDeviceAuthorized,
      revokeDevice,
    } = await import("../../../packages/backend/src/lib/deviceRegistration.ts");

    const reg = await registerOrResolveDevice({
      deviceId: "dev-a",
      tenantId: "local",
      companyId: "orbix-sales-e2e-company",
      userId: "user-1",
    });
    expect(reg.status).toBe("active");

    const ok = await assertDeviceAuthorized({
      deviceId: "dev-a",
      tenantId: "local",
      companyId: "orbix-sales-e2e-company",
    });
    expect(ok.ok).toBe(true);

    await revokeDevice({
      deviceId: "dev-a",
      tenantId: "local",
      companyId: "orbix-sales-e2e-company",
      revokedBy: "admin",
    });
    const denied = await assertDeviceAuthorized({
      deviceId: "dev-a",
      tenantId: "local",
      companyId: "orbix-sales-e2e-company",
    });
    expect(denied).toMatchObject({ ok: false, code: "device_revoked" });
  });

  it("rejects unknown device", async () => {
    const { assertDeviceAuthorized } = await import(
      "../../../packages/backend/src/lib/deviceRegistration.ts"
    );
    const denied = await assertDeviceAuthorized({
      deviceId: "never-registered",
      tenantId: "local",
      companyId: "orbix-sales-e2e-company",
    });
    expect(denied).toMatchObject({ ok: false, code: "device_unknown" });
  });

  it("isolates devices by company", async () => {
    const { registerOrResolveDevice, assertDeviceAuthorized } = await import(
      "../../../packages/backend/src/lib/deviceRegistration.ts"
    );
    await registerOrResolveDevice({
      deviceId: "dev-shared",
      tenantId: "local",
      companyId: "company-a",
      userId: "user-1",
    });
    const other = await assertDeviceAuthorized({
      deviceId: "dev-shared",
      tenantId: "local",
      companyId: "company-b",
    });
    expect(other).toMatchObject({ ok: false, code: "device_unknown" });
  });
});
