/**
 * Transport → domain adapter for Orbix complete / SSE payloads.
 * Never throws into the conversation UI; never enables posting from malformed data.
 */

import { z } from "zod";
import { classifyAssistantTextHeuristic } from "./orbixHeuristicFallback";
import {
  ORBIX_RESPONSE_SCHEMA_VERSION,
  type ClarificationFieldCaptured,
  type ClarificationFieldMissing,
  type ClarificationPayload,
  type ConfirmationRequiredPayload,
  type JournalPreviewPayload,
  type ModeRestrictionPayload,
  type OrbixAction,
  type OrbixResponse,
  type OrbixResponseParseResult,
  type OrbixResponseStatus,
  type OrbixResponseType,
  type TransactionPreviewPayload,
} from "./orbixResponseTypes";
import type { KhataConfirmationCard } from "./types";
import { normalizeOrbixCard } from "./orbixCardNormalize";

const moneyStr = (n: unknown): string => {
  if (n == null || n === "") return "0";
  if (typeof n === "string") return n;
  if (typeof n === "number" && Number.isFinite(n)) return String(n);
  return String(n);
};

const FIELD_LABELS: Record<string, string> = {
  item: "Item",
  quantity: "Quantity",
  unit: "Unit",
  rate_or_total: "Amount or rate",
  payment_method: "Payment method",
  supplier: "Supplier",
  payment_account: "Payment account",
  total_amount: "Total amount",
};

const FIELD_INPUT: Record<string, ClarificationFieldMissing["input_type"]> = {
  quantity: "number",
  rate_or_total: "money",
  total_amount: "money",
  payment_method: "choice",
  item: "text",
  unit: "text",
  supplier: "text",
  payment_account: "choice",
};

const completeTransportSchema = z
  .object({
    type: z.literal("complete").optional(),
    message: z.string().optional(),
    card: z.record(z.unknown()).nullable().optional(),
    route: z.record(z.unknown()).optional(),
    action: z.string().optional(),
    orbix_mode: z.enum(["ask", "accountant"]).optional(),
    operation_class: z.string().nullable().optional(),
    error: z.record(z.unknown()).nullable().optional(),
    draft_id: z.string().nullable().optional(),
    report_spec: z.record(z.unknown()).nullable().optional(),
    response_type: z.string().optional(),
    status: z.string().optional(),
    schema_version: z.string().optional(),
    request_id: z.string().optional(),
    conversation_id: z.string().optional(),
    message_id: z.string().optional(),
    timestamp: z.string().optional(),
    payload: z.record(z.unknown()).optional(),
  })
  .passthrough();

function baseFields(
  data: z.infer<typeof completeTransportSchema>,
  response_type: OrbixResponseType,
  status: OrbixResponseStatus,
  text: string,
  actions: OrbixAction[] = [],
): Omit<OrbixResponse, "payload" | "response_type"> & { response_type: OrbixResponseType } {
  return {
    schema_version: ORBIX_RESPONSE_SCHEMA_VERSION,
    request_id: data.request_id,
    conversation_id: data.conversation_id,
    message_id: data.message_id,
    timestamp: data.timestamp ?? new Date().toISOString(),
    orbix_mode: data.orbix_mode,
    operation_class: data.operation_class ?? null,
    response_type,
    status,
    display: { text, tone: "professional" },
    actions,
    diagnostics: null,
  };
}

function mapMissingFields(raw: unknown): ClarificationFieldMissing[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((f) => {
    if (typeof f === "string") {
      const field = f;
      const missing: ClarificationFieldMissing = {
        field,
        label: FIELD_LABELS[field] || field,
        required: true,
        input_type: FIELD_INPUT[field] || "text",
      };
      if (field === "payment_method") {
        missing.choices = [
          { value: "cash", label: "Cash" },
          { value: "bank", label: "Bank" },
          { value: "credit", label: "Credit" },
        ];
      }
      return missing;
    }
    if (f && typeof f === "object") {
      const o = f as Record<string, unknown>;
      return {
        field: String(o.field ?? ""),
        label: String(o.label ?? o.field ?? ""),
        required: o.required !== false,
        input_type: (o.input_type as ClarificationFieldMissing["input_type"]) || "text",
        choices: Array.isArray(o.choices)
          ? (o.choices as Array<{ value: string; label: string }>)
          : undefined,
      };
    }
    return { field: String(f), label: String(f), required: true, input_type: "text" };
  });
}

function buildCapturedFromError(error: Record<string, unknown>): ClarificationFieldCaptured[] {
  if (Array.isArray(error.captured_fields)) {
    return error.captured_fields.map((c) => {
      const o = (c || {}) as Record<string, unknown>;
      return {
        field: String(o.field ?? ""),
        label: String(o.label ?? o.field ?? ""),
        value: String(o.value ?? o.display_value ?? ""),
        display_value: o.display_value != null ? String(o.display_value) : undefined,
        confidence: typeof o.confidence === "number" ? o.confidence : undefined,
      };
    });
  }
  return [];
}

function journalFromCard(card: Record<string, unknown> | null | undefined): JournalPreviewPayload | null {
  if (!card || !Array.isArray(card.journalLines)) return null;
  const entries = card.journalLines.map((line) => {
    const l = (line || {}) as Record<string, unknown>;
    return {
      account_id: l.account_id != null ? String(l.account_id) : undefined,
      account_code: String(l.accountCode ?? l.account_code ?? ""),
      account_name: String(l.accountName ?? l.account_name ?? ""),
      debit: moneyStr(l.debit),
      credit: moneyStr(l.credit),
    };
  });
  let totalDebit = 0;
  let totalCredit = 0;
  for (const e of entries) {
    totalDebit += Number(e.debit) || 0;
    totalCredit += Number(e.credit) || 0;
  }
  const balanced =
    typeof card.balanced === "boolean"
      ? card.balanced
      : Math.abs(totalDebit - totalCredit) < 0.005;
  return {
    journal_id: card.journal_id != null ? String(card.journal_id) : undefined,
    draft_id: card.draft_id != null ? String(card.draft_id) : undefined,
    date: card.date != null ? String(card.date) : null,
    narration: card.narration != null ? String(card.narration) : null,
    entries,
    total_debit: moneyStr(totalDebit),
    total_credit: moneyStr(totalCredit),
    balanced,
  };
}

function transactionPreviewFromCard(
  card: Record<string, unknown>,
  draftId: string,
): TransactionPreviewPayload {
  const journal = journalFromCard(card);
  return {
    draft_id: draftId,
    preview_version: (card.preview_version as string | number | null) ?? 1,
    preview_hash: card.preview_hash != null ? String(card.preview_hash) : null,
    idempotency_key: card.idempotency_key != null ? String(card.idempotency_key) : null,
    transaction_type: String(card.transaction ?? card.intent ?? "purchase"),
    status: "previewed",
    party: card.party
      ? { name: String(card.party), id: null, type: "supplier" }
      : card.supplier
        ? { name: String(card.supplier), id: null, type: "supplier" }
        : null,
    items: [
      {
        name: String(card.item ?? "Item"),
        quantity: card.quantity != null ? moneyStr(card.quantity) : null,
        unit: card.unit != null ? String(card.unit) : null,
        rate: card.rate != null ? moneyStr(card.rate) : null,
        amount: moneyStr(card.total ?? card.amount),
      },
    ],
    payment: {
      method: card.payment != null ? String(card.payment) : null,
      account_name: null,
      account_id: null,
    },
    totals: {
      grand_total: moneyStr(card.total ?? card.amount),
      currency: String(card.currency ?? "NPR"),
      subtotal: moneyStr(card.total ?? card.amount),
      tax: "0",
      discount: "0",
    },
    journal,
    can_confirm: true,
    legacy_card: card,
  };
}

function confirmationFromCard(
  card: Record<string, unknown>,
  draftId: string,
): ConfirmationRequiredPayload {
  const preview = transactionPreviewFromCard(card, draftId);
  return {
    draft_id: draftId,
    preview_version: preview.preview_version,
    preview_hash: preview.preview_hash,
    idempotency_key: preview.idempotency_key,
    operation: `post_${String(card.intent ?? "purchase")}`,
    summary: {
      transaction_type: preview.transaction_type,
      party: preview.party?.name ?? null,
      amount: preview.totals.grand_total,
      currency: preview.totals.currency,
      date: card.date != null ? String(card.date) : null,
    },
    warnings: [],
    requires_permission: "purchase.post",
    journal: preview.journal,
    legacy_card: card,
  };
}

function deriveResponseType(
  data: z.infer<typeof completeTransportSchema>,
): OrbixResponseType {
  if (data.response_type && typeof data.response_type === "string") {
    return data.response_type as OrbixResponseType;
  }
  const errType = data.error && typeof data.error.type === "string" ? data.error.type : null;
  if (errType === "mode_restriction") return "mode_restriction";
  if (errType === "clarification_required") return "clarification_required";
  if (errType === "permission_denied") return "permission_denied";
  if (data.report_spec) return "report_result";
  if (data.card) return "confirmation_required";
  const text = data.message || "";
  const heuristic = classifyAssistantTextHeuristic(text);
  if (heuristic === "provider_offline") return "provider_offline";
  if (heuristic === "mode_restriction") return "mode_restriction";
  if (heuristic === "clarification_required") return "clarification_required";
  return "normal_answer";
}

function modeRestrictionPayload(
  data: z.infer<typeof completeTransportSchema>,
): ModeRestrictionPayload {
  const err = (data.error || {}) as Record<string, unknown>;
  return {
    requested_operation: err.operation != null ? String(err.operation) : data.operation_class ?? null,
    required_mode: (err.required_mode as "accountant") || "accountant",
    current_mode: data.orbix_mode || "ask",
    can_preview: err.can_preview !== false,
    can_explain: true,
    original_request_preserved: true,
  };
}

function clarificationPayload(
  data: z.infer<typeof completeTransportSchema>,
): ClarificationPayload | null {
  const err = (data.error || {}) as Record<string, unknown>;
  const draftId = String(data.draft_id || err.draft_id || "");
  if (!draftId && !Array.isArray(err.missing_fields)) {
    // Heuristic-only: no draft_id — still render UI but without mutation authority
    return {
      draft_id: "",
      transaction_type: "purchase",
      draft_status: "awaiting_clarification",
      captured_fields: [],
      missing_fields: [],
      ambiguous_fields: Array.isArray(err.ambiguous_fields)
        ? err.ambiguous_fields.map(String)
        : [],
      nothing_posted: true,
    };
  }
  return {
    draft_id: draftId,
    transaction_type: String(err.transaction_type || "purchase"),
    draft_status: String(err.draft_status || "awaiting_clarification"),
    captured_fields: buildCapturedFromError(err),
    missing_fields: mapMissingFields(err.missing_fields),
    ambiguous_fields: Array.isArray(err.ambiguous_fields)
      ? err.ambiguous_fields.map(String)
      : [],
    nothing_posted: true,
  };
}

/**
 * Parse a transport complete event (or envelope-like object) into a typed OrbixResponse.
 */
export function parseOrbixResponse(input: unknown): OrbixResponseParseResult {
  try {
    const parsed = completeTransportSchema.safeParse(input);
    if (!parsed.success) {
      const text =
        input && typeof input === "object" && "message" in input
          ? String((input as { message?: unknown }).message || "")
          : typeof input === "string"
            ? input
            : "";
      if (text) {
        return {
          ok: true,
          fromFallback: true,
          response: {
            ...baseFields(
              { message: text },
              "normal_answer",
              "success",
              text,
            ),
            response_type: "normal_answer",
            payload: { kind: "normal" },
          },
        };
      }
      return {
        ok: false,
        fallbackText: "We received a response but could not parse it.",
        errorCode: "parse_failed",
      };
    }

    const data = parsed.data;
    const text = data.message || "";
    const responseType = deriveResponseType(data);
    const fromFallback =
      !data.response_type &&
      !(data.error && typeof data.error.type === "string") &&
      !data.card &&
      !data.report_spec;

    if (responseType === "mode_restriction") {
      const payload = modeRestrictionPayload(data);
      const actions: OrbixAction[] = [
        {
          id: "switch_to_accountant",
          type: "switch_mode",
          label: "Switch to Accountant",
          target_mode: "accountant",
        },
      ];
      if (payload.can_preview) {
        actions.push({ id: "preview_only", type: "preview", label: "Preview entry" });
      }
      return {
        ok: true,
        fromFallback,
        response: {
          ...baseFields(data, "mode_restriction", "requires_input", text, actions),
          response_type: "mode_restriction",
          payload,
        },
      };
    }

    if (responseType === "clarification_required") {
      const payload = clarificationPayload(data);
      if (!payload) {
        return {
          ok: false,
          fallbackText: text || "Clarification required, but payload was incomplete.",
          errorCode: "clarification_incomplete",
        };
      }
      return {
        ok: true,
        fromFallback,
        response: {
          ...baseFields(data, "clarification_required", "requires_input", text),
          response_type: "clarification_required",
          payload,
        },
      };
    }

    if (responseType === "confirmation_required" || responseType === "transaction_preview") {
      const card = data.card;
      if (!card || typeof card !== "object") {
        return {
          ok: false,
          fallbackText: text || "Transaction preview was incomplete.",
          errorCode: "preview_incomplete",
        };
      }
      const draftId = String(data.draft_id || card.draft_id || "");
      if (!draftId) {
        // Card without draft_id — still allow local confirm path via legacy card, but mark partial
        const preview = transactionPreviewFromCard(card, "legacy-local");
        preview.can_confirm = Boolean(normalizeOrbixCard(card));
        return {
          ok: true,
          fromFallback: true,
          response: {
            ...baseFields(
              data,
              "confirmation_required",
              "requires_confirmation",
              text,
              [
                {
                  id: "confirm_post",
                  type: "confirm",
                  label: "Confirm and post",
                  danger_level: "consequential",
                },
                { id: "cancel_draft", type: "cancel", label: "Cancel draft" },
              ],
            ),
            response_type: "confirmation_required",
            payload: confirmationFromCard(card, "legacy-local"),
          },
        };
      }
      const payload = confirmationFromCard(card, draftId);
      return {
        ok: true,
        fromFallback: false,
        response: {
          ...baseFields(
            data,
            "confirmation_required",
            "requires_confirmation",
            text,
            [
              {
                id: "confirm_post",
                type: "confirm",
                label: "Confirm and post",
                danger_level: "consequential",
              },
              { id: "edit_draft", type: "edit", label: "Edit" },
              { id: "cancel_draft", type: "cancel", label: "Cancel draft" },
            ],
          ),
          response_type: "confirmation_required",
          payload,
        },
      };
    }

    if (responseType === "report_result" || responseType === "report_updated") {
      return {
        ok: true,
        fromFallback: false,
        response: {
          ...baseFields(data, responseType, "success", text),
          response_type: responseType,
          payload: {
            report_spec: data.report_spec ?? null,
            report_id:
              data.report_spec && typeof data.report_spec.report_id === "string"
                ? data.report_spec.report_id
                : undefined,
            report_type:
              data.report_spec && typeof data.report_spec.report_type === "string"
                ? data.report_spec.report_type
                : undefined,
          },
        },
      };
    }

    if (responseType === "provider_offline" || responseType === "backend_unavailable") {
      return {
        ok: true,
        fromFallback,
        response: {
          ...baseFields(data, responseType, "failed", text),
          response_type: responseType,
          payload: { retryable: true },
        },
      };
    }

    if (
      responseType === "permission_denied" ||
      responseType === "validation_error" ||
      responseType === "general_error"
    ) {
      return {
        ok: true,
        fromFallback,
        response: {
          ...baseFields(data, responseType, "failed", text),
          response_type: responseType,
          payload: {
            error_code: String((data.error as { code?: string } | null)?.code || responseType),
            safe_message: text || "Something went wrong.",
          },
        },
      };
    }

    return {
      ok: true,
      fromFallback,
      response: {
        ...baseFields(data, "normal_answer", "success", text),
        response_type: "normal_answer",
        payload: { kind: "normal" },
      },
    };
  } catch {
    return {
      ok: false,
      fallbackText: "We received a response but couldn’t display its structured details.",
      errorCode: "adapter_exception",
    };
  }
}

/** Extract legacy KhataConfirmationCard for existing confirmPending path. */
export function legacyCardFromResponse(response: OrbixResponse): KhataConfirmationCard | null {
  if (response.response_type === "confirmation_required") {
    const raw = response.payload.legacy_card;
    if (raw) return normalizeOrbixCard(raw as Record<string, unknown>);
  }
  if (response.response_type === "transaction_preview") {
    const raw = response.payload.legacy_card;
    if (raw) return normalizeOrbixCard(raw as Record<string, unknown>);
  }
  return null;
}

export function relatedDraftId(response: OrbixResponse): string | null {
  const p = response.payload as { draft_id?: string };
  return p.draft_id ? String(p.draft_id) : null;
}
