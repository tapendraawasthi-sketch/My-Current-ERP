import type { IStreamId } from "@fios/kernel";
import { getEventRepository } from "@/platform/event-store/eventRepository";
import { replayTenant } from "@/platform/event-store/eventReplay";
import { acquireProjectionLock, releaseProjectionLock } from "./projectionLock";
import { getProjectionEngine } from "./projectionEngine";
import {
  clearProjectionTable,
  isProjectionSchemaReady,
  readGlobalProjectionCursor,
  readProjectionCheckpoint,
  updateProjectionStatus,
  writeGlobalProjectionCursor,
} from "./projectionCheckpoint";
import { recordProjectionDiagnostic } from "./projectionDiagnostics";
import { projectionMetrics } from "./projectionMetrics";
import { ALL_PROJECTION_NAMES, type ProjectionName } from "./projectionState";
import { getProjectionRegistry } from "./projectionRegistry";

const DEFAULT_TENANT_ID = "local";

const PROJECTION_DATA_TABLES = [
  "projectionAccountBalances",
  "projectionGeneralLedger",
  "projectionTrialBalance",
  "projectionVouchers",
  "projectionInvoices",
  "projectionParties",
  "projectionInventory",
  "projectionStockLedger",
  "projectionStockBalances",
  "projectionTax",
  "projectionAudit",
  "projectionNotifications",
  "projectionCompany",
  "projectionFiscalYear",
  "projectionNumberSeries",
  "projectionSyncCursor",
];

export interface RebuildOptions {
  fromGlobalSequence?: number;
  projectionName?: ProjectionName;
  aggregate?: IStreamId;
  dryRun?: boolean;
}

export interface RebuildResult {
  eventsReplayed: number;
  fromSequence: number;
  toSequence: number;
  dryRun: boolean;
}

async function clearProjectionData(dryRun: boolean): Promise<void> {
  if (dryRun) return;
  for (const table of PROJECTION_DATA_TABLES) {
    await clearProjectionTable(table);
  }
}

export async function rebuildProjections(options: RebuildOptions = {}): Promise<RebuildResult> {
  if (!isProjectionSchemaReady()) {
    return { eventsReplayed: 0, fromSequence: 0, toSequence: 0, dryRun: Boolean(options.dryRun) };
  }

  const owner = `rebuild:${crypto.randomUUID()}`;
  if (!acquireProjectionLock(owner)) {
    throw new Error("Projection rebuild already in progress");
  }

  try {
    const dryRun = Boolean(options.dryRun);
    let fromSequence = options.fromGlobalSequence ?? 1;

    if (!options.fromGlobalSequence && !options.aggregate) {
      const global = await readGlobalProjectionCursor();
      if (options.projectionName) {
        const checkpoint = await readProjectionCheckpoint(options.projectionName);
        if (checkpoint) fromSequence = checkpoint.globalSequence + 1;
      } else if (global) {
        fromSequence = 1;
      }
    }

    if (!options.aggregate && !options.projectionName && fromSequence === 1) {
      await clearProjectionData(dryRun);
    }

    await writeGlobalProjectionCursor({ lastGlobalSequence: fromSequence - 1, status: "rebuilding" });
    for (const name of ALL_PROJECTION_NAMES) {
      await updateProjectionStatus(name, "rebuilding");
    }

    recordProjectionDiagnostic({
      stage: "rebuild-start",
      message: `from=${fromSequence} dryRun=${dryRun}`,
      timestamp: new Date().toISOString(),
    });

    const engine = getProjectionEngine();
    const repository = getEventRepository();

    let eventsReplayed = 0;
    let toSequence = fromSequence - 1;

    if (options.aggregate) {
      const events = await repository.readStream(options.aggregate, 1);
      for (const event of events) {
        await engine.processEvent(event, { dryRun });
        eventsReplayed += 1;
      }
      toSequence = events.length;
    } else {
      const result = await replayTenant(
        DEFAULT_TENANT_ID,
        {
          eventType: "*",
          async handle(event) {
            if (options.projectionName) {
              const registry = getProjectionRegistry();
              const handlers = registry.forEvent(event.eventType).filter(
                (h) => h.projectionName === options.projectionName,
              );
              const record = await repository.readRecordById(event.eventId);
              const globalSequence = record?.globalSequence ?? 0;
              if (globalSequence < fromSequence) return;
              for (const handler of handlers) {
                await handler.apply(event, {
                  globalSequence,
                  dryRun,
                  tenantId: DEFAULT_TENANT_ID,
                });
              }
            } else {
              const record = await repository.readRecordById(event.eventId);
              const globalSequence = record?.globalSequence ?? 0;
              if (globalSequence < fromSequence) return;
              await engine.processEvent(event, { dryRun });
            }
            eventsReplayed += 1;
          },
        },
        fromSequence,
        { verifyHashes: false, validateSequences: false },
      );
      toSequence = result.toSequence;
    }

    projectionMetrics.incrementRebuilds();
    if (!dryRun) {
      await writeGlobalProjectionCursor({ lastGlobalSequence: toSequence, status: "ready" });
      for (const name of ALL_PROJECTION_NAMES) {
        await updateProjectionStatus(name, "ready", toSequence);
      }
    }

    recordProjectionDiagnostic({
      stage: "rebuild-complete",
      message: `events=${eventsReplayed} to=${toSequence}`,
      timestamp: new Date().toISOString(),
    });

    return { eventsReplayed, fromSequence, toSequence, dryRun };
  } finally {
    releaseProjectionLock(owner);
  }
}

export async function rebuildFromCheckpoint(
  projectionName: ProjectionName,
  dryRun = false,
): Promise<RebuildResult> {
  const checkpoint = await readProjectionCheckpoint(projectionName);
  return rebuildProjections({
    fromGlobalSequence: (checkpoint?.globalSequence ?? 0) + 1,
    projectionName,
    dryRun,
  });
}

export async function rebuildSingleAggregate(
  aggregate: IStreamId,
  dryRun = false,
): Promise<RebuildResult> {
  return rebuildProjections({ aggregate, dryRun });
}

export async function fullReplay(dryRun = false): Promise<RebuildResult> {
  return rebuildProjections({ fromGlobalSequence: 1, dryRun });
}
