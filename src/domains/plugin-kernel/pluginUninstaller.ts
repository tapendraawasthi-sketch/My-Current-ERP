import { hostUnloadPlugin } from "./pluginHost";
import { unregisterPlugin, getPlugin } from "./pluginRegistry";
import { revokePluginPermissions } from "./pluginPermissions";
import { unregisterPluginCapabilities } from "./pluginCapabilities";
import { releaseIsolation } from "./pluginIsolation";
import { clearPluginConfig } from "./pluginStorage";
import { pluginLogger } from "./pluginLogger";

export async function uninstallPlugin(pluginId: string): Promise<boolean> {
  const plugin = getPlugin(pluginId);
  if (!plugin) return false;
  await hostUnloadPlugin(pluginId);
  revokePluginPermissions(pluginId);
  unregisterPluginCapabilities(pluginId);
  releaseIsolation(pluginId);
  clearPluginConfig(pluginId);
  unregisterPlugin(pluginId);
  pluginLogger.info("plugin-uninstalled", { pluginId });
  return true;
}

export async function hotUnloadPlugin(pluginId: string): Promise<boolean> {
  return uninstallPlugin(pluginId);
}
