import { DomainEventBus } from "./domainEventBus";
import {
  createCorrelationMiddleware,
  createLoggingMiddleware,
  createMetricsMiddleware,
  createValidationMiddleware,
  EventMiddlewarePipeline,
} from "./middleware";
import { createEventStoreMiddleware } from "@/platform/event-store/bootstrap";
import { isEventStoreEnabled } from "@/platform/event-store/eventStore";
import { isMigrationFlagEnabled } from "@/platform/flags/registry";
import { bootstrapEventSync } from "@/platform/sync/syncBootstrap";
import { createProjectionEventHandler, bootstrapProjections } from "@/platform/projections/projectionBootstrap";
import { createInventoryShadowHandler, bootstrapInventoryEngine } from "@/domains/inventory-engine/inventoryBootstrap";
import { createAccountingShadowHandler, bootstrapAccountingEngine } from "@/domains/accounting-engine/accountingBootstrap";
import { bootstrapReportEngine } from "@/domains/report-engine/reportBootstrap";
import { bootstrapNiosCore } from "@/domains/nios-core/bootstrap";
import { bootstrapProposalPipeline } from "@/domains/ai-proposal/proposalBootstrap";
import { bootstrapApprovalPipeline } from "@/domains/ai-proposal/approvalBootstrap";
import { bootstrapExecutionPipeline } from "@/domains/ai-proposal/executionBootstrap";
import { bootstrapPluginKernel } from "@/domains/plugin-kernel/bootstrap";
import { auditSubscriber } from "./subscribers/auditSubscriber";
import { notificationSubscriber } from "./subscribers/notificationSubscriber";
import { niosSubscriber } from "./subscribers/niosSubscriber";
import { syncSubscriber } from "./subscribers/syncSubscriber";
import {
  LEDGER_PROJECTION_STUB,
  STOCK_PROJECTION_STUB,
  TRIAL_BALANCE_PROJECTION_STUB,
} from "./subscribers/projectionSubscriber";

let eventBusInstance: DomainEventBus | null = null;

function registerDefaultSubscribers(bus: DomainEventBus): void {
  bus.subscribe(auditSubscriber);
  bus.subscribe(notificationSubscriber);
  bus.subscribe(niosSubscriber);
  bus.subscribe(syncSubscriber);
  if (isMigrationFlagEnabled("MIGRATION_PROJECTIONS")) {
    bus.subscribe(createProjectionEventHandler());
    bootstrapProjections();
  } else {
    bus.subscribe(TRIAL_BALANCE_PROJECTION_STUB);
    bus.subscribe(LEDGER_PROJECTION_STUB);
    bus.subscribe(STOCK_PROJECTION_STUB);
  }

  if (isMigrationFlagEnabled("MIGRATION_INVENTORY_ENGINE")) {
    bus.subscribe(createInventoryShadowHandler());
    bootstrapInventoryEngine();
  }

  if (isMigrationFlagEnabled("MIGRATION_ACCOUNTING_ENGINE")) {
    bus.subscribe(createAccountingShadowHandler());
    bootstrapAccountingEngine();
  }

  bootstrapReportEngine();

  bootstrapNiosCore();

  bootstrapProposalPipeline();
  bootstrapApprovalPipeline();
  bootstrapExecutionPipeline();

  bootstrapPluginKernel();

  bootstrapEventSync();
}

function configureMiddleware(pipeline: EventMiddlewarePipeline): void {
  pipeline.use(createCorrelationMiddleware());
  pipeline.use(createValidationMiddleware());
  if (isEventStoreEnabled()) {
    pipeline.use(createEventStoreMiddleware());
  }
  pipeline.use(createMetricsMiddleware());
  pipeline.use(createLoggingMiddleware());
}

export function getEventBus(): DomainEventBus {
  if (!eventBusInstance) {
    const pipeline = new EventMiddlewarePipeline();
    configureMiddleware(pipeline);
    eventBusInstance = new DomainEventBus(pipeline);
    registerDefaultSubscribers(eventBusInstance);
  }
  return eventBusInstance;
}

export function resetEventBus(): void {
  eventBusInstance = null;
}
