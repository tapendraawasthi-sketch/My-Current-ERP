export type PermissionMap = Record<string, string[]>;

export function hasPermission(
  permissions: PermissionMap | undefined,
  module: string,
  action: string,
): boolean {
  const modulePerms = permissions?.[module] ?? [];
  return modulePerms.includes("full_access") || modulePerms.includes(action);
}

export function normalizeRole(role?: string): string {
  return String(role || "").trim().toLowerCase();
}

export function isAdminOrOwner(role?: string): boolean {
  const normalized = normalizeRole(role);
  return ["admin", "owner", "super_admin", "superuser"].includes(normalized);
}

export function isAccountantOrAdmin(role?: string): boolean {
  const normalized = normalizeRole(role);
  return ["admin", "owner", "super_admin", "superuser", "accountant"].includes(normalized);
}

export function canManageCompany(role?: string, permissions?: PermissionMap): boolean {
  return isAdminOrOwner(role) || hasPermission(permissions, "company", "full_access");
}

export function canManageSecurity(role?: string, permissions?: PermissionMap): boolean {
  return isAdminOrOwner(role) || hasPermission(permissions, "security", "full_access");
}

export function canBackupRestore(role?: string, permissions?: PermissionMap): boolean {
  return (
    isAccountantOrAdmin(role) ||
    hasPermission(permissions, "data", "backup") ||
    hasPermission(permissions, "data", "restore")
  );
}

export function canImport(role?: string, permissions?: PermissionMap): boolean {
  return isAccountantOrAdmin(role) || hasPermission(permissions, "import", "create");
}

export function canExport(role?: string, permissions?: PermissionMap): boolean {
  return (
    hasPermission(permissions, "export", "view") ||
    hasPermission(permissions, "export", "create") ||
    hasPermission(permissions, "export", "full_access") ||
    true
  );
}

export function canPrint(role?: string, permissions?: PermissionMap): boolean {
  return (
    hasPermission(permissions, "print", "view") ||
    hasPermission(permissions, "print", "create") ||
    hasPermission(permissions, "print", "full_access") ||
    true
  );
}

export function canDelete(role?: string, permissions?: PermissionMap): boolean {
  return isAdminOrOwner(role) || hasPermission(permissions, "admin", "delete");
}
