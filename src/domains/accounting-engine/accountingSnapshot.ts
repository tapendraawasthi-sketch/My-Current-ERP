import type {
  AccountingAggregate,
  AccountingCheckpoint,
  ShadowAccountingEvent,
  ShadowJournalEntry,
  VoucherAggregate,
} from "./accountingAggregate";

const aggregates = new Map<string, AccountingAggregate>();
const vouchers = new Map<string, VoucherAggregate>();
const journals: ShadowJournalEntry[] = [];
const shadowEvents: ShadowAccountingEvent[] = [];
const checkpoints: AccountingCheckpoint[] = [];
const processedEventIds = new Set<string>();
let eventVersion = 0;

export function getAccountingAggregate(accountId: string): AccountingAggregate | null {
  return aggregates.get(accountId) ?? null;
}

export function listAccountingAggregates(): AccountingAggregate[] {
  return Array.from(aggregates.values());
}

export function getShadowVoucher(voucherId: string): VoucherAggregate | null {
  return vouchers.get(voucherId) ?? null;
}

export function listShadowVouchers(): VoucherAggregate[] {
  return Array.from(vouchers.values());
}

export function listShadowJournals(): ShadowJournalEntry[] {
  return [...journals];
}

export function listShadowAccountingEvents(): ShadowAccountingEvent[] {
  return [...shadowEvents];
}

export function listCheckpoints(): AccountingCheckpoint[] {
  return [...checkpoints];
}

export function hasProcessedEvent(eventId: string): boolean {
  return processedEventIds.has(eventId);
}

export function markEventProcessed(eventId: string): void {
  processedEventIds.add(eventId);
}

export function nextJournalSequence(): number {
  return journals.length + 1;
}

export function nextEventVersion(): number {
  eventVersion += 1;
  return eventVersion;
}

export function upsertVoucher(voucher: VoucherAggregate): void {
  vouchers.set(voucher.id, voucher);
}

export function appendJournal(entry: ShadowJournalEntry): void {
  journals.push(entry);
  for (const line of entry.lines) {
    const existing = aggregates.get(line.accountId);
    const debitTotal = (existing?.debitTotal ?? 0) + line.debit;
    const creditTotal = (existing?.creditTotal ?? 0) + line.credit;
    aggregates.set(line.accountId, {
      accountId: line.accountId,
      debitTotal,
      creditTotal,
      balance: debitTotal - creditTotal,
      version: (existing?.version ?? 0) + 1,
      lastPostingSequence: entry.sequence,
    });
  }
}

export function appendShadowAccountingEvent(event: ShadowAccountingEvent): void {
  shadowEvents.push(event);
}

export function saveCheckpoint(checkpoint: AccountingCheckpoint): void {
  checkpoints.push(checkpoint);
}

export function getLatestCheckpoint(): AccountingCheckpoint | null {
  return checkpoints.length > 0 ? checkpoints[checkpoints.length - 1] : null;
}

export function clearShadowAccountingState(): void {
  aggregates.clear();
  vouchers.clear();
  journals.length = 0;
  shadowEvents.length = 0;
  processedEventIds.clear();
  eventVersion = 0;
}

export function restoreFromCheckpoint(checkpointId: string): boolean {
  const index = checkpoints.findIndex((c) => c.checkpointId === checkpointId);
  if (index < 0) return false;
  clearShadowAccountingState();
  checkpoints.splice(0, index);
  return true;
}
