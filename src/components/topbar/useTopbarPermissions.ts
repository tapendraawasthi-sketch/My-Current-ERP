import { useMemo } from "react";
import { useStore } from "@/store/useStore";
import {
  PermissionMap,
  canBackupRestore,
  canDelete,
  canExport,
  canImport,
  canManageCompany,
  canManageSecurity,
  canPrint,
  isAdminOrOwner,
} from "@/lib/permissions";

interface UserWithOptionalPermissions {
  role?: string;
  permissions?: PermissionMap;
}

export function useTopbarPermissions() {
  const currentUser = useStore((state) => state.currentUser) as UserWithOptionalPermissions | null;

  return useMemo(() => {
    const role = String(currentUser?.role || "");
    const permissions = currentUser?.permissions ?? {};

    return {
      role,
      permissions,
      isAdmin: isAdminOrOwner(role),
      canManageCompany: canManageCompany(role, permissions),
      canManageSecurity: canManageSecurity(role, permissions),
      canBackupRestore: canBackupRestore(role, permissions),
      canImport: canImport(role, permissions),
      canExport: canExport(role, permissions),
      canPrint: canPrint(role, permissions),
      canDelete: canDelete(role, permissions),
    };
  }, [currentUser?.permissions, currentUser?.role]);
}
