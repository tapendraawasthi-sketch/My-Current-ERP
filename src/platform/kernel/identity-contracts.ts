import type { EntityId } from "./types";
import type { ITenantContext } from "./context";

/**
 * Identity platform contracts — interfaces only (F7 implements runtime).
 * @see SYSTEM-06 §06.25, §06.26
 */

export interface IClaims {
  sub: EntityId;
  tenantId: EntityId;
  companyId?: EntityId;
  username: string;
  role: string;
  sessionId?: EntityId;
  permissions?: string[];
  iat?: number;
  exp?: number;
  [key: string]: unknown;
}

export interface IPrincipal {
  userId: EntityId;
  username: string;
  role: string;
  tenantId: EntityId;
  companyId: EntityId | null;
  sessionId?: EntityId;
  claims: IClaims;
}

export interface IIdentityTenantContext extends ITenantContext {
  tenantId: EntityId | null;
  principal: IPrincipal | null;
}

export interface IIdentityProvider {
  getPrincipal(): IPrincipal | null;
  getTenantContext(): IIdentityTenantContext;
  isAuthenticated(): boolean;
  refreshFromLegacy(): void;
}

export interface IAuthResult {
  success: boolean;
  principal?: IPrincipal;
  error?: string;
}

export interface IAuthenticationService {
  getSession(): ISessionInfo | null;
  authenticateFromLegacy(): IAuthResult;
  logout(): Promise<void>;
  refreshSession(): Promise<IAuthResult>;
}

export interface ISessionInfo {
  sessionId: EntityId;
  userId: EntityId;
  companyId: EntityId | null;
  tenantId: EntityId;
  createdAt: string;
  expiresAt?: string;
}

export interface IAuthorizationService {
  authorize(principal: IPrincipal, permission: string): boolean;
  authorizeRole(principal: IPrincipal, roles: string | string[]): boolean;
  evaluatePolicy(principal: IPrincipal, policy: string, resource?: string): boolean;
}

export interface IPermissionEvaluator {
  hasPermission(principal: IPrincipal, permission: string): boolean;
  hasScreenAccess(principal: IPrincipal, screenId: string, action?: string): boolean;
}

export interface IJwtPayload extends IClaims {
  type?: string;
}

export interface ITokenValidationResult {
  valid: boolean;
  payload?: IJwtPayload;
  error?: string;
}

export interface ITokenValidator {
  validateAccessToken(token: string): ITokenValidationResult;
  validateRefreshToken(token: string): ITokenValidationResult;
}

export interface IRefreshTokenStore {
  getRefreshToken(): string | null;
  setRefreshToken(token: string): void;
  clearRefreshToken(): void;
}
