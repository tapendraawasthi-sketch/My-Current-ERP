import type { Request, Response, NextFunction } from "express";

export interface ApiEnvelope<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

export function sendSuccess<T>(res: Response, data: T, status = 200): void {
  const body: ApiEnvelope<T> = {
    success: true,
    data,
    timestamp: new Date().toISOString(),
  };
  res.status(status).json(body);
}

export function sendError(res: Response, error: string, status = 400): void {
  const body: ApiEnvelope = {
    success: false,
    error,
    timestamp: new Date().toISOString(),
  };
  res.status(status).json(body);
}

/** Ensures every response uses the standard envelope (fallback for unhandled routes). */
export function envelopeMiddleware(_req: Request, res: Response, next: NextFunction): void {
  const originalJson = res.json.bind(res);
  res.json = (body: unknown) => {
    if (
      body &&
      typeof body === "object" &&
      "success" in body &&
      "timestamp" in body
    ) {
      return originalJson(body);
    }
    return originalJson({
      success: true,
      data: body,
      timestamp: new Date().toISOString(),
    } satisfies ApiEnvelope);
  };
  next();
}
