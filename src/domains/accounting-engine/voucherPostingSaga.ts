import type { JournalLine } from "./accountingAggregate";
import { buildVoucherJournalLines } from "./journalBuilder";
import { runPostingPipeline, type PostingPipelineResult } from "./postingPipeline";
import { accountingLogger } from "./accountingLogger";

export interface VoucherPostingSagaInput {
  sourceEventId: string;
  sourceEventType: string;
  voucher: Record<string, unknown>;
  dryRun?: boolean;
}

export async function executeVoucherPostingSaga(
  input: VoucherPostingSagaInput,
): Promise<PostingPipelineResult> {
  accountingLogger.debug("voucher-posting-saga-start", { eventId: input.sourceEventId });
  const status = String(input.voucher.status ?? "posted");
  if (status !== "posted") {
    return { accepted: false, errors: [`Voucher status is ${status}, not posted`] };
  }

  const lines: JournalLine[] = buildVoucherJournalLines(input.voucher);
  if (lines.length === 0) {
    return { accepted: false, errors: ["No journal lines in voucher"] };
  }

  const voucherId = String(input.voucher.id ?? input.sourceEventId);
  const voucherNo = String(input.voucher.voucherNo ?? voucherId);
  const voucherType = String(input.voucher.type ?? "journal");
  const date = String(input.voucher.date ?? new Date().toISOString().slice(0, 10));

  return runPostingPipeline({
    sourceEventId: input.sourceEventId,
    sourceEventType: input.sourceEventType,
    voucherId,
    voucherNo,
    voucherType,
    date,
    lines,
    partyId: input.voucher.partyId ? String(input.voucher.partyId) : undefined,
    dryRun: input.dryRun,
  });
}
