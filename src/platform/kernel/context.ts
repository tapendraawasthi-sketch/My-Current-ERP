import type { EntityId } from "./types";

/** Session / tenant context propagated to domain operations (F7 expands with OIDC). */

export interface IUserContext {
  userId: EntityId;
  username: string;
  role: string;
}

export interface ICompanyContext {
  companyId: EntityId | null;
  companyName?: string;
}

export interface ITenantContext {
  tenantId?: EntityId | null;
  user: IUserContext | null;
  company: ICompanyContext;
  isAuthenticated: boolean;
}

export interface IContextProvider {
  getContext(): ITenantContext;
}
