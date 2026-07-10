import type { EntityId, JsonObject } from "./types";

/**
 * Query bus contracts — interfaces only (F5 implements runtime).
 * @see SYSTEM-06 §06.12
 */

export interface IQuery<TPayload extends JsonObject = JsonObject> {
  queryId: EntityId;
  queryType: string;
  queryVersion: number;
  payload: TPayload;
  correlationId: EntityId;
  issuedAt: string;
}

export interface IQueryResult<TData = unknown> {
  status: "ok" | "not_found" | "rejected";
  data?: TData;
  errors?: Array<{ code: string; message: string; field?: string }>;
  correlationId: EntityId;
}

export interface IQueryHandler<TPayload extends JsonObject = JsonObject> {
  queryType: string;
  handle(query: IQuery<TPayload>): Promise<IQueryResult>;
}

export interface IQueryBus {
  dispatch<TPayload extends JsonObject>(query: IQuery<TPayload>): Promise<IQueryResult>;
  registerHandler(handler: IQueryHandler): void;
}
