import type { IDomainEvent, IEventHandler } from "@fios/kernel";
import { isMigrationFlagEnabled } from "@/platform/flags/registry";
import { replayTenant } from "@/platform/event-store/eventReplay";
import { getContextProvider } from "@/platform/context/zustandContextProvider";
import {
  clearShadowAccountingState,
  listShadowJournals,
  listShadowVouchers,
  saveCheckpoint,
} from "./accountingSnapshot";
import { processAccountingDomainEvent } from "./postingEngine";
import { accountingMetrics } from "./accountingMetrics";
import { accountingLogger } from "./accountingLogger";
import { recordPostingDiagnostic } from "./postingDiagnostics";

export interface AccountingReplayOptions {
  fromGlobalSequence?: number;
  dryRun?: boolean;
  clearBeforeReplay?: boolean;
}

export interface AccountingReplayResult {
  eventCount: number;
  fromSequence: number;
  toSequence: number;
  voucherCount: number;
  journalCount: number;
  dryRun: boolean;
}

export async function replayAccountingFromEventStore(
  options: AccountingReplayOptions = {},
): Promise<AccountingReplayResult> {
  if (!isMigrationFlagEnabled("MIGRATION_ACCOUNTING_REPLAY")) {
    return {
      eventCount: 0,
      fromSequence: 0,
      toSequence: 0,
      voucherCount: 0,
      journalCount: 0,
      dryRun: Boolean(options.dryRun),
    };
  }

  const dryRun = Boolean(options.dryRun);
  const fromSequence = options.fromGlobalSequence ?? 1;

  if (options.clearBeforeReplay !== false && !dryRun) {
    clearShadowAccountingState();
  }

  recordPostingDiagnostic({
    stage: "replay-start",
    message: `replay from sequence ${fromSequence} dryRun=${dryRun}`,
    timestamp: new Date().toISOString(),
  });
  accountingMetrics.incrementReplays();

  const tenantId = getContextProvider().getContext().tenantId ?? "local";
  const handler: IEventHandler = {
    eventType: "*",
    async handle(event: IDomainEvent) {
      await processAccountingDomainEvent(event, { dryRun });
    },
  };

  const result = await replayTenant(tenantId, handler, fromSequence);
  accountingLogger.info("accounting-replay-complete", {
    eventCount: result.eventCount,
    dryRun,
  });

  if (!dryRun) {
    saveCheckpoint({
      checkpointId: crypto.randomUUID(),
      globalSequence: result.toSequence,
      voucherCount: listShadowVouchers().length,
      journalCount: listShadowJournals().length,
      createdAt: new Date().toISOString(),
    });
  }

  recordPostingDiagnostic({
    stage: "replay-complete",
    message: `replayed ${result.eventCount} events`,
    timestamp: new Date().toISOString(),
  });

  return {
    eventCount: result.eventCount,
    fromSequence: result.fromSequence,
    toSequence: result.toSequence,
    voucherCount: listShadowVouchers().length,
    journalCount: listShadowJournals().length,
    dryRun,
  };
}

export async function dryRunReplay(fromGlobalSequence = 1): Promise<AccountingReplayResult> {
  return replayAccountingFromEventStore({
    fromGlobalSequence,
    dryRun: true,
    clearBeforeReplay: false,
  });
}

export async function rebuildFromCheckpoint(
  checkpointId: string,
  fromGlobalSequence: number,
): Promise<AccountingReplayResult> {
  clearShadowAccountingState();
  return replayAccountingFromEventStore({
    fromGlobalSequence,
    dryRun: false,
    clearBeforeReplay: false,
  });
}
