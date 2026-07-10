import type { PluginManifest } from "./pluginManifest";
import { getPlugin } from "./pluginRegistry";
import { hostHotReload } from "./pluginHost";
import { isCompatibleVersion } from "./pluginVersioning";
import { pluginLogger } from "./pluginLogger";

export async function updatePlugin(manifest: PluginManifest): Promise<boolean> {
  const existing = getPlugin(manifest.id);
  if (!existing) return false;
  if (!isCompatibleVersion(existing.version, manifest.version)) {
    pluginLogger.warn("plugin-update-incompatible-version", {
      pluginId: manifest.id,
      from: existing.version,
      to: manifest.version,
    });
    return false;
  }
  return hostHotReload(manifest.id);
}
