import type { ICommandEnvelope, ICommandResult, JsonObject } from "@fios/kernel";
import { CommandTypes } from "@/platform/command-bus/commandTypes";
import { EventTypes } from "./eventTypes";
import { createEventFromCommand } from "./eventEnvelope";
import { getEventBus } from "./bootstrap";

function extractAggregateId(
  command: ICommandEnvelope,
  resultData: unknown,
): string {
  if (command.aggregateId) return command.aggregateId;
  const data = resultData as Record<string, unknown> | null | undefined;
  if (data && typeof data === "object") {
    if (typeof data.id === "string" && data.id) return data.id;
    if (typeof data.voucherNo === "string" && data.voucherNo) return data.voucherNo;
    if (typeof data.invoiceNo === "string" && data.invoiceNo) return data.invoiceNo;
  }
  const payload = command.payload;
  if (typeof payload.id === "string" && payload.id) return payload.id;
  if (typeof payload.entityId === "string" && payload.entityId) return payload.entityId;
  return command.commandId;
}

function buildPayload(command: ICommandEnvelope, resultData: unknown): JsonObject {
  const payload: JsonObject = {
    commandType: command.commandType,
    commandId: command.commandId,
  };
  if (resultData !== undefined && resultData !== null) {
    if (typeof resultData === "object") {
      Object.assign(payload, resultData as JsonObject);
    } else {
      payload.result = resultData;
    }
  } else {
    Object.assign(payload, command.payload);
  }
  return payload;
}

const COMMAND_EVENT_MAP: Record<string, string> = {
  [CommandTypes.POST_VOUCHER]: EventTypes.VOUCHER_POSTED,
  [CommandTypes.UPDATE_VOUCHER]: EventTypes.VOUCHER_UPDATED,
  [CommandTypes.CANCEL_VOUCHER]: EventTypes.VOUCHER_CANCELLED,
  [CommandTypes.POST_INVOICE]: EventTypes.INVOICE_POSTED,
  [CommandTypes.UPDATE_INVOICE]: EventTypes.INVOICE_UPDATED,
  [CommandTypes.CANCEL_INVOICE]: EventTypes.INVOICE_CANCELLED,
  [CommandTypes.CREATE_ACCOUNT]: EventTypes.ACCOUNT_CREATED,
  [CommandTypes.UPDATE_ACCOUNT]: EventTypes.ACCOUNT_UPDATED,
  [CommandTypes.DELETE_ACCOUNT]: EventTypes.ACCOUNT_DELETED,
  [CommandTypes.CREATE_PARTY]: EventTypes.PARTY_CREATED,
  [CommandTypes.UPDATE_PARTY]: EventTypes.PARTY_UPDATED,
  [CommandTypes.CREATE_ITEM]: EventTypes.ITEM_CREATED,
  [CommandTypes.UPDATE_ITEM]: EventTypes.ITEM_UPDATED,
  [CommandTypes.UPDATE_COMPANY_SETTINGS]: EventTypes.COMPANY_SETTINGS_UPDATED,
  [CommandTypes.SET_CURRENT_FISCAL_YEAR]: EventTypes.FISCAL_YEAR_CHANGED,
  [CommandTypes.ADD_TDS_ENTRY]: EventTypes.TDS_ENTRY_ADDED,
  [CommandTypes.UPDATE_TDS_ENTRY]: EventTypes.TDS_ENTRY_UPDATED,
  [CommandTypes.ADD_NOTIFICATION]: EventTypes.NOTIFICATION_ADDED,
  [CommandTypes.MARK_NOTIFICATION_READ]: EventTypes.NOTIFICATION_READ,
  [CommandTypes.CLEAR_NOTIFICATIONS]: EventTypes.NOTIFICATIONS_CLEARED,
  [CommandTypes.LOAD_AUDIT_LOGS]: EventTypes.AUDIT_LOGS_LOADED,
  [CommandTypes.ADD_AUDIT_LOG]: EventTypes.AUDIT_RECORD_ADDED,
  [CommandTypes.ENQUEUE_SYNC_RECORD]: EventTypes.SYNC_RECORD_ENQUEUED,
  [CommandTypes.POST_KHATA_ENTRY]: EventTypes.KHATA_ENTRY_POSTED,
};

export async function publishEventsForCommand(
  command: ICommandEnvelope,
  result: ICommandResult,
): Promise<void> {
  if (result.status !== "accepted") return;

  const bus = getEventBus();
  const aggregateId = extractAggregateId(command, result.data);
  const payload = buildPayload(command, result.data);

  await bus.publish(
    createEventFromCommand(command, EventTypes.COMMAND_ACCEPTED, {
      commandType: command.commandType,
      commandId: command.commandId,
      aggregateType: command.aggregateType,
    }, aggregateId),
  );

  const mappedType = COMMAND_EVENT_MAP[command.commandType];
  if (!mappedType) return;

  await bus.publish(createEventFromCommand(command, mappedType, payload, aggregateId));
}
