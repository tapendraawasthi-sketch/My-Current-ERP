/**
 * MAI-02 canonical AI contract types (schema_version 1.0.0).
 * Canonical authority remains Python Pydantic models under erp_bot/src/oip/contracts/.
 * These TypeScript + Zod definitions are checked against shared fixtures for parity.
 * Do not accept binary float money; TrustedScope is never client-built.
 */

import { z } from "zod";

export const MAI02_SCHEMA_VERSION = "1.0.0" as const;

const decimalString = z
  .string()
  .regex(/^-?\d+(\.\d+)?$/, "decimal string required")
  .refine((v) => v !== "NaN" && v !== "Infinity" && v !== "-Infinity", "non-finite forbidden");

export const MoneyV1Schema = z
  .object({
    amount: decimalString,
    currency: z.string().min(3).max(8).default("NPR"),
    scale: z.number().int().min(0).max(8).nullable().optional(),
  })
  .strict();

export const ClientTurnPayloadV1Schema = z
  .object({
    schema_version: z.string(),
    message: z.string().min(1),
    conversation_id: z.string().min(1).nullable().optional(),
    session_id: z.string().min(1).nullable().optional(),
    mode: z.enum(["ask", "accountant"]).default("ask"),
    input_channel: z.enum(["text", "voice", "ui", "unknown"]).default("text"),
    locale_hint: z.string().nullable().optional(),
    client_context: z.record(z.unknown()).default({}),
    active_ui_context: z.record(z.unknown()).default({}),
    active_draft_reference: z.string().nullable().optional(),
    client_message_id: z.string().nullable().optional(),
    idempotency_key: z.string().nullable().optional(),
  })
  .strict()
  .superRefine((val, ctx) => {
    if (!val.conversation_id && !val.session_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "conversation_id or session_id required",
      });
    }
    const forbidden = [
      "principal_id",
      "roles",
      "permissions",
      "authentication_method",
      "user_id",
      "trusted_scope",
      "execution_allowed",
    ] as const;
    for (const key of forbidden) {
      if (val.client_context && key in val.client_context) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `client payload must not establish ${key}`,
          path: ["client_context", key],
        });
      }
    }
    const major = String(val.schema_version).split(".")[0];
    if (major !== "1") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "UNSUPPORTED_SCHEMA_VERSION",
        path: ["schema_version"],
      });
    }
  });

export type ClientTurnPayloadV1 = z.infer<typeof ClientTurnPayloadV1Schema>;

/** Canonical response types (MAI-02). Legacy Orbix wire types remain separately. */
export const CanonicalResponseTypeV1 = z.enum([
  "ANSWER",
  "CLARIFICATION",
  "CHOICE",
  "REPORT",
  "DRAFT",
  "PREVIEW",
  "ACTION_PROGRESS",
  "RECEIPT",
  "CONFLICT",
  "SAFE_REFUSAL",
  "DEGRADED",
  "ERROR",
]);

export type CanonicalResponseTypeV1 = z.infer<typeof CanonicalResponseTypeV1>;

const payloadType = z.enum([
  "ANSWER",
  "CLARIFICATION",
  "CHOICE",
  "REPORT",
  "DRAFT",
  "PREVIEW",
  "ACTION_PROGRESS",
  "RECEIPT",
  "CONFLICT",
  "SAFE_REFUSAL",
  "DEGRADED",
  "ERROR",
]);

export const AIResponseEnvelopeV1Schema = z
  .object({
    schema_version: z.string(),
    response_id: z.string().min(1),
    request_id: z.string().min(1),
    conversation_id: z.string().min(1),
    response_type: CanonicalResponseTypeV1,
    status: z.string(),
    language: z.string().default("en"),
    user_visible_text: z.string(),
    structured_payload: z
      .object({
        payload_type: payloadType,
      })
      .passthrough(),
    citations: z.array(z.string()).default([]),
    warnings: z.array(z.string()).default([]),
    uncertainty: z.string().nullable().optional(),
    suggested_safe_actions: z.array(z.string()).default([]),
    draft_reference: z.unknown().nullable().optional(),
    trace_reference: z.string().nullable().optional(),
    policy_reference: z.string().nullable().optional(),
    created_at: z.string(),
  })
  .strict()
  .superRefine((val, ctx) => {
    if (val.structured_payload.payload_type !== val.response_type) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "RESPONSE_PAYLOAD_MISMATCH",
        path: ["structured_payload", "payload_type"],
      });
    }
    if ("execution_allowed" in val) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "EXECUTION_AUTHORITY_FORBIDDEN",
        path: ["execution_allowed"],
      });
    }
    const major = String(val.schema_version).split(".")[0];
    if (major !== "1") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "UNSUPPORTED_SCHEMA_VERSION",
        path: ["schema_version"],
      });
    }
  });

export type AIResponseEnvelopeV1 = z.infer<typeof AIResponseEnvelopeV1Schema>;

export function assertUnsupportedSchemaVersion(version: string): boolean {
  const major = String(version).split(".")[0];
  return major !== "1";
}

/** Exhaustive list of legacy Orbix wire response_type values. */
export const KNOWN_ORBIX_RESPONSE_TYPES = [
  "normal_answer",
  "capability_answer",
  "accounting_explanation",
  "erp_data_result",
  "report_result",
  "report_updated",
  "mode_restriction",
  "clarification_required",
  "transaction_draft",
  "transaction_preview",
  "journal_preview",
  "confirmation_required",
  "posting_started",
  "posting_progress",
  "posting_completed",
  "posting_failed",
  "permission_denied",
  "validation_error",
  "cancellation_completed",
  "provider_offline",
  "backend_unavailable",
  "general_error",
  "unknown",
  "unsupported_response",
] as const;

export type KnownOrbixResponseType = (typeof KNOWN_ORBIX_RESPONSE_TYPES)[number];

export function isKnownOrbixResponseType(value: string): value is KnownOrbixResponseType {
  return (KNOWN_ORBIX_RESPONSE_TYPES as readonly string[]).includes(value);
}
