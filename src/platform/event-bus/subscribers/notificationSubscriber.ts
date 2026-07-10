import type { IDomainEvent, IEventHandler } from "@fios/kernel";
import { EventTypes } from "../eventTypes";
import { logEvent } from "../eventLogger";

const NOTIFICATION_EVENT_TYPES = new Set<string>([
  EventTypes.VOUCHER_POSTED,
  EventTypes.INVOICE_POSTED,
  EventTypes.VOUCHER_CANCELLED,
  EventTypes.INVOICE_CANCELLED,
  EventTypes.KHATA_ENTRY_POSTED,
  EventTypes.SYNC_RECORD_ENQUEUED,
  EventTypes.HANDLER_FAILED,
]);

/** Notification-only observer — does not call notification repository or useStore. */
export const notificationSubscriber: IEventHandler = {
  eventType: "*",
  async handle(event: IDomainEvent) {
    if (!NOTIFICATION_EVENT_TYPES.has(event.eventType)) return;
    logEvent("info", "notification-observer", event, {
      notifyChannel: "in-app-observer",
      message: `Observed ${event.eventType} on ${event.aggregateType}`,
    });
  },
};
