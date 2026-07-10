import type { IIdentityTenantContext, IPrincipal } from "@fios/kernel";

let currentPrincipal: IPrincipal | null = null;
let currentContext: IIdentityTenantContext | null = null;

export function setIdentityContext(context: IIdentityTenantContext): void {
  currentContext = context;
  currentPrincipal = context.principal;
}

export function setPrincipal(principal: IPrincipal | null): void {
  currentPrincipal = principal;
}

export function getPrincipalSnapshot(): IPrincipal | null {
  return currentPrincipal;
}

export function getIdentityContextSnapshot(): IIdentityTenantContext | null {
  return currentContext;
}

export function clearIdentityContext(): void {
  currentPrincipal = null;
  currentContext = null;
}
