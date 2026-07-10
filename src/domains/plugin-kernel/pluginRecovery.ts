import { listPlugins } from "./pluginRegistry";
import { deactivatePlugin, unloadPlugin } from "./pluginLifecycle";
import { clearPluginDiagnostics } from "./pluginDiagnostics";
import { pluginLogger } from "./pluginLogger";
import { recordPluginDiagnostic } from "./pluginDiagnostics";
import { PluginStates } from "./pluginKernel";

export interface PluginRecoveryResult {
  recovered: number;
  message: string;
}

export async function recoverPluginKernel(): Promise<PluginRecoveryResult> {
  let recovered = 0;
  for (const plugin of listPlugins()) {
    if (plugin.state === PluginStates.ERROR) {
      await deactivatePlugin(plugin.id);
      await unloadPlugin(plugin.id);
      recovered += 1;
    }
  }
  clearPluginDiagnostics();
  recordPluginDiagnostic({
    stage: "recovery",
    message: `recovered ${recovered} plugins`,
    timestamp: new Date().toISOString(),
  });
  pluginLogger.info("plugin-kernel-recovered", { recovered });
  return { recovered, message: "Plugin kernel recovered" };
}
