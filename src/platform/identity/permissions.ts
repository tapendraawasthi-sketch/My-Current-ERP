import type { ScreenId, ScreenAction } from "@/lib/permissions";
import { getDefaultPermissionsForRole } from "@/lib/permissions";

export const PermissionNamespaces = {
  SCREEN: "screen",
  COMMAND: "command",
  QUERY: "query",
  ADMIN: "admin",
} as const;

export function screenPermissionKey(screenId: ScreenId, action: ScreenAction = "canView"): string {
  return `${PermissionNamespaces.SCREEN}:${screenId}:${action}`;
}

export function commandPermissionKey(commandType: string): string {
  return `${PermissionNamespaces.COMMAND}:${commandType}`;
}

export function queryPermissionKey(queryType: string): string {
  return `${PermissionNamespaces.QUERY}:${queryType}`;
}

export function evaluateScreenPermission(
  role: string,
  userId: string,
  screenId: ScreenId,
  action: ScreenAction,
): boolean {
  const profile = getDefaultPermissionsForRole(role, userId);
  const screen = profile.screenPermissions[screenId];
  if (!screen) return false;
  return Boolean(screen[action]);
}
