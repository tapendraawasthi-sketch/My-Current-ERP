import type { PluginDescriptor } from "./pluginDescriptor";
import { PluginStates } from "./pluginKernel";
import { activatePlugin, deactivatePlugin, loadPlugin, suspendPlugin, unloadPlugin } from "./pluginLifecycle";
import { getPlugin } from "./pluginRegistry";
import { pluginLogger } from "./pluginLogger";

export async function hostLoadPlugin(pluginId: string): Promise<boolean> {
  const plugin = getPlugin(pluginId);
  if (!plugin) return false;
  pluginLogger.info("plugin-host-load", { pluginId });
  return loadPlugin(pluginId);
}

export async function hostActivatePlugin(pluginId: string): Promise<boolean> {
  return activatePlugin(pluginId);
}

export async function hostSuspendPlugin(pluginId: string): Promise<boolean> {
  return suspendPlugin(pluginId);
}

export async function hostDeactivatePlugin(pluginId: string): Promise<boolean> {
  return deactivatePlugin(pluginId);
}

export async function hostUnloadPlugin(pluginId: string): Promise<boolean> {
  pluginLogger.info("plugin-host-unload", { pluginId });
  return unloadPlugin(pluginId);
}

export async function hostHotReload(pluginId: string): Promise<boolean> {
  await hostUnloadPlugin(pluginId);
  return hostLoadPlugin(pluginId);
}

export function isPluginHosted(descriptor: PluginDescriptor): boolean {
  return descriptor.state !== PluginStates.UNLOADED && descriptor.state !== PluginStates.DISCOVERED;
}
