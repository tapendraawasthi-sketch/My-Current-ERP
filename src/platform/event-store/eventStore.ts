import type { IDomainEvent, IAppendResult, IEventStore, IStreamId } from "@fios/kernel";
import { isMigrationFlagEnabled } from "@/platform/flags/registry";
import { getContextProvider } from "@/platform/context/zustandContextProvider";
import { getEventRepository } from "./eventRepository";

const DEFAULT_TENANT_ID = "local";

function resolvePersistContext(): { tenantId: string; companyId: string | null } {
  const ctx = getContextProvider().getContext();
  return {
    tenantId: DEFAULT_TENANT_ID,
    companyId: ctx.company.companyId,
  };
}

export class DexieEventStore implements IEventStore {
  private readonly repository = getEventRepository();

  async append(
    stream: IStreamId,
    events: IDomainEvent[],
    expectedVersion: number,
  ): Promise<IAppendResult> {
    if (!isMigrationFlagEnabled("MIGRATION_EVENT_STORE")) {
      return { eventIds: [], newVersion: expectedVersion };
    }
    const context = {
      tenantId: stream.tenantId || DEFAULT_TENANT_ID,
      companyId: resolvePersistContext().companyId,
    };
    return this.repository.appendToStream(stream, events, expectedVersion, context);
  }

  async readStream(stream: IStreamId, fromSequence = 1): Promise<IDomainEvent[]> {
    if (!isMigrationFlagEnabled("MIGRATION_EVENT_STORE")) {
      return [];
    }
    return this.repository.readStream(stream, fromSequence);
  }

  async readAll(tenantId: string, fromGlobalSequence = 1): Promise<IDomainEvent[]> {
    if (!isMigrationFlagEnabled("MIGRATION_EVENT_STORE")) {
      return [];
    }
    return this.repository.readTenantStream(tenantId, fromGlobalSequence);
  }

  async persistPublishedEvent(event: IDomainEvent): Promise<void> {
    if (!isMigrationFlagEnabled("MIGRATION_EVENT_STORE")) {
      return;
    }
    const context = resolvePersistContext();
    await this.repository.persistEvent(event, context);
  }
}

let eventStoreInstance: DexieEventStore | null = null;

export function getEventStore(): DexieEventStore {
  if (!eventStoreInstance) {
    eventStoreInstance = new DexieEventStore();
  }
  return eventStoreInstance;
}

export function resetEventStore(): void {
  eventStoreInstance = null;
}

export function isEventStoreEnabled(): boolean {
  return isMigrationFlagEnabled("MIGRATION_EVENT_STORE");
}
