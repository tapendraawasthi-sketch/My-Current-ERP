export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  minHostVersion?: string;
  capabilities: string[];
  permissions: string[];
  extensionPoints: string[];
  entryPoint?: string;
  config?: Record<string, unknown>;
}

export function createManifest(input: PluginManifest): PluginManifest {
  return {
    minHostVersion: "1.0.0",
    ...input,
  };
}
