import type { JournalLine, ShadowJournalEntry } from "./accountingAggregate";
import { AccountingEventTypes } from "./accountingAggregate";
import {
  appendJournal,
  appendShadowAccountingEvent,
  hasProcessedEvent,
  markEventProcessed,
  nextEventVersion,
  nextJournalSequence,
  upsertVoucher,
} from "./accountingSnapshot";
import { validateJournalLines } from "./doubleEntryValidator";
import { validateDateInFiscalYear } from "./fiscalValidation";
import { checkPeriodLock } from "./periodLockService";
import { allRulesPassed, runPostingRules } from "./postingRulesEngine";
import { createVoucherAggregate } from "./voucherAggregate";
import { AccountingPolicies } from "./accountingPolicies";
import { recordPostingDiagnostic } from "./postingDiagnostics";
import { accountingMetrics } from "./accountingMetrics";

export interface PostingPipelineInput {
  sourceEventId: string;
  sourceEventType: string;
  voucherId: string;
  voucherNo: string;
  voucherType: string;
  date: string;
  lines: JournalLine[];
  partyId?: string;
  referenceId?: string;
  dryRun?: boolean;
}

export interface PostingPipelineResult {
  accepted: boolean;
  journalId?: string;
  errors: string[];
}

function emitAccountingEvent(
  eventType: string,
  aggregateId: string,
  payload: Record<string, unknown>,
  dryRun: boolean,
): void {
  if (dryRun) return;
  appendShadowAccountingEvent({
    eventId: crypto.randomUUID(),
    eventType: eventType as never,
    aggregateId,
    payload,
    occurredAt: new Date().toISOString(),
    version: nextEventVersion(),
  });
}

export async function runPostingPipeline(input: PostingPipelineInput): Promise<PostingPipelineResult> {
  const errors: string[] = [];

  if (hasProcessedEvent(input.sourceEventId) && !input.dryRun) {
    return { accepted: false, errors: ["Duplicate event"] };
  }

  const ruleResults = runPostingRules(input.lines);
  if (!allRulesPassed(ruleResults)) {
    for (const r of ruleResults.filter((x) => !x.passed)) {
      errors.push(r.message ?? r.code);
    }
    emitAccountingEvent(
      AccountingEventTypes.POSTING_REJECTED,
      input.voucherId,
      { errors, sourceEventId: input.sourceEventId },
      Boolean(input.dryRun),
    );
    accountingMetrics.incrementPostingRejections();
    return { accepted: false, errors };
  }

  if (AccountingPolicies.enforceFiscalYear) {
    const fiscalViolation = validateDateInFiscalYear(input.date);
    if (fiscalViolation) errors.push(fiscalViolation.message);
  }

  if (AccountingPolicies.enforcePeriodLock) {
    const lockViolation = await checkPeriodLock(input.date);
    if (lockViolation) errors.push(lockViolation.message);
  }

  if (AccountingPolicies.enforceDoubleEntry) {
    const validation = validateJournalLines(input.lines);
    if (!validation.isValid) {
      errors.push(
        `Double-entry violation: debit=${validation.totalDebit} credit=${validation.totalCredit}`,
      );
      emitAccountingEvent(
        AccountingEventTypes.DOUBLE_ENTRY_VIOLATION,
        input.voucherId,
        { validation, sourceEventId: input.sourceEventId },
        Boolean(input.dryRun),
      );
      accountingMetrics.incrementDoubleEntryViolations();
    }
  }

  if (errors.length > 0) {
    emitAccountingEvent(
      AccountingEventTypes.POSTING_REJECTED,
      input.voucherId,
      { errors, sourceEventId: input.sourceEventId },
      Boolean(input.dryRun),
    );
    accountingMetrics.incrementPostingRejections();
    return { accepted: false, errors };
  }

  if (input.dryRun) {
    emitAccountingEvent(
      AccountingEventTypes.POSTING_VALIDATED,
      input.voucherId,
      { dryRun: true, sourceEventId: input.sourceEventId },
      true,
    );
    return { accepted: true, errors: [] };
  }

  const journalId = `shadow-jnl-${input.sourceEventId}`;
  const entry: ShadowJournalEntry = {
    id: journalId,
    sequence: nextJournalSequence(),
    voucherId: input.voucherId,
    voucherNo: input.voucherNo,
    voucherType: input.voucherType,
    date: input.date,
    lines: input.lines,
    sourceEventId: input.sourceEventId,
    sourceEventType: input.sourceEventType,
    createdAt: new Date().toISOString(),
  };

  const voucher = createVoucherAggregate({
    id: input.voucherId,
    voucherNo: input.voucherNo,
    type: input.voucherType,
    date: input.date,
    lines: input.lines,
    partyId: input.partyId,
    referenceId: input.referenceId,
  });

  appendJournal(entry);
  upsertVoucher(voucher);
  markEventProcessed(input.sourceEventId);

  emitAccountingEvent(AccountingEventTypes.JOURNAL_POSTED, input.voucherId, { journalId, entry }, false);
  emitAccountingEvent(AccountingEventTypes.VOUCHER_POSTED, input.voucherId, { voucher }, false);
  emitAccountingEvent(
    AccountingEventTypes.POSTING_VALIDATED,
    input.voucherId,
    { sourceEventId: input.sourceEventId },
    false,
  );

  recordPostingDiagnostic({
    stage: "applied",
    eventId: input.sourceEventId,
    voucherId: input.voucherId,
    message: `shadow posting applied`,
    timestamp: new Date().toISOString(),
  });
  accountingMetrics.incrementPostingsApplied();

  return { accepted: true, journalId, errors: [] };
}
