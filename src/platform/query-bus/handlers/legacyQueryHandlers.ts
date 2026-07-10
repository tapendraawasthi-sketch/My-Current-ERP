import type { IQuery, IQueryHandler, IQueryResult, JsonObject } from "@fios/kernel";
import type { IQueryBus } from "@fios/kernel";
import { FiosErrorCode } from "@fios/kernel";
import {
  createLegacyStateReader,
  createNumberingService,
  readLegacyState,
} from "@fios/legacy";
import { generateSerialNumber, generateNextNumber } from "@/lib/accounting";
import { getPendingSyncCount } from "@/lib/syncEngine";
import { QueryTypes } from "../queryTypes";
import {
  buildDayBookEntries,
  buildLedgerRows,
  readBalanceSheet,
  readInventoryValuation,
  readLedgerBalance,
  readProfitLoss,
  readStockSummary,
  readTaxSummary,
  readTrialBalance,
  resolveValuationMethod,
} from "./legacyReadAdapters";

const state = createLegacyStateReader();
const numbering = createNumberingService();

function ok<T>(data: T): IQueryResult<T> {
  return { status: "ok", data, correlationId: "" };
}

function notFound(message: string): IQueryResult {
  return {
    status: "not_found",
    errors: [{ code: FiosErrorCode.NOT_FOUND, message }],
    correlationId: "",
  };
}

function createHandler(
  queryType: string,
  handleFn: (query: IQuery) => Promise<IQueryResult> | IQueryResult,
): IQueryHandler & { handleSync(query: IQuery): IQueryResult } {
  return {
    queryType,
    async handle(query) {
      const result = await handleFn(query);
      return { ...result, correlationId: query.correlationId };
    },
    handleSync(query) {
      const result = handleFn(query);
      if (result instanceof Promise) {
        throw new Error(`Query ${queryType} is async — use executeQuery()`);
      }
      return { ...result, correlationId: query.correlationId };
    },
  };
}

function rangeFromPayload(payload: JsonObject): DateRangeQuery {
  return {
    fromDate: typeof payload.fromDate === "string" ? payload.fromDate : undefined,
    toDate: typeof payload.toDate === "string" ? payload.toDate : undefined,
  };
}

const handlers: IQueryHandler[] = [
  createHandler(QueryTypes.GET_VOUCHER, (query) => {
    const id = String(query.payload.id ?? "");
    const voucher =
      state.getVouchers().find((v) => (v as { id?: string }).id === id) ?? null;
    return voucher ? ok(voucher) : notFound(`Voucher not found: ${id}`);
  }),

  createHandler(QueryTypes.LIST_VOUCHERS, () => ok(state.getVouchers())),

  createHandler(QueryTypes.GET_INVOICE, (query) => {
    const id = String(query.payload.id ?? "");
    const invoice =
      state.getInvoices().find((inv) => (inv as { id?: string }).id === id) ?? null;
    return invoice ? ok(invoice) : notFound(`Invoice not found: ${id}`);
  }),

  createHandler(QueryTypes.LIST_INVOICES, () => ok(state.getInvoices())),

  createHandler(QueryTypes.GET_ACCOUNT, (query) => {
    const id = String(query.payload.id ?? "");
    const account =
      state.getAccounts().find((a) => (a as { id?: string }).id === id) ?? null;
    return account ? ok(account) : notFound(`Account not found: ${id}`);
  }),

  createHandler(QueryTypes.LIST_ACCOUNTS, () => ok(state.getAccounts())),

  createHandler(QueryTypes.GET_PARTY, (query) => {
    const id = String(query.payload.id ?? "");
    const party = state.getParties().find((p) => (p as { id?: string }).id === id) ?? null;
    return party ? ok(party) : notFound(`Party not found: ${id}`);
  }),

  createHandler(QueryTypes.LIST_PARTIES, () => ok(state.getParties())),

  createHandler(QueryTypes.GET_ITEM, (query) => {
    const id = String(query.payload.id ?? "");
    const item = state.getItems().find((i) => (i as { id?: string }).id === id) ?? null;
    return item ? ok(item) : notFound(`Item not found: ${id}`);
  }),

  createHandler(QueryTypes.LIST_ITEMS, () => ok(state.getItems())),

  createHandler(QueryTypes.TRIAL_BALANCE, (query) =>
    ok(readTrialBalance(rangeFromPayload(query.payload))),
  ),

  createHandler(QueryTypes.LEDGER, (query) => {
    const accountId = String(query.payload.accountId ?? "");
    if (!accountId) {
      return {
        status: "rejected",
        errors: [{ code: FiosErrorCode.VALIDATION_FAILED, message: "accountId is required" }],
        correlationId: "",
      };
    }
    const range = rangeFromPayload(query.payload);
    const detail = buildLedgerRows(accountId, range);
    if (!detail.account) return notFound(`Account not found: ${accountId}`);
    return ok({
      ...detail,
      balance: readLedgerBalance(accountId, range),
    });
  }),

  createHandler(QueryTypes.PROFIT_LOSS, (query) =>
    ok(readProfitLoss(rangeFromPayload(query.payload))),
  ),

  createHandler(QueryTypes.BALANCE_SHEET, (query) => {
    const asOfDate =
      typeof query.payload.asOfDate === "string" ? query.payload.asOfDate : undefined;
    return ok(readBalanceSheet(asOfDate));
  }),

  createHandler(QueryTypes.CASH_BOOK, (query) => {
    const accountId = String(query.payload.accountId ?? "");
    if (!accountId) {
      return {
        status: "rejected",
        errors: [{ code: FiosErrorCode.VALIDATION_FAILED, message: "accountId is required" }],
        correlationId: "",
      };
    }
    const range = rangeFromPayload(query.payload);
    const detail = buildLedgerRows(accountId, range);
    if (!detail.account) return notFound(`Account not found: ${accountId}`);
    return ok(detail);
  }),

  createHandler(QueryTypes.DAY_BOOK, (query) =>
    ok({ entries: buildDayBookEntries(rangeFromPayload(query.payload)) }),
  ),

  createHandler(QueryTypes.STOCK_LEDGER, (query) => {
    const itemId = String(query.payload.itemId ?? "");
    if (!itemId) {
      return {
        status: "rejected",
        errors: [{ code: FiosErrorCode.VALIDATION_FAILED, message: "itemId is required" }],
        correlationId: "",
      };
    }
    const method = resolveValuationMethod();
    const fromDate =
      typeof query.payload.fromDate === "string" ? query.payload.fromDate : undefined;
    const toDate = typeof query.payload.toDate === "string" ? query.payload.toDate : undefined;
    const summaries = readStockSummary(method, fromDate, toDate, itemId);
    const summary = summaries[0] ?? null;
    return summary ? ok(summary) : notFound(`Stock ledger not found for item: ${itemId}`);
  }),

  createHandler(QueryTypes.STOCK_SUMMARY, (query) => {
    const method = resolveValuationMethod();
    const fromDate =
      typeof query.payload.fromDate === "string" ? query.payload.fromDate : undefined;
    const toDate = typeof query.payload.toDate === "string" ? query.payload.toDate : undefined;
    return ok(readStockSummary(method, fromDate, toDate));
  }),

  createHandler(QueryTypes.INVENTORY_VALUATION, (query) => {
    const method = resolveValuationMethod();
    const asAtDate =
      typeof query.payload.asAtDate === "string" ? query.payload.asAtDate : undefined;
    return ok({ totalValue: readInventoryValuation(method, asAtDate), method, asAtDate });
  }),

  createHandler(QueryTypes.TAX_SUMMARY, () => ok(readTaxSummary())),

  createHandler(QueryTypes.AUDIT_LOG, () => ok(readLegacyState().auditLogs)),

  createHandler(QueryTypes.NOTIFICATIONS, () => ok(readLegacyState().notifications)),

  createHandler(QueryTypes.COMPANY_SETTINGS, () => ok(state.getCompanySettings())),

  createHandler(QueryTypes.FISCAL_YEAR, () => ok(state.getCurrentFiscalYear())),

  createHandler(QueryTypes.NUMBER_SERIES, async (query) => {
    const action = String(query.payload.action ?? "serial");
    const type = String(query.payload.type ?? "journal");
    const seriesId =
      typeof query.payload.seriesId === "string" ? query.payload.seriesId : undefined;
    const fiscalYearBS =
      typeof query.payload.fiscalYearBS === "string" ? query.payload.fiscalYearBS : undefined;
    const preview = Boolean(query.payload.preview);

    switch (action) {
      case "voucher":
        return ok({ number: await numbering.generateNextVoucherNo(type) });
      case "invoice":
        return ok({ number: await numbering.generateNextInvoiceNo(type) });
      case "next":
        return ok({ number: await generateNextNumber(type) });
      case "serial":
      default:
        return ok({
          number: await generateSerialNumber(type, seriesId, fiscalYearBS, preview),
        });
    }
  }),

  createHandler(QueryTypes.SYNC_STATUS, async () =>
    ok({ pendingCount: await getPendingSyncCount() }),
  ),
];

export function registerLegacyQueryHandlers(bus: IQueryBus): void {
  for (const handler of handlers) {
    bus.registerHandler(handler);
  }
}
