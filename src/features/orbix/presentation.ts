/**
 * Phase UI-6 — presentation metadata for structured Orbix responses.
 * Does not invent accounting facts; maps authoritative response_type → UI rules.
 */

import type { OrbixResponse, OrbixResponseType } from "@/lib/ekhata/orbixResponseTypes";

export type OrbixTrustLabel =
  | "explanation"
  | "clarification"
  | "preview"
  | "posted_local"
  | "pending_sync"
  | "synced"
  | "conflict"
  | "failed"
  | "restricted"
  | "unavailable";

export interface OrbixPresentationMeta {
  responseType: OrbixResponseType;
  heading: string;
  trust: OrbixTrustLabel;
  allowsConfirm: boolean;
  allowsMutation: boolean;
  isStructured: boolean;
}

const META: Partial<Record<OrbixResponseType, Omit<OrbixPresentationMeta, "responseType">>> = {
  accounting_explanation: {
    heading: "Explanation",
    trust: "explanation",
    allowsConfirm: false,
    allowsMutation: false,
    isStructured: true,
  },
  normal_answer: {
    heading: "Answer",
    trust: "explanation",
    allowsConfirm: false,
    allowsMutation: false,
    isStructured: false,
  },
  clarification_required: {
    heading: "Clarification needed",
    trust: "clarification",
    allowsConfirm: false,
    allowsMutation: false,
    isStructured: true,
  },
  mode_restriction: {
    heading: "Ask Mode restriction",
    trust: "restricted",
    allowsConfirm: false,
    allowsMutation: false,
    isStructured: true,
  },
  permission_denied: {
    heading: "Not permitted",
    trust: "restricted",
    allowsConfirm: false,
    allowsMutation: false,
    isStructured: true,
  },
  transaction_preview: {
    heading: "Confirm preview",
    trust: "preview",
    allowsConfirm: true,
    allowsMutation: false,
    isStructured: true,
  },
  confirmation_required: {
    heading: "Confirm to post",
    trust: "preview",
    allowsConfirm: true,
    allowsMutation: false,
    isStructured: true,
  },
  posting_completed: {
    heading: "Posted locally",
    trust: "posted_local",
    allowsConfirm: false,
    allowsMutation: false,
    isStructured: true,
  },
  posting_failed: {
    heading: "Posting failed",
    trust: "failed",
    allowsConfirm: false,
    allowsMutation: false,
    isStructured: true,
  },
  provider_offline: {
    heading: "Orbix unavailable",
    trust: "unavailable",
    allowsConfirm: false,
    allowsMutation: false,
    isStructured: true,
  },
  backend_unavailable: {
    heading: "Orbix unavailable",
    trust: "unavailable",
    allowsConfirm: false,
    allowsMutation: false,
    isStructured: true,
  },
  report_result: {
    heading: "Report",
    trust: "explanation",
    allowsConfirm: false,
    allowsMutation: false,
    isStructured: true,
  },
};

export function getPresentationMeta(response: OrbixResponse | null | undefined): OrbixPresentationMeta {
  const type = response?.response_type ?? "unknown";
  const base = META[type] ?? {
    heading: "Response",
    trust: "explanation" as OrbixTrustLabel,
    allowsConfirm: false,
    allowsMutation: false,
    isStructured: Boolean(response),
  };
  let trust = base.trust;
  if (type === "posting_completed" && response && "payload" in response) {
    const sync = (response.payload as { sync_status?: string }).sync_status;
    if (sync === "synced") trust = "synced";
    else if (sync === "conflict") trust = "conflict";
    else if (sync === "failed") trust = "failed";
    else trust = "pending_sync";
  }
  return { responseType: type, ...base, trust };
}

/** Map posting sync_status to UI-3-aligned labels. Never invent "synced". */
export function syncStatusPresentation(sync?: string | null): {
  label: string;
  testId: "synced" | "pending" | "failed" | "conflict" | "local_only" | "offline";
} {
  switch (sync) {
    case "synced":
      return { label: "Synced", testId: "synced" };
    case "disabled":
    case "local_only":
      return { label: "Local only", testId: "local_only" };
    case "failed":
      return { label: "Sync failed — local records are safe", testId: "failed" };
    case "conflict":
      return { label: "Conflict detected — review required", testId: "conflict" };
    case "pending":
    case "queued":
    case "waiting_to_sync":
    case "syncing":
    case "retry_scheduled":
      // PR-B3 / ADR_0086 — queued/pending must never present as Synced.
      return { label: "Waiting to sync", testId: "pending" };
    default:
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        return { label: "Offline — will sync later", testId: "offline" };
      }
      return { label: "Waiting to sync", testId: "pending" };
  }
}

export function confirmButtonLabel(intent?: string | null): string {
  const key = String(intent || "").toLowerCase();
  if (key.includes("sales") && key.includes("return")) return "Post Sales Return";
  if (key.includes("purchase") && key.includes("return")) return "Post Purchase Return";
  if (key.includes("cash_sale") || key.includes("bank_sale") || (key.includes("sale") && !key.includes("purchase")))
    return "Post Sales Invoice";
  if (key.includes("sales") || key.includes("invoice")) return "Post Sales Invoice";
  if (key.includes("purchase")) return "Record Purchase";
  if (key.includes("payment")) return "Record Payment";
  if (key.includes("receipt")) return "Receive Money";
  if (key.includes("journal")) return "Post Journal Entry";
  if (key.includes("credit")) return "Issue Credit Note";
  if (key.includes("recon") || key.includes("match")) return "Match Bank Transaction";
  return "Confirm and post";
}

/** MAI-01: UI confirm affordance requires Accountant Mode + presentation allow. */
export function mayShowConfirmControl(
  meta: OrbixPresentationMeta,
  mode: "ask" | "accountant",
): boolean {
  return mode === "accountant" && meta.allowsConfirm;
}
