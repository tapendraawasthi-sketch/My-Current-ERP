export const SystemRoles = {
  OWNER: "owner",
  ADMIN: "admin",
  ACCOUNTANT: "accountant",
  USER: "user",
  VIEWER: "viewer",
} as const;

export type SystemRole = (typeof SystemRoles)[keyof typeof SystemRoles];

export const ALL_SYSTEM_ROLES: SystemRole[] = Object.values(SystemRoles);

export function normalizeRole(role: string): string {
  return (role || "user").trim().toLowerCase();
}

export function isAdminRole(role: string): boolean {
  const r = normalizeRole(role);
  return r === SystemRoles.OWNER || r === SystemRoles.ADMIN;
}

export function isAccountantRole(role: string): boolean {
  const r = normalizeRole(role);
  return r === SystemRoles.ACCOUNTANT || isAdminRole(r);
}

export function roleHierarchyLevel(role: string): number {
  const r = normalizeRole(role);
  switch (r) {
    case SystemRoles.OWNER:
      return 100;
    case SystemRoles.ADMIN:
      return 90;
    case SystemRoles.ACCOUNTANT:
      return 70;
    case SystemRoles.USER:
      return 50;
    case SystemRoles.VIEWER:
      return 10;
    default:
      return 40;
  }
}

export function roleSatisfies(actualRole: string, requiredRole: string): boolean {
  return roleHierarchyLevel(actualRole) >= roleHierarchyLevel(requiredRole);
}
