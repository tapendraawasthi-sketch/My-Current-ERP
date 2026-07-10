import type { PluginManifest } from "./pluginManifest";
import { discoverPlugin } from "./pluginLifecycle";
import { pluginLogger } from "./pluginLogger";

export interface DiscoveredPlugin {
  manifest: PluginManifest;
  source: string;
}

const discovered: DiscoveredPlugin[] = [];

export function registerDiscoveredPlugin(entry: DiscoveredPlugin): void {
  discovered.push(entry);
  void discoverPlugin(entry.manifest.id, entry.manifest.name, entry.manifest.version);
  pluginLogger.debug("plugin-discovered", { pluginId: entry.manifest.id });
}

export function listDiscoveredPlugins(): DiscoveredPlugin[] {
  return [...discovered];
}

export function discoverBuiltinPlugins(): DiscoveredPlugin[] {
  const builtins: PluginManifest[] = [
    {
      id: "tax-nepal",
      name: "Nepal Tax Rules",
      version: "1.0.0",
      capabilities: ["tax.calculate"],
      permissions: ["query.execute"],
      extensionPoints: ["tax.engine"],
    },
    {
      id: "report-pack-standard",
      name: "Standard Report Pack",
      version: "1.0.0",
      capabilities: ["report.generate"],
      permissions: ["query.execute"],
      extensionPoints: ["report.engine"],
    },
  ];
  for (const manifest of builtins) {
    registerDiscoveredPlugin({ manifest, source: "builtin" });
  }
  return listDiscoveredPlugins();
}
