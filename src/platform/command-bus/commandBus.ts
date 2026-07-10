import type {
  ICommandBus,
  ICommandEnvelope,
  ICommandHandler,
  ICommandResult,
  JsonObject,
} from "@fios/kernel";
import { FiosErrorCode } from "@fios/kernel";
import { IdempotencyStore } from "./idempotencyStore";

export class SyncCommandBus implements ICommandBus {
  private readonly handlers = new Map<string, ICommandHandler>();
  private readonly idempotency = new IdempotencyStore();

  registerHandler(handler: ICommandHandler): void {
    if (this.handlers.has(handler.commandType)) {
      throw new Error(`Command handler already registered: ${handler.commandType}`);
    }
    this.handlers.set(handler.commandType, handler);
  }

  async dispatch<TPayload extends JsonObject>(
    envelope: ICommandEnvelope<TPayload>,
  ): Promise<ICommandResult> {
    const cached = this.idempotency.get(envelope.commandId);
    if (cached) {
      return {
        ...cached,
        status: "duplicate",
        correlationId: envelope.correlationId,
      };
    }

    const handler = this.handlers.get(envelope.commandType);
    if (!handler) {
      return {
        status: "rejected",
        errors: [
          {
            code: FiosErrorCode.NOT_FOUND,
            message: `No handler registered for command type: ${envelope.commandType}`,
          },
        ],
        correlationId: envelope.correlationId,
      };
    }

    const result = await handler.handle(envelope);
    if (result.status === "accepted") {
      this.idempotency.set(envelope.commandId, result);
    }
    return result;
  }

  hasHandler(commandType: string): boolean {
    return this.handlers.has(commandType);
  }

  registeredCommandTypes(): string[] {
    return Array.from(this.handlers.keys());
  }

  clearIdempotencyCache(): void {
    this.idempotency.clear();
  }
}
