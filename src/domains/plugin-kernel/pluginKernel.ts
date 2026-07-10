export const PLUGIN_KERNEL_VERSION = "1.0.0";
export const MIN_HOST_VERSION = "1.0.0";

export const PluginStates = {
  DISCOVERED: "discovered",
  VALIDATED: "validated",
  LOADED: "loaded",
  ACTIVE: "active",
  SUSPENDED: "suspended",
  DEACTIVATED: "deactivated",
  UNLOADED: "unloaded",
  ERROR: "error",
} as const;

export type PluginState = (typeof PluginStates)[keyof typeof PluginStates];

export interface PluginKernelState {
  initialized: boolean;
  version: string;
  activePlugins: number;
  loadedPlugins: number;
}

let kernelState: PluginKernelState = {
  initialized: false,
  version: PLUGIN_KERNEL_VERSION,
  activePlugins: 0,
  loadedPlugins: 0,
};

export function getPluginKernelState(): PluginKernelState {
  return { ...kernelState };
}

export function markPluginKernelInitialized(): void {
  kernelState = { ...kernelState, initialized: true };
}

export function updatePluginKernelCounters(patch: Partial<Pick<PluginKernelState, "activePlugins" | "loadedPlugins">>): void {
  kernelState = { ...kernelState, ...patch };
}
