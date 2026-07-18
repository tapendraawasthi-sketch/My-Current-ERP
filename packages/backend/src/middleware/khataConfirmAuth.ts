/**
 * MAI-01 — trusted principal helpers for khata mutation routes.
 * Reuses existing JWT AuthTokenPayload; body fields are resource selectors only.
 */

import type { Request, Response, NextFunction } from "express";
import { authMiddleware, type AuthTokenPayload } from "../middleware/auth.js";
import { sendError } from "../middleware/responseEnvelope.js";

const POST_ROLES = new Set([
  "admin",
  "owner",
  "super_admin",
  "superuser",
  "accountant",
  "manager",
  "company_admin",
  "tenant_admin",
  "system_admin",
]);

export function isProductionNodeEnv(env: NodeJS.ProcessEnv = process.env): boolean {
  return (
    (env.NODE_ENV || "").toLowerCase() === "production" ||
    (env.RENDER || "").toLowerCase() === "true" ||
    (env.APP_ENV || "").toLowerCase() === "production"
  );
}

export function assertProductionJwtSecretConfigured(env: NodeJS.ProcessEnv = process.env): void {
  if (!isProductionNodeEnv(env)) return;
  const secret = env.API_SECRET_KEY || env.JWT_SECRET || "";
  if (!secret || secret === "dev-insecure-secret-change-me" || secret.length < 16) {
    throw new Error("INSECURE_PRODUCTION_CONFIGURATION: JWT/API secret missing or insecure");
  }
}

export function principalMayConfirmKhata(user: AuthTokenPayload): boolean {
  return POST_ROLES.has((user.role || "").toLowerCase());
}

/**
 * Authenticate then authorize khata confirm. Tenant/company come from JWT;
 * body values may only match trusted scope as selectors.
 */
export function requireKhataConfirmAuth(req: Request, res: Response, next: NextFunction): void {
  authMiddleware(req, res, () => {
    const user = req.user;
    if (!user) {
      sendError(res, "AUTHENTICATION_REQUIRED", 401);
      return;
    }
    if (!principalMayConfirmKhata(user)) {
      sendError(res, "AUTHORIZATION_REQUIRED", 403);
      return;
    }

    const bodyTenant = String(req.body?.tenant_id ?? "").trim();
    const bodyCompany = String(req.body?.company_id ?? "").trim();

    if (bodyTenant && bodyTenant !== user.tenantId) {
      sendError(res, "TENANT_SCOPE_MISMATCH", 403);
      return;
    }
    if (bodyCompany && user.companyId && bodyCompany !== user.companyId) {
      sendError(res, "COMPANY_SCOPE_MISMATCH", 403);
      return;
    }

    // Overwrite body identity with trusted principal (selectors cannot establish identity).
    req.body = {
      ...(req.body ?? {}),
      tenant_id: user.tenantId,
      company_id: user.companyId || bodyCompany,
      user_id: user.sub,
    };
    next();
  });
}
