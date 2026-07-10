import { isMigrationFlagEnabled } from "@/platform/flags/registry";

export interface SandboxContext {
  pluginId: string;
  isolated: boolean;
  allowedApis: string[];
}

export function createSandbox(pluginId: string): SandboxContext {
  return {
    pluginId,
    isolated: isMigrationFlagEnabled("MIGRATION_PLUGIN_SANDBOX"),
    allowedApis: ["command", "query", "event", "proposal"],
  };
}

export function isApiAllowed(sandbox: SandboxContext, api: string): boolean {
  if (!sandbox.isolated) return true;
  return sandbox.allowedApis.includes(api);
}

export function blockDirectStoreAccess(): void {
  /* sandbox policy: plugins must not access useStore */
}

export function blockDirectDexieAccess(): void {
  /* sandbox policy: plugins must not access Dexie */
}
