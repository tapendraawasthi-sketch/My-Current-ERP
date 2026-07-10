const granted = new Map<string, Set<string>>();

const DEFAULT_PERMISSIONS = ["event.subscribe", "query.execute"];

export function grantPermissions(permissions: string[]): string[] {
  return [...new Set([...DEFAULT_PERMISSIONS, ...permissions])];
}

export function setPluginPermissions(pluginId: string, permissions: string[]): void {
  granted.set(pluginId, new Set(permissions));
}

export function hasPermission(pluginId: string, permission: string): boolean {
  const perms = granted.get(pluginId);
  if (!perms) return false;
  return perms.has(permission) || perms.has("*");
}

export function revokePluginPermissions(pluginId: string): void {
  granted.delete(pluginId);
}

export function listPluginPermissions(pluginId: string): string[] {
  return Array.from(granted.get(pluginId) ?? []);
}

export const PluginPermissions = {
  COMMAND_EXECUTE: "command.execute",
  QUERY_EXECUTE: "query.execute",
  EVENT_SUBSCRIBE: "event.subscribe",
  PROPOSAL_SUBMIT: "proposal.submit",
  CONFIG_READ: "config.read",
  CONFIG_WRITE: "config.write",
} as const;
