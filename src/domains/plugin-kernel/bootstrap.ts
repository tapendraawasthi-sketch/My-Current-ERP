import { isMigrationFlagEnabled } from "@/platform/flags/registry";
import { markPluginKernelInitialized, updatePluginKernelCounters } from "./pluginKernel";
import { countActivePlugins } from "./pluginRegistry";
import { discoverBuiltinPlugins } from "./pluginDiscovery";
import { installPlugin } from "./pluginInstaller";
import { checkPluginHealth } from "./pluginHealth";
import { pluginLogger } from "./pluginLogger";

let bootstrapComplete = false;
let healthInterval: ReturnType<typeof setInterval> | null = null;

export function bootstrapPluginKernel(): void {
  if (!isMigrationFlagEnabled("MIGRATION_PLUGIN_KERNEL")) return;
  if (bootstrapComplete) return;

  pluginLogger.info("plugin-kernel-bootstrap");
  markPluginKernelInitialized();

  const discovered = discoverBuiltinPlugins();
  for (const entry of discovered) {
    void installPlugin(entry.manifest);
  }

  updatePluginKernelCounters({ loadedPlugins: discovered.length, activePlugins: countActivePlugins() });

  healthInterval = setInterval(() => {
    checkPluginHealth();
  }, 300_000);

  bootstrapComplete = true;
}

export function shutdownPluginKernel(): void {
  if (healthInterval) {
    clearInterval(healthInterval);
    healthInterval = null;
  }
  bootstrapComplete = false;
}

export function isPluginKernelBootstrapped(): boolean {
  return bootstrapComplete;
}
