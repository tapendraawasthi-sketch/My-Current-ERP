export type { LegacyStorePort, LegacyStateSnapshot } from "./adapters/storePort";
export {
  createLegacyStorePort,
  getLegacyStorePort,
  readLegacyState,
  legacyNumberingService,
  legacySyncRepository,
} from "./adapters/legacyStoreAdapter";
export {
  createLegacyStateReader,
  createVoucherRepository,
  createInvoiceRepository,
  createAccountRepository,
  createPartyRepository,
  createItemRepository,
  createCompanyRepository,
  createFiscalYearRepository,
  createNotificationRepository,
  createAuditRepository,
  createNumberingService,
  createSyncRepository,
} from "./adapters/repositories";

/** Future F1 move target — today re-exports current store unchanged. */
export { useStore } from "@/store";
export type { AppState, CompanySettings, StoreUser, FiscalYear } from "@/store";
