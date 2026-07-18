/**
 * MAI-03 — correlation / request ID helpers for Node (opaque, validated).
 */

import { randomUUID } from "node:crypto";
import type { Request, Response, NextFunction } from "express";

export const MAX_CORRELATION_HEADER_LENGTH = 128;
export const HEADER_CORRELATION = "x-correlation-id";
export const HEADER_REQUEST = "x-request-id";
export const HEADER_TRACE_REF = "x-trace-reference";

const UUID_RE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const HEX32_RE = /^[0-9a-fA-F]{32}$/;

export type CorrelationSource = "GENERATED" | "VALIDATED_UPSTREAM";

export function isValidCorrelationId(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const text = value.trim();
  if (!text || text.length > MAX_CORRELATION_HEADER_LENGTH) return false;
  return UUID_RE.test(text) || HEX32_RE.test(text);
}

export function sanitizeOrGenerateCorrelationId(inbound: unknown): {
  id: string;
  source: CorrelationSource;
} {
  if (isValidCorrelationId(inbound)) {
    return { id: String(inbound).trim(), source: "VALIDATED_UPSTREAM" };
  }
  return { id: randomUUID(), source: "GENERATED" };
}

export function makeTraceReference(traceOrCorrId: string, requestId: string): string {
  const a = traceOrCorrId.replace(/-/g, "").slice(0, 8);
  const b = requestId.replace(/-/g, "").slice(0, 8);
  return `tr_${a}_${b}`;
}

export interface MokxyaTraceLocals {
  correlationId: string;
  requestId: string;
  traceReference: string;
  correlationSource: CorrelationSource;
}

declare global {
  namespace Express {
    interface Locals {
      mokxyaTrace?: MokxyaTraceLocals;
    }
  }
}

/** Attach validated correlation to res.locals; never logs Authorization/body. */
export function attachCorrelationMiddleware(req: Request, res: Response, next: NextFunction): void {
  const inbound = req.header(HEADER_CORRELATION) || req.header("X-Correlation-ID");
  const { id: correlationId, source } = sanitizeOrGenerateCorrelationId(inbound);
  const requestId = randomUUID();
  const traceReference = makeTraceReference(correlationId, requestId);
  res.locals.mokxyaTrace = {
    correlationId,
    requestId,
    traceReference,
    correlationSource: source,
  };
  res.setHeader(HEADER_CORRELATION, correlationId);
  res.setHeader(HEADER_REQUEST, requestId);
  res.setHeader(HEADER_TRACE_REF, traceReference);
  next();
}

export function readTraceLocals(res: Response): MokxyaTraceLocals | undefined {
  return res.locals?.mokxyaTrace as MokxyaTraceLocals | undefined;
}

/** Safe structured log line — never include auth headers or body. */
export function safeRouteLog(fields: Record<string, unknown>): Record<string, unknown> {
  const allowed = new Set([
    "route",
    "method",
    "status",
    "duration_ms",
    "correlation_id",
    "request_id",
    "trace_reference",
    "safe_error_code",
    "outcome_code",
  ]);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (!allowed.has(k)) continue;
    if (typeof v === "string" && /bearer|eyJ|password|authorization/i.test(v)) continue;
    out[k] = v;
  }
  return out;
}
