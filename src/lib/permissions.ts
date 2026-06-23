/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { ReactNode } from "react";
import { User, UserRole } from "./types";
import { useStore } from "../store/useStore";

// ==========================================
// ROLE BASED ACCESS CONTROL CONSTANTS
// ==========================================

export const ALL_PERMISSIONS_LIST = [
  "accounts.view",
  "accounts.create",
  "accounts.edit",
  "accounts.delete",
  "vouchers.view",
  "vouchers.create",
  "vouchers.edit",
  "vouchers.delete",
  "invoices.view",
  "invoices.create",
  "invoices.edit",
  "invoices.delete",
  "reports.view",
  "reports.export",
  "masters.view",
  "masters.create",
  "masters.edit",
  "masters.delete",
  "settings.view",
  "settings.edit",
  "settings.voucher-series.view",
  "settings.fiscal.close",
  "users.manage",
  "backup.create",
  "backup.restore",
];

/**
 * Complete role-based access control mappings for Nepal Sutra ERP.
 */
export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  [UserRole.ADMIN]: ["*"],
  [UserRole.MANAGER]: ALL_PERMISSIONS_LIST.filter(
    (p) =>
      !["users.manage", "backup.restore", "settings.fiscal.close", "accounts.delete"].includes(p),
  ),
  [UserRole.ACCOUNTANT]: [
    "vouchers.view",
    "vouchers.create",
    "vouchers.edit",
    "invoices.view",
    "invoices.create",
    "invoices.edit",
    "reports.view",
    "masters.view",
    "settings.voucher-series.view",
  ],
  [UserRole.VIEWER]: [
    "accounts.view",
    "vouchers.view",
    "invoices.view",
    "reports.view",
    "masters.view",
    "settings.view",
    "settings.voucher-series.view",
    "*.view",
  ],
};

/**
 * Checks if a user has the explicit permission or a wildcard override.
 */
export function hasPermission(user: User, permission: string): boolean {
  if (!user || !user.isActive) return false;

  // Admin and * wildcard check
  if (user.role === UserRole.ADMIN) {
    return true;
  }

  const userPerms = user.permissions || ROLE_PERMISSIONS[user.role] || [];

  if (userPerms.includes("*")) {
    return true;
  }

  if (userPerms.includes(permission)) {
    return true;
  }

  // Supporting wildcard matching like "accounts.*" for "accounts.create"
  const parts = permission.split(".");
  if (parts.length > 1) {
    const parentWildcard = `${parts[0]}.*`;
    if (userPerms.includes(parentWildcard)) {
      return true;
    }
  }

  // Check for "*.view" wildcard if checking a ".view" permission
  if (permission.endsWith(".view") && userPerms.includes("*.view")) {
    return true;
  }

  return false;
}

/**
 * React hook to query permission rules for the current log-in user.
 */
export function usePermission(permission: string): boolean {
  const currentUser = useStore((state) => state.currentUser);
  if (!currentUser) return false;
  return hasPermission(currentUser, permission);
}

interface PermissionGateProps {
  permission: string;
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Declarative component to hide/show UI components based on user authority.
 */
export const PermissionGate: React.FC<PermissionGateProps> = ({
  permission,
  children,
  fallback = null,
}) => {
  const isAllowed = usePermission(permission);
  return isAllowed ? (children as React.ReactElement) : (fallback as React.ReactElement | null);
};

export default PermissionGate;
