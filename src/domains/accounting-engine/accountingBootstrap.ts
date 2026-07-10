import type { IDomainEvent, IEventHandler } from "@fios/kernel";
import { isMigrationFlagEnabled } from "@/platform/flags/registry";
import { processAccountingDomainEvent } from "./postingEngine";
import { runAccountingParityValidation } from "./accountingParity";
import { accountingLogger } from "./accountingLogger";

let bootstrapComplete = false;
let parityInterval: ReturnType<typeof setInterval> | null = null;

export function createAccountingShadowHandler(): IEventHandler {
  return {
    eventType: "*",
    async handle(event: IDomainEvent) {
      if (!isMigrationFlagEnabled("MIGRATION_ACCOUNTING_ENGINE")) return;
      await processAccountingDomainEvent(event);
    },
  };
}

export function bootstrapAccountingEngine(): void {
  if (!isMigrationFlagEnabled("MIGRATION_ACCOUNTING_ENGINE")) return;
  if (bootstrapComplete) return;

  accountingLogger.info("accounting-engine-bootstrap");
  bootstrapComplete = true;

  if (isMigrationFlagEnabled("MIGRATION_ACCOUNTING_PARITY")) {
    parityInterval = setInterval(() => {
      runAccountingParityValidation();
    }, 300_000);
  }
}

export function shutdownAccountingEngine(): void {
  if (parityInterval) {
    clearInterval(parityInterval);
    parityInterval = null;
  }
  bootstrapComplete = false;
}

export function isAccountingEngineBootstrapped(): boolean {
  return bootstrapComplete;
}
