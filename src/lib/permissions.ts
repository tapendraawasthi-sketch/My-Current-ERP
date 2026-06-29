// src/lib/permissions.ts
// ── Nepal ERP — Granular Permission Matrix (Tally Prime / Busy style) ─────────

// ─── Screen IDs ───────────────────────────────────────────────────────────────

export type ScreenId =
  | "dashboard"
  | "ledgerMaster"
  | "partyMaster"
  | "itemMaster"
  | "salesVoucher"
  | "purchaseVoucher"
  | "paymentVoucher"
  | "receiptVoucher"
  | "journalVoucher"
  | "contraVoucher"
  | "creditNote"
  | "debitNote"
  | "salesOrder"
  | "purchaseOrder"
  | "deliveryChallan"
  | "grn"
  | "stockJournal"
  | "transfer"
  | "balanceSheet"
  | "profitLoss"
  | "trialBalance"
  | "dayBook"
  | "generalLedger"
  | "vatReports"
  | "tdsReport"
  | "payroll"
  | "companySettings"
  | "userManagement"
  | "auditLog"
  | "backupRestore";

export const ALL_SCREENS: ScreenId[] = [
  "dashboard",
  "ledgerMaster",
  "partyMaster",
  "itemMaster",
  "salesVoucher",
  "purchaseVoucher",
  "paymentVoucher",
  "receiptVoucher",
  "journalVoucher",
  "contraVoucher",
  "creditNote",
  "debitNote",
  "salesOrder",
  "purchaseOrder",
  "deliveryChallan",
  "grn",
  "stockJournal",
  "transfer",
  "balanceSheet",
  "profitLoss",
  "trialBalance",
  "dayBook",
  "generalLedger",
  "vatReports",
  "tdsReport",
  "payroll",
  "companySettings",
  "userManagement",
  "auditLog",
  "backupRestore",
];

export const SCREEN_LABELS: Record<ScreenId, string> = {
  dashboard: "Dashboard",
  ledgerMaster: "Ledger Master",
  partyMaster: "Party Master",
  itemMaster: "Item Master",
  salesVoucher: "Sales Voucher",
  purchaseVoucher: "Purchase Voucher",
  paymentVoucher: "Payment Voucher",
  receiptVoucher: "Receipt Voucher",
  journalVoucher: "Journal Voucher",
  contraVoucher: "Contra Voucher",
  creditNote: "Credit Note",
  debitNote: "Debit Note",
  salesOrder: "Sales Order",
  purchaseOrder: "Purchase Order",
  deliveryChallan: "Delivery Challan",
  grn: "Goods Receipt Note",
  stockJournal: "Stock Journal",
  transfer: "Stock Transfer",
  balanceSheet: "Balance Sheet",
  profitLoss: "Profit & Loss",
  trialBalance: "Trial Balance",
  dayBook: "Day Book",
  generalLedger: "General Ledger",
  vatReports: "VAT Reports",
  tdsReport: "TDS Report",
  payroll: "Payroll",
  companySettings: "Company Settings",
  userManagement: "User Management",
  auditLog: "Audit Log",
  backupRestore: "Backup & Restore",
};

export const SCREEN_GROUPS: { label: string; screens: ScreenId[] }[] = [
  {
    label: "Masters",
    screens: ["ledgerMaster", "partyMaster", "itemMaster"],
  },
  {
    label: "Vouchers",
    screens: [
      "salesVoucher",
      "purchaseVoucher",
      "paymentVoucher",
      "receiptVoucher",
      "journalVoucher",
      "contraVoucher",
      "creditNote",
      "debitNote",
    ],
  },
  {
    label: "Inventory & Orders",
    screens: ["salesOrder", "purchaseOrder", "deliveryChallan", "grn", "stockJournal", "transfer"],
  },
  {
    label: "Reports",
    screens: [
      "balanceSheet",
      "profitLoss",
      "trialBalance",
      "dayBook",
      "generalLedger",
      "vatReports",
      "tdsReport",
    ],
  },
  {
    label: "Administration",
    screens: [
      "dashboard",
      "payroll",
      "companySettings",
      "userManagement",
      "auditLog",
      "backupRestore",
    ],
  },
];

// ─── Voucher screen IDs (subset that have amount limits) ──────────────────────

export type VoucherScreenId =
  | "salesVoucher"
  | "purchaseVoucher"
  | "paymentVoucher"
  | "receiptVoucher"
  | "journalVoucher"
  | "contraVoucher"
  | "creditNote"
  | "debitNote";

export const VOUCHER_SCREENS: VoucherScreenId[] = [
  "salesVoucher",
  "purchaseVoucher",
  "paymentVoucher",
  "receiptVoucher",
  "journalVoucher",
  "contraVoucher",
  "creditNote",
  "debitNote",
];

// ─── Core Permission Objects ───────────────────────────────────────────────────

export interface ScreenPermission {
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canPrint: boolean;
  canExport: boolean;
}

export type ScreenAction = keyof ScreenPermission;

export const SCREEN_ACTION_LABELS: Record<ScreenAction, string> = {
  canView: "View",
  canCreate: "Create",
  canEdit: "Edit",
  canDelete: "Delete",
  canPrint: "Print",
  canExport: "Export",
};

export interface VoucherAmountLimit {
  /** 0 = unlimited */
  maxAmountPerVoucher: number;
}

export interface DateRestrictions {
  allowBackDate: boolean;
  /** How many days in the past can user enter (only relevant if allowBackDate=true) */
  backDateDaysAllowed: number;
  allowFutureDate: boolean;
}

export interface AlterationRestrictions {
  canAlterPostedVoucher: boolean;
  canCancelVoucher: boolean;
  /** 0 = no time limit; only applies when canAlterPostedVoucher=true */
  canAlterWithinDays: number;
  canDeleteVoucher: boolean;
}

// ─── Full User Permission Profile ─────────────────────────────────────────────

export interface UserPermission {
  userId: string;
  role: string;
  screenPermissions: Record<ScreenId, ScreenPermission>;
  voucherAmountLimits: Record<VoucherScreenId, VoucherAmountLimit>;
  dateRestrictions: DateRestrictions;
  alterationRestrictions: AlterationRestrictions;
  updatedAt?: string;
  updatedBy?: string;
}

// ─── Reusable permission presets ──────────────────────────────────────────────

const FULL_SCREEN: ScreenPermission = {
  canView: true,
  canCreate: true,
  canEdit: true,
  canDelete: true,
  canPrint: true,
  canExport: true,
};

const VIEW_ONLY: ScreenPermission = {
  canView: true,
  canCreate: false,
  canEdit: false,
  canDelete: false,
  canPrint: true,
  canExport: true,
};

const NO_ACCESS: ScreenPermission = {
  canView: false,
  canCreate: false,
  canEdit: false,
  canDelete: false,
  canPrint: false,
  canExport: false,
};

const CREATE_EDIT: ScreenPermission = {
  canView: true,
  canCreate: true,
  canEdit: true,
  canDelete: false,
  canPrint: true,
  canExport: false,
};

// ─── Builders ─────────────────────────────────────────────────────────────────

function allScreens(perm: ScreenPermission): Record<ScreenId, ScreenPermission> {
  return ALL_SCREENS.reduce(
    (acc, id) => {
      acc[id] = { ...perm };
      return acc;
    },
    {} as Record<ScreenId, ScreenPermission>,
  );
}

const UNLIMITED: Record<VoucherScreenId, VoucherAmountLimit> = {
  salesVoucher: { maxAmountPerVoucher: 0 },
  purchaseVoucher: { maxAmountPerVoucher: 0 },
  paymentVoucher: { maxAmountPerVoucher: 0 },
  receiptVoucher: { maxAmountPerVoucher: 0 },
  journalVoucher: { maxAmountPerVoucher: 0 },
  contraVoucher: { maxAmountPerVoucher: 0 },
  creditNote: { maxAmountPerVoucher: 0 },
  debitNote: { maxAmountPerVoucher: 0 },
};

// ─── Default Role Profiles ────────────────────────────────────────────────────

/** Admin: everything, no limits */
export const ADMIN_PERMISSIONS: Omit<UserPermission, "userId"> = {
  role: "admin",
  screenPermissions: allScreens(FULL_SCREEN),
  voucherAmountLimits: { ...UNLIMITED },
  dateRestrictions: {
    allowBackDate: true,
    backDateDaysAllowed: 365,
    allowFutureDate: true,
  },
  alterationRestrictions: {
    canAlterPostedVoucher: true,
    canCancelVoucher: true,
    canAlterWithinDays: 0, // unlimited
    canDeleteVoucher: true,
  },
};

/** Manager: all screens view+create+edit, no delete, 30-day alteration, Rs. 5L limit */
export const MANAGER_PERMISSIONS: Omit<UserPermission, "userId"> = {
  role: "manager",
  screenPermissions: {
    ...allScreens(CREATE_EDIT),
    // Sensitive admin screens — view only
    userManagement: VIEW_ONLY,
    companySettings: VIEW_ONLY,
    auditLog: VIEW_ONLY,
    backupRestore: NO_ACCESS,
  },
  voucherAmountLimits: {
    salesVoucher: { maxAmountPerVoucher: 500000 }, // Rs. 5,00,000
    purchaseVoucher: { maxAmountPerVoucher: 500000 },
    paymentVoucher: { maxAmountPerVoucher: 500000 },
    receiptVoucher: { maxAmountPerVoucher: 0 }, // unlimited receipts
    journalVoucher: { maxAmountPerVoucher: 500000 },
    contraVoucher: { maxAmountPerVoucher: 500000 },
    creditNote: { maxAmountPerVoucher: 500000 },
    debitNote: { maxAmountPerVoucher: 500000 },
  },
  dateRestrictions: {
    allowBackDate: true,
    backDateDaysAllowed: 30,
    allowFutureDate: false,
  },
  alterationRestrictions: {
    canAlterPostedVoucher: true,
    canCancelVoucher: true,
    canAlterWithinDays: 30,
    canDeleteVoucher: false,
  },
};

/** Accountant: voucher entry only, Rs. 1L limit, no master create, no alter after posting */
export const ACCOUNTANT_PERMISSIONS: Omit<UserPermission, "userId"> = {
  role: "accountant",
  screenPermissions: {
    dashboard: VIEW_ONLY,
    // Masters: view only
    ledgerMaster: VIEW_ONLY,
    partyMaster: VIEW_ONLY,
    itemMaster: VIEW_ONLY,
    // Vouchers: create + edit
    salesVoucher: CREATE_EDIT,
    purchaseVoucher: CREATE_EDIT,
    paymentVoucher: CREATE_EDIT,
    receiptVoucher: CREATE_EDIT,
    journalVoucher: CREATE_EDIT,
    contraVoucher: CREATE_EDIT,
    creditNote: CREATE_EDIT,
    debitNote: CREATE_EDIT,
    // Inventory: create + edit
    salesOrder: CREATE_EDIT,
    purchaseOrder: CREATE_EDIT,
    deliveryChallan: CREATE_EDIT,
    grn: CREATE_EDIT,
    stockJournal: CREATE_EDIT,
    transfer: CREATE_EDIT,
    // Reports: view + print only (no export)
    balanceSheet: { ...VIEW_ONLY, canExport: false },
    profitLoss: { ...VIEW_ONLY, canExport: false },
    trialBalance: VIEW_ONLY,
    dayBook: VIEW_ONLY,
    generalLedger: VIEW_ONLY,
    vatReports: VIEW_ONLY,
    tdsReport: VIEW_ONLY,
    // Admin: no access
    payroll: NO_ACCESS,
    companySettings: NO_ACCESS,
    userManagement: NO_ACCESS,
    auditLog: NO_ACCESS,
    backupRestore: NO_ACCESS,
  },
  voucherAmountLimits: {
    salesVoucher: { maxAmountPerVoucher: 100000 }, // Rs. 1,00,000
    purchaseVoucher: { maxAmountPerVoucher: 100000 },
    paymentVoucher: { maxAmountPerVoucher: 50000 }, // Rs. 50,000
    receiptVoucher: { maxAmountPerVoucher: 100000 },
    journalVoucher: { maxAmountPerVoucher: 100000 },
    contraVoucher: { maxAmountPerVoucher: 100000 },
    creditNote: { maxAmountPerVoucher: 100000 },
    debitNote: { maxAmountPerVoucher: 100000 },
  },
  dateRestrictions: {
    allowBackDate: true,
    backDateDaysAllowed: 7,
    allowFutureDate: false,
  },
  alterationRestrictions: {
    canAlterPostedVoucher: false,
    canCancelVoucher: false,
    canAlterWithinDays: 0,
    canDeleteVoucher: false,
  },
};

/** Viewer: view + print + export only, no create/edit/delete */
export const VIEWER_PERMISSIONS: Omit<UserPermission, "userId"> = {
  role: "viewer",
  screenPermissions: {
    dashboard: VIEW_ONLY,
    ledgerMaster: VIEW_ONLY,
    partyMaster: VIEW_ONLY,
    itemMaster: VIEW_ONLY,
    salesVoucher: VIEW_ONLY,
    purchaseVoucher: VIEW_ONLY,
    paymentVoucher: VIEW_ONLY,
    receiptVoucher: VIEW_ONLY,
    journalVoucher: VIEW_ONLY,
    contraVoucher: VIEW_ONLY,
    creditNote: VIEW_ONLY,
    debitNote: VIEW_ONLY,
    salesOrder: VIEW_ONLY,
    purchaseOrder: VIEW_ONLY,
    deliveryChallan: VIEW_ONLY,
    grn: VIEW_ONLY,
    stockJournal: VIEW_ONLY,
    transfer: VIEW_ONLY,
    balanceSheet: VIEW_ONLY,
    profitLoss: VIEW_ONLY,
    trialBalance: VIEW_ONLY,
    dayBook: VIEW_ONLY,
    generalLedger: VIEW_ONLY,
    vatReports: VIEW_ONLY,
    tdsReport: VIEW_ONLY,
    payroll: NO_ACCESS,
    companySettings: NO_ACCESS,
    userManagement: NO_ACCESS,
    auditLog: NO_ACCESS,
    backupRestore: NO_ACCESS,
  },
  voucherAmountLimits: { ...UNLIMITED },
  dateRestrictions: {
    allowBackDate: false,
    backDateDaysAllowed: 0,
    allowFutureDate: false,
  },
  alterationRestrictions: {
    canAlterPostedVoucher: false,
    canCancelVoucher: false,
    canAlterWithinDays: 0,
    canDeleteVoucher: false,
  },
};

// ─── Exported Helpers ─────────────────────────────────────────────────────────

export function getDefaultPermissionsForRole(role: string, userId: string): UserPermission {
  const norm = role.toLowerCase();
  let base: Omit<UserPermission, "userId">;
  switch (norm) {
    case "admin":
      base = ADMIN_PERMISSIONS;
      break;
    case "manager":
      base = MANAGER_PERMISSIONS;
      break;
    case "accountant":
      base = ACCOUNTANT_PERMISSIONS;
      break;
    default:
      base = VIEWER_PERMISSIONS;
  }
  return { ...base, userId, role: norm, updatedAt: new Date().toISOString() };
}

export function formatAmountLimit(limit: number): string {
  if (limit === 0) return "Unlimited";
  return `Rs. ${limit.toLocaleString("en-IN")}`;
}

export function checkAmountAgainstLimit(
  amount: number,
  limit: number,
): { exceeded: boolean; message: string } {
  if (limit === 0) return { exceeded: false, message: "" };
  if (amount > limit) {
    return {
      exceeded: true,
      message: `Your authorization limit is ${formatAmountLimit(limit)}. This voucher (${formatAmountLimit(amount)}) requires manager approval.`,
    };
  }
  return { exceeded: false, message: "" };
}

/** Merge a custom permission profile onto the role defaults (for partial overrides) */
export function mergePermissions(
  base: UserPermission,
  overrides: Partial<
    Pick<
      UserPermission,
      "screenPermissions" | "voucherAmountLimits" | "dateRestrictions" | "alterationRestrictions"
    >
  >,
): UserPermission {
  return {
    ...base,
    screenPermissions: { ...base.screenPermissions, ...overrides.screenPermissions },
    voucherAmountLimits: { ...base.voucherAmountLimits, ...overrides.voucherAmountLimits },
    dateRestrictions: { ...base.dateRestrictions, ...overrides.dateRestrictions },
    alterationRestrictions: { ...base.alterationRestrictions, ...overrides.alterationRestrictions },
    updatedAt: new Date().toISOString(),
  };
}

// ─── Legacy Permission Helpers ────────────────────────────────────────────────
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
  return String(role || "")
    .trim()
    .toLowerCase();
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
