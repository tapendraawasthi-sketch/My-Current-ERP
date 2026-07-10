import type { IDomainEvent } from "@fios/kernel";
import { isMigrationFlagEnabled } from "@/platform/flags/registry";
import { getEventRepository } from "@/platform/event-store/eventRepository";
import { EventTypes } from "@/platform/event-bus/eventTypes";
import { getProjectionRegistry, type ProjectionRegistry } from "./projectionRegistry";
import {
  isProjectionSchemaReady,
  updateProjectionStatus,
  writeGlobalProjectionCursor,
  writeProjectionCheckpoint,
} from "./projectionCheckpoint";
import { validateProjectionEvent } from "./projectionIntegrity";
import { recordProjectionDiagnostic } from "./projectionDiagnostics";
import { projectionMetrics } from "./projectionMetrics";
import type { ProjectionName } from "./projectionState";

const DEFAULT_TENANT_ID = "local";

const SKIPPED_EVENT_TYPES = new Set<string>([
  EventTypes.COMMAND_ACCEPTED,
  EventTypes.HANDLER_FAILED,
]);

export function isProjectionsEnabled(): boolean {
  return isMigrationFlagEnabled("MIGRATION_PROJECTIONS");
}

async function resolveGlobalSequence(event: IDomainEvent): Promise<number> {
  const repository = getEventRepository();
  const record = await repository.readRecordById(event.eventId);
  return record?.globalSequence ?? 0;
}

export class ProjectionEngine {
  private readonly registry: ProjectionRegistry;

  constructor(registry = getProjectionRegistry()) {
    this.registry = registry;
  }

  async processEvent(event: IDomainEvent, options: { dryRun?: boolean } = {}): Promise<void> {
    if (!isProjectionsEnabled()) return;
    if (!isProjectionSchemaReady()) return;
    if (SKIPPED_EVENT_TYPES.has(event.eventType)) return;

    validateProjectionEvent(event);
    const globalSequence = await resolveGlobalSequence(event);
    const context = {
      globalSequence,
      dryRun: Boolean(options.dryRun),
      tenantId: DEFAULT_TENANT_ID,
    };

    recordProjectionDiagnostic({
      eventId: event.eventId,
      eventType: event.eventType,
      globalSequence,
      stage: "event-received",
      timestamp: new Date().toISOString(),
    });

    const handlers = this.registry.forEvent(event.eventType);
    projectionMetrics.incrementEventsProcessed();

    for (const handler of handlers) {
      try {
        await handler.apply(event, context);
        projectionMetrics.incrementProjectionsApplied();
        await updateProjectionStatus(
          handler.projectionName as ProjectionName,
          "ready",
          globalSequence,
        );
        if (!context.dryRun) {
          await writeProjectionCheckpoint({
            id: handler.projectionName,
            projectionName: handler.projectionName as ProjectionName,
            globalSequence,
            aggregateType: event.aggregateType,
            aggregateId: event.aggregateId,
            updatedAt: new Date().toISOString(),
          });
        }
        recordProjectionDiagnostic({
          projectionName: handler.projectionName as ProjectionName,
          eventId: event.eventId,
          eventType: event.eventType,
          globalSequence,
          stage: "applied",
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        projectionMetrics.incrementErrors();
        const message = error instanceof Error ? error.message : String(error);
        await updateProjectionStatus(
          handler.projectionName as ProjectionName,
          "error",
          globalSequence,
          message,
        );
        recordProjectionDiagnostic({
          projectionName: handler.projectionName as ProjectionName,
          eventId: event.eventId,
          eventType: event.eventType,
          globalSequence,
          stage: "error",
          message,
          timestamp: new Date().toISOString(),
        });
      }
    }

    if (!options.dryRun && globalSequence > 0) {
      await writeGlobalProjectionCursor({ lastGlobalSequence: globalSequence, status: "ready" });
    }
  }
}

let engineInstance: ProjectionEngine | null = null;

export function getProjectionEngine(): ProjectionEngine {
  if (!engineInstance) {
    engineInstance = new ProjectionEngine();
  }
  return engineInstance;
}

export function resetProjectionEngine(): void {
  engineInstance = null;
}
