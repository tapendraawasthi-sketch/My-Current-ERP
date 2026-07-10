import type { PluginManifest } from "./pluginManifest";
import type { PluginState } from "./pluginKernel";

export interface PluginDescriptor {
  id: string;
  name: string;
  version: string;
  manifest: PluginManifest;
  state: PluginState;
  permissions: string[];
  loadedAt?: string;
  activatedAt?: string;
  errorMessage?: string;
}
