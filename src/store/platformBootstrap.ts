import { getEventBus } from "@/platform/event-bus/bootstrap";
import { getCommandBus } from "@/platform/command-bus/dispatch";
import { getQueryBus } from "@/platform/query-bus/bootstrap";
import { bootstrapAiRuntime } from "@/platform/ai-runtime/bootstrap";
import { isMigrationFlagEnabled } from "@/platform/flags/registry";

let bootstrapped = false;

export function bootstrapPlatformRuntime(): void {
  if (bootstrapped) return;
  if (!isMigrationFlagEnabled("MIGRATION_EVENT_BUS")) return;

  getEventBus();
  if (isMigrationFlagEnabled("MIGRATION_COMMAND_BUS")) {
    getCommandBus();
  }
  if (isMigrationFlagEnabled("MIGRATION_QUERY_BUS")) {
    getQueryBus();
  }

  bootstrapAiRuntime();

  bootstrapped = true;
}
