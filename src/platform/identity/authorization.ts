import type { IPrincipal, IPermissionEvaluator, IAuthorizationService } from "@fios/kernel";
import type { ScreenAction } from "@/lib/permissions";
import { evaluateScreenPermission } from "./permissions";
import { isAdminRole, normalizeRole, roleSatisfies } from "./roles";
import { recordIdentityDiagnostic } from "./identityDiagnostics";
import { identityMetrics } from "./identityMetrics";

export class LegacyPermissionEvaluator implements IPermissionEvaluator {
  hasPermission(principal: IPrincipal, permission: string): boolean {
    identityMetrics.incrementPermissionChecks();
    if (isAdminRole(principal.role)) return true;
    return principal.claims.permissions?.includes(permission) ?? false;
  }

  hasScreenAccess(principal: IPrincipal, screenId: string, action = "canView"): boolean {
    identityMetrics.incrementPermissionChecks();
    return evaluateScreenPermission(
      principal.role,
      principal.userId,
      screenId as never,
      action as ScreenAction,
    );
  }
}

export class AuthorizationService implements IAuthorizationService {
  private readonly evaluator: IPermissionEvaluator;

  constructor(evaluator = new LegacyPermissionEvaluator()) {
    this.evaluator = evaluator;
  }

  authorize(principal: IPrincipal, permission: string): boolean {
    const allowed = this.evaluator.hasPermission(principal, permission);
    recordIdentityDiagnostic({
      stage: allowed ? "authz-allow" : "authz-deny",
      userId: principal.userId,
      tenantId: principal.tenantId,
      message: permission,
      timestamp: new Date().toISOString(),
    });
    if (!allowed) identityMetrics.incrementAuthzDenials();
    return allowed;
  }

  authorizeRole(principal: IPrincipal, roles: string | string[]): boolean {
    const required = Array.isArray(roles) ? roles : [roles];
    const actual = normalizeRole(principal.role);
    return required.some((role) => roleSatisfies(actual, role) || actual === normalizeRole(role));
  }

  evaluatePolicy(principal: IPrincipal, policy: string, resource?: string): boolean {
    if (policy === "admin") return isAdminRole(principal.role);
    if (policy === "authenticated") return Boolean(principal.userId);
    if (policy === "tenant-match" && resource) {
      return principal.tenantId === resource;
    }
    return this.authorize(principal, policy);
  }
}

let evaluatorInstance: IPermissionEvaluator | null = null;
let authorizationInstance: IAuthorizationService | null = null;

export function getPermissionEvaluator(): IPermissionEvaluator {
  if (!evaluatorInstance) {
    evaluatorInstance = new LegacyPermissionEvaluator();
  }
  return evaluatorInstance;
}

export function getAuthorizationService(): IAuthorizationService {
  if (!authorizationInstance) {
    authorizationInstance = new AuthorizationService(getPermissionEvaluator());
  }
  return authorizationInstance;
}

export function resetAuthorizationServices(): void {
  evaluatorInstance = null;
  authorizationInstance = null;
}
