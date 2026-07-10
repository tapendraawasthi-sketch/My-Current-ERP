import { getPluginKernelState } from "./pluginKernel";
import { listPlugins, countActivePlugins, countLoadedPlugins } from "./pluginRegistry";
import { pluginMetrics } from "./pluginMetrics";
import { recordPluginDiagnostic } from "./pluginDiagnostics";

export interface PluginHealthStatus {
  healthy: boolean;
  kernelInitialized: boolean;
  loadedPlugins: number;
  activePlugins: number;
  totalPlugins: number;
  metrics: Record<string, number>;
}

export function checkPluginHealth(): PluginHealthStatus {
  const kernel = getPluginKernelState();
  const status: PluginHealthStatus = {
    healthy: kernel.initialized,
    kernelInitialized: kernel.initialized,
    loadedPlugins: countLoadedPlugins(),
    activePlugins: countActivePlugins(),
    totalPlugins: listPlugins().length,
    metrics: pluginMetrics.snapshot(),
  };
  recordPluginDiagnostic({
    stage: "activated",
    message: `health check healthy=${status.healthy}`,
    timestamp: new Date().toISOString(),
  });
  return status;
}
