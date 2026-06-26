import { useStore } from "@/store/useStore";

export function useTopMenuPermission() {
  const currentUser = useStore((state) => state.currentUser);

  const role = String(currentUser?.role || "").toLowerCase();

  const isAdmin =
    role.includes("admin") ||
    role.includes("owner") ||
    role.includes("super");

  const isAccountant =
    isAdmin ||
    role.includes("accountant") ||
    role.includes("manager") ||
    role.includes("finance");

  const isAuditor =
    isAdmin ||
    role.includes("auditor") ||
    role.includes("viewer") ||
    role.includes("read");

  const canAccess = (permission?: string, adminOnly?: boolean) => {
    if (!permission && !adminOnly) return true;

    if (adminOnly) return isAdmin;

    if (!permission) return true;

    if (isAdmin) return true;

    if (
      permission.startsWith("print.") ||
      permission.startsWith("export.") ||
      permission.startsWith("share.")
    ) {
      return isAccountant || isAuditor;
    }

    if (permission.startsWith("import.")) {
      return isAccountant;
    }

    if (permission.startsWith("data.backup")) {
      return isAccountant;
    }

    if (
      permission.startsWith("data.repair") ||
      permission.startsWith("data.migrate") ||
      permission.startsWith("data.split") ||
      permission.startsWith("company.security") ||
      permission.startsWith("company.encryption") ||
      permission.startsWith("company.licensing")
    ) {
      return isAdmin;
    }

    if (permission.startsWith("company.select")) return true;

    return isAccountant;
  };

  return {
    currentUser,
    role,
    isAdmin,
    isAccountant,
    isAuditor,
    canAccess,
  };
}
