import { getPluginConfig, savePluginConfig } from "./pluginStorage";

export interface PluginConfigSchema {
  pluginId: string;
  settings: Record<string, unknown>;
}

export function getConfiguration(pluginId: string): Record<string, unknown> {
  return getPluginConfig(pluginId) ?? {};
}

export function setConfiguration(pluginId: string, settings: Record<string, unknown>): void {
  savePluginConfig(pluginId, settings);
}

export function mergeConfiguration(
  pluginId: string,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const current = getConfiguration(pluginId);
  const merged = { ...current, ...patch };
  savePluginConfig(pluginId, merged);
  return merged;
}
