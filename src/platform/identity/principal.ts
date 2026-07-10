import type { IPrincipal, IClaims } from "@fios/kernel";
import { buildClaims } from "./claims";

export function createPrincipal(input: {
  userId: string;
  username: string;
  role: string;
  tenantId: string;
  companyId?: string | null;
  sessionId?: string;
  permissions?: string[];
}): IPrincipal {
  const claims: IClaims = buildClaims({
    userId: input.userId,
    username: input.username,
    role: input.role,
    tenantId: input.tenantId,
    companyId: input.companyId,
    sessionId: input.sessionId,
    permissions: input.permissions,
  });

  return {
    userId: input.userId,
    username: input.username,
    role: input.role,
    tenantId: input.tenantId,
    companyId: input.companyId ?? null,
    sessionId: input.sessionId,
    claims,
  };
}

export function isPrincipalAuthenticated(principal: IPrincipal | null): boolean {
  return Boolean(principal?.userId && principal?.tenantId);
}

export function principalEquals(a: IPrincipal | null, b: IPrincipal | null): boolean {
  if (!a || !b) return false;
  return a.userId === b.userId && a.tenantId === b.tenantId && a.sessionId === b.sessionId;
}
