import type { IEventHandler } from "@fios/kernel";
import { getEventBus } from "@/platform/event-bus/bootstrap";
import { checkEventAccess } from "./pluginSecurity";
import { pluginLogger } from "./pluginLogger";

const subscriptions = new Map<string, IEventHandler>();

export function subscribePluginToEvents(pluginId: string, handler: IEventHandler): boolean {
  const check = checkEventAccess(pluginId);
  if (!check.allowed) {
    pluginLogger.warn("plugin-event-subscribe-denied", { pluginId, reason: check.reason });
    return false;
  }
  getEventBus().subscribe(handler);
  subscriptions.set(`${pluginId}:${handler.eventType}`, handler);
  pluginLogger.debug("plugin-event-subscribed", { pluginId, eventType: handler.eventType });
  return true;
}

export function listPluginEventSubscriptions(): string[] {
  return Array.from(subscriptions.keys());
}
