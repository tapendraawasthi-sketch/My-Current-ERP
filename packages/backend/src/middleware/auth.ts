import type { Request, Response, NextFunction } from "express";
import jwt, { type SignOptions } from "jsonwebtoken";

export interface AuthTokenPayload {
  sub: string;
  tenantId: string;
  companyId?: string;
  username: string;
  role: string;
  sessionId: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthTokenPayload;
    }
  }
}

function getJwtSecret(): string {
  return process.env.API_SECRET_KEY || process.env.JWT_SECRET || "dev-insecure-secret-change-me";
}

export function signAccessToken(payload: AuthTokenPayload, expiresIn: string): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn } as SignOptions);
}

export function signRefreshToken(payload: AuthTokenPayload, expiresIn: string): string {
  return jwt.sign({ ...payload, type: "refresh" }, getJwtSecret(), { expiresIn } as SignOptions);
}

export function verifyToken(token: string): AuthTokenPayload {
  return jwt.verify(token, getJwtSecret()) as AuthTokenPayload;
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({
      success: false,
      error: "Missing or invalid Authorization header",
      timestamp: new Date().toISOString(),
    });
    return;
  }
  try {
    const token = header.slice(7);
    req.user = verifyToken(token);
    next();
  } catch {
    res.status(401).json({
      success: false,
      error: "Invalid or expired token",
      timestamp: new Date().toISOString(),
    });
  }
}
