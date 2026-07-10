import type {
  IAccountRepository,
  IAuditRepository,
  ICompanyRepository,
  IFiscalYearRepository,
  IInvoiceRepository,
  IItemRepository,
  ILegacyStateReader,
  INotificationRepository,
  IPartyRepository,
  IVoucherRepository,
  INumberingService,
  ISyncRepository,
} from "@fios/kernel";
import { executeQuerySync, QueryTypes } from "@fios/query-bus";
import { isMigrationFlagEnabled } from "@/platform/flags/registry";
import {
  getLegacyStorePort,
  legacyNumberingService,
  legacySyncRepository,
  readLegacyState,
} from "./legacyStoreAdapter";

function useQueryFacadeReads(): boolean {
  return (
    isMigrationFlagEnabled("MIGRATION_QUERY_FACADE") &&
    isMigrationFlagEnabled("MIGRATION_QUERY_BUS")
  );
}

export function createLegacyStateReader(): ILegacyStateReader {
  if (useQueryFacadeReads()) {
    return {
      getVouchers: () => executeQuerySync({ queryType: QueryTypes.LIST_VOUCHERS, payload: {} }),
      getInvoices: () => executeQuerySync({ queryType: QueryTypes.LIST_INVOICES, payload: {} }),
      getAccounts: () => executeQuerySync({ queryType: QueryTypes.LIST_ACCOUNTS, payload: {} }),
      getParties: () => executeQuerySync({ queryType: QueryTypes.LIST_PARTIES, payload: {} }),
      getItems: () => executeQuerySync({ queryType: QueryTypes.LIST_ITEMS, payload: {} }),
      getStockMovements: () => readLegacyState().stockMovements,
      getCompanySettings: () =>
        executeQuerySync({ queryType: QueryTypes.COMPANY_SETTINGS, payload: {} }),
      getCurrentFiscalYear: () =>
        executeQuerySync({ queryType: QueryTypes.FISCAL_YEAR, payload: {} }),
    };
  }

  return {
    getVouchers: () => readLegacyState().vouchers,
    getInvoices: () => readLegacyState().invoices,
    getAccounts: () => readLegacyState().accounts,
    getParties: () => readLegacyState().parties,
    getItems: () => readLegacyState().items,
    getStockMovements: () => readLegacyState().stockMovements,
    getCompanySettings: () => readLegacyState().companySettings,
    getCurrentFiscalYear: () => readLegacyState().currentFiscalYear,
  };
}

export function createVoucherRepository(): IVoucherRepository {
  const port = getLegacyStorePort();
  return {
    addVoucher: (voucher) => port.addVoucher(voucher),
    updateVoucher: (id, updates) => port.updateVoucher(id, updates),
    cancelVoucher: (id, reason) => port.cancelVoucher(id, reason),
  };
}

export function createInvoiceRepository(): IInvoiceRepository {
  const port = getLegacyStorePort();
  return {
    addInvoice: (invoice) => port.addInvoice(invoice),
    updateInvoice: (id, updates) => port.updateInvoice(id, updates),
    cancelInvoice: (id, reason) => port.cancelInvoice(id, reason),
  };
}

export function createAccountRepository(): IAccountRepository {
  const port = getLegacyStorePort();
  return {
    addAccount: (account) => port.addAccount(account),
    updateAccount: (id, updates) => port.updateAccount(id, updates),
    deleteAccount: (id) => port.deleteAccount(id),
  };
}

export function createPartyRepository(): IPartyRepository {
  const port = getLegacyStorePort();
  return {
    addParty: (party) => port.addParty(party),
    updateParty: (id, updates) => port.updateParty(id, updates),
  };
}

export function createItemRepository(): IItemRepository {
  const port = getLegacyStorePort();
  return {
    addItem: (item) => port.addItem(item),
    updateItem: (item) => port.updateItem(item),
  };
}

export function createCompanyRepository(): ICompanyRepository {
  const port = getLegacyStorePort();
  return {
    updateCompanySettings: (settings) => port.updateCompanySettings(settings as never),
  };
}

export function createFiscalYearRepository(): IFiscalYearRepository {
  const port = getLegacyStorePort();
  return {
    setCurrentFiscalYear: (fiscalYear) => port.setCurrentFiscalYear(fiscalYear as never),
  };
}

export function createNotificationRepository(): INotificationRepository {
  const port = getLegacyStorePort();
  return {
    addNotification: (message, type) => port.addNotification(message, type),
    markNotificationRead: (id) => port.markNotificationRead(id),
    clearNotifications: () => port.clearNotifications(),
  };
}

export function createAuditRepository(): IAuditRepository {
  const port = getLegacyStorePort();
  return {
    loadAuditLogs: () => port.loadAuditLogs(),
    addAuditLog: (params) =>
      port.addAuditLog({
        action: params.action,
        resourceType: params.resourceType,
        resourceId: params.resourceId,
        before: params.before ?? params.details,
        after: params.after,
      }),
  };
}

export function createNumberingService(): INumberingService {
  return legacyNumberingService;
}

export function createSyncRepository(): ISyncRepository {
  return legacySyncRepository;
}
