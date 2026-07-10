import { isMigrationFlagEnabled } from "@/platform/flags/registry";
import { aiLogger } from "./aiLogger";
import { getAiRuntime } from "./aiRuntime";
import { getToolRouter } from "./tool-router/toolRouter";
import { getMemoryStore } from "./memory";
import { getPromptRegistry } from "./prompt-builder/promptRegistry";
import { getExtensionRegistry } from "./extensionRegistry";

let bootstrapComplete = false;
let eventUnsubscribe: (() => void) | null = null;

function subscribeToDomainEvents(): void {
  void import("@/platform/event-bus/bootstrap").then(({ getEventBus }) => {
    eventUnsubscribe = getEventBus().subscribe({
      eventType: "*",
      async handle(event: import("@fios/kernel").IDomainEvent) {
        const memory = getMemoryStore();
        memory.working.set(`last-event:${event.eventType}`, {
          eventId: event.eventId,
          aggregateType: event.aggregateType,
          timestamp: event.occurredAt,
        });
      },
    });
  });
}

export function bootstrapAiRuntime(): void {
  if (!isMigrationFlagEnabled("MIGRATION_AI_RUNTIME")) return;
  if (bootstrapComplete) return;

  aiLogger.info("ai-runtime-bootstrap");

  getToolRouter();
  getMemoryStore();
  getPromptRegistry();
  getExtensionRegistry();
  getAiRuntime();

  if (isMigrationFlagEnabled("MIGRATION_EVENT_BUS")) {
    subscribeToDomainEvents();
  }

  bootstrapComplete = true;
  aiLogger.info("ai-runtime-ready");
}

export function shutdownAiRuntime(): void {
  if (eventUnsubscribe) {
    eventUnsubscribe();
    eventUnsubscribe = null;
  }
  bootstrapComplete = false;
  aiLogger.info("ai-runtime-shutdown");
}

export function isAiRuntimeBootstrapped(): boolean {
  return bootstrapComplete && isMigrationFlagEnabled("MIGRATION_AI_RUNTIME");
}
