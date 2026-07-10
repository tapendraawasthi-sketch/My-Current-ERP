import type { PluginDescriptor } from "./pluginDescriptor";
import { PluginStates } from "./pluginKernel";

const registry = new Map<string, PluginDescriptor>();

export function registerPluginDescriptor(descriptor: PluginDescriptor): void {
  registry.set(descriptor.id, descriptor);
}

export function getPlugin(id: string): PluginDescriptor | null {
  return registry.get(id) ?? null;
}

export function listPlugins(): PluginDescriptor[] {
  return Array.from(registry.values());
}

export function listPluginsByState(state: PluginDescriptor["state"]): PluginDescriptor[] {
  return listPlugins().filter((p) => p.state === state);
}

export function unregisterPlugin(id: string): boolean {
  return registry.delete(id);
}

export function clearPluginRegistry(): void {
  registry.clear();
}

export function countActivePlugins(): number {
  return listPluginsByState(PluginStates.ACTIVE).length;
}

export function countLoadedPlugins(): number {
  return listPlugins().filter(
    (p) => p.state === PluginStates.LOADED || p.state === PluginStates.ACTIVE || p.state === PluginStates.SUSPENDED,
  ).length;
}
