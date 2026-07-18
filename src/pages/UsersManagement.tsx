// @ts-nocheck
import React, { useState, useEffect, useMemo } from "react";
import { useStore } from "../store/useStore";
import { getDB, generateId } from "../lib/db";
import * as XLSX from "xlsx";
import toast from "@/lib/appToast";
import {
  User,
  Shield,
  Lock,
  Eye,
  EyeOff,
  Plus,
  Edit2,
  Trash2,
  LogOut,
  AlertTriangle,
  CheckCircle,
  HelpCircle,
  X,
} from "lucide-react";
import { useBranchFilter } from "../hooks/useBranchFilter";
import { readActiveBranchId } from "../lib/activeBranch";

function money(v: number): string {
  const abs = Math.abs(Number(v || 0));
  const s = abs.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return v < 0 ? `(${s})` : s;
}

const ALL_PERMISSIONS = [
  "VIEW_VOUCHERS",
  "CREATE_VOUCHERS",
  "EDIT_VOUCHERS",
  "DELETE_VOUCHERS",
  "APPROVE_VOUCHERS",
  "POST_VOUCHERS",
  "VIEW_REPORTS",
  "EXPORT_REPORTS",
  "PRINT_REPORTS",
  "VIEW_PROFIT_MARGINS",
  "VIEW_COST_PRICES",
  "VIEW_MASTERS",
  "CREATE_MASTERS",
  "EDIT_MASTERS",
  "DELETE_MASTERS",
  "VIEW_PAYROLL",
  "CREATE_PAYROLL",
  "APPROVE_PAYROLL",
  "VIEW_SALARY_DETAILS",
  "VIEW_INVENTORY",
  "ADJUST_INVENTORY",
  "VIEW_STOCK_VALUE",
  "VIEW_BANKING",
  "CREATE_BANKING",
  "RECONCILE_BANKING",
  "CHEQUE_PRINTING",
  "VIEW_TAX",
  "FILE_TAX",
  "VIEW_TDS",
  "APPLY_DISCOUNT_ABOVE_5PCT",
  "CHANGE_VOUCHER_PRICES",
  "VIEW_PARTY_LEDGER",
  "PERIOD_LOCK",
  "PERIOD_UNLOCK",
  "YEAR_END_CLOSING",
  "VIEW_AUDIT_LOG",
  "USER_MANAGEMENT",
  "SYSTEM_SETTINGS",
  "COMPANY_SETTINGS",
  "VIEW_BUDGET",
  "CREATE_BUDGET",
  "APPROVE_BUDGET",
  "POS_ACCESS",
  "POS_VOID_BILL",
  "POS_CLOSE_SHIFT",
];

const DEFAULT_ROLES = {
  admin: ALL_PERMISSIONS,
  manager: ALL_PERMISSIONS.filter(
    (p) =>
      ![
        "USER_MANAGEMENT",
        "SYSTEM_SETTINGS",
        "DELETE_VOUCHERS",
        "YEAR_END_CLOSING",
        "PERIOD_UNLOCK",
      ].includes(p),
  ),
  accountant: [
    "VIEW_VOUCHERS",
    "CREATE_VOUCHERS",
    "EDIT_VOUCHERS",
    "VIEW_REPORTS",
    "EXPORT_REPORTS",
    "PRINT_REPORTS",
    "VIEW_MASTERS",
    "CREATE_MASTERS",
    "VIEW_INVENTORY",
    "VIEW_BANKING",
    "CREATE_BANKING",
    "VIEW_TAX",
    "VIEW_PAYROLL",
    "VIEW_BUDGET",
    "POS_ACCESS",
  ],
  viewer: [
    "VIEW_VOUCHERS",
    "VIEW_REPORTS",
    "VIEW_MASTERS",
    "VIEW_INVENTORY",
    "VIEW_BANKING",
    "VIEW_TAX",
  ],
};

const PERMISSION_GROUPS = {
  "Voucher Management": [
    "VIEW_VOUCHERS",
    "CREATE_VOUCHERS",
    "EDIT_VOUCHERS",
    "DELETE_VOUCHERS",
    "APPROVE_VOUCHERS",
    "POST_VOUCHERS",
  ],
  "Report Access": [
    "VIEW_REPORTS",
    "EXPORT_REPORTS",
    "PRINT_REPORTS",
    "VIEW_PROFIT_MARGINS",
    "VIEW_COST_PRICES",
  ],
  "Master Data": ["VIEW_MASTERS", "CREATE_MASTERS", "EDIT_MASTERS", "DELETE_MASTERS"],
  Payroll: ["VIEW_PAYROLL", "CREATE_PAYROLL", "APPROVE_PAYROLL", "VIEW_SALARY_DETAILS"],
  Inventory: ["VIEW_INVENTORY", "ADJUST_INVENTORY", "VIEW_STOCK_VALUE"],
  "Banking & Finance": ["VIEW_BANKING", "CREATE_BANKING", "RECONCILE_BANKING", "CHEQUE_PRINTING"],
  "Tax & Compliance": ["VIEW_TAX", "FILE_TAX", "VIEW_TDS"],
  "Sales Controls": ["APPLY_DISCOUNT_ABOVE_5PCT", "CHANGE_VOUCHER_PRICES", "VIEW_PARTY_LEDGER"],
  "Period Management": ["PERIOD_LOCK", "PERIOD_UNLOCK", "YEAR_END_CLOSING"],
  Administration: ["VIEW_AUDIT_LOG", "USER_MANAGEMENT", "SYSTEM_SETTINGS", "COMPANY_SETTINGS"],
  Budget: ["VIEW_BUDGET", "CREATE_BUDGET", "APPROVE_BUDGET"],
  "Point of Sale": ["POS_ACCESS", "POS_VOID_BILL", "POS_CLOSE_SHIFT"],
};

const MODULE_ACCESS_GROUPS = {
  Vouchers: [
    "VIEW_VOUCHERS",
    "CREATE_VOUCHERS",
    "EDIT_VOUCHERS",
    "DELETE_VOUCHERS",
    "APPROVE_VOUCHERS",
  ],
  Reports: ["VIEW_REPORTS", "EXPORT_REPORTS", "PRINT_REPORTS", "VIEW_PROFIT_MARGINS"],
  Masters: ["VIEW_MASTERS", "CREATE_MASTERS", "EDIT_MASTERS", "DELETE_MASTERS"],
  Payroll: ["VIEW_PAYROLL", "CREATE_PAYROLL", "APPROVE_PAYROLL"],
  Inventory: ["VIEW_INVENTORY", "ADJUST_INVENTORY"],
  Banking: ["VIEW_BANKING", "CREATE_BANKING", "RECONCILE_BANKING"],
  Tax: ["VIEW_TAX", "FILE_TAX"],
  System: ["USER_MANAGEMENT", "SYSTEM_SETTINGS", "PERIOD_LOCK", "YEAR_END_CLOSING"],
  POS: ["POS_ACCESS", "POS_VOID_BILL", "POS_CLOSE_SHIFT"],
};

export function filterByUserBranch(data: any[], currentUser: any): any[] {
  if (!currentUser?.costCenterId || currentUser.role === "admin") return data || [];
  return (data || []).filter(
    (item) => !item.costCenterId || item.costCenterId === currentUser.costCenterId,
  );
}

export async function recordLoginEvent(
  username: string,
  action: "login" | "logout" | "failed" | "locked",
  ipAddress?: string,
) {
  const db = getDB();
  await db
    .table("loginAudit")
    .add({
      id: generateId(),
      username,
      action,
      ipAddress: ipAddress || "unknown",
      timestamp: new Date().toISOString(),
      userAgent:
        typeof navigator !== "undefined" && navigator.userAgent
          ? navigator.userAgent.slice(0, 100)
          : "unknown",
    })
    .catch(() => {});
}

function roleBadgeClass(role: string) {
  const r = String(role || "custom").toLowerCase();
  if (r === "admin") return "bg-red-50 text-red-700 border border-red-200";
  if (r === "manager") return "bg-amber-50 text-amber-700 border border-amber-200";
  if (r === "accountant") return "bg-blue-50 text-blue-700 border border-blue-200";
  if (r === "viewer") return "bg-green-50 text-green-700 border border-green-200";
  return "bg-gray-50 text-gray-700 border border-gray-200";
}

function actionBadgeClass(action: string) {
  const a = String(action || "").toLowerCase();
  if (a === "login") return "bg-green-50 text-green-700 border-green-200";
  if (a === "logout") return "bg-gray-50 text-gray-700 border-gray-200";
  if (a === "failed") return "bg-amber-50 text-amber-700 border-amber-200";
  if (a === "locked") return "bg-red-50 text-red-700 border-red-200";
  return "bg-gray-50 text-gray-700 border-gray-200";
}

function defaultUserForm() {
  return {
    id: "",
    username: "",
    name: "",
    email: "",
    phone: "",
    role: "viewer",
    costCenterId: "",
    isActive: true,
    forcePasswordChange: false,
    fromTime: "08:00",
    toTime: "18:00",
    allowedIPsText: "",
    maxSessions: 1,
    permissions: DEFAULT_ROLES.viewer,
  };
}

function defaultSecuritySettings() {
  return {
    id: "global",
    minPasswordLength: 8,
    requireUppercase: true,
    requireNumber: true,
    requireSpecial: true,
    passwordExpiryDays: 90,
    failedAttempts: 5,
    lockoutMinutes: 30,
    sessionTimeoutMinutes: 60,
    require2FAAdmin: false,
    allowedIpRanges: "",
    maskBankAccounts: true,
    maskPanReports: true,
    watermarkPrints: false,
  };
}

export default function UsersManagement() {
  const {
    users: storeUsers = [],
    roles: storeRoles = [],
    costCenters = [],
    currentUser = {},
    addUser,
    updateUser,
    deleteUser,
  } = useStore();
  const { branchFilter, setBranchFilter, matchBranch, branchOptions } = useBranchFilter();

  const [activeTab, setActiveTab] = useState("Users");

  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [securitySettings, setSecuritySettings] = useState(defaultSecuritySettings());
  const [auditEvents, setAuditEvents] = useState([]);

  const [search, setSearch] = useState("");
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userForm, setUserForm] = useState(defaultUserForm());
  const [showIpHelp, setShowIpHelp] = useState(false);

  const [newRoleName, setNewRoleName] = useState("");
  const [auditUser, setAuditUser] = useState("");
  const [auditAction, setAuditAction] = useState("all");
  const [auditFrom, setAuditFrom] = useState("");
  const [auditTo, setAuditTo] = useState("");

  useEffect(() => {
    loadUsers();
    loadRoles();
    loadSecuritySettings();
    loadAuditEvents();
  }, []);

  async function loadUsers() {
    const db = getDB();
    const dbUsers = await db
      .table("users")
      .toArray()
      .catch(() => []);
    const merged = dbUsers.length ? dbUsers : storeUsers || [];
    setUsers(merged || []);
  }

  async function loadRoles() {
    const db = getDB();
    const dbRoles = await db
      .table("roles")
      .toArray()
      .catch(() => []);
    let merged = dbRoles.length ? dbRoles : storeRoles || [];

    if (!merged || merged.length === 0) {
      merged = Object.entries(DEFAULT_ROLES).map(([name, permissions]) => ({
        id: name,
        name,
        permissions,
        isDefault: true,
      }));
      for (const role of merged) {
        await db
          .table("roles")
          .put(role)
          .catch(() => {});
      }
    }

    const roleMap = new Map();
    merged.forEach((r) => roleMap.set(String(r.name || r.id).toLowerCase(), r));

    Object.entries(DEFAULT_ROLES).forEach(([name, permissions]) => {
      if (!roleMap.has(name)) {
        merged.push({ id: name, name, permissions, isDefault: true });
      }
    });

    setRoles(merged);
  }

  async function loadSecuritySettings() {
    const db = getDB();
    const s = await db
      .table("securitySettings")
      .get("global")
      .catch(() => null);
    if (s) setSecuritySettings({ ...defaultSecuritySettings(), ...s });
  }

  async function loadAuditEvents() {
    const db = getDB();
    const rows = await db
      .table("loginAudit")
      .orderBy("timestamp")
      .reverse()
      .limit(200)
      .toArray()
      .catch(() => []);

    if (rows.length === 0) {
      const seed = [
        {
          id: "1",
          username: currentUser?.username || "admin",
          action: "login",
          ipAddress: "192.168.1.1",
          timestamp: new Date().toISOString(),
          userAgent: "Chrome",
        },
        {
          id: "2",
          username: currentUser?.username || "admin",
          action: "logout",
          ipAddress: "192.168.1.1",
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          userAgent: "Chrome",
        },
        {
          id: "3",
          username: "accountant",
          action: "failed",
          ipAddress: "192.168.1.25",
          timestamp: new Date(Date.now() - 7200000).toISOString(),
          userAgent: "Firefox",
        },
        {
          id: "4",
          username: "viewer",
          action: "login",
          ipAddress: "192.168.1.30",
          timestamp: new Date(Date.now() - 10800000).toISOString(),
          userAgent: "Edge",
        },
        {
          id: "5",
          username: "manager",
          action: "locked",
          ipAddress: "10.0.0.5",
          timestamp: new Date(Date.now() - 14400000).toISOString(),
          userAgent: "Safari",
        },
      ];
      setAuditEvents(seed);
      for (const e of seed) {
        await db
          .table("loginAudit")
          .put(e)
          .catch(() => {});
      }
      return;
    }

    setAuditEvents(rows);
  }

  const filteredUsers = useMemo(() => {
    const q = search.toLowerCase();
    return (users || []).filter((u) => {
      if (!matchBranch(u.branchId)) return false;
      return (
        String(u.name || "")
          .toLowerCase()
          .includes(q) ||
        String(u.username || "")
          .toLowerCase()
          .includes(q) ||
        String(u.email || "")
          .toLowerCase()
          .includes(q) ||
        String(u.role || "")
          .toLowerCase()
          .includes(q)
      );
    });
  }, [users, search, matchBranch, branchFilter]);

  function openAddUser() {
    setEditingUser(null);
    setUserForm(defaultUserForm());
    setUserModalOpen(true);
  }

  function openEditUser(user: any) {
    setEditingUser(user);
    setUserForm({
      id: user.id || "",
      username: user.username || "",
      name: user.name || "",
      email: user.email || "",
      phone: user.phone || "",
      role: user.role || "viewer",
      costCenterId: user.costCenterId || "",
      isActive: user.isActive !== false,
      forcePasswordChange: Boolean(user.forcePasswordChange),
      fromTime: user.loginRestrictions?.fromTime || "08:00",
      toTime: user.loginRestrictions?.toTime || "18:00",
      allowedIPsText: (user.loginRestrictions?.allowedIPs || []).join("\n"),
      maxSessions: Number(user.loginRestrictions?.maxSessions || 1),
      permissions: user.permissions || DEFAULT_ROLES[user.role] || [],
    });
    setUserModalOpen(true);
  }

  function onRoleChange(role: string) {
    setUserForm((f) => ({
      ...f,
      role,
      permissions: role === "custom" ? [] : DEFAULT_ROLES[role] || [],
    }));
  }

  function togglePermission(permission: string) {
    setUserForm((f) => {
      const set = new Set(f.permissions || []);
      if (set.has(permission)) set.delete(permission);
      else set.add(permission);
      return { ...f, permissions: Array.from(set) };
    });
  }

  function setGroupPermissions(group: string, mode: "all" | "clear") {
    const perms = MODULE_ACCESS_GROUPS[group] || [];
    setUserForm((f) => {
      const set = new Set(f.permissions || []);
      perms.forEach((p) => {
        if (mode === "all") set.add(p);
        else set.delete(p);
      });
      return { ...f, permissions: Array.from(set) };
    });
  }

  function validateUserForm() {
    if (!userForm.username.trim()) return "Username is required";
    if (!/^[a-zA-Z0-9_]+$/.test(userForm.username))
      return "Username must be alphanumeric or underscore only";
    if (!userForm.name.trim()) return "Full name is required";
    if (userForm.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userForm.email))
      return "Invalid email address";
    if (Number(userForm.maxSessions) < 1 || Number(userForm.maxSessions) > 5) {
      return "Max concurrent sessions must be between 1 and 5";
    }
    if (!/^\d{2}:\d{2}$/.test(userForm.fromTime) || !/^\d{2}:\d{2}$/.test(userForm.toTime)) {
      return "Login time must be in HH:MM format";
    }
    return "";
  }

  async function saveUser() {
    const error = validateUserForm();
    if (error) {
      toast.error(error);
      return;
    }

    const db = getDB();
    const existingId = editingUser?.id || userForm.id;
    const id = existingId || generateId();
    const now = new Date().toISOString();

    const userData = {
      id,
      username: userForm.username.trim(),
      name: userForm.name.trim(),
      email: userForm.email.trim(),
      phone: userForm.phone.trim(),
      role: userForm.role,
      costCenterId: userForm.costCenterId || "",
      branchId: editingUser?.branchId || readActiveBranchId() || undefined,
      isActive: Boolean(userForm.isActive),
      permissions: userForm.permissions || [],
      loginRestrictions: {
        fromTime: userForm.fromTime,
        toTime: userForm.toTime,
        allowedIPs: userForm.allowedIPsText
          .split("\n")
          .map((x) => x.trim())
          .filter(Boolean),
        maxSessions: Number(userForm.maxSessions || 1),
      },
      forcePasswordChange: Boolean(userForm.forcePasswordChange),
      createdAt: editingUser?.createdAt || now,
      lastModified: now,
    };

    await db
      .table("users")
      .put(userData)
      .catch(() => {
        const fallback = JSON.parse(localStorage.getItem("users_fallback") || "[]");
        const next = fallback.filter((u) => u.id !== id).concat(userData);
        localStorage.setItem("users_fallback", JSON.stringify(next));
      });

    if (editingUser && updateUser) {
      await updateUser(id, userData).catch(() => {});
    } else if (!editingUser && addUser) {
      await addUser(userData).catch(() => {});
    }

    setUsers((rows) => rows.filter((u) => u.id !== id).concat(userData));
    setUserModalOpen(false);
    toast.success("User saved");
  }

  async function removeUser(user: any) {
    if (!confirm(`Delete user ${user.username}?`)) return;
    const db = getDB();
    await db
      .table("users")
      .delete(user.id)
      .catch(() => {});
    if (deleteUser) await deleteUser(user.id).catch(() => {});
    setUsers((rows) => rows.filter((u) => u.id !== user.id));
    toast.success("User deleted");
  }

  async function resetPassword(user: any) {
    const tempPassword = `Temp@${Math.floor(100000 + Math.random() * 900000)}`;
    const db = getDB();
    await db
      .table("users")
      .update(user.id, {
        tempPassword,
        forcePasswordChange: true,
        passwordResetAt: new Date().toISOString(),
      })
      .catch(() => {});
    toast.success(`Temporary password for ${user.username}: ${tempPassword}`);
  }

  function toggleRolePermission(roleName: string, permission: string) {
    if (roleName === "admin") return;
    setRoles((rows) =>
      rows.map((r) => {
        const name = String(r.name || r.id).toLowerCase();
        if (name !== roleName) return r;
        const set = new Set(r.permissions || []);
        if (set.has(permission)) set.delete(permission);
        else set.add(permission);
        return { ...r, permissions: Array.from(set) };
      }),
    );
  }

  async function saveRolePermissions() {
    const db = getDB();
    for (const role of roles) {
      await db
        .table("roles")
        .put(role)
        .catch(() => {});
    }
    toast.success("Role permissions saved");
  }

  async function createCustomRole() {
    const name = newRoleName.trim().toLowerCase().replace(/\s+/g, "-");
    if (!name) return toast.error("Enter role name");
    if (roles.some((r) => String(r.name || r.id).toLowerCase() === name))
      return toast.error("Role already exists");

    const role = { id: generateId(), name, permissions: [], isDefault: false };
    await getDB()
      .table("roles")
      .put(role)
      .catch(() => {});
    setRoles((r) => [...r, role]);
    setNewRoleName("");
    toast.success("Custom role created");
  }

  async function deleteCustomRole(role: any) {
    const roleName = String(role.name || role.id).toLowerCase();
    if (["admin", "manager", "accountant", "viewer"].includes(roleName))
      return toast.error("Default roles cannot be deleted");
    if (!confirm(`Delete custom role ${roleName}?`)) return;

    await getDB()
      .table("roles")
      .delete(role.id)
      .catch(() => {});
    setRoles((rows) => rows.filter((r) => r.id !== role.id));
    toast.success("Role deleted");
  }

  async function saveSecuritySettings() {
    const db = getDB();
    await db
      .table("securitySettings")
      .put({ ...securitySettings, id: "global", savedAt: new Date().toISOString() })
      .catch(() => {});
    toast.success("Security settings saved");
  }

  const filteredAuditEvents = useMemo(() => {
    return (auditEvents || []).filter((e) => {
      const ts = String(e.timestamp || "").slice(0, 10);
      if (auditUser && e.username !== auditUser) return false;
      if (auditAction !== "all" && e.action !== auditAction) return false;
      if (auditFrom && ts < auditFrom) return false;
      if (auditTo && ts > auditTo) return false;
      return true;
    });
  }, [auditEvents, auditUser, auditAction, auditFrom, auditTo]);

  const auditSummary = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    const todayRows = (auditEvents || []).filter((e) =>
      String(e.timestamp || "").startsWith(today),
    );
    return {
      totalLoginsToday: todayRows.filter((e) => e.action === "login").length,
      failedAttemptsToday: todayRows.filter((e) => e.action === "failed").length,
      activeSessions: 0,
    };
  }, [auditEvents]);

  function exportAuditLog() {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(
      filteredAuditEvents.map((e) => ({
        Timestamp: e.timestamp,
        Username: e.username,
        Action: e.action,
        "IP Address": e.ipAddress,
        "Browser/Device": e.userAgent,
        Status: e.action === "failed" || e.action === "locked" ? "Attention" : "OK",
      })),
    );
    XLSX.utils.book_append_sheet(wb, ws, "Login Audit");
    XLSX.writeFile(wb, "Login_Audit.xlsx");
    toast.success("Audit log exported");
  }

  const uniqueAuditUsers = useMemo(() => {
    return Array.from(new Set((auditEvents || []).map((e) => e.username).filter(Boolean)));
  }, [auditEvents]);

  const tabs = ["Users", "Roles & Permissions Matrix", "Security Settings", "Login Audit"];

  return (
    <div className="min-h-screen bg-[#f5f6fa] p-4 text-gray-800">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800 flex items-center gap-2">
            <Shield size={16} className="text-[var(--ds-action-primary)]" /> Users
          </h1>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Field-level permissions, branch isolation, login audit and security policies
          </p>
        </div>
        {branchOptions.length > 0 && (
          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
            aria-label="Branch"
          >
            <option value="all">All branches</option>
            {branchOptions.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name || b.code || b.id}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="flex border-b border-gray-200 mb-4 bg-white px-2 pt-2 rounded-t-md shadow-sm overflow-x-auto hide-scrollbar">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`px-4 py-2 text-[12px] font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === t
                ? "border-[var(--ds-action-primary)] text-[var(--ds-action-primary)]"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {activeTab === "Users" && (
        <div className="bg-white border border-gray-200 rounded-md shadow-sm p-4">
          <div className="flex flex-col md:flex-row gap-3 justify-between mb-4">
            <input
              className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-full md:max-w-sm shadow-sm"
              placeholder="Search users by name, username, email, role..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button
              className="h-8 px-3 bg-[var(--ds-action-primary)] text-white text-[12px] font-medium rounded-md hover:bg-[var(--ds-action-primary-hover)] transition-colors flex items-center gap-1.5 shadow-sm whitespace-nowrap"
              onClick={openAddUser}
            >
              <Plus size={14} /> Add User
            </button>
          </div>

          <div className="border border-gray-200 rounded-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-max border-collapse">
                <thead>
                  <tr className="bg-[#f5f6fa] border-b border-gray-200">
                    {[
                      "Username",
                      "Full Name",
                      "Role Badge",
                      "Assigned Branch",
                      "Last Login",
                      "Status",
                      "Actions",
                    ].map((h) => (
                      <th
                        key={h}
                        className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center p-8 text-[12px] text-gray-500">
                        No users found.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => {
                      const branch = costCenters.find((c) => c.id === u.costCenterId);
                      const lastLogin = auditEvents.find(
                        (e) => e.username === u.username && e.action === "login",
                      );
                      return (
                        <tr
                          key={u.id}
                          className="bg-white hover:bg-gray-50 transition-colors text-[12px]"
                        >
                          <td className="px-3 py-2.5 font-medium text-gray-800">{u.username}</td>
                          <td className="px-3 py-2.5 text-gray-600">{u.name}</td>
                          <td className="px-3 py-2.5">
                            <span
                              className={`${roleBadgeClass(u.role)} rounded px-2 py-0.5 text-[10px] uppercase font-semibold tracking-wide border`}
                            >
                              {u.role || "custom"}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-gray-600">
                            {branch?.name || "All Branches"}
                          </td>
                          <td className="px-3 py-2.5 text-gray-600">
                            {lastLogin ? new Date(lastLogin.timestamp).toLocaleString() : "Never"}
                          </td>
                          <td className="px-3 py-2.5">
                            <span className="inline-flex items-center gap-1.5 font-medium">
                              <span
                                className={`w-2 h-2 rounded-full ${u.isActive !== false ? "bg-green-500" : "bg-gray-400"}`}
                              />
                              {u.isActive !== false ? "Active" : "Inactive"}
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex gap-2.5 items-center">
                              <button
                                onClick={() => openEditUser(u)}
                                title="Edit"
                                className="text-gray-500 hover:text-[var(--ds-action-primary)] transition-colors"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                onClick={() => removeUser(u)}
                                title="Delete"
                                className="text-gray-500 hover:text-red-600 transition-colors"
                              >
                                <Trash2 size={14} />
                              </button>
                              <button
                                onClick={() => resetPassword(u)}
                                title="Reset Password"
                                className="text-gray-500 hover:text-[var(--ds-action-primary)] transition-colors"
                              >
                                <Lock size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === "Roles & Permissions Matrix" && (
        <div className="bg-white border border-gray-200 rounded-md shadow-sm p-4">
          <div className="flex flex-col md:flex-row gap-3 justify-between mb-4">
            <div className="flex gap-2">
              <input
                className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] max-w-xs shadow-sm"
                placeholder="New Role Name"
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
              />
              <button
                className="h-8 px-3 bg-white text-gray-700 border border-gray-300 text-[12px] font-medium rounded-md hover:bg-gray-50 transition-colors shadow-sm"
                onClick={createCustomRole}
              >
                Create Custom Role
              </button>
            </div>
            <button
              className="h-8 px-4 bg-[var(--ds-action-primary)] text-white text-[12px] font-medium rounded-md hover:bg-[var(--ds-action-primary-hover)] transition-colors flex items-center gap-1.5 shadow-sm"
              onClick={saveRolePermissions}
            >
              <CheckCircle size={14} /> Save Permissions
            </button>
          </div>

          <div className="border border-gray-200 rounded-md overflow-hidden relative">
            <div className="overflow-x-auto">
              <table className="border-collapse min-w-[1000px] w-full">
                <thead>
                  <tr className="bg-[#f5f6fa] border-b border-gray-200">
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-600 uppercase tracking-wide sticky left-0 z-10 bg-[#f5f6fa] border-r border-gray-200 shadow-[2px_0_4px_rgba(0,0,0,0.02)]">
                      Permission
                    </th>
                    {roles.map((r) => (
                      <th
                        key={r.id}
                        className="px-3 py-3 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wide border-r border-gray-200 last:border-r-0"
                      >
                        <div className="flex items-center justify-center gap-2">
                          <span>{r.name}</span>
                          {!["admin", "manager", "accountant", "viewer"].includes(
                            String(r.name).toLowerCase(),
                          ) && (
                            <button
                              className="text-red-500 hover:text-red-700 transition-colors"
                              onClick={() => deleteCustomRole(r)}
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {Object.entries(PERMISSION_GROUPS).map(([group, permissions]) => (
                    <React.Fragment key={group}>
                      <tr>
                        <td
                          colSpan={roles.length + 1}
                          className="bg-gray-50 border-y border-gray-200 px-4 py-2 text-[11px] font-bold text-gray-700 uppercase tracking-wide"
                        >
                          {group}
                        </td>
                      </tr>
                      {permissions.map((p) => (
                        <tr key={p} className="bg-white hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-2 text-[12px] text-gray-600 font-mono sticky left-0 z-10 bg-white border-r border-gray-200 shadow-[2px_0_4px_rgba(0,0,0,0.02)]">
                            {p}
                          </td>
                          {roles.map((r) => {
                            const name = String(r.name || r.id).toLowerCase();
                            const checked = name === "admin" || (r.permissions || []).includes(p);
                            return (
                              <td
                                key={r.id + p}
                                className="px-3 py-2 text-center border-r border-gray-100 last:border-r-0"
                              >
                                <input
                                  type="checkbox"
                                  className="w-4 h-4 text-[var(--ds-action-primary)] border-gray-300 rounded focus:ring-[var(--ds-action-primary)]"
                                  checked={checked}
                                  disabled={name === "admin"}
                                  onChange={() => toggleRolePermission(name, p)}
                                />
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === "Security Settings" && (
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-md shadow-sm p-5">
            <h2 className="text-[14px] font-bold text-gray-800 mb-4 border-b border-gray-100 pb-2 flex items-center gap-2">
              <Lock size={15} className="text-gray-500" /> Password Policy
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-1.5">
                  Min Password Length
                </label>
                <input
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-full shadow-sm"
                  type="number"
                  value={securitySettings.minPasswordLength}
                  onChange={(e) =>
                    setSecuritySettings({
                      ...securitySettings,
                      minPasswordLength: Number(e.target.value),
                    })
                  }
                />
              </div>
              <div className="flex items-center pt-5">
                <label className="text-[12px] flex items-center gap-2 text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4 text-[var(--ds-action-primary)] border-gray-300 rounded focus:ring-[var(--ds-action-primary)]"
                    checked={securitySettings.requireUppercase}
                    onChange={(e) =>
                      setSecuritySettings({
                        ...securitySettings,
                        requireUppercase: e.target.checked,
                      })
                    }
                  />
                  Require Uppercase
                </label>
              </div>
              <div className="flex items-center pt-5">
                <label className="text-[12px] flex items-center gap-2 text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4 text-[var(--ds-action-primary)] border-gray-300 rounded focus:ring-[var(--ds-action-primary)]"
                    checked={securitySettings.requireNumber}
                    onChange={(e) =>
                      setSecuritySettings({ ...securitySettings, requireNumber: e.target.checked })
                    }
                  />
                  Require Number
                </label>
              </div>
              <div className="flex items-center pt-5">
                <label className="text-[12px] flex items-center gap-2 text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4 text-[var(--ds-action-primary)] border-gray-300 rounded focus:ring-[var(--ds-action-primary)]"
                    checked={securitySettings.requireSpecial}
                    onChange={(e) =>
                      setSecuritySettings({ ...securitySettings, requireSpecial: e.target.checked })
                    }
                  />
                  Require Special
                </label>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-1.5">
                  Password Expires (Days)
                </label>
                <input
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-full shadow-sm"
                  type="number"
                  value={securitySettings.passwordExpiryDays}
                  onChange={(e) =>
                    setSecuritySettings({
                      ...securitySettings,
                      passwordExpiryDays: Number(e.target.value),
                    })
                  }
                />
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-md shadow-sm p-5">
            <h2 className="text-[14px] font-bold text-gray-800 mb-4 border-b border-gray-100 pb-2 flex items-center gap-2">
              <Shield size={15} className="text-gray-500" /> Login Security
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-1.5">
                  Lock After Failed Attempts
                </label>
                <input
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-full shadow-sm"
                  type="number"
                  value={securitySettings.failedAttempts}
                  onChange={(e) =>
                    setSecuritySettings({
                      ...securitySettings,
                      failedAttempts: Number(e.target.value),
                    })
                  }
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-1.5">
                  Lockout Duration (Mins)
                </label>
                <input
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-full shadow-sm"
                  type="number"
                  value={securitySettings.lockoutMinutes}
                  onChange={(e) =>
                    setSecuritySettings({
                      ...securitySettings,
                      lockoutMinutes: Number(e.target.value),
                    })
                  }
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-1.5">
                  Session Timeout (Mins)
                </label>
                <input
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-full shadow-sm"
                  type="number"
                  value={securitySettings.sessionTimeoutMinutes}
                  onChange={(e) =>
                    setSecuritySettings({
                      ...securitySettings,
                      sessionTimeoutMinutes: Number(e.target.value),
                    })
                  }
                />
              </div>
              <div className="flex flex-col justify-end">
                <label className="text-[12px] flex items-center gap-2 text-gray-700 cursor-pointer h-8">
                  <input
                    type="checkbox"
                    className="w-4 h-4 text-[var(--ds-action-primary)] border-gray-300 rounded focus:ring-[var(--ds-action-primary)]"
                    checked={securitySettings.require2FAAdmin}
                    onChange={(e) =>
                      setSecuritySettings({
                        ...securitySettings,
                        require2FAAdmin: e.target.checked,
                      })
                    }
                  />
                  <span>
                    Require 2FA for Admin{" "}
                    <span className="block text-[10px] text-amber-600">Via email OTP</span>
                  </span>
                </label>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-md shadow-sm p-5">
            <h2 className="text-[14px] font-bold text-gray-800 mb-4 border-b border-gray-100 pb-2">
              Allowed IP Ranges
            </h2>
            <textarea
              className="px-3 py-2 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-full min-h-[100px] shadow-sm font-mono"
              placeholder="One CIDR per line, blank = no restriction"
              value={securitySettings.allowedIpRanges}
              onChange={(e) =>
                setSecuritySettings({ ...securitySettings, allowedIpRanges: e.target.value })
              }
            />
          </div>

          <div className="bg-white border border-gray-200 rounded-md shadow-sm p-5">
            <h2 className="text-[14px] font-bold text-gray-800 mb-4 border-b border-gray-100 pb-2 flex items-center gap-2">
              <EyeOff size={15} className="text-gray-500" /> Data Security
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <label className="text-[12px] flex items-center gap-2 text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 text-[var(--ds-action-primary)] border-gray-300 rounded focus:ring-[var(--ds-action-primary)]"
                  checked={securitySettings.maskBankAccounts}
                  onChange={(e) =>
                    setSecuritySettings({ ...securitySettings, maskBankAccounts: e.target.checked })
                  }
                />
                Mask Bank Account Numbers
              </label>
              <label className="text-[12px] flex items-center gap-2 text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 text-[var(--ds-action-primary)] border-gray-300 rounded focus:ring-[var(--ds-action-primary)]"
                  checked={securitySettings.maskPanReports}
                  onChange={(e) =>
                    setSecuritySettings({ ...securitySettings, maskPanReports: e.target.checked })
                  }
                />
                Mask PAN Numbers in Reports
              </label>
              <label className="text-[12px] flex items-center gap-2 text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 text-[var(--ds-action-primary)] border-gray-300 rounded focus:ring-[var(--ds-action-primary)]"
                  checked={securitySettings.watermarkPrints}
                  onChange={(e) =>
                    setSecuritySettings({ ...securitySettings, watermarkPrints: e.target.checked })
                  }
                />
                Prevent Printing with Watermark
              </label>
            </div>
            <div className="flex justify-end pt-4 border-t border-gray-100">
              <button
                className="h-8 px-4 bg-[var(--ds-action-primary)] text-white text-[12px] font-medium rounded-md hover:bg-[var(--ds-action-primary-hover)] transition-colors shadow-sm flex items-center gap-1.5"
                onClick={saveSecuritySettings}
              >
                <CheckCircle size={14} /> Save Security Settings
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === "Login Audit" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white border border-gray-200 rounded-md shadow-sm p-4 flex flex-col justify-center">
              <div className="text-[11px] text-gray-500 uppercase font-semibold tracking-wide mb-1">
                Total Logins Today
              </div>
              <div className="text-[28px] font-bold text-gray-800">
                {auditSummary.totalLoginsToday}
              </div>
            </div>
            <div
              className={`border rounded-md shadow-sm p-4 flex flex-col justify-center ${auditSummary.failedAttemptsToday > 5 ? "bg-red-50 border-red-200" : "bg-white border-gray-200"}`}
            >
              <div
                className={`text-[11px] uppercase font-semibold tracking-wide flex items-center gap-1.5 mb-1 ${auditSummary.failedAttemptsToday > 5 ? "text-red-700" : "text-gray-500"}`}
              >
                {auditSummary.failedAttemptsToday > 5 && <AlertTriangle size={14} />}
                Failed Attempts Today
              </div>
              <div
                className={`text-[28px] font-bold ${auditSummary.failedAttemptsToday > 5 ? "text-red-600" : "text-gray-800"}`}
              >
                {auditSummary.failedAttemptsToday}
              </div>
            </div>
            <div className="bg-white border border-gray-200 rounded-md shadow-sm p-4 flex flex-col justify-center">
              <div className="text-[11px] text-gray-500 uppercase font-semibold tracking-wide mb-1">
                Active Sessions
              </div>
              <div className="text-[28px] font-bold text-[var(--ds-action-primary)]">
                {auditSummary.activeSessions}
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-md shadow-sm p-4">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4">
              <select
                className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] shadow-sm"
                value={auditUser}
                onChange={(e) => setAuditUser(e.target.value)}
              >
                <option value="">All Users</option>
                {uniqueAuditUsers.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
              <input
                className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] shadow-sm"
                type="date"
                value={auditFrom}
                onChange={(e) => setAuditFrom(e.target.value)}
              />
              <input
                className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] shadow-sm"
                type="date"
                value={auditTo}
                onChange={(e) => setAuditTo(e.target.value)}
              />
              <select
                className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] shadow-sm"
                value={auditAction}
                onChange={(e) => setAuditAction(e.target.value)}
              >
                <option value="all">All Actions</option>
                <option value="login">Login</option>
                <option value="logout">Logout</option>
                <option value="failed">Failed</option>
                <option value="locked">Locked</option>
              </select>
              <button
                className="h-8 px-3 bg-white text-gray-700 border border-gray-300 text-[12px] font-medium rounded-md hover:bg-gray-50 transition-colors shadow-sm"
                onClick={exportAuditLog}
              >
                Export Audit Log
              </button>
            </div>

            <div className="border border-gray-200 rounded-md overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-max border-collapse">
                  <thead>
                    <tr className="bg-[#f5f6fa] border-b border-gray-200">
                      {[
                        "Timestamp",
                        "Username",
                        "Action",
                        "IP Address",
                        "Browser/Device",
                        "Status",
                      ].map((h) => (
                        <th
                          key={h}
                          className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredAuditEvents.map((e) => (
                      <tr
                        key={e.id}
                        className="bg-white hover:bg-gray-50 text-[12px] transition-colors"
                      >
                        <td className="px-3 py-2 text-gray-600">
                          {new Date(e.timestamp).toLocaleString()}
                        </td>
                        <td className="px-3 py-2 font-medium text-gray-800">{e.username}</td>
                        <td className="px-3 py-2">
                          <span
                            className={`${actionBadgeClass(e.action)} rounded px-2 py-0.5 text-[10px] uppercase font-semibold tracking-wide border`}
                          >
                            {e.action}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-gray-600 font-mono">{e.ipAddress}</td>
                        <td
                          className="px-3 py-2 text-gray-500 truncate max-w-[200px]"
                          title={e.userAgent}
                        >
                          {e.userAgent}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`inline-flex items-center gap-1.5 font-medium ${e.action === "failed" || e.action === "locked" ? "text-amber-600" : "text-green-600"}`}
                          >
                            {e.action === "failed" || e.action === "locked" ? "Attention" : "OK"}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {filteredAuditEvents.length === 0 && (
                      <tr>
                        <td colSpan={6} className="text-center p-8 text-[12px] text-gray-500">
                          No audit events match filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {userModalOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setUserModalOpen(false);
          }}
        >
          <div className="bg-white border border-gray-200 rounded-md shadow-xl w-full max-w-5xl max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h2 className="text-[15px] font-bold text-gray-800 flex items-center gap-2">
                <User size={16} className="text-[var(--ds-action-primary)]" />
                {editingUser ? "Edit User Account" : "Create New User"}
              </h2>
              <button
                className="text-gray-400 hover:text-gray-600 transition-colors"
                onClick={() => setUserModalOpen(false)}
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-6">
              <div className="space-y-4">
                <h3 className="text-[13px] font-bold text-gray-800 border-b border-gray-100 pb-1 flex items-center gap-2">
                  <span className="bg-[var(--ds-action-primary)] text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px]">
                    1
                  </span>{" "}
                  Basic Info
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">
                      Username <span className="text-red-500">*</span>
                    </label>
                    <input
                      className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-full shadow-sm"
                      value={userForm.username}
                      onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                      disabled={!!editingUser}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">
                      Full Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-full shadow-sm"
                      value={userForm.name}
                      onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">
                      Email
                    </label>
                    <input
                      className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-full shadow-sm"
                      type="email"
                      value={userForm.email}
                      onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">
                      Phone
                    </label>
                    <input
                      className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-full shadow-sm"
                      value={userForm.phone}
                      onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">
                      Role Type
                    </label>
                    <select
                      className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-full shadow-sm"
                      value={userForm.role}
                      onChange={(e) => onRoleChange(e.target.value)}
                    >
                      <option value="admin">Admin</option>
                      <option value="manager">Manager</option>
                      <option value="accountant">Accountant</option>
                      <option value="viewer">Viewer</option>
                      <option value="custom">Custom</option>
                      {roles
                        .filter(
                          (r) =>
                            !["admin", "manager", "accountant", "viewer"].includes(
                              String(r.name).toLowerCase(),
                            ),
                        )
                        .map((r) => (
                          <option key={r.id} value={r.name}>
                            {r.name}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">
                      Branch/Department Assignment
                    </label>
                    <select
                      className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-full shadow-sm"
                      value={userForm.costCenterId}
                      onChange={(e) => setUserForm({ ...userForm, costCenterId: e.target.value })}
                    >
                      <option value="">All Branches</option>
                      {costCenters.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col justify-end pt-2">
                    <label className="text-[12px] flex items-center gap-2 cursor-pointer text-gray-700">
                      <input
                        type="checkbox"
                        className="w-4 h-4 text-[var(--ds-action-primary)] border-gray-300 rounded focus:ring-[var(--ds-action-primary)]"
                        checked={userForm.isActive}
                        onChange={(e) => setUserForm({ ...userForm, isActive: e.target.checked })}
                      />
                      Active Account
                    </label>
                  </div>
                  <div className="flex flex-col justify-end pt-2 md:col-span-2">
                    <label className="text-[12px] flex items-center gap-2 cursor-pointer text-gray-700">
                      <input
                        type="checkbox"
                        className="w-4 h-4 text-[var(--ds-action-primary)] border-gray-300 rounded focus:ring-[var(--ds-action-primary)]"
                        checked={userForm.forcePasswordChange}
                        onChange={(e) =>
                          setUserForm({ ...userForm, forcePasswordChange: e.target.checked })
                        }
                      />
                      Force Password Change on Next Login
                    </label>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-[13px] font-bold text-gray-800 border-b border-gray-100 pb-1 flex items-center gap-2">
                  <span className="bg-[var(--ds-action-primary)] text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px]">
                    2
                  </span>{" "}
                  Login Restrictions
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">
                      Allowed Login From Time
                    </label>
                    <input
                      className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-full shadow-sm"
                      type="time"
                      value={userForm.fromTime}
                      onChange={(e) => setUserForm({ ...userForm, fromTime: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">
                      Allowed Login To Time
                    </label>
                    <input
                      className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-full shadow-sm"
                      type="time"
                      value={userForm.toTime}
                      onChange={(e) => setUserForm({ ...userForm, toTime: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">
                      Max Concurrent Sessions
                    </label>
                    <input
                      className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-full shadow-sm"
                      type="number"
                      min={1}
                      max={5}
                      value={userForm.maxSessions}
                      onChange={(e) =>
                        setUserForm({ ...userForm, maxSessions: Number(e.target.value) })
                      }
                    />
                  </div>
                  <div className="md:col-span-3">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-medium text-gray-600">
                        Allowed IP Addresses
                      </label>
                      <button
                        className="text-[10px] text-[var(--ds-action-primary)] hover:underline flex items-center gap-1"
                        onClick={() => setShowIpHelp(!showIpHelp)}
                      >
                        <HelpCircle size={12} /> Help
                      </button>
                    </div>
                    {showIpHelp && (
                      <div className="bg-blue-50 text-blue-800 text-[11px] p-2 rounded mb-2 border border-blue-100">
                        Enter IP addresses like 192.168.1.100. Leave blank to allow from anywhere.
                        One IP per line.
                      </div>
                    )}
                    <textarea
                      className="px-3 py-2 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-full min-h-[80px] shadow-sm font-mono"
                      placeholder="One IP per line, blank = any IP allowed"
                      value={userForm.allowedIPsText}
                      onChange={(e) => setUserForm({ ...userForm, allowedIPsText: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div
                className={`space-y-4 ${userForm.role !== "custom" && userForm.role !== "admin" ? "opacity-75 pointer-events-none" : ""}`}
              >
                <h3 className="text-[13px] font-bold text-gray-800 border-b border-gray-100 pb-1 flex items-center gap-2">
                  <span className="bg-[var(--ds-action-primary)] text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px]">
                    3
                  </span>{" "}
                  Module Access
                  {userForm.role !== "custom" && userForm.role !== "admin" && (
                    <span className="text-[10px] font-normal text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                      Set role to 'custom' to edit
                    </span>
                  )}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.entries(MODULE_ACCESS_GROUPS).map(([group, perms]) => (
                    <div key={group} className="border border-gray-200 rounded-md bg-gray-50/50">
                      <div className="flex items-center justify-between p-2.5 border-b border-gray-200 bg-gray-50 rounded-t-md">
                        <div className="text-[11px] font-bold text-gray-700 uppercase tracking-wide">
                          {group}
                        </div>
                        <div className="flex gap-2">
                          <button
                            className="text-[10px] text-[var(--ds-action-primary)] hover:underline"
                            onClick={() => setGroupPermissions(group, "all")}
                          >
                            All
                          </button>
                          <button
                            className="text-[10px] text-red-600 hover:underline"
                            onClick={() => setGroupPermissions(group, "clear")}
                          >
                            Clear
                          </button>
                        </div>
                      </div>
                      <div className="p-2 space-y-1">
                        {perms.map((p) => (
                          <label
                            key={p}
                            className="flex items-center gap-2 text-[11px] text-gray-600 hover:bg-gray-100 p-1 rounded cursor-pointer transition-colors"
                          >
                            <input
                              type="checkbox"
                              className="w-3.5 h-3.5 text-[var(--ds-action-primary)] border-gray-300 rounded focus:ring-[var(--ds-action-primary)]"
                              checked={
                                userForm.role === "admin" ||
                                (userForm.permissions || []).includes(p)
                              }
                              disabled={userForm.role === "admin"}
                              onChange={() => togglePermission(p)}
                            />
                            <span className="truncate">{p.replace(/_/g, " ")}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-2 rounded-b-md">
              <button
                className="h-8 px-4 bg-white text-gray-700 border border-gray-300 text-[12px] font-medium rounded-md hover:bg-gray-50 transition-colors shadow-sm"
                onClick={() => setUserModalOpen(false)}
              >
                Cancel
              </button>
              <button
                className="h-8 px-5 bg-[var(--ds-action-primary)] text-white text-[12px] font-medium rounded-md hover:bg-[var(--ds-action-primary-hover)] transition-colors shadow-sm"
                onClick={saveUser}
              >
                {editingUser ? "Save Changes" : "Create User"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
