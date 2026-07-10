export interface NiosPlugin {
  id: string;
  name: string;
  version: string;
  onLoad?: () => void | Promise<void>;
  onUnload?: () => void | Promise<void>;
}

const plugins = new Map<string, NiosPlugin>();

export function registerPlugin(plugin: NiosPlugin): void {
  plugins.set(plugin.id, plugin);
}

export async function loadPlugin(id: string): Promise<boolean> {
  const plugin = plugins.get(id);
  if (!plugin) return false;
  if (plugin.onLoad) await plugin.onLoad();
  return true;
}

export async function unloadPlugin(id: string): Promise<boolean> {
  const plugin = plugins.get(id);
  if (!plugin) return false;
  if (plugin.onUnload) await plugin.onUnload();
  return true;
}

export function listPlugins(): NiosPlugin[] {
  return Array.from(plugins.values());
}
