import type { JournalLine } from "./accountingAggregate";
import type { VoucherAggregate } from "./accountingAggregate";

export interface LedgerEntry {
  date: string;
  voucherId: string;
  voucherNo: string;
  voucherType: string;
  accountId: string;
  accountName?: string;
  debit: number;
  credit: number;
  balance: number;
}

export function buildLedgerEntries(vouchers: VoucherAggregate[]): LedgerEntry[] {
  const entries: LedgerEntry[] = [];
  const balances = new Map<string, number>();

  const sorted = [...vouchers].sort((a, b) => a.date.localeCompare(b.date));
  for (const voucher of sorted) {
    if (voucher.status !== "posted") continue;
    for (const line of voucher.lines) {
      const prev = balances.get(line.accountId) ?? 0;
      const next = prev + line.debit - line.credit;
      balances.set(line.accountId, next);
      entries.push({
        date: voucher.date,
        voucherId: voucher.id,
        voucherNo: voucher.voucherNo,
        voucherType: voucher.type,
        accountId: line.accountId,
        accountName: line.accountName,
        debit: line.debit,
        credit: line.credit,
        balance: next,
      });
    }
  }
  return entries;
}

export function buildAccountLedger(accountId: string, vouchers: VoucherAggregate[]): LedgerEntry[] {
  return buildLedgerEntries(vouchers).filter((e) => e.accountId === accountId);
}

export function sumLines(lines: JournalLine[]): { debit: number; credit: number } {
  return {
    debit: lines.reduce((s, l) => s + l.debit, 0),
    credit: lines.reduce((s, l) => s + l.credit, 0),
  };
}
