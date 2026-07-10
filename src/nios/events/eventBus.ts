/**
 * NIOS Event Bus — browser-side pub/sub.
 */

import type { NiosEvent, NiosEventType } from "./types";

type EventHandler<T = Record<string, unknown>> = (event: NiosEvent<T>) => void;

const handlers = new Map<NiosEventType, Set<EventHandler>>();

export function emitNiosEvent<T extends Record<string, unknown>>(
  type: NiosEventType,
  payload: T,
  meta?: { tenantId?: string; companyId?: string; sessionId?: string },
): NiosEvent<T> {
  const event: NiosEvent<T> = {
    id: crypto.randomUUID(),
    type,
    timestamp: new Date().toISOString(),
    tenantId: meta?.tenantId,
    companyId: meta?.companyId,
    sessionId: meta?.sessionId,
    payload,
  };

  const typeHandlers = handlers.get(type);
  if (typeHandlers) {
    for (const handler of typeHandlers) {
      try {
        handler(event as NiosEvent);
      } catch (err) {
        console.warn("[NIOS EventBus] handler error", type, err);
      }
    }
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("nios:event", { detail: event }));
  }

  return event;
}

export function onNiosEvent<T extends Record<string, unknown>>(
  type: NiosEventType,
  handler: EventHandler<T>,
): () => void {
  if (!handlers.has(type)) handlers.set(type, new Set());
  const set = handlers.get(type)!;
  set.add(handler as EventHandler);
  return () => set.delete(handler as EventHandler);
}

export function clearNiosEventHandlers(type?: NiosEventType): void {
  if (type) handlers.delete(type);
  else handlers.clear();
}
