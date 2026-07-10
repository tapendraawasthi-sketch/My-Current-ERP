import type { JournalLine, ShadowJournalEntry } from "./accountingAggregate";

export function createJournalEntry(input: {
  voucherId: string;
  voucherNo: string;
  voucherType: string;
  date: string;
  lines: JournalLine[];
  sourceEventId: string;
  sourceEventType: string;
  sequence: number;
}): ShadowJournalEntry {
  return {
    id: `shadow-jnl-${input.sourceEventId}`,
    sequence: input.sequence,
    voucherId: input.voucherId,
    voucherNo: input.voucherNo,
    voucherType: input.voucherType,
    date: input.date,
    lines: input.lines,
    sourceEventId: input.sourceEventId,
    sourceEventType: input.sourceEventType,
    createdAt: new Date().toISOString(),
  };
}

export function mergeJournalLines(...groups: JournalLine[][]): JournalLine[] {
  const merged = new Map<string, JournalLine>();
  for (const group of groups) {
    for (const line of group) {
      const key = `${line.accountId}:${line.narration ?? ""}`;
      const existing = merged.get(key);
      if (existing) {
        existing.debit += line.debit;
        existing.credit += line.credit;
      } else {
        merged.set(key, { ...line });
      }
    }
  }
  return Array.from(merged.values());
}
