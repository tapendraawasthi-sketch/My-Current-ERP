import type { EntityId, JsonObject } from "./types";

/**
 * Command bus contracts — interfaces only (F2 implements runtime).
 * @see SYSTEM-06 §06.11
 */

export interface ICommandEnvelope<TPayload extends JsonObject = JsonObject> {
  commandId: EntityId;
  commandType: string;
  commandVersion: number;
  aggregateType: string;
  aggregateId?: EntityId;
  payload: TPayload;
  correlationId: EntityId;
  causationId?: EntityId;
  issuedAt: string;
}

export interface ICommandResult {
  status: "accepted" | "rejected" | "duplicate";
  errors: Array<{ code: string; message: string; field?: string }>;
  correlationId: EntityId;
  data?: unknown;
}

export interface ICommandHandler<TPayload extends JsonObject = JsonObject> {
  commandType: string;
  handle(envelope: ICommandEnvelope<TPayload>): Promise<ICommandResult>;
}

export interface ICommandBus {
  dispatch<TPayload extends JsonObject>(
    envelope: ICommandEnvelope<TPayload>,
  ): Promise<ICommandResult>;
  registerHandler(handler: ICommandHandler): void;
}
