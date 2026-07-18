/**
 * MAI-01 unit tests for khata confirm auth (no DB).
 * Run: npx vitest run packages/backend/src/middleware/khataConfirmAuth.test.ts
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import {
  assertProductionJwtSecretConfigured,
  isProductionNodeEnv,
  principalMayConfirmKhata,
  requireKhataConfirmAuth,
} from "./khataConfirmAuth.js";
import type { AuthTokenPayload } from "./auth.js";

function mockRes() {
  const res = {
    statusCode: 200,
    body: null as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res as unknown as Response & { statusCode: number; body: unknown };
}

describe("khataConfirmAuth", () => {
  const secret = "unit-test-secret-key-32chars!!";
  const prev = { ...process.env };

  beforeEach(() => {
    process.env.API_SECRET_KEY = secret;
    process.env.JWT_SECRET = secret;
    delete process.env.NODE_ENV;
    delete process.env.RENDER;
  });

  afterEach(() => {
    process.env = { ...prev };
  });

  it("denies unauthenticated confirm", () => {
    const req = { headers: {}, body: { tenant_id: "t1", company_id: "c1" } } as Request;
    const res = mockRes();
    let nextCalled = false;
    requireKhataConfirmAuth(req, res, (() => {
      nextCalled = true;
    }) as NextFunction);
    expect(nextCalled).toBe(false);
    expect(res.statusCode).toBe(401);
  });

  it("denies invalid token", () => {
    const req = {
      headers: { authorization: "Bearer not-a-jwt" },
      body: { tenant_id: "t1", company_id: "c1" },
    } as Request;
    const res = mockRes();
    requireKhataConfirmAuth(req, res, vi.fn() as NextFunction);
    expect(res.statusCode).toBe(401);
  });

  it("denies authenticated but unauthorized role", () => {
    const token = jwt.sign(
      {
        sub: "u1",
        tenantId: "t1",
        companyId: "c1",
        username: "viewer",
        role: "read_only",
        sessionId: "s1",
      } satisfies AuthTokenPayload,
      secret,
      { expiresIn: "15m" },
    );
    const req = {
      headers: { authorization: `Bearer ${token}` },
      body: { tenant_id: "t1", company_id: "c1", intent: "khata_purchase", amount: 10 },
    } as Request;
    const res = mockRes();
    requireKhataConfirmAuth(req, res, vi.fn() as NextFunction);
    expect(res.statusCode).toBe(403);
    expect((res.body as { error?: string }).error).toBe("AUTHORIZATION_REQUIRED");
  });

  it("denies tenant spoofing via body", () => {
    const token = jwt.sign(
      {
        sub: "u1",
        tenantId: "t1",
        companyId: "c1",
        username: "acct",
        role: "accountant",
        sessionId: "s1",
      } satisfies AuthTokenPayload,
      secret,
      { expiresIn: "15m" },
    );
    const req = {
      headers: { authorization: `Bearer ${token}` },
      body: { tenant_id: "other-tenant", company_id: "c1" },
    } as unknown as Request;
    const res = mockRes();
    requireKhataConfirmAuth(req, res, vi.fn() as NextFunction);
    expect(res.statusCode).toBe(403);
    expect((res.body as { error?: string }).error).toBe("TENANT_SCOPE_MISMATCH");
  });

  it("denies company spoofing via body", () => {
    const token = jwt.sign(
      {
        sub: "u1",
        tenantId: "t1",
        companyId: "c1",
        username: "acct",
        role: "accountant",
        sessionId: "s1",
      } satisfies AuthTokenPayload,
      secret,
      { expiresIn: "15m" },
    );
    const req = {
      headers: { authorization: `Bearer ${token}` },
      body: { tenant_id: "t1", company_id: "c-other" },
    } as unknown as Request;
    const res = mockRes();
    requireKhataConfirmAuth(req, res, vi.fn() as NextFunction);
    expect(res.statusCode).toBe(403);
    expect((res.body as { error?: string }).error).toBe("COMPANY_SCOPE_MISMATCH");
  });

  it("allows matching accountant and overwrites body identity from JWT", () => {
    const token = jwt.sign(
      {
        sub: "user-99",
        tenantId: "t1",
        companyId: "c1",
        username: "acct",
        role: "accountant",
        sessionId: "s1",
      } satisfies AuthTokenPayload,
      secret,
      { expiresIn: "15m" },
    );
    const req = {
      headers: { authorization: `Bearer ${token}` },
      body: {
        tenant_id: "t1",
        company_id: "c1",
        user_id: "spoofed",
        intent: "khata_purchase",
        amount: 100,
      },
    } as unknown as Request;
    const res = mockRes();
    let nextCalled = false;
    requireKhataConfirmAuth(req, res, (() => {
      nextCalled = true;
    }) as NextFunction);
    expect(nextCalled).toBe(true);
    expect(req.body.user_id).toBe("user-99");
    expect(req.body.tenant_id).toBe("t1");
    expect(req.body.company_id).toBe("c1");
  });

  it("role matrix", () => {
    expect(principalMayConfirmKhata({ role: "accountant" } as AuthTokenPayload)).toBe(true);
    expect(principalMayConfirmKhata({ role: "read_only" } as AuthTokenPayload)).toBe(false);
  });

  it("production rejects insecure secret", () => {
    expect(() =>
      assertProductionJwtSecretConfigured({
        NODE_ENV: "production",
        API_SECRET_KEY: "dev-insecure-secret-change-me",
      } as NodeJS.ProcessEnv),
    ).toThrow(/INSECURE_PRODUCTION_CONFIGURATION/);
    expect(isProductionNodeEnv({ NODE_ENV: "production" } as NodeJS.ProcessEnv)).toBe(true);
  });
});
