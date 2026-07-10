import type { PluginDescriptor } from "./pluginDescriptor";

const isolationContexts = new Map<string, { namespace: string }>();

export function isolatePlugin(descriptor: PluginDescriptor): void {
  isolationContexts.set(descriptor.id, { namespace: `plugin:${descriptor.id}` });
}

export function releaseIsolation(pluginId: string): void {
  isolationContexts.delete(pluginId);
}

export function getPluginNamespace(pluginId: string): string | null {
  return isolationContexts.get(pluginId)?.namespace ?? null;
}

export function isIsolated(pluginId: string): boolean {
  return isolationContexts.has(pluginId);
}
