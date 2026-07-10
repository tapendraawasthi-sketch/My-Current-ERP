import type { EntityId, IPrincipal } from "@fios/kernel";

/**
 * Tenant resolution — always from authenticated identity.
 * Never trust request body, headers, or query parameters for tenant ownership.
 */

export function buildTenantId(companyId: EntityId | null): EntityId {
  if (!companyId) return "local";
  return `tenant:${companyId}`;
}

export function resolveTenantFromPrincipal(principal: IPrincipal | null): EntityId | null {
  if (!principal) return null;
  return principal.tenantId;
}

export function resolveCompanyFromPrincipal(principal: IPrincipal | null): EntityId | null {
  if (!principal) return null;
  return principal.companyId;
}

export function rejectUntrustedTenantInput(
  _proposedTenantId: unknown,
  principal: IPrincipal | null,
): EntityId | null {
  return resolveTenantFromPrincipal(principal);
}

export function assertTrustedTenant(
  principal: IPrincipal | null,
  operation: string,
): EntityId {
  const tenantId = resolveTenantFromPrincipal(principal);
  if (!tenantId) {
    throw new Error(`Tenant context required for ${operation}`);
  }
  return tenantId;
}
