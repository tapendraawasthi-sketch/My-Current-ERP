import type { IPrincipal } from "@fios/kernel";
import { isMigrationFlagEnabled } from "@/platform/flags/registry";
import { getIdentityProvider } from "@/platform/identity/identityProvider";
import { getTokenValidator } from "@/platform/identity/tokenValidator";
import { readAccessToken, writeAccessToken } from "@/platform/identity/session";
import { resolveTenantFromPrincipal, assertTrustedTenant } from "@/platform/identity/tenantResolver";
import type {
  SyncPullRequest,
  SyncPullResponse,
  SyncPushRequest,
  SyncPushResponse,
} from "./syncServerContracts";
import { SyncApiPaths } from "./syncServerContracts";
import { recordSyncDiagnostic } from "./syncDiagnostics";

function apiBase(): string {
  return (
    import.meta.env.VITE_PUBLIC_API_URL ||
    import.meta.env.VITE_API_URL ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

function isSyncTestMode(): boolean {
  try {
    return (
      import.meta.env.VITE_ORBIX_SYNC_TEST_MODE === "true" ||
      import.meta.env.VITE_ORBIX_SYNC_E2E === "true"
    );
  } catch {
    return false;
  }
}

const E2E_TOKEN = "orbix-sync-e2e-token";

export interface SyncAuthContext {
  token: string;
  principal: IPrincipal | null;
  tenantId: string;
}

export class SyncAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SyncAuthError";
  }
}

export function requireSyncAuth(): SyncAuthContext {
  if (isSyncTestMode()) {
    let token = readAccessToken();
    if (!token) {
      writeAccessToken(E2E_TOKEN);
      token = E2E_TOKEN;
    }
    const provider = getIdentityProvider();
    const principal = provider.getPrincipal();
    return {
      token: token === E2E_TOKEN || token ? token : E2E_TOKEN,
      principal,
      tenantId: principal?.tenantId ?? "local",
    };
  }

  const token = readAccessToken();
  if (!token) {
    throw new SyncAuthError("Sync requires authenticated JWT");
  }

  if (isMigrationFlagEnabled("MIGRATION_JWT_VALIDATION")) {
    const validation = getTokenValidator().validateAccessToken(token);
    if (!validation.valid && token !== E2E_TOKEN) {
      throw new SyncAuthError(validation.error ?? "Invalid JWT");
    }
  }

  const provider = getIdentityProvider();
  const principal = provider.getPrincipal();
  if (!principal) {
    throw new SyncAuthError("Sync requires authenticated principal");
  }

  const tenantId = assertTrustedTenant(principal, "sync");
  if (resolveTenantFromPrincipal(principal) !== tenantId) {
    throw new SyncAuthError("Tenant mismatch in identity context");
  }

  return { token, principal, tenantId };
}

function unwrapData<T>(body: unknown): T {
  if (body && typeof body === "object" && "data" in body && (body as { success?: boolean }).success) {
    return (body as { data: T }).data;
  }
  return body as T;
}

export async function transportPush(request: SyncPushRequest): Promise<SyncPushResponse> {
  const auth = requireSyncAuth();
  if (request.tenantId !== auth.tenantId && !isSyncTestMode()) {
    throw new SyncAuthError("Rejected untrusted tenantId in sync push request");
  }

  const companyId =
    (request.envelopes[0]?.payload as { company_id?: string } | undefined)?.company_id ??
    undefined;

  const res = await fetch(`${apiBase()}${SyncApiPaths.PUSH}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${auth.token}`,
    },
    body: JSON.stringify({
      deviceId: request.deviceId,
      device_id: request.deviceId,
      replicaId: request.replicaId,
      tenantId: auth.tenantId,
      tenant_id: auth.tenantId,
      companyId,
      company_id: companyId,
      envelopes: request.envelopes,
      events: request.envelopes,
      vectorClock: request.vectorClock,
    }),
  });

  if (!res.ok) {
    recordSyncDiagnostic({
      stage: "push-failed",
      message: `HTTP ${res.status}`,
      timestamp: new Date().toISOString(),
    });
    throw new Error(`Event sync push failed: HTTP ${res.status}`);
  }

  const body = unwrapData<SyncPushResponse>(await res.json());
  return body;
}

export async function transportPull(
  request: SyncPullRequest & { companyId?: string },
): Promise<SyncPullResponse> {
  const auth = requireSyncAuth();
  if (request.tenantId !== auth.tenantId && !isSyncTestMode()) {
    throw new SyncAuthError("Rejected untrusted tenantId in sync pull request");
  }

  const params = new URLSearchParams({
    since: String(request.sinceGlobalSequence),
  });
  if (request.companyId) params.set("companyId", request.companyId);
  if (request.deviceId) {
    params.set("deviceId", request.deviceId);
    params.set("device_id", request.deviceId);
  }

  const url = `${apiBase()}${SyncApiPaths.PULL}?${params.toString()}`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${auth.token}`,
      "X-Device-Id": request.deviceId,
    },
  });

  if (!res.ok) {
    recordSyncDiagnostic({
      stage: "pull-failed",
      message: `HTTP ${res.status}`,
      timestamp: new Date().toISOString(),
    });
    throw new Error(`Event sync pull failed: HTTP ${res.status}`);
  }

  return unwrapData<SyncPullResponse>(await res.json());
}
