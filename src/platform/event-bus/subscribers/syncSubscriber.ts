import type { IDomainEvent, IEventHandler } from "@fios/kernel";
import { EventTypes } from "../eventTypes";
import { logEvent } from "../eventLogger";

const SYNC_EVENT_TYPES = new Set<string>([
  EventTypes.SYNC_RECORD_ENQUEUED,
  EventTypes.VOUCHER_POSTED,
  EventTypes.INVOICE_POSTED,
  EventTypes.ACCOUNT_CREATED,
  EventTypes.ACCOUNT_UPDATED,
  EventTypes.PARTY_CREATED,
  EventTypes.PARTY_UPDATED,
  EventTypes.ITEM_CREATED,
  EventTypes.ITEM_UPDATED,
]);

/** Sync notification-only observer — does not enqueue sync records. */
export const syncSubscriber: IEventHandler = {
  eventType: "*",
  async handle(event: IDomainEvent) {
    if (!SYNC_EVENT_TYPES.has(event.eventType)) return;
    logEvent("debug", "sync-observer", event, {
      observer: "sync-notification-only",
    });
  },
};
