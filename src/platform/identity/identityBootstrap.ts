import { isMigrationFlagEnabled } from "@/platform/flags/registry";
import { getIdentityProvider, resetIdentityProvider } from "./identityProvider";
import { resetAuthenticationService } from "./authentication";
import { resetAuthorizationServices } from "./authorization";
import { resetTokenValidator } from "./tokenValidator";
import { resetRefreshTokenStore } from "./refreshToken";
import { clearIdentityContext } from "./identityContext";
import { recordIdentityDiagnostic } from "./identityDiagnostics";
import { logIdentity } from "./identityLogger";

let bootstrapped = false;

export function isIdentityEnabled(): boolean {
  return isMigrationFlagEnabled("MIGRATION_IDENTITY");
}

export function bootstrapIdentity(): void {
  if (!isIdentityEnabled()) return;
  if (bootstrapped) return;

  const provider = getIdentityProvider();
  provider.refreshFromLegacy();
  const ctx = provider.getTenantContext();

  recordIdentityDiagnostic({
    stage: "bootstrap",
    userId: ctx.user?.userId,
    tenantId: ctx.tenantId ?? undefined,
    timestamp: new Date().toISOString(),
  });

  logIdentity("info", "identity platform bootstrapped", {
    authenticated: ctx.isAuthenticated,
    tenantId: ctx.tenantId,
  });

  bootstrapped = true;
}

export function shutdownIdentity(): void {
  clearIdentityContext();
  resetIdentityProvider();
  resetAuthenticationService();
  resetAuthorizationServices();
  resetTokenValidator();
  resetRefreshTokenStore();
  bootstrapped = false;
}

export function isIdentityBootstrapped(): boolean {
  return bootstrapped;
}
