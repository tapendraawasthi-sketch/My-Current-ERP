import type { IDomainEvent, IEventHandler } from "@fios/kernel";
import { EventTypes } from "../eventTypes";
import { logEvent } from "../eventLogger";

const NIOS_EVENT_TYPES = new Set<string>([
  EventTypes.KHATA_ENTRY_POSTED,
  EventTypes.COMMAND_ACCEPTED,
  EventTypes.VOUCHER_POSTED,
  EventTypes.INVOICE_POSTED,
]);

/** NIOS notification-only observer — no agent actions or ERP writes. */
export const niosSubscriber: IEventHandler = {
  eventType: "*",
  async handle(event: IDomainEvent) {
    if (!NIOS_EVENT_TYPES.has(event.eventType)) return;
    logEvent("debug", "nios-observer", event, {
      observer: "nios-notification-only",
    });
  },
};
