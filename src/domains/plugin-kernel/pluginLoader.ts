import type { PluginManifest } from "./pluginManifest";
import type { PluginDescriptor } from "./pluginDescriptor";
import { PluginStates } from "./pluginKernel";
import { registerPluginDescriptor } from "./pluginRegistry";
import { validateManifest } from "./pluginValidation";
import { checkCompatibility } from "./pluginCompatibility";
import { grantPermissions } from "./pluginPermissions";
import { recordPluginDiagnostic } from "./pluginDiagnostics";
import { pluginLogger } from "./pluginLogger";
import { pluginMetrics } from "./pluginMetrics";
import { isForbiddenApi } from "./pluginSecurity";
import { blockDirectStoreAccess, blockDirectDexieAccess } from "./pluginSandbox";

export async function loadPluginFromManifest(manifest: PluginManifest): Promise<PluginDescriptor | null> {
  const issues = validateManifest(manifest);
  if (issues.length > 0) {
    pluginLogger.error("plugin-load-validation-failed", { pluginId: manifest.id, issues });
    return null;
  }

  const compat = checkCompatibility(manifest);
  if (!compat.compatible) {
    pluginLogger.error("plugin-load-incompatible", { pluginId: manifest.id, reason: compat.reason });
    return null;
  }

  const descriptor: PluginDescriptor = {
    id: manifest.id,
    name: manifest.name,
    version: manifest.version,
    manifest,
    state: PluginStates.LOADED,
    permissions: grantPermissions(manifest.permissions ?? []),
    loadedAt: new Date().toISOString(),
  };

  if (manifest.entryPoint && isForbiddenApi(manifest.entryPoint)) {
    pluginLogger.error("plugin-load-forbidden-entry", { pluginId: manifest.id });
    return null;
  }

  blockDirectStoreAccess();
  blockDirectDexieAccess();

  registerPluginDescriptor(descriptor);
  pluginMetrics.incrementLoaded();
  recordPluginDiagnostic({ pluginId: manifest.id, stage: "loaded", timestamp: new Date().toISOString() });
  pluginLogger.info("plugin-loaded", { pluginId: manifest.id });
  return descriptor;
}

export async function hotLoadPlugin(manifest: PluginManifest): Promise<PluginDescriptor | null> {
  return loadPluginFromManifest(manifest);
}
