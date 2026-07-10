import type { ICommandBus, ICommandEnvelope, JsonObject } from "@fios/kernel";
import { isMigrationFlagEnabled } from "@/platform/flags/registry";
import { publishEventsForCommand } from "@/platform/event-bus/publishFromCommand";
import { runInCommandBusContextAsync } from "@/store/commandBusContext";
import { SyncCommandBus } from "./commandBus";
import { registerLegacyCommandHandlers } from "./handlers/legacyHandlers";

let commandBusInstance: SyncCommandBus | null = null;

export function getCommandBus(): ICommandBus {
  if (!commandBusInstance) {
    commandBusInstance = new SyncCommandBus();
    registerLegacyCommandHandlers(commandBusInstance);
  }
  return commandBusInstance;
}

export function resetCommandBus(): void {
  commandBusInstance = null;
}

export interface ExecuteCommandOptions {
  commandType: string;
  aggregateType: string;
  aggregateId?: string;
  payload: JsonObject;
  commandId?: string;
  correlationId?: string;
  causationId?: string;
}

function createEnvelope(options: ExecuteCommandOptions): ICommandEnvelope {
  return {
    commandId: options.commandId ?? crypto.randomUUID(),
    commandType: options.commandType,
    commandVersion: 1,
    aggregateType: options.aggregateType,
    aggregateId: options.aggregateId,
    payload: options.payload,
    correlationId: options.correlationId ?? crypto.randomUUID(),
    causationId: options.causationId,
    issuedAt: new Date().toISOString(),
  };
}

export async function executeCommand<T = unknown>(options: ExecuteCommandOptions): Promise<T> {
  if (!isMigrationFlagEnabled("MIGRATION_COMMAND_BUS")) {
    throw new Error("MIGRATION_COMMAND_BUS is disabled");
  }
  const bus = getCommandBus();
  const envelope = createEnvelope(options);
  const result = await runInCommandBusContextAsync(() => bus.dispatch(envelope));
  if (result.status === "rejected") {
    const message =
      result.errors.map((error) => error.message).join("; ") || "Command rejected";
    throw new Error(message);
  }
  if (result.status === "accepted" && isMigrationFlagEnabled("MIGRATION_EVENT_BUS")) {
    await publishEventsForCommand(envelope, result);
  }
  return result.data as T;
}

export async function executeCommandVoid(options: ExecuteCommandOptions): Promise<void> {
  await executeCommand(options);
}
