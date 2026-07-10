import type { IDomainEvent, JsonObject } from "@fios/kernel";
import { EventTypes, type EventType } from "./eventTypes";

export interface EventSchemaDefinition {
  eventType: EventType;
  eventVersion: number;
  requiredPayloadKeys: string[];
  aggregateType?: string;
}

const REGISTRY: Record<string, EventSchemaDefinition> = {
  [EventTypes.COMMAND_ACCEPTED]: {
    eventType: EventTypes.COMMAND_ACCEPTED,
    eventVersion: 1,
    requiredPayloadKeys: ["commandType"],
  },
  [EventTypes.VOUCHER_POSTED]: {
    eventType: EventTypes.VOUCHER_POSTED,
    eventVersion: 1,
    requiredPayloadKeys: [],
    aggregateType: "Voucher",
  },
  [EventTypes.VOUCHER_UPDATED]: {
    eventType: EventTypes.VOUCHER_UPDATED,
    eventVersion: 1,
    requiredPayloadKeys: ["id"],
    aggregateType: "Voucher",
  },
  [EventTypes.VOUCHER_CANCELLED]: {
    eventType: EventTypes.VOUCHER_CANCELLED,
    eventVersion: 1,
    requiredPayloadKeys: ["id"],
    aggregateType: "Voucher",
  },
  [EventTypes.INVOICE_POSTED]: {
    eventType: EventTypes.INVOICE_POSTED,
    eventVersion: 1,
    requiredPayloadKeys: [],
    aggregateType: "Invoice",
  },
  [EventTypes.INVOICE_UPDATED]: {
    eventType: EventTypes.INVOICE_UPDATED,
    eventVersion: 1,
    requiredPayloadKeys: ["id"],
    aggregateType: "Invoice",
  },
  [EventTypes.INVOICE_CANCELLED]: {
    eventType: EventTypes.INVOICE_CANCELLED,
    eventVersion: 1,
    requiredPayloadKeys: ["id"],
    aggregateType: "Invoice",
  },
  [EventTypes.ACCOUNT_CREATED]: {
    eventType: EventTypes.ACCOUNT_CREATED,
    eventVersion: 1,
    requiredPayloadKeys: [],
    aggregateType: "Account",
  },
  [EventTypes.ACCOUNT_UPDATED]: {
    eventType: EventTypes.ACCOUNT_UPDATED,
    eventVersion: 1,
    requiredPayloadKeys: ["id"],
    aggregateType: "Account",
  },
  [EventTypes.ACCOUNT_DELETED]: {
    eventType: EventTypes.ACCOUNT_DELETED,
    eventVersion: 1,
    requiredPayloadKeys: ["id"],
    aggregateType: "Account",
  },
  [EventTypes.PARTY_CREATED]: {
    eventType: EventTypes.PARTY_CREATED,
    eventVersion: 1,
    requiredPayloadKeys: [],
    aggregateType: "Party",
  },
  [EventTypes.PARTY_UPDATED]: {
    eventType: EventTypes.PARTY_UPDATED,
    eventVersion: 1,
    requiredPayloadKeys: ["id"],
    aggregateType: "Party",
  },
  [EventTypes.ITEM_CREATED]: {
    eventType: EventTypes.ITEM_CREATED,
    eventVersion: 1,
    requiredPayloadKeys: [],
    aggregateType: "Item",
  },
  [EventTypes.ITEM_UPDATED]: {
    eventType: EventTypes.ITEM_UPDATED,
    eventVersion: 1,
    requiredPayloadKeys: ["id"],
    aggregateType: "Item",
  },
  [EventTypes.COMPANY_SETTINGS_UPDATED]: {
    eventType: EventTypes.COMPANY_SETTINGS_UPDATED,
    eventVersion: 1,
    requiredPayloadKeys: [],
    aggregateType: "Company",
  },
  [EventTypes.FISCAL_YEAR_CHANGED]: {
    eventType: EventTypes.FISCAL_YEAR_CHANGED,
    eventVersion: 1,
    requiredPayloadKeys: [],
    aggregateType: "FiscalYear",
  },
  [EventTypes.TDS_ENTRY_ADDED]: {
    eventType: EventTypes.TDS_ENTRY_ADDED,
    eventVersion: 1,
    requiredPayloadKeys: [],
    aggregateType: "Tax",
  },
  [EventTypes.TDS_ENTRY_UPDATED]: {
    eventType: EventTypes.TDS_ENTRY_UPDATED,
    eventVersion: 1,
    requiredPayloadKeys: ["id"],
    aggregateType: "Tax",
  },
  [EventTypes.NOTIFICATION_ADDED]: {
    eventType: EventTypes.NOTIFICATION_ADDED,
    eventVersion: 1,
    requiredPayloadKeys: ["message"],
    aggregateType: "Notification",
  },
  [EventTypes.NOTIFICATION_READ]: {
    eventType: EventTypes.NOTIFICATION_READ,
    eventVersion: 1,
    requiredPayloadKeys: ["id"],
    aggregateType: "Notification",
  },
  [EventTypes.NOTIFICATIONS_CLEARED]: {
    eventType: EventTypes.NOTIFICATIONS_CLEARED,
    eventVersion: 1,
    requiredPayloadKeys: [],
    aggregateType: "Notification",
  },
  [EventTypes.AUDIT_LOGS_LOADED]: {
    eventType: EventTypes.AUDIT_LOGS_LOADED,
    eventVersion: 1,
    requiredPayloadKeys: [],
    aggregateType: "Audit",
  },
  [EventTypes.AUDIT_RECORD_ADDED]: {
    eventType: EventTypes.AUDIT_RECORD_ADDED,
    eventVersion: 1,
    requiredPayloadKeys: ["action", "resourceType"],
    aggregateType: "Audit",
  },
  [EventTypes.SYNC_RECORD_ENQUEUED]: {
    eventType: EventTypes.SYNC_RECORD_ENQUEUED,
    eventVersion: 1,
    requiredPayloadKeys: ["entityType", "entityId"],
    aggregateType: "Sync",
  },
  [EventTypes.KHATA_ENTRY_POSTED]: {
    eventType: EventTypes.KHATA_ENTRY_POSTED,
    eventVersion: 1,
    requiredPayloadKeys: [],
    aggregateType: "Khata",
  },
  [EventTypes.HANDLER_FAILED]: {
    eventType: EventTypes.HANDLER_FAILED,
    eventVersion: 1,
    requiredPayloadKeys: ["handlerType", "error"],
  },
};

export function getEventSchema(eventType: string): EventSchemaDefinition | undefined {
  return REGISTRY[eventType];
}

export function listRegisteredEventTypes(): EventType[] {
  return Object.keys(REGISTRY) as EventType[];
}

export function isRegisteredEventType(eventType: string): eventType is EventType {
  return eventType in REGISTRY;
}

export function registerEventSchema(definition: EventSchemaDefinition): void {
  REGISTRY[definition.eventType] = definition;
}

export type { IDomainEvent, JsonObject };
