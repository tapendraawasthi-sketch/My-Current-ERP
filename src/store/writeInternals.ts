export interface WriteInternals {
  addVoucher: (voucher: unknown) => Promise<unknown>;
  updateVoucher: (id: string, updates: unknown) => Promise<void>;
  cancelVoucher: (id: string, reason: string) => Promise<void>;
  addInvoice: (invoice: unknown) => Promise<unknown>;
  updateInvoice: (id: string, updates: unknown) => Promise<void>;
  cancelInvoice: (id: string, reason: string) => Promise<void>;
  addAccount: (account: unknown) => Promise<unknown>;
  updateAccount: (id: string, updates: unknown) => Promise<void>;
  deleteAccount: (id: string) => Promise<void>;
  addParty: (party: unknown) => Promise<unknown>;
  updateParty: (id: string, updates: unknown) => Promise<void>;
  addItem: (item: unknown) => Promise<unknown>;
  updateItem: (item: unknown) => Promise<unknown>;
  updateCompanySettings: (settings: unknown) => Promise<void>;
  setCurrentFiscalYear: (fy: unknown) => void;
  addNotification: (message: string, type?: string) => void;
  markNotificationRead: (id: string) => void;
  clearNotifications: () => void;
  loadAuditLogs: () => Promise<void>;
  addAuditLog: (params: unknown) => Promise<void>;
  addTdsEntry: (entry: unknown) => Promise<unknown>;
  updateTdsEntry: (id: string, updates: unknown) => Promise<void>;
}

let internals: WriteInternals | null = null;

export function registerWriteInternals(registered: WriteInternals): void {
  internals = registered;
}

export function getWriteInternals(): WriteInternals {
  if (!internals) {
    throw new Error("Write internals not registered");
  }
  return internals;
}
