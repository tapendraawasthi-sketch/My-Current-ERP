const capabilities = new Map<string, { pluginId: string; capability: string }>();

export function registerCapability(pluginId: string, capability: string): void {
  capabilities.set(`${pluginId}:${capability}`, { pluginId, capability });
}

export function unregisterPluginCapabilities(pluginId: string): void {
  for (const [key, entry] of capabilities) {
    if (entry.pluginId === pluginId) capabilities.delete(key);
  }
}

export function listCapabilities(): Array<{ pluginId: string; capability: string }> {
  return Array.from(capabilities.values());
}

export function findPluginForCapability(capability: string): string | null {
  for (const entry of capabilities.values()) {
    if (entry.capability === capability) return entry.pluginId;
  }
  return null;
}

export function registerCapabilitiesFromManifest(pluginId: string, caps: string[]): void {
  for (const cap of caps) {
    registerCapability(pluginId, cap);
  }
}
