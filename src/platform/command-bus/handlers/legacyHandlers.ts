import type { ICommandBus, ICommandEnvelope, ICommandHandler, JsonObject } from "@fios/kernel";
import { FiosErrorCode } from "@fios/kernel";
import { confirmKhataEntry } from "@/lib/ekhata/confirmKhata";
import type { KhataConfirmationCard } from "@/lib/ekhata/types";
import { getWriteInternals } from "@/store/writeInternals";
import {
  createAccountRepository,
  createAuditRepository,
  createCompanyRepository,
  createFiscalYearRepository,
  createInvoiceRepository,
  createItemRepository,
  createNotificationRepository,
  createPartyRepository,
  createSyncRepository,
  createVoucherRepository,
  getLegacyStorePort,
} from "@fios/legacy";
import { CommandTypes } from "../commandTypes";

function createLegacyHandler(
  commandType: string,
  execute: (payload: JsonObject, envelope: ICommandEnvelope) => Promise<unknown>,
): ICommandHandler {
  return {
    commandType,
    async handle(envelope) {
      try {
        const data = await execute(envelope.payload, envelope);
        return {
          status: "accepted",
          errors: [],
          correlationId: envelope.correlationId,
          data,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        let code: string = FiosErrorCode.INTERNAL;
        if (message.toLowerCase().includes("unbalanced")) {
          code = FiosErrorCode.UNBALANCED_VOUCHER;
        } else if (message.toLowerCase().includes("period is locked")) {
          code = FiosErrorCode.PERIOD_LOCKED;
        } else if (message.toLowerCase().includes("already exists")) {
          code = FiosErrorCode.DUPLICATE;
        } else if (message.toLowerCase().includes("validation")) {
          code = FiosErrorCode.VALIDATION_FAILED;
        }
        return {
          status: "rejected",
          errors: [{ code, message }],
          correlationId: envelope.correlationId,
        };
      }
    },
  };
}

export function registerLegacyCommandHandlers(bus: ICommandBus): void {
  const vouchers = createVoucherRepository();
  const invoices = createInvoiceRepository();
  const accounts = createAccountRepository();
  const parties = createPartyRepository();
  const items = createItemRepository();
  const company = createCompanyRepository();
  const fiscalYears = createFiscalYearRepository();
  const notifications = createNotificationRepository();
  const audit = createAuditRepository();
  const sync = createSyncRepository();
  const legacyPort = getLegacyStorePort();

  const handlers: ICommandHandler[] = [
    createLegacyHandler(CommandTypes.POST_VOUCHER, (payload) => vouchers.addVoucher(payload)),
    createLegacyHandler(CommandTypes.UPDATE_VOUCHER, (payload) => {
      const id = String(payload.id ?? "");
      const updates = (payload.updates ?? {}) as JsonObject;
      return vouchers.updateVoucher(id, updates);
    }),
    createLegacyHandler(CommandTypes.CANCEL_VOUCHER, (payload) => {
      const id = String(payload.id ?? "");
      const reason = String(payload.reason ?? "");
      return vouchers.cancelVoucher(id, reason);
    }),
    createLegacyHandler(CommandTypes.POST_INVOICE, (payload) => invoices.addInvoice(payload)),
    createLegacyHandler(CommandTypes.UPDATE_INVOICE, (payload) => {
      const id = String(payload.id ?? "");
      const updates = (payload.updates ?? {}) as JsonObject;
      return invoices.updateInvoice(id, updates);
    }),
    createLegacyHandler(CommandTypes.CANCEL_INVOICE, (payload) => {
      const id = String(payload.id ?? "");
      const reason = String(payload.reason ?? "");
      return invoices.cancelInvoice(id, reason);
    }),
    createLegacyHandler(CommandTypes.CREATE_ACCOUNT, (payload) => accounts.addAccount(payload)),
    createLegacyHandler(CommandTypes.UPDATE_ACCOUNT, (payload) => {
      const id = String(payload.id ?? "");
      const updates = (payload.updates ?? {}) as JsonObject;
      return accounts.updateAccount(id, updates);
    }),
    createLegacyHandler(CommandTypes.DELETE_ACCOUNT, (payload) =>
      accounts.deleteAccount(String(payload.id ?? "")),
    ),
    createLegacyHandler(CommandTypes.CREATE_PARTY, (payload) => parties.addParty(payload)),
    createLegacyHandler(CommandTypes.UPDATE_PARTY, (payload) => {
      const id = String(payload.id ?? "");
      const updates = (payload.updates ?? {}) as JsonObject;
      return parties.updateParty(id, updates);
    }),
    createLegacyHandler(CommandTypes.CREATE_ITEM, (payload) => items.addItem(payload)),
    createLegacyHandler(CommandTypes.UPDATE_ITEM, (payload) => items.updateItem(payload)),
    createLegacyHandler(CommandTypes.UPDATE_COMPANY_SETTINGS, (payload) =>
      company.updateCompanySettings(payload),
    ),
    createLegacyHandler(CommandTypes.SET_CURRENT_FISCAL_YEAR, (payload) => {
      fiscalYears.setCurrentFiscalYear(payload);
      return null;
    }),
    createLegacyHandler(CommandTypes.ADD_TDS_ENTRY, (payload) => legacyPort.addTdsEntry(payload)),
    createLegacyHandler(CommandTypes.UPDATE_TDS_ENTRY, (payload) => {
      const id = String(payload.id ?? "");
      const updates = (payload.updates ?? {}) as JsonObject;
      return legacyPort.updateTdsEntry(id, updates);
    }),
    createLegacyHandler(CommandTypes.ADD_NOTIFICATION, (payload) => {
      notifications.addNotification(String(payload.message ?? ""), payload.type as string | undefined);
      return null;
    }),
    createLegacyHandler(CommandTypes.MARK_NOTIFICATION_READ, (payload) => {
      notifications.markNotificationRead(String(payload.id ?? ""));
      return null;
    }),
    createLegacyHandler(CommandTypes.CLEAR_NOTIFICATIONS, () => {
      notifications.clearNotifications();
      return null;
    }),
    createLegacyHandler(CommandTypes.LOAD_AUDIT_LOGS, () => audit.loadAuditLogs()),
    createLegacyHandler(CommandTypes.ADD_AUDIT_LOG, (payload) =>
      audit.addAuditLog({
        action: String(payload.action ?? ""),
        resourceType: String(payload.resourceType ?? ""),
        resourceId: payload.resourceId as string | undefined,
        before: payload.before,
        after: payload.after,
        details: payload.details as Record<string, unknown> | undefined,
      }),
    ),
    createLegacyHandler(CommandTypes.ENQUEUE_SYNC_RECORD, (payload) =>
      sync.enqueueRecord({
        entityType: String(payload.entityType ?? ""),
        entityId: String(payload.entityId ?? ""),
        operation: payload.operation as "create" | "update",
        payload: (payload.payload ?? {}) as JsonObject,
      }),
    ),
    createLegacyHandler(CommandTypes.POST_KHATA_ENTRY, (payload) => {
      const card = payload.card as KhataConfirmationCard;
      return confirmKhataEntry(card, {
        addVoucher: (voucher) => getWriteInternals().addVoucher(voucher),
      });
    }),
  ];

  for (const handler of handlers) {
    bus.registerHandler(handler);
  }
}
