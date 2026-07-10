import type { IIdentityProvider, IIdentityTenantContext, IPrincipal } from "@fios/kernel";
import { isMigrationFlagEnabled } from "@/platform/flags/registry";
import { getAuthenticationService } from "./authentication";
import { setIdentityContext, setPrincipal } from "./identityContext";
import { buildTenantId, resolveTenantFromPrincipal } from "./tenantResolver";
import { getTokenValidator } from "./tokenValidator";
import { readAccessToken } from "./session";
import { claimsFromJwtPayload } from "./claims";
import { createPrincipal } from "./principal";
import { identityMetrics } from "./identityMetrics";

export class LegacyIdentityProvider implements IIdentityProvider {
  private cachedPrincipal: IPrincipal | null = null;

  refreshFromLegacy(): void {
    const auth = getAuthenticationService();
    const result = auth.authenticateFromLegacy();
    this.cachedPrincipal = result.success ? (result.principal ?? null) : null;

    if (this.cachedPrincipal) {
      setPrincipal(this.cachedPrincipal);
      setIdentityContext(this.getTenantContext());
      identityMetrics.incrementContextRefreshes();
    }
  }

  tryHydrateFromJwt(): IPrincipal | null {
    if (!isMigrationFlagEnabled("MIGRATION_JWT_VALIDATION")) return null;
    const token = readAccessToken();
    if (!token) return null;

    const validator = getTokenValidator();
    const validation = validator.validateAccessToken(token);
    if (!validation.valid || !validation.payload) return null;

    const claims = claimsFromJwtPayload(validation.payload as Record<string, unknown>);
    if (!claims) return null;

    return createPrincipal({
      userId: claims.sub,
      username: claims.username,
      role: claims.role,
      tenantId: claims.tenantId,
      companyId: claims.companyId ?? null,
      sessionId: claims.sessionId,
      permissions: claims.permissions,
    });
  }

  getPrincipal(): IPrincipal | null {
    if (!isMigrationFlagEnabled("MIGRATION_IDENTITY")) return null;

    const jwtPrincipal = this.tryHydrateFromJwt();
    if (jwtPrincipal) {
      this.cachedPrincipal = jwtPrincipal;
      return jwtPrincipal;
    }

    if (!this.cachedPrincipal) {
      this.refreshFromLegacy();
    }
    return this.cachedPrincipal;
  }

  isAuthenticated(): boolean {
    return Boolean(this.getPrincipal());
  }

  getTenantContext(): IIdentityTenantContext {
    const principal = this.getPrincipal();
    const tenantId = resolveTenantFromPrincipal(principal);

    if (!principal) {
      return {
        tenantId: null,
        principal: null,
        user: null,
        company: { companyId: null },
        isAuthenticated: false,
      };
    }

    return {
      tenantId,
      principal,
      user: {
        userId: principal.userId,
        username: principal.username,
        role: principal.role,
      },
      company: {
        companyId: principal.companyId,
      },
      isAuthenticated: true,
    };
  }
}

let providerInstance: IIdentityProvider | null = null;

export function getIdentityProvider(): IIdentityProvider {
  if (!providerInstance) {
    providerInstance = new LegacyIdentityProvider();
  }
  return providerInstance;
}

export function resetIdentityProvider(): void {
  providerInstance = null;
}

export function resolveIdentityTenantId(): string {
  const provider = getIdentityProvider();
  const principal = provider.getPrincipal();
  return resolveTenantFromPrincipal(principal) ?? buildTenantId(null);
}
