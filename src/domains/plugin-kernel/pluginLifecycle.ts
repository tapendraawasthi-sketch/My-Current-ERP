import { PluginStates } from "./pluginKernel";
import { getPlugin, registerPluginDescriptor, countActivePlugins, countLoadedPlugins } from "./pluginRegistry";
import { updatePluginKernelCounters } from "./pluginKernel";
import { recordPluginDiagnostic } from "./pluginDiagnostics";
import { pluginMetrics } from "./pluginMetrics";

export async function discoverPlugin(id: string, name: string, version: string): Promise<boolean> {
  if (getPlugin(id)) return false;
  registerPluginDescriptor({
    id,
    name,
    version,
    manifest: { id, name, version, capabilities: [], permissions: [], extensionPoints: [] },
    state: PluginStates.DISCOVERED,
    permissions: [],
  });
  recordPluginDiagnostic({ pluginId: id, stage: "discovered", timestamp: new Date().toISOString() });
  return true;
}

export async function validatePlugin(pluginId: string): Promise<boolean> {
  const plugin = getPlugin(pluginId);
  if (!plugin) return false;
  plugin.state = PluginStates.VALIDATED;
  recordPluginDiagnostic({ pluginId, stage: "validated", timestamp: new Date().toISOString() });
  return true;
}

export async function loadPlugin(pluginId: string): Promise<boolean> {
  const plugin = getPlugin(pluginId);
  if (!plugin) return false;
  plugin.state = PluginStates.LOADED;
  plugin.loadedAt = new Date().toISOString();
  updatePluginKernelCounters({ loadedPlugins: countLoadedPlugins() });
  recordPluginDiagnostic({ pluginId, stage: "loaded", timestamp: new Date().toISOString() });
  return true;
}

export async function activatePlugin(pluginId: string): Promise<boolean> {
  const plugin = getPlugin(pluginId);
  if (!plugin || plugin.state !== PluginStates.LOADED) return false;
  plugin.state = PluginStates.ACTIVE;
  plugin.activatedAt = new Date().toISOString();
  pluginMetrics.incrementActivated();
  updatePluginKernelCounters({ activePlugins: countActivePlugins() });
  recordPluginDiagnostic({ pluginId, stage: "activated", timestamp: new Date().toISOString() });
  return true;
}

export async function suspendPlugin(pluginId: string): Promise<boolean> {
  const plugin = getPlugin(pluginId);
  if (!plugin || plugin.state !== PluginStates.ACTIVE) return false;
  plugin.state = PluginStates.SUSPENDED;
  updatePluginKernelCounters({ activePlugins: countActivePlugins() });
  recordPluginDiagnostic({ pluginId, stage: "suspended", timestamp: new Date().toISOString() });
  return true;
}

export async function deactivatePlugin(pluginId: string): Promise<boolean> {
  const plugin = getPlugin(pluginId);
  if (!plugin) return false;
  plugin.state = PluginStates.DEACTIVATED;
  updatePluginKernelCounters({ activePlugins: countActivePlugins() });
  recordPluginDiagnostic({ pluginId, stage: "deactivated", timestamp: new Date().toISOString() });
  return true;
}

export async function unloadPlugin(pluginId: string): Promise<boolean> {
  const plugin = getPlugin(pluginId);
  if (!plugin) return false;
  plugin.state = PluginStates.UNLOADED;
  updatePluginKernelCounters({
    activePlugins: countActivePlugins(),
    loadedPlugins: countLoadedPlugins(),
  });
  pluginMetrics.incrementUnloaded();
  recordPluginDiagnostic({ pluginId, stage: "unloaded", timestamp: new Date().toISOString() });
  return true;
}
