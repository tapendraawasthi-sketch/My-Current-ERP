import type { EntityId } from "./types";
import type { IDomainEvent } from "./event-contracts";

/**
 * Event store contracts — interfaces only (F4 implements runtime).
 * @see SYSTEM-06 §06.13
 */

export interface IStreamId {
  tenantId: EntityId;
  aggregateType: string;
  aggregateId: EntityId;
}

export interface IAppendResult {
  eventIds: EntityId[];
  newVersion: number;
}

export interface IEventStore {
  append(
    stream: IStreamId,
    events: IDomainEvent[],
    expectedVersion: number,
  ): Promise<IAppendResult>;
  readStream(stream: IStreamId, fromSequence?: number): Promise<IDomainEvent[]>;
}
