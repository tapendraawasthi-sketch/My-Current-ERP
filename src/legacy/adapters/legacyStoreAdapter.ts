import { useStore } from "@/store";
import { getDB } from "@/lib/db";
import { generateNextInvoiceNo, generateNextVoucherNo } from "@/store/index";
import { getWriteInternals } from "@/store/writeInternals";
import type { LegacyStateSnapshot, LegacyStorePort } from "./storePort";

export function createLegacyStorePort(): LegacyStorePort {
  const getState = () => useStore.getState();
  const internal = () => getWriteInternals();

  return {
    getState,
    addVoucher: (voucher) => internal().addVoucher(voucher),
    updateVoucher: (id, updates) => internal().updateVoucher(id, updates),
    cancelVoucher: (id, reason) => internal().cancelVoucher(id, reason),
    addInvoice: (invoice) => internal().addInvoice(invoice),
    updateInvoice: (id, updates) => internal().updateInvoice(id, updates),
    cancelInvoice: (id, reason) => internal().cancelInvoice(id, reason),
    addAccount: (account) => internal().addAccount(account),
    updateAccount: (id, updates) => internal().updateAccount(id, updates),
    deleteAccount: (id) => internal().deleteAccount(id),
    addParty: (party) => internal().addParty(party),
    updateParty: (id, updates) => internal().updateParty(id, updates),
    addItem: (item) => internal().addItem(item),
    updateItem: (item) => internal().updateItem(item),
    updateCompanySettings: (settings) => internal().updateCompanySettings(settings),
    setCurrentFiscalYear: (fy) => internal().setCurrentFiscalYear(fy),
    addNotification: (message, type) => internal().addNotification(message, type),
    markNotificationRead: (id) => internal().markNotificationRead(id),
    clearNotifications: () => internal().clearNotifications(),
    loadAuditLogs: () => internal().loadAuditLogs(),
    addAuditLog: (params) => internal().addAuditLog(params),
    addTdsEntry: (entry) => internal().addTdsEntry(entry),
    updateTdsEntry: (id, updates) => internal().updateTdsEntry(id, updates),
  };
}

let cachedPort: LegacyStorePort | null = null;

export function getLegacyStorePort(): LegacyStorePort {
  if (!cachedPort) {
    cachedPort = createLegacyStorePort();
  }
  return cachedPort;
}

export function readLegacyState(): LegacyStateSnapshot {
  const s = getLegacyStorePort().getState();
  return {
    vouchers: s.vouchers,
    invoices: s.invoices,
    accounts: s.accounts,
    parties: s.parties,
    items: s.items,
    stockMovements: s.stockMovements,
    companySettings: s.companySettings,
    currentFiscalYear: s.currentFiscalYear,
    notifications: s.notifications,
    auditLogs: s.auditLogs,
    tdsEntries: s.tdsEntries,
  };
}

export const legacyNumberingService = {
  async generateNextVoucherNo(type: string): Promise<string> {
    const db = getDB();
    return generateNextVoucherNo(type, db);
  },
  async generateNextInvoiceNo(type: string): Promise<string> {
    const db = getDB();
    return generateNextInvoiceNo(type, db);
  },
};

export const legacySyncRepository = {
  async enqueueRecord(input: {
    entityType: string;
    entityId: string;
    operation: "create" | "update";
    payload: Record<string, unknown>;
  }): Promise<void> {
    const { enqueueAfterDomainWrite } = await import("@/store/syncEnqueueRouter");
    await enqueueAfterDomainWrite({
      entityType: input.entityType as "account" | "party" | "item" | "voucher" | "invoice",
      entityId: input.entityId,
      operation: input.operation,
      payload: input.payload,
    });
  },
};
