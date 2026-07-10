import { hasPermission } from "./pluginPermissions";
import { isApiAllowed, createSandbox } from "./pluginSandbox";

export interface SecurityCheckResult {
  allowed: boolean;
  reason?: string;
}

export function checkCommandAccess(pluginId: string): SecurityCheckResult {
  if (!hasPermission(pluginId, "command.execute")) {
    return { allowed: false, reason: "Missing command.execute permission" };
  }
  const sandbox = createSandbox(pluginId);
  if (!isApiAllowed(sandbox, "command")) {
    return { allowed: false, reason: "Command API blocked by sandbox" };
  }
  return { allowed: true };
}

export function checkQueryAccess(pluginId: string): SecurityCheckResult {
  if (!hasPermission(pluginId, "query.execute")) {
    return { allowed: false, reason: "Missing query.execute permission" };
  }
  return { allowed: true };
}

export function checkProposalAccess(pluginId: string): SecurityCheckResult {
  if (!hasPermission(pluginId, "proposal.submit")) {
    return { allowed: false, reason: "Missing proposal.submit permission" };
  }
  return { allowed: true };
}

export function checkEventAccess(pluginId: string): SecurityCheckResult {
  if (!hasPermission(pluginId, "event.subscribe")) {
    return { allowed: false, reason: "Missing event.subscribe permission" };
  }
  return { allowed: true };
}

export const FORBIDDEN_APIS = ["useStore", "getDB", "Dexie", "directWrite"] as const;

export function isForbiddenApi(api: string): boolean {
  return FORBIDDEN_APIS.some((f) => api.toLowerCase().includes(f.toLowerCase()));
}
