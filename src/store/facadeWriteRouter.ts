import { isMigrationFlagEnabled } from "@/platform/flags/registry";
import { voucherDomain } from "@/domains/voucher";
import { invoiceDomain } from "@/domains/invoice";
import { mastersDomain } from "@/domains/masters";
import { partyDomain } from "@/domains/party";
import { inventoryDomain } from "@/domains/inventory";
import { companyDomain } from "@/domains/company";
import { fiscalYearDomain } from "@/domains/fiscal-year";
import { notificationDomain } from "@/domains/notification";
import { auditDomain } from "@/domains/audit";
import { taxDomain } from "@/domains/tax";
import { isInCommandBusContext } from "./commandBusContext";
import { getWriteInternals } from "./writeInternals";

function shouldRouteThroughFacade(): boolean {
  return isMigrationFlagEnabled("MIGRATION_DOMAIN_FACADES") && !isInCommandBusContext();
}

export async function facadeAddVoucher(voucher: unknown): Promise<unknown> {
  if (!shouldRouteThroughFacade()) return getWriteInternals().addVoucher(voucher);
  return voucherDomain.post(voucher as never);
}

export async function facadeUpdateVoucher(id: string, updates: unknown): Promise<void> {
  if (!shouldRouteThroughFacade()) return getWriteInternals().updateVoucher(id, updates);
  await voucherDomain.update(id, updates as never);
}

export async function facadeCancelVoucher(id: string, reason: string): Promise<void> {
  if (!shouldRouteThroughFacade()) return getWriteInternals().cancelVoucher(id, reason);
  await voucherDomain.cancel(id, reason);
}

export async function facadeAddInvoice(invoice: unknown): Promise<unknown> {
  if (!shouldRouteThroughFacade()) return getWriteInternals().addInvoice(invoice);
  return invoiceDomain.post(invoice as never);
}

export async function facadeUpdateInvoice(id: string, updates: unknown): Promise<void> {
  if (!shouldRouteThroughFacade()) return getWriteInternals().updateInvoice(id, updates);
  await invoiceDomain.update(id, updates as never);
}

export async function facadeCancelInvoice(id: string, reason: string): Promise<void> {
  if (!shouldRouteThroughFacade()) return getWriteInternals().cancelInvoice(id, reason);
  await invoiceDomain.cancel(id, reason);
}

export async function facadeAddAccount(account: unknown): Promise<unknown> {
  if (!shouldRouteThroughFacade()) return getWriteInternals().addAccount(account);
  return mastersDomain.createAccount(account as never);
}

export async function facadeUpdateAccount(id: string, updates: unknown): Promise<void> {
  if (!shouldRouteThroughFacade()) return getWriteInternals().updateAccount(id, updates);
  await mastersDomain.updateAccount(id, updates as never);
}

export async function facadeDeleteAccount(id: string): Promise<void> {
  if (!shouldRouteThroughFacade()) return getWriteInternals().deleteAccount(id);
  await mastersDomain.deleteAccount(id);
}

export async function facadeAddParty(party: unknown): Promise<unknown> {
  if (!shouldRouteThroughFacade()) return getWriteInternals().addParty(party);
  return partyDomain.create(party as never);
}

export async function facadeUpdateParty(id: string, updates: unknown): Promise<void> {
  if (!shouldRouteThroughFacade()) return getWriteInternals().updateParty(id, updates);
  await partyDomain.update(id, updates as never);
}

export async function facadeAddItem(item: unknown): Promise<unknown> {
  if (!shouldRouteThroughFacade()) return getWriteInternals().addItem(item);
  return inventoryDomain.createItem(item as never);
}

export async function facadeUpdateItem(item: unknown): Promise<unknown> {
  if (!shouldRouteThroughFacade()) return getWriteInternals().updateItem(item);
  return inventoryDomain.updateItem(item as never);
}

export async function facadeUpdateCompanySettings(settings: unknown): Promise<void> {
  if (!shouldRouteThroughFacade()) return getWriteInternals().updateCompanySettings(settings);
  await companyDomain.updateSettings(settings as never);
}

export function facadeSetCurrentFiscalYear(fy: unknown): void {
  if (!shouldRouteThroughFacade()) {
    getWriteInternals().setCurrentFiscalYear(fy);
    return;
  }
  void fiscalYearDomain.setCurrent(fy as never);
}

export function facadeAddNotification(message: string, type?: string): void {
  if (!shouldRouteThroughFacade()) {
    getWriteInternals().addNotification(message, type);
    return;
  }
  void notificationDomain.notify(message, type);
}

export function facadeMarkNotificationRead(id: string): void {
  if (!shouldRouteThroughFacade()) {
    getWriteInternals().markNotificationRead(id);
    return;
  }
  void notificationDomain.markRead(id);
}

export function facadeClearNotifications(): void {
  if (!shouldRouteThroughFacade()) {
    getWriteInternals().clearNotifications();
    return;
  }
  void notificationDomain.clearAll();
}

export async function facadeLoadAuditLogs(): Promise<void> {
  if (!shouldRouteThroughFacade()) return getWriteInternals().loadAuditLogs();
  await auditDomain.load();
}

export async function facadeAddAuditLog(params: unknown): Promise<void> {
  if (!shouldRouteThroughFacade()) return getWriteInternals().addAuditLog(params);
  await auditDomain.record(params as never);
}

export async function facadeAddTdsEntry(entry: unknown): Promise<unknown> {
  if (!shouldRouteThroughFacade()) return getWriteInternals().addTdsEntry(entry);
  return taxDomain.addEntry(entry as never);
}

export async function facadeUpdateTdsEntry(id: string, updates: unknown): Promise<void> {
  if (!shouldRouteThroughFacade()) return getWriteInternals().updateTdsEntry(id, updates);
  await taxDomain.updateEntry(id, updates as never);
}
