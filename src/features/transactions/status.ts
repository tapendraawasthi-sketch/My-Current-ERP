/**
 * Phase UI-7 — transaction status presentation (no invented sync success).
 */

export type TransactionDocMode =
  | "inventory-document"
  | "settlement-document"
  | "transfer-document"
  | "journal-document";

export type TransactionLifecycle =
  | "draft"
  | "validating"
  | "posting"
  | "posted_local"
  | "pending"
  | "synced"
  | "failed"
  | "conflict";

export function syncStatusToLifecycle(sync?: string | null): TransactionLifecycle {
  switch (sync) {
    case "synced":
      return "synced";
    case "conflict":
      return "conflict";
    case "failed":
      return "failed";
    case "pending":
    case "syncing":
    case "waiting_to_sync":
    case "retry_scheduled":
    case "offline_will_sync":
      return "pending";
    case "disabled":
    case "local_only":
      return "posted_local";
    default:
      return "posted_local";
  }
}

export function lifecycleLabel(state: TransactionLifecycle): string {
  switch (state) {
    case "draft":
      return "Draft";
    case "validating":
      return "Validating";
    case "posting":
      return "Posting";
    case "posted_local":
      return "Posted locally";
    case "pending":
      return "Waiting to sync";
    case "synced":
      return "Synced";
    case "failed":
      return "Failed — local records may be safe";
    case "conflict":
      return "Conflict — review required";
  }
}

export function postActionLabel(family: string, posting?: boolean): string {
  if (posting) return "Posting…";
  switch (family) {
    case "sales":
      return "Post Sales Invoice";
    case "purchase":
      return "Post Purchase Invoice";
    case "receipt":
      return "Record Receipt";
    case "payment":
      return "Record Payment";
    case "contra":
      return "Post Contra";
    case "journal":
      return "Post Journal Entry";
    default:
      return "Post";
  }
}
