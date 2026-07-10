import type { IDomainEvent } from "@fios/kernel";
import type { DBDomainEvent } from "./eventSchemas";

export interface EventMigrationContext {
  tenantId: string;
  migrationTag: string;
  dryRun: boolean;
}

export interface EventMigrationResult {
  processed: number;
  skipped: number;
  errors: string[];
}

export interface IEventMigration {
  readonly name: string;
  readonly version: number;
  run(context: EventMigrationContext): Promise<EventMigrationResult>;
}

export interface BackfillSourceRow {
  sourceTable: string;
  sourceId: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: Record<string, unknown>;
  occurredAt: string;
}

export interface IBackfillAdapter {
  enumerateRows(tenantId: string): AsyncIterable<BackfillSourceRow>;
  toDomainEvent(row: BackfillSourceRow, context: EventMigrationContext): IDomainEvent;
}

export class StubBackfillMigration implements IEventMigration {
  readonly name = "dexie-backfill-stub";
  readonly version = 1;

  async run(_context: EventMigrationContext): Promise<EventMigrationResult> {
    return { processed: 0, skipped: 0, errors: [] };
  }
}

export function mapStoredToDomain(record: DBDomainEvent): IDomainEvent {
  return {
    eventId: record.id,
    eventType: record.eventType,
    eventVersion: record.eventVersion,
    aggregateType: record.aggregateType,
    aggregateId: record.aggregateId,
    sequence: record.sequence,
    payload: record.payload,
    correlationId: record.correlationId,
    causationId: record.causationId,
    occurredAt: record.occurredAt,
  };
}

const registeredMigrations: IEventMigration[] = [];

export function registerEventMigration(migration: IEventMigration): () => void {
  registeredMigrations.push(migration);
  return () => {
    const index = registeredMigrations.indexOf(migration);
    if (index >= 0) registeredMigrations.splice(index, 1);
  };
}

export function getRegisteredMigrations(): readonly IEventMigration[] {
  return registeredMigrations;
}

export async function runEventMigrations(
  context: EventMigrationContext,
): Promise<EventMigrationResult> {
  const aggregate: EventMigrationResult = { processed: 0, skipped: 0, errors: [] };
  for (const migration of registeredMigrations) {
    try {
      const result = await migration.run(context);
      aggregate.processed += result.processed;
      aggregate.skipped += result.skipped;
      aggregate.errors.push(...result.errors);
    } catch (error) {
      aggregate.errors.push(
        `${migration.name}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  return aggregate;
}
