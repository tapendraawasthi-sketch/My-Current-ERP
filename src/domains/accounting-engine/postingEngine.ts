import type { IDomainEvent } from "@fios/kernel";
import { EventTypes } from "@/platform/event-bus/eventTypes";
import { executeInvoicePostingSaga } from "./invoicePostingSaga";
import { executeVoucherPostingSaga } from "./voucherPostingSaga";
import { runInShadowBoundary } from "./transactionBoundaryManager";
import { accountingMetrics } from "./accountingMetrics";
import { accountingLogger } from "./accountingLogger";
import { recordPostingDiagnostic } from "./postingDiagnostics";
import { runAccountingIntegrityChecks } from "./accountingIntegrityChecker";
import { AccountingPolicies } from "./accountingPolicies";

function payloadAsObject(payload: unknown): Record<string, unknown> {
  if (payload && typeof payload === "object") return payload as Record<string, unknown>;
  return {};
}

const ACCOUNTING_EVENT_TYPES = new Set([
  EventTypes.VOUCHER_POSTED,
  EventTypes.VOUCHER_UPDATED,
  EventTypes.INVOICE_POSTED,
  EventTypes.INVOICE_UPDATED,
  EventTypes.TDS_ENTRY_ADDED,
  EventTypes.TDS_ENTRY_UPDATED,
]);

export function isAccountingDomainEvent(eventType: string): boolean {
  return ACCOUNTING_EVENT_TYPES.has(eventType as never);
}

export async function processAccountingDomainEvent(
  event: IDomainEvent,
  options: { dryRun?: boolean } = {},
): Promise<void> {
  if (!AccountingPolicies.shadowModeOnly) return;
  if (!isAccountingDomainEvent(event.eventType)) return;

  accountingMetrics.incrementEventsProcessed();
  accountingLogger.debug("accounting-event-received", {
    eventType: event.eventType,
    eventId: event.eventId,
  });
  recordPostingDiagnostic({
    stage: "event-received",
    eventId: event.eventId,
    eventType: event.eventType,
    timestamp: new Date().toISOString(),
  });

  try {
    const payload = payloadAsObject(event.payload);

    await runInShadowBoundary(async () => {
      if (
        event.eventType === EventTypes.INVOICE_POSTED ||
        event.eventType === EventTypes.INVOICE_UPDATED
      ) {
        await executeInvoicePostingSaga({
          sourceEventId: event.eventId,
          sourceEventType: event.eventType,
          invoice: payload,
          dryRun: options.dryRun,
        });
      } else if (
        event.eventType === EventTypes.VOUCHER_POSTED ||
        event.eventType === EventTypes.VOUCHER_UPDATED
      ) {
        await executeVoucherPostingSaga({
          sourceEventId: event.eventId,
          sourceEventType: event.eventType,
          voucher: payload,
          dryRun: options.dryRun,
        });
      }
    });

    const issues = runAccountingIntegrityChecks();
    if (issues.length > 0) {
      accountingMetrics.incrementIntegrityFailures(issues.length);
    }
  } catch (error) {
    accountingMetrics.incrementErrors();
    recordPostingDiagnostic({
      stage: "error",
      eventId: event.eventId,
      eventType: event.eventType,
      message: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    });
    accountingLogger.error("accounting-event-error", { eventId: event.eventId, error });
  }
}
