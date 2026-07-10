import type { AppState } from "@/store/store.types";

/**
 * Narrow port of Zustand AppState used by domain adapters.
 * Keeps legacy store as the single write authority (F1).
 */
export type LegacyStorePort = Pick<
  AppState,
  | "addVoucher"
  | "updateVoucher"
  | "cancelVoucher"
  | "addInvoice"
  | "updateInvoice"
  | "cancelInvoice"
  | "addAccount"
  | "updateAccount"
  | "deleteAccount"
  | "addParty"
  | "updateParty"
  | "addItem"
  | "updateItem"
  | "updateCompanySettings"
  | "setCurrentFiscalYear"
  | "addNotification"
  | "markNotificationRead"
  | "clearNotifications"
  | "loadAuditLogs"
  | "addAuditLog"
  | "addTdsEntry"
  | "updateTdsEntry"
> & {
  getState: () => AppState;
};

export type LegacyStateSnapshot = Pick<
  AppState,
  | "vouchers"
  | "invoices"
  | "accounts"
  | "parties"
  | "items"
  | "stockMovements"
  | "companySettings"
  | "currentFiscalYear"
  | "notifications"
  | "auditLogs"
  | "tdsEntries"
>;
