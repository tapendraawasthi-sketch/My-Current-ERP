import type { HomeWorkspaceId, QuickActionDef } from "./types";
import { canCreateScreen, canViewScreen } from "./roleWorkspace";
import type { ScreenId, UserPermission } from "@/lib/permissions";

type Profile = UserPermission;

const REGISTRY: QuickActionDef[] = [
  {
    id: "new_sale",
    label: "New sales invoice",
    description: "Open billing",
    page: "billing",
    icon: "TrendingUp",
    permissionScreen: "salesVoucher",
    requireCreate: true,
    rolesPriority: ["owner", "cashier", "accountant", "combined"],
    mobileEligible: true,
  },
  {
    id: "new_purchase",
    label: "Record purchase",
    page: "purchase",
    icon: "TrendingDown",
    permissionScreen: "purchaseVoucher",
    requireCreate: true,
    rolesPriority: ["owner", "accountant", "inventory", "combined"],
    mobileEligible: true,
  },
  {
    id: "receive_money",
    label: "Receive money",
    page: "receipt",
    icon: "Receipt",
    permissionScreen: "receiptVoucher",
    requireCreate: true,
    rolesPriority: ["cashier", "banking", "accountant", "owner", "combined"],
    mobileEligible: true,
  },
  {
    id: "make_payment",
    label: "Make payment",
    page: "payment",
    icon: "Banknote",
    permissionScreen: "paymentVoucher",
    requireCreate: true,
    rolesPriority: ["cashier", "banking", "accountant", "owner", "combined"],
    mobileEligible: true,
  },
  {
    id: "journal",
    label: "Journal entry",
    page: "journal",
    icon: "FileText",
    permissionScreen: "journalVoucher",
    requireCreate: true,
    rolesPriority: ["accountant", "auditor", "combined"],
    mobileEligible: false,
  },
  {
    id: "bank_recon",
    label: "Bank reconciliation",
    page: "bank-reconciliation",
    icon: "Landmark",
    permissionScreen: "dayBook",
    requireCreate: false,
    rolesPriority: ["banking", "accountant", "auditor", "combined"],
    mobileEligible: true,
  },
  {
    id: "trial_balance",
    label: "Trial balance",
    page: "trial-balance",
    icon: "Scale",
    permissionScreen: "trialBalance",
    requireCreate: false,
    rolesPriority: ["accountant", "auditor", "owner", "combined"],
    mobileEligible: false,
  },
  {
    id: "stock",
    label: "Review stock",
    page: "stock-summary",
    icon: "Package",
    permissionScreen: "itemMaster",
    requireCreate: false,
    rolesPriority: ["inventory", "owner", "accountant", "combined"],
    mobileEligible: true,
  },
  {
    id: "users",
    label: "Manage users",
    page: "users",
    icon: "Users",
    permissionScreen: "userManagement",
    requireCreate: false,
    rolesPriority: ["administrator"],
    mobileEligible: false,
  },
  {
    id: "backup",
    label: "Backup & restore",
    page: "backup-restore",
    icon: "HardDrive",
    permissionScreen: "backupRestore",
    requireCreate: false,
    rolesPriority: ["administrator"],
    mobileEligible: false,
  },
  {
    id: "ask_orbix",
    label: "Ask Orbix",
    page: "orbix",
    icon: "MessageSquare",
    rolesPriority: [
      "owner",
      "accountant",
      "cashier",
      "banking",
      "inventory",
      "auditor",
      "administrator",
      "combined",
      "restricted",
    ],
    mobileEligible: true,
    orbix: true,
  },
];

export function selectQuickActions(
  workspaces: HomeWorkspaceId[],
  profile: Profile,
  isAdmin: boolean,
  opts?: { mobile?: boolean; limit?: number },
): QuickActionDef[] {
  const primary = workspaces.includes("combined")
    ? "combined"
    : workspaces[0] ?? "restricted";
  const scored = REGISTRY.map((action) => {
    let score = action.rolesPriority.indexOf(primary);
    if (score < 0) {
      score = Math.min(
        ...workspaces.map((w) => {
          const i = action.rolesPriority.indexOf(w);
          return i < 0 ? 99 : i;
        }),
      );
    }
    return { action, score };
  })
    .filter(({ score, action }) => {
      if (score >= 90 && primary !== "restricted" && action.id !== "ask_orbix") return false;
      if (opts?.mobile && !action.mobileEligible && action.id !== "ask_orbix") return false;
      if (!action.permissionScreen) return true;
      const screen = action.permissionScreen as ScreenId;
      if (action.requireCreate) return canCreateScreen(profile, screen, isAdmin);
      return canViewScreen(profile, screen, isAdmin);
    })
    .sort((a, b) => a.score - b.score);

  const seen = new Set<string>();
  const out: QuickActionDef[] = [];
  for (const { action } of scored) {
    if (seen.has(action.id)) continue;
    seen.add(action.id);
    out.push(action);
    if (out.length >= (opts?.limit ?? 6)) break;
  }
  return out;
}

export { REGISTRY as QUICK_ACTION_REGISTRY };
