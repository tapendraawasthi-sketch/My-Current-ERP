import type { EntityId } from "@fios/kernel";
import type { IClaims } from "@fios/kernel";

export function buildClaims(input: {
  userId: EntityId;
  username: string;
  role: string;
  tenantId: EntityId;
  companyId?: EntityId | null;
  sessionId?: EntityId;
  permissions?: string[];
}): IClaims {
  const now = Math.floor(Date.now() / 1000);
  return {
    sub: input.userId,
    tenantId: input.tenantId,
    companyId: input.companyId ?? undefined,
    username: input.username,
    role: input.role,
    sessionId: input.sessionId,
    permissions: input.permissions,
    iat: now,
  };
}

export function claimsFromJwtPayload(payload: Record<string, unknown>): IClaims | null {
  const sub = payload.sub;
  const tenantId = payload.tenantId;
  if (typeof sub !== "string" || typeof tenantId !== "string") return null;
  return {
    sub,
    tenantId,
    companyId: typeof payload.companyId === "string" ? payload.companyId : undefined,
    username: typeof payload.username === "string" ? payload.username : sub,
    role: typeof payload.role === "string" ? payload.role : "user",
    sessionId: typeof payload.sessionId === "string" ? payload.sessionId : undefined,
    permissions: Array.isArray(payload.permissions)
      ? payload.permissions.map(String)
      : undefined,
    iat: typeof payload.iat === "number" ? payload.iat : undefined,
    exp: typeof payload.exp === "number" ? payload.exp : undefined,
  };
}

export function extractClaim<T = unknown>(claims: IClaims, key: string): T | undefined {
  return claims[key] as T | undefined;
}
