const configStore = new Map<string, Record<string, unknown>>();

export function savePluginConfig(pluginId: string, config: Record<string, unknown>): void {
  configStore.set(pluginId, config);
}

export function getPluginConfig(pluginId: string): Record<string, unknown> | null {
  return configStore.get(pluginId) ?? null;
}

export function clearPluginConfig(pluginId: string): void {
  configStore.delete(pluginId);
}

export function listPluginConfigs(): Map<string, Record<string, unknown>> {
  return new Map(configStore);
}
