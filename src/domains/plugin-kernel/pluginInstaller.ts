import type { PluginManifest } from "./pluginManifest";
import { loadPluginFromManifest } from "./pluginLoader";
import { setPluginPermissions } from "./pluginPermissions";
import { registerCapabilitiesFromManifest } from "./pluginCapabilities";
import { registerExtensionPoint, type ExtensionPoint } from "./extensionPoints";
import { activatePlugin } from "./pluginLifecycle";
import { savePluginConfig } from "./pluginStorage";
import { pluginLogger } from "./pluginLogger";

export async function installPlugin(manifest: PluginManifest): Promise<boolean> {
  const descriptor = await loadPluginFromManifest(manifest);
  if (!descriptor) return false;
  setPluginPermissions(manifest.id, descriptor.permissions);
  registerCapabilitiesFromManifest(manifest.id, manifest.capabilities);
  for (const extensionPoint of manifest.extensionPoints) {
    registerExtensionPoint(
      extensionPoint as ExtensionPoint,
      manifest.id,
      `${manifest.id}:${extensionPoint}`,
    );
  }
  if (manifest.config) savePluginConfig(manifest.id, manifest.config);
  await activatePlugin(manifest.id);
  pluginLogger.info("plugin-installed", { pluginId: manifest.id });
  return true;
}
