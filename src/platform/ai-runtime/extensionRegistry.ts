import type {
  IAiRuntimeExtensionRegistry,
  AiRuntimeExtensionPoint,
  AiRuntimeHookContext,
  AiRuntimePlugin,
} from "./contracts/extensionPoints";

export class AiRuntimeExtensionRegistry implements IAiRuntimeExtensionRegistry {
  private plugins = new Map<string, AiRuntimePlugin>();

  register(plugin: AiRuntimePlugin): void {
    this.plugins.set(plugin.id, plugin);
  }

  unregister(pluginId: string): void {
    this.plugins.delete(pluginId);
  }

  async runHooks(point: AiRuntimeExtensionPoint, ctx: AiRuntimeHookContext): Promise<AiRuntimeHookContext> {
    let current = ctx;
    for (const plugin of this.plugins.values()) {
      if (!plugin.extensionPoints.includes(point)) continue;
      const result = await plugin.onHook(point, current);
      if (result) current = result;
    }
    return current;
  }

  listPlugins(): readonly AiRuntimePlugin[] {
    return [...this.plugins.values()];
  }
}

let registryInstance: AiRuntimeExtensionRegistry | null = null;

export function getExtensionRegistry(): AiRuntimeExtensionRegistry {
  if (!registryInstance) registryInstance = new AiRuntimeExtensionRegistry();
  return registryInstance;
}

export function resetExtensionRegistry(): void {
  registryInstance = null;
}
