/**
 * Phase 5 authenticated event push/pull routes.
 * Mounted under /api/sync — coexists with legacy /push and /pull entity routes.
 */

import { Router } from "express";
import { authMiddleware, type AuthTokenPayload } from "../middleware/auth.js";
import { sendSuccess, sendError } from "../middleware/responseEnvelope.js";
import {
  ensureEventSyncTables,
  ingestSyncEnvelope,
  pullSyncEvents,
  resetE2ESyncStore,
} from "../lib/eventSyncStore.js";
import {
  assertDeviceAuthorized,
  registerOrResolveDevice,
  revokeDevice,
  resetE2EDeviceRegistrations,
  ensureDeviceRegistrationTable,
} from "../lib/deviceRegistration.js";
import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const router = Router();

function getJwtSecret(): string {
  return process.env.API_SECRET_KEY || process.env.JWT_SECRET || "dev-insecure-secret-change-me";
}

/**
 * Auth for event sync:
 * - Production: standard JWT via authMiddleware
 * - ORBIX_SYNC_TEST_MODE: accept Bearer orbix-sync-e2e-token with fixed test principal
 */
function eventSyncAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (
    process.env.ORBIX_SYNC_TEST_MODE === "true" &&
    header === "Bearer orbix-sync-e2e-token"
  ) {
    req.user = {
      sub: "orbix-sync-e2e-user",
      tenantId: "local",
      companyId: "orbix-sync-e2e-company",
      username: "orbix-sync-e2e",
      role: "admin",
      sessionId: "orbix-sync-e2e-session",
    };
    next();
    return;
  }

  if (!header?.startsWith("Bearer ")) {
    sendError(res, "Unauthorized", 401);
    return;
  }

  try {
    const token = header.slice("Bearer ".length);
    req.user = jwt.verify(token, getJwtSecret()) as AuthTokenPayload;
    next();
  } catch {
    sendError(res, "Invalid or expired token", 401);
  }
}

function resolveCompanyId(user: AuthTokenPayload, bodyCompanyId?: unknown): string {
  const fromToken = user.companyId;
  if (process.env.ORBIX_SYNC_TEST_MODE === "true") {
    if (typeof bodyCompanyId === "string" && bodyCompanyId) return bodyCompanyId;
    if (fromToken) return fromToken;
    throw new Error("company_required");
  }

  if (fromToken) {
    if (typeof bodyCompanyId === "string" && bodyCompanyId && bodyCompanyId !== fromToken) {
      throw new Error("company_mismatch");
    }
    return fromToken;
  }
  if (typeof bodyCompanyId === "string" && bodyCompanyId) {
    throw new Error("company_required_on_token");
  }
  throw new Error("company_required");
}

router.post("/events/push", eventSyncAuth, async (req, res) => {
  try {
    await ensureEventSyncTables();
    await ensureDeviceRegistrationTable();
    const user = req.user!;
    const { device_id, deviceId, tenant_id, tenantId, company_id, companyId, events, envelopes } =
      req.body ?? {};

    const resolvedTenant = user.tenantId;
    const requestTenant = tenant_id ?? tenantId;
    if (requestTenant && requestTenant !== resolvedTenant) {
      sendError(res, "Tenant mismatch", 403);
      return;
    }

    let resolvedCompany: string;
    try {
      resolvedCompany = resolveCompanyId(user, company_id ?? companyId);
    } catch (err) {
      sendError(res, err instanceof Error ? err.message : "Company scope error", 403);
      return;
    }

    const device = device_id ?? deviceId;
    if (!device || typeof device !== "string") {
      sendError(res, "device_id is required", 400);
      return;
    }

    // Auto-register on first push for authenticated principals; then authorize.
    await registerOrResolveDevice({
      deviceId: device,
      tenantId: resolvedTenant,
      companyId: resolvedCompany,
      userId: user.sub,
      deviceName: typeof req.body?.device_name === "string" ? req.body.device_name : undefined,
      installationId: typeof req.body?.installation_id === "string" ? req.body.installation_id : device,
    });
    const authz = await assertDeviceAuthorized({
      deviceId: device,
      tenantId: resolvedTenant,
      companyId: resolvedCompany,
    });
    if (!authz.ok) {
      sendError(res, authz.code, 403);
      return;
    }

    const batch = Array.isArray(events)
      ? events
      : Array.isArray(envelopes)
        ? envelopes
        : null;
    if (!batch) {
      sendError(res, "events array is required", 400);
      return;
    }

    const results = [];
    let accepted = 0;
    let rejected = 0;
    const conflicts = [];

    for (const raw of batch) {
      const envelope = raw.eventId
        ? raw
        : {
            eventId: raw.event_id,
            eventType: raw.event_type,
            aggregateType: raw.aggregate_type,
            aggregateId: raw.aggregate_id,
            aggregateVersion: raw.aggregate_version ?? 1,
            timestamp: raw.occurred_at ?? raw.timestamp,
            hash: raw.integrity?.event_hash ?? raw.hash,
            payload: raw.payload?.purchase
              ? {
                  ...raw,
                  purchase: raw.payload,
                  integrity: raw.integrity,
                  idempotency_key: raw.idempotency_key,
                  company_id: raw.company_id,
                }
              : raw.payload ?? raw,
          };

      // Prefer company from envelope payload when token allows test mode multi-company
      const envelopeCompany =
        (envelope.payload as { company_id?: string })?.company_id ?? resolvedCompany;
      if (
        process.env.ORBIX_SYNC_TEST_MODE !== "true" &&
        envelopeCompany !== resolvedCompany
      ) {
        results.push({
          eventId: envelope.eventId,
          status: "rejected",
          remoteEventId: null,
          remoteSequence: null,
          acknowledgedAt: null,
          errorCode: "company_mismatch",
          conflict: null,
        });
        rejected += 1;
        continue;
      }

      const companyForEvent =
        process.env.ORBIX_SYNC_TEST_MODE === "true" ? envelopeCompany : resolvedCompany;

      const result = await ingestSyncEnvelope({
        tenantId: resolvedTenant,
        companyId: companyForEvent,
        deviceId: device,
        envelope: {
          eventId: String(envelope.eventId),
          eventType: String(envelope.eventType),
          aggregateType: String(envelope.aggregateType),
          aggregateId: String(envelope.aggregateId),
          aggregateVersion: Number(envelope.aggregateVersion) || 1,
          timestamp: String(envelope.timestamp ?? new Date().toISOString()),
          hash: String(envelope.hash),
          payload: (envelope.payload ?? {}) as Record<string, unknown>,
        },
      });

      if (result.status === "accepted") accepted += 1;
      if (result.status === "rejected") rejected += 1;
      if (result.status === "conflict" && result.conflict) {
        conflicts.push({
          eventId: result.event_id,
          aggregateId: envelope.aggregateId,
          aggregateType: envelope.aggregateType,
          classification: result.conflict.classification,
          localVersion: result.conflict.localVersion ?? 0,
          remoteVersion: result.conflict.remoteVersion ?? 0,
        });
      }

      results.push({
        eventId: result.event_id,
        status: result.status,
        remoteEventId: result.remote_event_id,
        remoteSequence: result.remote_sequence,
        acknowledgedAt: result.acknowledged_at,
        errorCode: result.error_code,
        conflict: result.conflict,
      });
    }

    sendSuccess(res, {
      accepted,
      rejected,
      conflicts,
      results,
    });
  } catch (err) {
    sendError(res, err instanceof Error ? err.message : "Event push failed", 500);
  }
});

router.get("/events/pull", eventSyncAuth, async (req, res) => {
  try {
    await ensureEventSyncTables();
    await ensureDeviceRegistrationTable();
    const user = req.user!;
    const since = parseInt(String(req.query.since ?? req.query.cursor ?? "0"), 10) || 0;
    const companyIdParam = typeof req.query.companyId === "string" ? req.query.companyId : undefined;
    const deviceId =
      typeof req.query.deviceId === "string"
        ? req.query.deviceId
        : typeof req.query.device_id === "string"
          ? req.query.device_id
          : typeof req.headers["x-device-id"] === "string"
            ? req.headers["x-device-id"]
            : undefined;

    let companyId: string;
    try {
      companyId = resolveCompanyId(user, companyIdParam);
    } catch (err) {
      sendError(res, err instanceof Error ? err.message : "Company scope error", 403);
      return;
    }

    // Test mode may pull for a specific E2E company
    if (process.env.ORBIX_SYNC_TEST_MODE === "true" && companyIdParam) {
      companyId = companyIdParam;
    }

    if (!deviceId) {
      sendError(res, "device_id is required", 400);
      return;
    }

    await registerOrResolveDevice({
      deviceId,
      tenantId: user.tenantId,
      companyId,
      userId: user.sub,
    });
    const authz = await assertDeviceAuthorized({
      deviceId,
      tenantId: user.tenantId,
      companyId,
    });
    if (!authz.ok) {
      sendError(res, authz.code, 403);
      return;
    }

    const pulled = await pullSyncEvents({
      tenantId: user.tenantId,
      companyId,
      sinceRemoteSequence: since,
    });

    const envelopes = pulled.events.map((e) => ({
      eventId: e.event_id,
      globalSequence: Number(e.remote_sequence),
      aggregateId: e.aggregate_id,
      aggregateType: e.aggregate_type,
      aggregateVersion: e.aggregate_version,
      tenantId: e.tenant_id,
      principalId: "remote",
      timestamp: e.occurred_at,
      eventType: e.event_type,
      payload: e.payload,
      correlationId: e.event_id,
      hash: e.event_hash,
      signature: "",
      deviceId: e.device_id,
      companyId: e.company_id,
      remoteSequence: Number(e.remote_sequence),
    }));

    sendSuccess(res, {
      envelopes,
      vectorClock: {},
      lastGlobalSequence: pulled.lastRemoteSequence,
      nextCursor: pulled.lastRemoteSequence,
      hasMore: pulled.hasMore,
      serverTime: new Date().toISOString(),
    });
  } catch (err) {
    sendError(res, err instanceof Error ? err.message : "Event pull failed", 500);
  }
});

/** Explicit device registration */
router.post("/devices/register", eventSyncAuth, async (req, res) => {
  try {
    await ensureDeviceRegistrationTable();
    const user = req.user!;
    const deviceId = String(req.body?.device_id ?? req.body?.deviceId ?? "");
    if (!deviceId) {
      sendError(res, "device_id is required", 400);
      return;
    }
    let companyId: string;
    try {
      companyId = resolveCompanyId(user, req.body?.company_id ?? req.body?.companyId);
    } catch (err) {
      sendError(res, err instanceof Error ? err.message : "Company scope error", 403);
      return;
    }
    if (process.env.ORBIX_SYNC_TEST_MODE === "true" && req.body?.companyId) {
      companyId = String(req.body.companyId);
    }
    const registration = await registerOrResolveDevice({
      deviceId,
      tenantId: user.tenantId,
      companyId,
      userId: user.sub,
      deviceName: req.body?.device_name,
      installationId: req.body?.installation_id ?? deviceId,
    });
    sendSuccess(res, { registration });
  } catch (err) {
    sendError(res, err instanceof Error ? err.message : "Device registration failed", 500);
  }
});

/** Revoke device — admin/test */
router.post("/devices/revoke", eventSyncAuth, async (req, res) => {
  try {
    const user = req.user!;
    const deviceId = String(req.body?.device_id ?? req.body?.deviceId ?? "");
    if (!deviceId) {
      sendError(res, "device_id is required", 400);
      return;
    }
    let companyId: string;
    try {
      companyId = resolveCompanyId(user, req.body?.company_id ?? req.body?.companyId);
    } catch (err) {
      sendError(res, err instanceof Error ? err.message : "Company scope error", 403);
      return;
    }
    if (process.env.ORBIX_SYNC_TEST_MODE === "true" && req.body?.companyId) {
      companyId = String(req.body.companyId);
    }
    const registration = await revokeDevice({
      deviceId,
      tenantId: user.tenantId,
      companyId,
      revokedBy: user.sub,
    });
    if (!registration) {
      sendError(res, "device_unknown", 404);
      return;
    }
    sendSuccess(res, { registration });
  } catch (err) {
    sendError(res, err instanceof Error ? err.message : "Device revoke failed", 500);
  }
});

/** E2E reset — gated */
router.post("/events/e2e-reset", eventSyncAuth, async (req, res) => {
  if (process.env.ORBIX_SYNC_TEST_MODE !== "true") {
    sendError(res, "E2E reset disabled", 403);
    return;
  }
  const companyId = String(req.body?.companyId ?? "");
  try {
    const deleted = await resetE2ESyncStore(companyId);
    const devicesDeleted = await resetE2EDeviceRegistrations(companyId).catch(() => 0);
    sendSuccess(res, { deleted, devicesDeleted });
  } catch (err) {
    sendError(res, err instanceof Error ? err.message : "Reset failed", 400);
  }
});

// Keep authMiddleware export usage for legacy co-existence documentation
void authMiddleware;

export default router;
