import type { IContextProvider, ITenantContext } from "@fios/kernel";
import { isMigrationFlagEnabled } from "@/platform/flags/registry";
import { bootstrapIdentity } from "@/platform/identity/identityBootstrap";
import { getIdentityProvider } from "@/platform/identity/identityProvider";
import { useStore } from "@/store";
import type { AppState } from "@/store/store.types";

export class ZustandContextProvider implements IContextProvider {
  getContext(): ITenantContext {
    if (isMigrationFlagEnabled("MIGRATION_IDENTITY")) {
      bootstrapIdentity();
      const identityCtx = getIdentityProvider().getTenantContext();
      return {
        tenantId: identityCtx.tenantId,
        user: identityCtx.user,
        company: identityCtx.company,
        isAuthenticated: identityCtx.isAuthenticated,
      };
    }

    const state = useStore.getState();
    const user = state.currentUser;
    const companyId = state.selectedCompanyId;
    const companyName = state.companySettings?.name ?? state.companySettings?.companyNameEn;

    return {
      tenantId: companyId ? `tenant:${companyId}` : "local",
      user: user
        ? {
            userId: user.id,
            username: user.username,
            role: user.role,
          }
        : null,
      company: {
        companyId,
        companyName,
      },
      isAuthenticated: Boolean(state.isAuthenticated && user),
    };
  }
}

let contextProvider: IContextProvider | null = null;

export function getContextProvider(): IContextProvider {
  if (!contextProvider) {
    contextProvider = new ZustandContextProvider();
  }
  return contextProvider;
}

export function getLegacyAppState(): AppState {
  return useStore.getState();
}
