import { isMigrationFlagEnabled } from "@/platform/flags/registry";
import { createSdkForPlugin } from "./sdkUtilities";
import { createPluginContext } from "./pluginContext";
import type { PluginDescriptor } from "./pluginDescriptor";

export interface PluginSDK {
  version: string;
  forPlugin(descriptor: PluginDescriptor): ReturnType<typeof createSdkForPlugin>;
  createContext(descriptor: PluginDescriptor): ReturnType<typeof createPluginContext>;
}

export function createPluginSDK(): PluginSDK {
  if (!isMigrationFlagEnabled("MIGRATION_PLUGIN_SDK")) {
    throw new Error("MIGRATION_PLUGIN_SDK is disabled");
  }
  return {
    version: "1.0.0",
    forPlugin: (descriptor) => createSdkForPlugin(descriptor.id),
    createContext: (descriptor) => createPluginContext(descriptor),
  };
}

export function isPluginSdkEnabled(): boolean {
  return isMigrationFlagEnabled("MIGRATION_PLUGIN_SDK");
}
