import type {
  IAuthResult,
  IAuthenticationService,
  ISessionInfo,
} from "@fios/kernel";
import { useStore } from "@/store";
import {
  clearAccessToken,
  clearLegacySession,
  createSessionId,
  readLegacySession,
} from "./session";
import { clearRefreshTokens } from "./refreshToken";
import { createPrincipal } from "./principal";
import { buildTenantId } from "./tenantResolver";
import { recordIdentityDiagnostic } from "./identityDiagnostics";

export class LegacyAuthenticationService implements IAuthenticationService {
  getSession(): ISessionInfo | null {
    const legacy = readLegacySession();
    const state = useStore.getState();
    if (!legacy.userId || !state.isAuthenticated) return null;

    const companyId = legacy.companyId ?? state.selectedCompanyId ?? null;
    const tenantId = buildTenantId(companyId);

    return {
      sessionId: createSessionId(),
      userId: legacy.userId,
      companyId,
      tenantId,
      createdAt: new Date().toISOString(),
    };
  }

  authenticateFromLegacy(): IAuthResult {
    const state = useStore.getState();
    const user = state.currentUser;
    const legacy = readLegacySession();

    if (!state.isAuthenticated || !user || !legacy.userId) {
      recordIdentityDiagnostic({
        stage: "auth-failed",
        message: "No active legacy session",
        timestamp: new Date().toISOString(),
      });
      return { success: false, error: "Not authenticated" };
    }

    const companyId = legacy.companyId ?? state.selectedCompanyId ?? null;
    const tenantId = buildTenantId(companyId);
    const principal = createPrincipal({
      userId: user.id,
      username: user.username,
      role: user.role,
      tenantId,
      companyId,
      sessionId: legacy.userId,
    });

    recordIdentityDiagnostic({
      stage: "auth-success",
      userId: user.id,
      tenantId,
      timestamp: new Date().toISOString(),
    });

    return { success: true, principal };
  }

  async logout(): Promise<void> {
    clearLegacySession();
    clearAccessToken();
    clearRefreshTokens();
    recordIdentityDiagnostic({
      stage: "logout",
      timestamp: new Date().toISOString(),
    });
  }

  async refreshSession(): Promise<IAuthResult> {
    return this.authenticateFromLegacy();
  }
}

let authServiceInstance: IAuthenticationService | null = null;

export function getAuthenticationService(): IAuthenticationService {
  if (!authServiceInstance) {
    authServiceInstance = new LegacyAuthenticationService();
  }
  return authServiceInstance;
}

export function resetAuthenticationService(): void {
  authServiceInstance = null;
}
