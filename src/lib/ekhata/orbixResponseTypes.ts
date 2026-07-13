/**
 * Orbix structured response contracts (schema_version 1.0).
 * Discriminator: response_type. Display text is presentation only.
 */

export const ORBIX_RESPONSE_SCHEMA_VERSION = "1.0" as const;

export type OrbixResponseStatus =
  | "success"
  | "partial"
  | "requires_input"
  | "requires_confirmation"
  | "processing"
  | "failed";

export type OrbixResponseType =
  | "normal_answer"
  | "capability_answer"
  | "accounting_explanation"
  | "erp_data_result"
  | "report_result"
  | "report_updated"
  | "mode_restriction"
  | "clarification_required"
  | "transaction_draft"
  | "transaction_preview"
  | "journal_preview"
  | "confirmation_required"
  | "posting_started"
  | "posting_progress"
  | "posting_completed"
  | "posting_failed"
  | "permission_denied"
  | "validation_error"
  | "cancellation_completed"
  | "provider_offline"
  | "backend_unavailable"
  | "general_error"
  | "unknown";

export type OrbixActionType =
  | "switch_mode"
  | "preview"
  | "confirm"
  | "edit"
  | "cancel"
  | "open_voucher"
  | "view_ledger"
  | "new_transaction"
  | "retry"
  | "dismiss";

export interface OrbixAction {
  id: string;
  type: OrbixActionType;
  label: string;
  target_mode?: "ask" | "accountant";
  danger_level?: "none" | "consequential" | "destructive";
  disabled?: boolean;
}

export interface OrbixDisplay {
  text: string;
  language?: "en" | "ne" | "ne-romanized" | "mixed";
  tone?: "professional";
}

export interface OrbixResponseBase {
  schema_version: typeof ORBIX_RESPONSE_SCHEMA_VERSION;
  request_id?: string;
  conversation_id?: string;
  message_id?: string;
  timestamp?: string;
  orbix_mode?: "ask" | "accountant";
  operation_class?: string | null;
  response_type: OrbixResponseType;
  status: OrbixResponseStatus;
  display: OrbixDisplay;
  actions: OrbixAction[];
  diagnostics?: Record<string, unknown> | null;
}

export interface ModeRestrictionPayload {
  requested_operation: string | null;
  required_mode: "accountant" | "ask";
  current_mode: "ask" | "accountant";
  can_preview: boolean;
  can_explain: boolean;
  original_request_preserved: boolean;
}

export interface ClarificationFieldCaptured {
  field: string;
  label: string;
  value: string;
  display_value?: string;
  confidence?: number;
}

export interface ClarificationFieldMissing {
  field: string;
  label: string;
  required: boolean;
  input_type?: "text" | "number" | "money" | "choice" | "date";
  choices?: Array<{ value: string; label: string }>;
}

export interface ClarificationPayload {
  draft_id: string;
  transaction_type: string;
  draft_status: string;
  captured_fields: ClarificationFieldCaptured[];
  missing_fields: ClarificationFieldMissing[];
  ambiguous_fields: string[];
  nothing_posted: true;
}

export interface JournalPreviewEntry {
  account_id?: string;
  account_code?: string;
  account_name: string;
  debit: string;
  credit: string;
}

export interface JournalPreviewPayload {
  journal_id?: string;
  draft_id?: string;
  date?: string | null;
  narration?: string | null;
  entries: JournalPreviewEntry[];
  total_debit: string;
  total_credit: string;
  balanced: boolean;
  accounting_rule?: string | null;
}

export interface TransactionPreviewPayload {
  draft_id: string;
  preview_version?: string | number | null;
  preview_hash?: string | null;
  idempotency_key?: string | null;
  transaction_type: string;
  status: string;
  party?: { id?: string | null; name?: string | null; type?: string | null } | null;
  items: Array<{
    item_id?: string | null;
    name: string;
    quantity?: string | null;
    unit?: string | null;
    rate?: string | null;
    amount?: string | null;
  }>;
  payment?: {
    method?: string | null;
    account_id?: string | null;
    account_name?: string | null;
  } | null;
  totals: {
    subtotal?: string | null;
    tax?: string | null;
    discount?: string | null;
    grand_total: string;
    currency: string;
  };
  journal?: JournalPreviewPayload | null;
  can_confirm: boolean;
  /** Legacy card bridge for confirmPending */
  legacy_card?: Record<string, unknown> | null;
}

export interface ConfirmationRequiredPayload {
  draft_id: string;
  preview_version?: string | number | null;
  preview_hash?: string | null;
  idempotency_key?: string | null;
  operation: string;
  summary: {
    transaction_type: string;
    party?: string | null;
    amount: string;
    currency: string;
    date?: string | null;
  };
  warnings: string[];
  requires_permission?: string | null;
  journal?: JournalPreviewPayload | null;
  legacy_card?: Record<string, unknown> | null;
}

export interface PostingProgressPayload {
  draft_id: string;
  posting_id?: string | null;
  stage: string;
  label?: string;
}

export interface PostingCompletedPayload {
  draft_id: string;
  posting_id?: string;
  voucher_id?: string | null;
  voucher_number?: string | null;
  invoice_id?: string | null;
  invoice_number?: string | null;
  journal_id?: string | null;
  posted_at?: string | null;
  posted_by?: string | null;
  idempotent_replay?: boolean;
  amount?: string | null;
  currency?: string;
  /** Phase 5: remote sync state — separate from local posting success */
  sync_status?:
    | "pending"
    | "disabled"
    | "syncing"
    | "synced"
    | "failed"
    | "conflict"
    | "waiting_to_sync"
    | "offline_will_sync";
  sync_event_id?: string | null;
}

export interface PostingFailedPayload {
  draft_id?: string | null;
  error_code: string;
  safe_message: string;
  rolled_back: boolean | null;
  retryable: boolean;
  user_action_required: boolean;
  draft_retained: boolean;
}

export interface ReportResultPayload {
  report_id?: string;
  report_type?: string;
  title?: string;
  version?: number;
  changes?: string[];
  /** FE OrbixReportPayload when local/engine report is attached */
  report?: unknown;
  report_spec?: Record<string, unknown> | null;
}

export interface ProviderOfflinePayload {
  reason?: string;
  retryable: boolean;
}

export interface NormalAnswerPayload {
  kind?: "normal" | "capability" | "accounting_explanation" | "erp_data";
}

export interface GeneralErrorPayload {
  error_code: string;
  safe_message: string;
}

export type OrbixResponse =
  | (OrbixResponseBase & { response_type: "normal_answer"; payload: NormalAnswerPayload })
  | (OrbixResponseBase & { response_type: "capability_answer"; payload: NormalAnswerPayload })
  | (OrbixResponseBase & { response_type: "accounting_explanation"; payload: NormalAnswerPayload })
  | (OrbixResponseBase & { response_type: "erp_data_result"; payload: NormalAnswerPayload })
  | (OrbixResponseBase & { response_type: "mode_restriction"; payload: ModeRestrictionPayload })
  | (OrbixResponseBase & {
      response_type: "clarification_required";
      payload: ClarificationPayload;
    })
  | (OrbixResponseBase & {
      response_type: "transaction_preview";
      payload: TransactionPreviewPayload;
    })
  | (OrbixResponseBase & {
      response_type: "confirmation_required";
      payload: ConfirmationRequiredPayload;
    })
  | (OrbixResponseBase & { response_type: "journal_preview"; payload: JournalPreviewPayload })
  | (OrbixResponseBase & { response_type: "report_result"; payload: ReportResultPayload })
  | (OrbixResponseBase & { response_type: "report_updated"; payload: ReportResultPayload })
  | (OrbixResponseBase & { response_type: "posting_progress"; payload: PostingProgressPayload })
  | (OrbixResponseBase & { response_type: "posting_completed"; payload: PostingCompletedPayload })
  | (OrbixResponseBase & { response_type: "posting_failed"; payload: PostingFailedPayload })
  | (OrbixResponseBase & { response_type: "provider_offline"; payload: ProviderOfflinePayload })
  | (OrbixResponseBase & { response_type: "backend_unavailable"; payload: ProviderOfflinePayload })
  | (OrbixResponseBase & { response_type: "permission_denied"; payload: GeneralErrorPayload })
  | (OrbixResponseBase & { response_type: "validation_error"; payload: GeneralErrorPayload })
  | (OrbixResponseBase & { response_type: "general_error"; payload: GeneralErrorPayload })
  | (OrbixResponseBase & { response_type: "unknown"; payload: Record<string, unknown> });

export type OrbixResponseParseResult =
  | { ok: true; response: OrbixResponse; fromFallback?: boolean }
  | { ok: false; fallbackText: string; errorCode: string };
