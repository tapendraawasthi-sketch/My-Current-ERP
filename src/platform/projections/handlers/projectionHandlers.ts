import type { IDomainEvent } from "@fios/kernel";
import { getDB } from "@/lib/db";
import { EventTypes } from "@/platform/event-bus/eventTypes";
import type { ProjectionContext, IProjectionHandler } from "../projectionRegistry";
import { ProjectionNames } from "../projectionState";
import {
  deleteProjectionRow,
  payloadAsObject,
  readProjectionRow,
  readProjectionRows,
  upsertProjectionRow,
} from "../projectionStorage";

const VOUCHER_EVENTS = [
  EventTypes.VOUCHER_POSTED,
  EventTypes.VOUCHER_UPDATED,
  EventTypes.VOUCHER_CANCELLED,
];
const INVOICE_EVENTS = [
  EventTypes.INVOICE_POSTED,
  EventTypes.INVOICE_UPDATED,
  EventTypes.INVOICE_CANCELLED,
];
const PARTY_EVENTS = [EventTypes.PARTY_CREATED, EventTypes.PARTY_UPDATED];
const ITEM_EVENTS = [EventTypes.ITEM_CREATED, EventTypes.ITEM_UPDATED];
const TAX_EVENTS = [EventTypes.TDS_ENTRY_ADDED, EventTypes.TDS_ENTRY_UPDATED];
const AUDIT_EVENTS = [EventTypes.AUDIT_RECORD_ADDED, EventTypes.AUDIT_LOGS_LOADED];
const NOTIFICATION_EVENTS = [
  EventTypes.NOTIFICATION_ADDED,
  EventTypes.NOTIFICATION_READ,
  EventTypes.NOTIFICATIONS_CLEARED,
];

function now(): string {
  return new Date().toISOString();
}

async function readBalance(accountId: string) {
  const db = getDB() as Record<
    string,
    { get: (id: string) => Promise<Record<string, number> | undefined> }
  >;
  return (await db.projectionAccountBalances?.get(accountId)) ?? null;
}

export class VoucherProjectionHandler implements IProjectionHandler {
  readonly projectionName = ProjectionNames.VOUCHER;
  readonly supportedEventTypes = VOUCHER_EVENTS;

  async apply(event: IDomainEvent, context: ProjectionContext): Promise<void> {
    const payload = payloadAsObject(event.payload);
    const id = String(payload.id ?? event.aggregateId);
    if (event.eventType === EventTypes.VOUCHER_CANCELLED) {
      await deleteProjectionRow("projectionVouchers", id, context.dryRun);
      return;
    }
    await upsertProjectionRow(
      "projectionVouchers",
      {
        id,
        aggregateId: event.aggregateId,
        payload: event.payload,
        globalSequence: context.globalSequence,
        updatedAt: now(),
      },
      context.dryRun,
    );
  }
}

export class InvoiceProjectionHandler implements IProjectionHandler {
  readonly projectionName = ProjectionNames.INVOICE;
  readonly supportedEventTypes = INVOICE_EVENTS;

  async apply(event: IDomainEvent, context: ProjectionContext): Promise<void> {
    const payload = payloadAsObject(event.payload);
    const id = String(payload.id ?? event.aggregateId);
    if (event.eventType === EventTypes.INVOICE_CANCELLED) {
      await deleteProjectionRow("projectionInvoices", id, context.dryRun);
      return;
    }
    await upsertProjectionRow(
      "projectionInvoices",
      {
        id,
        aggregateId: event.aggregateId,
        payload: event.payload,
        globalSequence: context.globalSequence,
        updatedAt: now(),
      },
      context.dryRun,
    );
  }
}

export class PartyProjectionHandler implements IProjectionHandler {
  readonly projectionName = ProjectionNames.PARTY;
  readonly supportedEventTypes = PARTY_EVENTS;

  async apply(event: IDomainEvent, context: ProjectionContext): Promise<void> {
    const payload = payloadAsObject(event.payload);
    const id = String(payload.id ?? event.aggregateId);
    await upsertProjectionRow(
      "projectionParties",
      {
        id,
        aggregateId: event.aggregateId,
        payload: event.payload,
        globalSequence: context.globalSequence,
        updatedAt: now(),
      },
      context.dryRun,
    );
  }
}

export class InventoryProjectionHandler implements IProjectionHandler {
  readonly projectionName = ProjectionNames.INVENTORY;
  readonly supportedEventTypes = ITEM_EVENTS;

  async apply(event: IDomainEvent, context: ProjectionContext): Promise<void> {
    const payload = payloadAsObject(event.payload);
    const itemId = String(payload.id ?? event.aggregateId);
    await upsertProjectionRow(
      "projectionInventory",
      {
        id: itemId,
        itemId,
        payload: event.payload,
        globalSequence: context.globalSequence,
        updatedAt: now(),
      },
      context.dryRun,
    );
  }
}

export class AccountBalanceProjectionHandler implements IProjectionHandler {
  readonly projectionName = ProjectionNames.ACCOUNT_BALANCE;
  readonly supportedEventTypes = VOUCHER_EVENTS;

  async apply(event: IDomainEvent, context: ProjectionContext): Promise<void> {
    const payload = payloadAsObject(event.payload);
    const lines = (payload.lines as Array<Record<string, unknown>>) || [];
    const factor = event.eventType === EventTypes.VOUCHER_CANCELLED ? -1 : 1;
    for (const line of lines) {
      const accountId = String(line.accountId ?? "");
      if (!accountId) continue;
      const debit = Number(line.debit ?? 0);
      const credit = Number(line.credit ?? 0);
      const existing = await readBalance(accountId);
      await upsertProjectionRow(
        "projectionAccountBalances",
        {
          id: accountId,
          accountId,
          debit: (existing?.debit ?? 0) + debit * factor,
          credit: (existing?.credit ?? 0) + credit * factor,
          balance: (existing?.balance ?? 0) + (debit - credit) * factor,
          globalSequence: context.globalSequence,
          updatedAt: now(),
        },
        context.dryRun,
      );
    }
  }
}

export class GeneralLedgerProjectionHandler implements IProjectionHandler {
  readonly projectionName = ProjectionNames.GENERAL_LEDGER;
  readonly supportedEventTypes = VOUCHER_EVENTS;

  async apply(event: IDomainEvent, context: ProjectionContext): Promise<void> {
    const payload = payloadAsObject(event.payload);
    const voucherId = String(payload.id ?? event.aggregateId);
    const date = String(payload.date ?? event.occurredAt.slice(0, 10));
    const lines = (payload.lines as Array<Record<string, unknown>>) || [];
    for (let index = 0; index < lines.length; index++) {
      const line = lines[index];
      const accountId = String(line.accountId ?? "");
      if (!accountId) continue;
      const debit = Number(line.debit ?? 0);
      const credit = Number(line.credit ?? 0);
      const balanceRow = await readBalance(accountId);
      await upsertProjectionRow(
        "projectionGeneralLedger",
        {
          id: `${voucherId}:${accountId}:${index}`,
          accountId,
          voucherId,
          date,
          debit,
          credit,
          balance: balanceRow?.balance ?? debit - credit,
          globalSequence: context.globalSequence,
        },
        context.dryRun,
      );
    }
  }
}

export class TrialBalanceProjectionHandler implements IProjectionHandler {
  readonly projectionName = ProjectionNames.TRIAL_BALANCE;
  readonly supportedEventTypes = VOUCHER_EVENTS;

  async apply(_event: IDomainEvent, context: ProjectionContext): Promise<void> {
    const balances = await readProjectionRows("projectionAccountBalances");
    for (const row of balances) {
      const debit = Number(row.debit ?? 0);
      const credit = Number(row.credit ?? 0);
      const netDebit = debit > credit ? debit - credit : 0;
      const netCredit = credit > debit ? credit - debit : 0;
      await upsertProjectionRow(
        "projectionTrialBalance",
        {
          id: String(row.accountId),
          accountId: String(row.accountId),
          accountName: String(row.accountId),
          debit: netDebit,
          credit: netCredit,
          snapshotSequence: context.globalSequence,
          updatedAt: now(),
        },
        context.dryRun,
      );
    }
  }
}

export class StockLedgerProjectionHandler implements IProjectionHandler {
  readonly projectionName = ProjectionNames.STOCK_LEDGER;
  readonly supportedEventTypes = [EventTypes.INVOICE_POSTED, EventTypes.INVOICE_UPDATED];

  async apply(event: IDomainEvent, context: ProjectionContext): Promise<void> {
    const payload = payloadAsObject(event.payload);
    const lines = (payload.lines as Array<Record<string, unknown>>) || [];
    const date = String(payload.date ?? event.occurredAt.slice(0, 10));
    for (let index = 0; index < lines.length; index++) {
      const line = lines[index];
      const itemId = String(line.itemId ?? "");
      if (!itemId) continue;
      const qty = Number(line.qty ?? line.quantity ?? 0);
      const isSales = String(payload.invoiceType ?? payload.type ?? "").includes("sales");
      await upsertProjectionRow(
        "projectionStockLedger",
        {
          id: `${event.eventId}:${itemId}:${index}`,
          itemId,
          date,
          inQty: isSales ? 0 : qty,
          outQty: isSales ? qty : 0,
          balanceQty: 0,
          globalSequence: context.globalSequence,
        },
        context.dryRun,
      );
    }
  }
}

export class StockBalanceProjectionHandler implements IProjectionHandler {
  readonly projectionName = ProjectionNames.STOCK_BALANCE;
  readonly supportedEventTypes = [EventTypes.INVOICE_POSTED, EventTypes.ITEM_UPDATED];

  async apply(event: IDomainEvent, context: ProjectionContext): Promise<void> {
    const payload = payloadAsObject(event.payload);
    if (event.eventType === EventTypes.ITEM_UPDATED) {
      const itemId = String(payload.id ?? event.aggregateId);
      await upsertProjectionRow(
        "projectionStockBalances",
        {
          id: itemId,
          itemId,
          qty: Number(payload.stockQty ?? payload.qty ?? 0),
          value: Number(payload.stockValue ?? 0),
          globalSequence: context.globalSequence,
          updatedAt: now(),
        },
        context.dryRun,
      );
      return;
    }
    const lines = (payload.lines as Array<Record<string, unknown>>) || [];
    for (const line of lines) {
      const itemId = String(line.itemId ?? "");
      if (!itemId) continue;
      const existing = await readProjectionRow("projectionStockBalances", itemId);
      const qty = Number(line.qty ?? line.quantity ?? 0);
      const isSales = String(payload.invoiceType ?? payload.type ?? "").includes("sales");
      const delta = isSales ? -qty : qty;
      await upsertProjectionRow(
        "projectionStockBalances",
        {
          id: itemId,
          itemId,
          qty: Number(existing?.qty ?? 0) + delta,
          value: Number(line.amount ?? 0) + Number(existing?.value ?? 0),
          globalSequence: context.globalSequence,
          updatedAt: now(),
        },
        context.dryRun,
      );
    }
  }
}

export class TaxProjectionHandler implements IProjectionHandler {
  readonly projectionName = ProjectionNames.TAX;
  readonly supportedEventTypes = TAX_EVENTS;

  async apply(event: IDomainEvent, context: ProjectionContext): Promise<void> {
    const payload = payloadAsObject(event.payload);
    const entryId = String(payload.id ?? event.aggregateId);
    await upsertProjectionRow(
      "projectionTax",
      {
        id: entryId,
        entryId,
        payload: event.payload,
        globalSequence: context.globalSequence,
        updatedAt: now(),
      },
      context.dryRun,
    );
  }
}

export class AuditProjectionHandler implements IProjectionHandler {
  readonly projectionName = ProjectionNames.AUDIT;
  readonly supportedEventTypes = AUDIT_EVENTS;

  async apply(event: IDomainEvent, context: ProjectionContext): Promise<void> {
    const payload = payloadAsObject(event.payload);
    const entryId = String(payload.id ?? event.eventId);
    await upsertProjectionRow(
      "projectionAudit",
      {
        id: entryId,
        entryId,
        payload: event.payload,
        globalSequence: context.globalSequence,
        updatedAt: now(),
      },
      context.dryRun,
    );
  }
}

export class NotificationProjectionHandler implements IProjectionHandler {
  readonly projectionName = ProjectionNames.NOTIFICATION;
  readonly supportedEventTypes = NOTIFICATION_EVENTS;

  async apply(event: IDomainEvent, context: ProjectionContext): Promise<void> {
    if (event.eventType === EventTypes.NOTIFICATIONS_CLEARED) return;
    const payload = payloadAsObject(event.payload);
    const notificationId = String(payload.id ?? event.eventId);
    await upsertProjectionRow(
      "projectionNotifications",
      {
        id: notificationId,
        notificationId,
        payload: event.payload,
        globalSequence: context.globalSequence,
        updatedAt: now(),
      },
      context.dryRun,
    );
  }
}

export class CompanyProjectionHandler implements IProjectionHandler {
  readonly projectionName = ProjectionNames.COMPANY;
  readonly supportedEventTypes = [EventTypes.COMPANY_SETTINGS_UPDATED];

  async apply(event: IDomainEvent, context: ProjectionContext): Promise<void> {
    await upsertProjectionRow(
      "projectionCompany",
      {
        id: "company",
        payload: event.payload,
        globalSequence: context.globalSequence,
        updatedAt: now(),
      },
      context.dryRun,
    );
  }
}

export class FiscalYearProjectionHandler implements IProjectionHandler {
  readonly projectionName = ProjectionNames.FISCAL_YEAR;
  readonly supportedEventTypes = [EventTypes.FISCAL_YEAR_CHANGED];

  async apply(event: IDomainEvent, context: ProjectionContext): Promise<void> {
    await upsertProjectionRow(
      "projectionFiscalYear",
      {
        id: "fiscal-year",
        payload: event.payload,
        globalSequence: context.globalSequence,
        updatedAt: now(),
      },
      context.dryRun,
    );
  }
}

export class NumberSeriesProjectionHandler implements IProjectionHandler {
  readonly projectionName = ProjectionNames.NUMBER_SERIES;
  readonly supportedEventTypes = [EventTypes.VOUCHER_POSTED, EventTypes.INVOICE_POSTED];

  async apply(event: IDomainEvent, context: ProjectionContext): Promise<void> {
    const payload = payloadAsObject(event.payload);
    const seriesKey = String(payload.voucherNo ?? payload.invoiceNo ?? event.aggregateType);
    const lastNumber = String(payload.voucherNo ?? payload.invoiceNo ?? "");
    await upsertProjectionRow(
      "projectionNumberSeries",
      {
        id: seriesKey,
        seriesKey,
        lastNumber,
        globalSequence: context.globalSequence,
        updatedAt: now(),
      },
      context.dryRun,
    );
  }
}

export class SyncCursorProjectionHandler implements IProjectionHandler {
  readonly projectionName = ProjectionNames.SYNC_CURSOR;
  readonly supportedEventTypes = [EventTypes.SYNC_RECORD_ENQUEUED];

  async apply(event: IDomainEvent, context: ProjectionContext): Promise<void> {
    const existing = await readProjectionRow("projectionSyncCursor", "sync");
    await upsertProjectionRow(
      "projectionSyncCursor",
      {
        id: "sync",
        lastGlobalSequence: context.globalSequence,
        pendingCount: Number(existing?.pendingCount ?? 0) + 1,
        updatedAt: now(),
      },
      context.dryRun,
    );
  }
}

export const ALL_PROJECTION_HANDLERS: IProjectionHandler[] = [
  new AccountBalanceProjectionHandler(),
  new GeneralLedgerProjectionHandler(),
  new TrialBalanceProjectionHandler(),
  new VoucherProjectionHandler(),
  new InvoiceProjectionHandler(),
  new PartyProjectionHandler(),
  new InventoryProjectionHandler(),
  new StockLedgerProjectionHandler(),
  new StockBalanceProjectionHandler(),
  new TaxProjectionHandler(),
  new AuditProjectionHandler(),
  new NotificationProjectionHandler(),
  new CompanyProjectionHandler(),
  new FiscalYearProjectionHandler(),
  new NumberSeriesProjectionHandler(),
  new SyncCursorProjectionHandler(),
];
