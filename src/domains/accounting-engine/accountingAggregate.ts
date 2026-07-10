import type { EntityId } from "@fios/kernel";

export const AccountingEventTypes = {
  JOURNAL_POSTED: "JournalPosted",
  VOUCHER_POSTED: "VoucherPosted",
  POSTING_VALIDATED: "PostingValidated",
  POSTING_REJECTED: "PostingRejected",
  PERIOD_LOCK_VIOLATION: "PeriodLockViolation",
  DOUBLE_ENTRY_VIOLATION: "DoubleEntryViolation",
  TAX_POSTED: "TaxPosted",
  POSTING_REVERSED: "PostingReversed",
} as const;

export type AccountingEventType = (typeof AccountingEventTypes)[keyof typeof AccountingEventTypes];

export interface JournalLine {
  accountId: EntityId;
  accountName?: string;
  debit: number;
  credit: number;
  narration?: string;
  costCenterId?: EntityId;
}

export interface AccountingAggregate {
  accountId: EntityId;
  debitTotal: number;
  creditTotal: number;
  balance: number;
  version: number;
  lastPostingSequence: number;
}

export interface VoucherAggregate {
  id: EntityId;
  voucherNo: string;
  type: string;
  date: string;
  status: "draft" | "posted" | "cancelled";
  lines: JournalLine[];
  partyId?: EntityId;
  referenceId?: EntityId;
  totalDebit: number;
  totalCredit: number;
  version: number;
  postedAt?: string;
}

export interface ShadowJournalEntry {
  id: EntityId;
  sequence: number;
  voucherId: EntityId;
  voucherNo: string;
  voucherType: string;
  date: string;
  lines: JournalLine[];
  sourceEventId: EntityId;
  sourceEventType: string;
  createdAt: string;
}

export interface ShadowAccountingEvent {
  eventId: EntityId;
  eventType: AccountingEventType;
  aggregateId: EntityId;
  payload: Record<string, unknown>;
  occurredAt: string;
  version: number;
}

export interface AccountingCheckpoint {
  checkpointId: EntityId;
  globalSequence: number;
  voucherCount: number;
  journalCount: number;
  createdAt: string;
}
