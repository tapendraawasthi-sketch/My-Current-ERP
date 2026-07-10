import type { JournalLine, VoucherAggregate } from "./accountingAggregate";
import { sumLines } from "./ledgerBuilder";

export function createVoucherAggregate(input: {
  id: string;
  voucherNo: string;
  type: string;
  date: string;
  lines: JournalLine[];
  partyId?: string;
  referenceId?: string;
  status?: VoucherAggregate["status"];
}): VoucherAggregate {
  const totals = sumLines(input.lines);
  return {
    id: input.id,
    voucherNo: input.voucherNo,
    type: input.type,
    date: input.date,
    status: input.status ?? "posted",
    lines: input.lines,
    partyId: input.partyId,
    referenceId: input.referenceId,
    totalDebit: totals.debit,
    totalCredit: totals.credit,
    version: 1,
    postedAt: new Date().toISOString(),
  };
}

export function isPosted(voucher: VoucherAggregate): boolean {
  return voucher.status === "posted";
}
