import { isMigrationFlagEnabled } from "@/platform/flags/registry";

export interface ProviderDescriptor {
  id: string;
  name: string;
  type: "ollama" | "openai" | "anthropic" | "local" | "custom";
  endpoint?: string;
  enabled: boolean;
}

const providers = new Map<string, ProviderDescriptor>();

const DEFAULT_PROVIDERS: ProviderDescriptor[] = [
  { id: "ollama", name: "Ollama Local", type: "ollama", endpoint: "http://localhost:11434", enabled: true },
  { id: "openai", name: "OpenAI", type: "openai", enabled: false },
  { id: "anthropic", name: "Anthropic", type: "anthropic", enabled: false },
  { id: "local-fallback", name: "Local Fallback", type: "local", enabled: true },
];

for (const provider of DEFAULT_PROVIDERS) {
  providers.set(provider.id, provider);
}

export function registerProvider(descriptor: ProviderDescriptor): void {
  providers.set(descriptor.id, descriptor);
}

export function getProvider(id: string): ProviderDescriptor | null {
  return providers.get(id) ?? null;
}

export function listProviders(): ProviderDescriptor[] {
  if (!isMigrationFlagEnabled("MIGRATION_NIOS_PROVIDERS")) {
    return providers.values().next().value ? [providers.get("local-fallback")!] : [];
  }
  return Array.from(providers.values());
}

export function listEnabledProviders(): ProviderDescriptor[] {
  return listProviders().filter((p) => p.enabled);
}
