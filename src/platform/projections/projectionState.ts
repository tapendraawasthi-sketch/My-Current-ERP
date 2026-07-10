import type { EntityId, JsonObject } from "@fios/kernel";

export const PROJECTION_ENGINE_VERSION = 1;
export const GLOBAL_PROJECTION_CURSOR_ID = "global";

export const ProjectionNames = {
  ACCOUNT_BALANCE: "AccountBalanceProjection",
  GENERAL_LEDGER: "GeneralLedgerProjection",
  TRIAL_BALANCE: "TrialBalanceProjection",
  VOUCHER: "VoucherProjection",
  INVOICE: "InvoiceProjection",
  PARTY: "PartyProjection",
  INVENTORY: "InventoryProjection",
  STOCK_LEDGER: "StockLedgerProjection",
  STOCK_BALANCE: "StockBalanceProjection",
  TAX: "TaxProjection",
  AUDIT: "AuditProjection",
  NOTIFICATION: "NotificationProjection",
  COMPANY: "CompanyProjection",
  FISCAL_YEAR: "FiscalYearProjection",
  NUMBER_SERIES: "NumberSeriesProjection",
  SYNC_CURSOR: "SyncCursorProjection",
} as const;

export type ProjectionName = (typeof ProjectionNames)[keyof typeof ProjectionNames];

export const ALL_PROJECTION_NAMES: ProjectionName[] = Object.values(ProjectionNames);

export type ProjectionStatus = "idle" | "running" | "rebuilding" | "error" | "ready";

export interface DBProjectionMeta {
  id: string;
  projectionName: ProjectionName;
  version: number;
  status: ProjectionStatus;
  lastGlobalSequence: number;
  errorMessage?: string;
  updatedAt: string;
}

export interface DBProjectionCheckpoint {
  id: string;
  projectionName: ProjectionName;
  globalSequence: number;
  aggregateType?: string;
  aggregateId?: EntityId;
  updatedAt: string;
}

export interface DBProjectionGlobalCursor {
  id: string;
  lastGlobalSequence: number;
  projectionVersion: number;
  status: ProjectionStatus;
  updatedAt: string;
}

export interface DBProjectionAccountBalance {
  id: string;
  accountId: string;
  balance: number;
  debit: number;
  credit: number;
  globalSequence: number;
  updatedAt: string;
}

export interface DBProjectionGeneralLedger {
  id: string;
  accountId: string;
  voucherId: string;
  date: string;
  debit: number;
  credit: number;
  balance: number;
  globalSequence: number;
}

export interface DBProjectionTrialBalance {
  id: string;
  accountId: string;
  accountName: string;
  debit: number;
  credit: number;
  snapshotSequence: number;
  updatedAt: string;
}

export interface DBProjectionDocument {
  id: string;
  aggregateId: string;
  payload: JsonObject;
  globalSequence: number;
  updatedAt: string;
}

export interface DBProjectionStockLedger {
  id: string;
  itemId: string;
  date: string;
  inQty: number;
  outQty: number;
  balanceQty: number;
  globalSequence: number;
}

export interface DBProjectionStockBalance {
  id: string;
  itemId: string;
  qty: number;
  value: number;
  globalSequence: number;
  updatedAt: string;
}

export interface DBProjectionTax {
  id: string;
  entryId: string;
  payload: JsonObject;
  globalSequence: number;
  updatedAt: string;
}

export interface DBProjectionAudit {
  id: string;
  entryId: string;
  payload: JsonObject;
  globalSequence: number;
  updatedAt: string;
}

export interface DBProjectionNotification {
  id: string;
  notificationId: string;
  payload: JsonObject;
  globalSequence: number;
  updatedAt: string;
}

export interface DBProjectionCompany {
  id: string;
  payload: JsonObject;
  globalSequence: number;
  updatedAt: string;
}

export interface DBProjectionFiscalYear {
  id: string;
  payload: JsonObject;
  globalSequence: number;
  updatedAt: string;
}

export interface DBProjectionNumberSeries {
  id: string;
  seriesKey: string;
  lastNumber: string;
  globalSequence: number;
  updatedAt: string;
}

export interface DBProjectionSyncCursor {
  id: string;
  lastGlobalSequence: number;
  pendingCount: number;
  updatedAt: string;
}

export interface DBProjectionParityResult {
  id: string;
  projectionName: ProjectionName;
  metric: string;
  legacyValue: number;
  projectionValue: number;
  diff: number;
  withinTolerance: boolean;
  recordedAt: string;
  details?: JsonObject;
}
