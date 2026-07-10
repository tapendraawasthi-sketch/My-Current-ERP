import type { JsonObject } from "./types";

/** Read-only state snapshot port (F5 query façade builds on this). */

export interface ILegacyStateReader {
  getVouchers(): unknown[];
  getInvoices(): unknown[];
  getAccounts(): unknown[];
  getParties(): unknown[];
  getItems(): unknown[];
  getStockMovements(): unknown[];
  getCompanySettings(): unknown | null;
  getCurrentFiscalYear(): unknown | null;
}

export interface IVoucherRepository {
  addVoucher(voucher: JsonObject): Promise<unknown>;
  updateVoucher(id: string, updates: JsonObject): Promise<void>;
  cancelVoucher(id: string, reason: string): Promise<void>;
}

export interface IInvoiceRepository {
  addInvoice(invoice: JsonObject): Promise<unknown>;
  updateInvoice(id: string, updates: JsonObject): Promise<void>;
  cancelInvoice(id: string, reason: string): Promise<void>;
}

export interface IAccountRepository {
  addAccount(account: JsonObject): Promise<unknown>;
  updateAccount(id: string, updates: JsonObject): Promise<void>;
  deleteAccount(id: string): Promise<boolean>;
}

export interface IPartyRepository {
  addParty(party: JsonObject): Promise<unknown>;
  updateParty(id: string, updates: JsonObject): Promise<void>;
}

export interface IItemRepository {
  addItem(item: JsonObject): Promise<unknown>;
  updateItem(item: JsonObject): Promise<unknown>;
}

export interface ICompanyRepository {
  updateCompanySettings(settings: JsonObject): Promise<void>;
}

export interface IFiscalYearRepository {
  setCurrentFiscalYear(fiscalYear: JsonObject): void;
}

export interface INotificationRepository {
  addNotification(message: string, type?: string): void;
  markNotificationRead(id: string): void;
  clearNotifications(): void;
}

export interface IAuditRepository {
  loadAuditLogs(): Promise<void>;
  addAuditLog(params: {
    action: string;
    resourceType: string;
    resourceId?: string;
    before?: unknown;
    after?: unknown;
    details?: Record<string, unknown>;
  }): Promise<void>;
}

export interface INumberingService {
  generateNextVoucherNo(type: string): Promise<string>;
  generateNextInvoiceNo(type: string): Promise<string>;
}

export interface ISyncRepository {
  enqueueRecord(input: {
    entityType: string;
    entityId: string;
    operation: "create" | "update";
    payload: JsonObject;
  }): Promise<void>;
}
