import type { IDomainEvent, IEventHandler } from "@fios/kernel";
import { isMigrationFlagEnabled } from "@/platform/flags/registry";
import { processInventoryDomainEvent } from "./inventoryService";
import { runInventoryParityValidation } from "./inventoryParity";
import { inventoryLogger } from "./inventoryLogger";

let bootstrapComplete = false;
let parityInterval: ReturnType<typeof setInterval> | null = null;

export function createInventoryShadowHandler(): IEventHandler {
  return {
    eventType: "*",
    async handle(event: IDomainEvent) {
      if (!isMigrationFlagEnabled("MIGRATION_INVENTORY_ENGINE")) return;
      processInventoryDomainEvent(event);
    },
  };
}

export function bootstrapInventoryEngine(): void {
  if (!isMigrationFlagEnabled("MIGRATION_INVENTORY_ENGINE")) return;
  if (bootstrapComplete) return;

  inventoryLogger.info("inventory-engine-bootstrap");
  bootstrapComplete = true;

  if (isMigrationFlagEnabled("MIGRATION_INVENTORY_PARITY")) {
    parityInterval = setInterval(() => {
      runInventoryParityValidation().catch((error) => {
        inventoryLogger.error("inventory-parity-scheduled-error", {
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }, 300_000);
  }
}

export function shutdownInventoryEngine(): void {
  if (parityInterval) {
    clearInterval(parityInterval);
    parityInterval = null;
  }
  bootstrapComplete = false;
}

export function isInventoryEngineBootstrapped(): boolean {
  return bootstrapComplete;
}
