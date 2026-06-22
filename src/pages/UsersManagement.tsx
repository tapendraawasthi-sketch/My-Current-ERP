import React, { useState } from "react";
import {
  UserPlus,
  Edit2,
  Lock,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Shield,
  Activity,
  Eye,
  EyeOff,
} from "lucide-react";
import { useStore } from "../store/useStore";
import ChangePasswordModal from "../components/auth/ChangePasswordModal";
import { User, UserRole } from "../lib/types";
import toast from "react-hot-toast";

const rolePermissions = {
  [UserRole.ADMIN]: ["all"],
  [UserRole.MANAGER]: [
    "view_reports",
    "create_voucher",
    "edit_voucher",
    "view_ledger",
    "manage_inventory",
    "manage_customers",
  ],
  [UserRole.ACCOUNTANT]: ["create_voucher", "edit_voucher", "view_ledger", "view_reports"],
  [UserRole.VIEWER]: ["view_ledger", "view_reports"],
};

const allPermissions = [
  "manage_users",
  "manage_settings",
  "create_voucher",
  "edit_voucher",
  "delete_voucher",
  "view_ledger",
  "edit_ledger",
  "view_reports",
  "manage_inventory",
  "manage_customers",
  "manage_suppliers",
  "close_fiscal_year",
  "backup_restore",
  "view_audit_log",
];

export default function UsersManagement() {
  const { users, currentUser, addUser, updateUser, deleteUser } = useStore();

  const [showForm, setShowForm] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showPermissions, setShowPermissions] = useState<string | null>(null);
  const [showActivityLog, setShowActivityLog] = useState<string | null>(null);
  const [passwordModal, setPasswordModal] = useState<{ userId: string; isOpen: boolean }>({
    userId: "",
    isOpen: false,
  });
  const [formData, setFormData] = useState({
    name: "",
    username: "",
    email: "",
    role: UserRole.ACCOUNTANT,
    password: "",
    confirmPassword: "",
    isActive: true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedUser && formData.password !== formData.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (users.some((u) => u.username === formData.username && u.id !== selectedUser?.id)) {
      toast.error("Username already exists");
      return;
    }

    try {
      if (selectedUser) {
        await updateUser(selectedUser.id, {
          name: formData.name,
          username: formData.username,
          email: formData.email,
          role: formData.role,
          isActive: formData.isActive,
        });
        toast.success("User updated successfully");
      } else {
        await addUser({
          name: formData.name,
          username: formData.username,
          email: formData.email,
          role: formData.role,
          isActive: formData.isActive,
          password: formData.password,
        });
        toast.success("User added successfully");
      }
      resetForm();
    } catch (error: any) {
      toast.error(error?.message || "Failed to save user");
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      username: "",
      email: "",
      role: UserRole.ACCOUNTANT,
      password: "",
      confirmPassword: "",
      isActive: true,
    });
    setSelectedUser(null);
    setShowForm(false);
  };

  const handleEdit = (user: User) => {
    setSelectedUser(user);
    setFormData({
      name: user.name,
      username: user.username,
      email: user.email || "",
      role: user.role,
      password: "",
      confirmPassword: "",
      isActive: user.isActive,
    });
    setShowForm(true);
  };

  const handleToggleActive = async (id: string) => {
    const user = users.find((u) => u.id === id);
    if (!user) return;
    try {
      await updateUser(id, { isActive: !user.isActive });
      toast.success(`User status updated successfully`);
    } catch (error: any) {
      toast.error(error?.message || "Failed to update user status");
    }
  };

  const handleDelete = async (id: string) => {
    if (id === currentUser?.id) {
      toast.error("Cannot delete yourself");
      return;
    }
    if (confirm("Are you sure you want to delete this user?")) {
      try {
        await deleteUser(id);
        toast.success("User deleted successfully");
      } catch (error: any) {
        toast.error(error?.message || "Failed to delete user");
      }
    }
  };

  const getUserPermissions = (user: User): string[] => {
    const rolePerms = rolePermissions[user.role as keyof typeof rolePermissions] || [];
    if (rolePerms.includes("all")) return allPermissions;
    return user.permissions || rolePerms;
  };

  const togglePermission = async (userId: string, permission: string) => {
    const user = users.find((u) => u.id === userId);
    if (!user) return;
    const current =
      user.permissions || rolePermissions[user.role as keyof typeof rolePermissions] || [];
    const updated = current.includes(permission)
      ? current.filter((p: string) => p !== permission)
      : [...current, permission];
    try {
      await updateUser(userId, { permissions: updated });
      toast.success("Permissions updated successfully");
    } catch (error: any) {
      toast.error(error?.message || "Failed to update permissions");
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const activityLogs = [
    {
      id: "1",
      action: "Login",
      module: "Auth",
      timestamp: "2024-01-15 10:30",
      description: "User logged in",
    },
    {
      id: "2",
      action: "Create",
      module: "Voucher",
      timestamp: "2024-01-15 11:15",
      description: "Created Journal Voucher JV001",
    },
    {
      id: "3",
      action: "Update",
      module: "Ledger",
      timestamp: "2024-01-15 12:00",
      description: "Updated Cash ledger",
    },
  ];

  return (
    <div className="flex flex-col gap-4 animate-fadeIn pb-4">
      {/* Standard Page Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800">Users & Roles</h1>
          <p className="text-[11px] text-gray-500 mt-0.5">Manage system access and permissions</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowForm(!showForm)}
            className="h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md flex items-center gap-1 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" /> Add User
          </button>
        </div>
      </div>

      {showForm && (
        <div className="form-wrapper bg-white border border-gray-200 rounded-lg p-4 mb-4">
          <div className="form-header mb-4">
            <h2 className="text-[13px] font-bold text-gray-800">
              {selectedUser ? "Edit User" : "New User"}
            </h2>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-semibold text-gray-700">Full Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                  required
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-semibold text-gray-700">
                  Username * (no spaces)
                </label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) =>
                    setFormData({ ...formData, username: e.target.value.replace(/\s/g, "") })
                  }
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                  required
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-semibold text-gray-700">Email *</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                  required
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-semibold text-gray-700">Role *</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                >
                  <option value={UserRole.ADMIN}>Admin</option>
                  <option value={UserRole.MANAGER}>Manager</option>
                  <option value={UserRole.ACCOUNTANT}>Accountant</option>
                  <option value={UserRole.VIEWER}>Viewer</option>
                </select>
              </div>
              {!selectedUser && (
                <>
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-semibold text-gray-700">
                      Password *
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        className="w-full h-8 pl-2.5 pr-8 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                        required
                        minLength={6}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? (
                          <EyeOff className="w-3.5 h-3.5" />
                        ) : (
                          <Eye className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-semibold text-gray-700">
                      Confirm Password *
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={formData.confirmPassword}
                        onChange={(e) =>
                          setFormData({ ...formData, confirmPassword: e.target.value })
                        }
                        className="w-full h-8 pl-2.5 pr-8 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? (
                          <EyeOff className="w-3.5 h-3.5" />
                        ) : (
                          <Eye className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                </>
              )}
              <div className="col-span-1 md:col-span-2 flex items-center gap-2 py-1">
                <input
                  type="checkbox"
                  id="isActiveCheck"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="rounded border-gray-300 text-[#1557b0] focus:ring-[#1557b0]"
                />
                <label htmlFor="isActiveCheck" className="text-[12px] font-medium text-gray-700 cursor-pointer">
                  Is Active User Account
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={resetForm}
                className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md cursor-pointer"
              >
                {selectedUser ? "Update User" : "Add User"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Grid Cards for Users */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {users.map((user) => (
          <div key={user.id} className="bg-white border border-gray-200 rounded-lg p-3 flex flex-col justify-between hover:shadow-sm transition-shadow">
            <div>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-full bg-[#1557b0]/10 text-[#1557b0] flex items-center justify-center font-bold text-[13px] shrink-0">
                    {getInitials(user.name)}
                  </div>
                  <div>
                    <h3 className="text-[12px] font-bold text-gray-800">{user.name}</h3>
                    <p className="text-[11px] text-gray-500">@{user.username}</p>
                  </div>
                </div>
                <span className={`badge px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                  user.role === UserRole.ADMIN
                    ? "bg-[#e8eaff] text-[#1557b0]"
                    : user.role === UserRole.MANAGER
                    ? "bg-amber-50 text-amber-700"
                    : user.role === UserRole.ACCOUNTANT
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-gray-100 text-gray-700"
                }`}>
                  {user.role}
                </span>
              </div>

              <div className="space-y-1 text-[11px] text-gray-600 mb-3 border-t border-gray-100 pt-2">
                <div className="flex justify-between">
                  <span>Email:</span>
                  <span className="font-medium text-gray-800">{user.email}</span>
                </div>
                <div className="flex justify-between">
                  <span>Last Login:</span>
                  <span className="font-medium text-gray-800">
                    {user.lastLogin ? new Date(user.lastLogin).toLocaleString() : "Never"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Status:</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${user.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                    {user.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-gray-100 pt-2 mt-1">
              <div className="flex gap-1.5">
                <button
                  onClick={() => setShowPermissions(showPermissions === user.id ? null : user.id)}
                  title="Permissions"
                  className={`h-7 px-2 border rounded-md text-[11px] font-medium flex items-center gap-1 cursor-pointer transition-colors ${
                    showPermissions === user.id
                      ? "bg-[#1557b0] border-[#1557b0] text-white"
                      : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>Permissions</span>
                </button>
                <button
                  onClick={() => setShowActivityLog(showActivityLog === user.id ? null : user.id)}
                  title="Activity Log"
                  className={`h-7 px-2 border rounded-md text-[11px] font-medium flex items-center gap-1 cursor-pointer transition-colors ${
                    showActivityLog === user.id
                      ? "bg-emerald-600 border-emerald-600 text-white"
                      : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <Activity className="w-3.5 h-3.5" />
                  <span>Logs</span>
                </button>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleEdit(user)}
                  title="Edit User"
                  className="h-7 w-7 bg-white border border-gray-300 text-gray-600 rounded hover:bg-gray-50 flex items-center justify-center cursor-pointer"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setPasswordModal({ userId: user.id, isOpen: true })}
                  title="Change Password"
                  className="h-7 w-7 bg-white border border-gray-300 text-amber-600 rounded hover:bg-gray-50 flex items-center justify-center cursor-pointer"
                >
                  <Lock className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleToggleActive(user.id)}
                  title={user.isActive ? "Deactivate" : "Activate"}
                  className="h-7 w-7 bg-white border border-gray-300 text-blue-600 rounded hover:bg-gray-50 flex items-center justify-center cursor-pointer"
                >
                  {user.isActive ? (
                    <ToggleRight className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <ToggleLeft className="w-4 h-4 text-gray-400" />
                  )}
                </button>
                <button
                  onClick={() => handleDelete(user.id)}
                  title="Delete User"
                  className="h-7 w-7 bg-white border border-gray-300 text-red-600 rounded hover:bg-gray-50 flex items-center justify-center cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Expandable Permissions details on the card */}
            {showPermissions === user.id && (
              <div className="col-span-full mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200 text-[11px] animate-fadeIn">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-gray-800 uppercase tracking-wider text-[10px]">
                    Permissions for {user.name}
                  </h4>
                  {user.role === UserRole.ADMIN && (
                    <span className="text-[10px] text-gray-500 italic">Admin has full access</span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {allPermissions.map((perm) => {
                    const hasPermission =
                      getUserPermissions(user).includes(perm) ||
                      user.role === UserRole.ADMIN;
                    return (
                      <label key={perm} className="flex items-center gap-1.5 p-1 rounded hover:bg-white border border-transparent hover:border-gray-200 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={hasPermission}
                          onChange={() => togglePermission(user.id, perm)}
                          disabled={user.role === UserRole.ADMIN}
                          className="rounded border-gray-300 text-[#1557b0] focus:ring-[#1557b0]"
                        />
                        <span className="text-gray-700 capitalize">
                          {perm.replace(/_/g, " ")}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Expandable Activity log details on the card */}
            {showActivityLog === user.id && (
              <div className="col-span-full mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200 text-[11px] animate-fadeIn">
                <h4 className="font-bold text-gray-800 uppercase tracking-wider text-[10px] mb-2">
                  Recent Activity Log
                </h4>
                <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                  {activityLogs.map((log) => (
                    <div
                      key={log.id}
                      className="border-b border-gray-150 pb-1.5 last:border-0 last:pb-0"
                    >
                      <div className="flex justify-between items-center text-[10px] text-gray-500 mb-0.5">
                        <span className="font-semibold text-emerald-700 uppercase">{log.module}</span>
                        <span>{log.timestamp}</span>
                      </div>
                      <p className="font-semibold text-gray-800">{log.action}</p>
                      <p className="text-gray-500 mt-0.5">{log.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <ChangePasswordModal
        userId={passwordModal.userId}
        isOpen={passwordModal.isOpen}
        onClose={() => setPasswordModal({ userId: "", isOpen: false })}
      />
    </div>
  );
}
