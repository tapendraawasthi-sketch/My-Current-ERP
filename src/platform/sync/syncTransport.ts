import type { IPrincipal } from "@fios/kernel";
import { isMigrationFlagEnabled } from "@/platform/flags/registry";
import { getIdentityProvider } from "@/platform/identity/identityProvider";
import { getTokenValidator } from "@/platform/identity/tokenValidator";
import { readAccessToken } from "@/platform/identity/session";
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

export interface SyncAuthContext {
  token: string;
  principal: IPrincipal;
  tenantId: string;
}

export class SyncAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SyncAuthError";
  }
}

export function requireSyncAuth(): SyncAuthContext {
  const token = readAccessToken();
  if (!token) {
    throw new SyncAuthError("Sync requires authenticated JWT");
  }

  if (isMigrationFlagEnabled("MIGRATION_JWT_VALIDATION")) {
    const validation = getTokenValidator().validateAccessToken(token);
    if (!validation.valid) {
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

export async function transportPush(request: SyncPushRequest): Promise<SyncPushResponse> {
  const auth = requireSyncAuth();
  if (request.tenantId !== auth.tenantId) {
    throw new SyncAuthError("Rejected untrusted tenantId in sync push request");
  }

  const res = await fetch(`${apiBase()}${SyncApiPaths.PUSH}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${auth.token}`,
    },
    body: JSON.stringify(request),
  });

  if (!res.ok) {
    recordSyncDiagnostic({
      stage: "push-failed",
      message: `HTTP ${res.status}`,
      timestamp: new Date().toISOString(),
    });
    throw new Error(`Event sync push failed: HTTP ${res.status}`);
  }

  const body = (await res.json()) as SyncPushResponse;
  return body;
}

export async function transportPull(request: SyncPullRequest): Promise<SyncPullResponse> {
  const auth = requireSyncAuth();
  if (request.tenantId !== auth.tenantId) {
    throw new SyncAuthError("Rejected untrusted tenantId in sync pull request");
  }

  const url = `${apiBase()}${SyncApiPaths.PULL}?since=${request.sinceGlobalSequence}`;
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

  return (await res.json()) as SyncPullResponse;
}
