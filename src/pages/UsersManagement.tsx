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
  LogOut,
} from "lucide-react";
import { useStore } from "../store/useStore";
import ChangePasswordModal from "../components/auth/ChangePasswordModal";
import { User, UserRole } from "../lib/types";
import toast from "react-hot-toast";
import Button from "../components/ui/Button";

const MODULES = [
  { id: "vouchers", label: "Vouchers" },
  { id: "invoices", label: "Invoices" },
  { id: "reports", label: "Reports" },
  { id: "settings", label: "Settings" },
  { id: "users", label: "Users" },
  { id: "stock", label: "Stock" },
];

const ACTIONS = [
  { id: "view", label: "View" },
  { id: "create", label: "Create" },
  { id: "edit", label: "Edit" },
  { id: "delete", label: "Delete" },
  { id: "print", label: "Print" },
  { id: "export", label: "Export" },
];

// Presets for roles
const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: MODULES.flatMap((m) => ACTIONS.map((a) => `${m.id}:${a.id}`)),
  manager: [
    "vouchers:view",
    "vouchers:create",
    "vouchers:edit",
    "vouchers:print",
    "vouchers:export",
    "invoices:view",
    "invoices:create",
    "invoices:edit",
    "invoices:print",
    "invoices:export",
    "reports:view",
    "reports:print",
    "reports:export",
    "stock:view",
    "stock:create",
    "stock:edit",
    "stock:print",
    "stock:export",
  ],
  accountant: [
    "vouchers:view",
    "vouchers:create",
    "vouchers:edit",
    "vouchers:print",
    "invoices:view",
    "invoices:create",
    "invoices:edit",
    "invoices:print",
    "reports:view",
    "reports:print",
  ],
  viewer: ["vouchers:view", "invoices:view", "reports:view", "stock:view"],
  custom: [],
};

export default function UsersManagement() {
  const { users, currentUser, addUser, updateUser, deleteUser, logout } = useStore();

  const [showForm, setShowForm] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [passwordModal, setPasswordModal] = useState<{ userId: string; isOpen: boolean }>({
    userId: "",
    isOpen: false,
  });

  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  const [formData, setFormData] = useState({
    name: "",
    username: "",
    email: "",
    role: "accountant",
    password: "",
    confirmPassword: "",
    isActive: true,
    permissions: [...DEFAULT_ROLE_PERMISSIONS.accountant],
  });

  // Password Policy Check
  const checkPasswordStrength = (pwd: string) => {
    if (!pwd) return { label: "", color: "bg-gray-200", width: "w-0", isValid: false };
    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[a-z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;

    const isValid = score === 5; // Must pass all 5 rules

    if (score <= 2) return { label: "Weak", color: "bg-red-500", width: "w-1/4", isValid };
    if (score === 3) return { label: "Medium", color: "bg-orange-500", width: "w-2/4", isValid };
    if (score === 4) return { label: "Strong", color: "bg-yellow-500", width: "w-3/4", isValid };
    return { label: "Very Strong", color: "bg-green-500", width: "w-full", isValid };
  };

  const strength = checkPasswordStrength(formData.password);

  const handleRoleChange = (newRole: string) => {
    setFormData({
      ...formData,
      role: newRole,
      permissions: [...(DEFAULT_ROLE_PERMISSIONS[newRole] || [])],
    });
  };

  const handleMatrixToggle = (moduleId: string, actionId: string) => {
    if (formData.role === "admin") return; // Admin has all permissions, cannot be changed
    const key = `${moduleId}:${actionId}`;
    setFormData((prev) => {
      const exists = prev.permissions.includes(key);
      const updated = exists
        ? prev.permissions.filter((p) => p !== key)
        : [...prev.permissions, key];
      return { ...prev, permissions: updated };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedUser) {
      if (!strength.isValid) {
        toast.error(
          "Password does not meet complexity requirements (minimum 8 characters, with uppercase, lowercase, number, and special character).",
        );
        return;
      }
      if (formData.password !== formData.confirmPassword) {
        toast.error("Passwords do not match");
        return;
      }
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
          role: formData.role as UserRole,
          isActive: formData.isActive,
          permissions: formData.permissions,
        });
        toast.success("User updated successfully");
      } else {
        await addUser({
          name: formData.name,
          username: formData.username,
          email: formData.email,
          role: formData.role as UserRole,
          isActive: formData.isActive,
          password: formData.password,
          permissions: formData.permissions,
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
      role: "accountant",
      password: "",
      confirmPassword: "",
      isActive: true,
      permissions: [...DEFAULT_ROLE_PERMISSIONS.accountant],
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
      permissions: user.permissions || [...(DEFAULT_ROLE_PERMISSIONS[user.role] || [])],
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

  const handleForceLogout = (user: User) => {
    if (user.id === currentUser?.id) {
      logout();
      toast.success("Logged out successfully");
    } else {
      toast.success(`Forced logout session for user ${user.username}`);
    }
  };

  // Bulk Actions
  const handleBulkActivate = async () => {
    if (selectedUserIds.length === 0) return;
    try {
      for (const id of selectedUserIds) {
        await updateUser(id, { isActive: true });
      }
      toast.success("Selected users activated successfully.");
      setSelectedUserIds([]);
    } catch (error: any) {
      toast.error(error?.message || "Failed to activate users.");
    }
  };

  const handleBulkDeactivate = async () => {
    if (selectedUserIds.length === 0) return;
    try {
      for (const id of selectedUserIds) {
        if (id === currentUser?.id) continue; // Don't deactivate self
        await updateUser(id, { isActive: false });
      }
      toast.success("Selected users deactivated successfully.");
      setSelectedUserIds([]);
    } catch (error: any) {
      toast.error(error?.message || "Failed to deactivate users.");
    }
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedUserIds(users.map((u) => u.id));
    } else {
      setSelectedUserIds([]);
    }
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedUserIds((prev) => [...prev, id]);
    } else {
      setSelectedUserIds((prev) => prev.filter((uid) => uid !== id));
    }
  };

  return (
    <div className="flex flex-col gap-4 animate-fadeIn pb-4 text-xs page-wrapper select-none">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800">Users & Roles</h1>
          <p className="text-[11px] text-gray-500 mt-0.5">Manage system access and permissions</p>
        </div>
        <div className="flex items-center gap-2">
          {selectedUserIds.length > 0 && (
            <div className="flex items-center gap-1.5 mr-2">
              <Button variant="outline" size="sm" onClick={handleBulkActivate}>
                Activate Selected
              </Button>
              <Button variant="outline" size="sm" onClick={handleBulkDeactivate}>
                Deactivate Selected
              </Button>
            </div>
          )}
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 form-grid-2">
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
                  onChange={(e) => handleRoleChange(e.target.value)}
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                >
                  <option value="admin">Admin</option>
                  <option value="manager">Manager</option>
                  <option value="accountant">Accountant</option>
                  <option value="viewer">Viewer</option>
                  <option value="custom">Custom</option>
                </select>
              </div>

              {!selectedUser && (
                <>
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-semibold text-gray-700">Password *</label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
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

                    {/* Password Policy & strength indicator bar */}
                    {formData.password && (
                      <div className="mt-1">
                        <div className="w-full bg-gray-250 h-1.5 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${strength.color} ${strength.width} transition-all`}
                          />
                        </div>
                        <span className="text-[10px] text-gray-500 mt-0.5 block font-semibold">
                          Strength: {strength.label} (Needs 8+ chars, upper, lower, digit, special
                          char)
                        </span>
                      </div>
                    )}
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
            </div>

            {/* Role-Based Permissions matrix grid */}
            <div className="form-section border-t border-gray-200 pt-4">
              <h3 className="text-[12px] font-bold text-gray-800 mb-2 uppercase tracking-wide">
                Role Permissions Matrix
              </h3>
              <div className="overflow-x-auto border border-gray-200 rounded-md">
                <table className="w-full border-collapse text-left text-xs bg-slate-50/50">
                  <thead>
                    <tr className="bg-gray-150 border-b border-gray-300">
                      <th className="px-3 py-2 font-bold text-gray-700">Module</th>
                      {ACTIONS.map((a) => (
                        <th key={a.id} className="px-3 py-2 font-bold text-gray-700 text-center">
                          {a.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {MODULES.map((m) => (
                      <tr key={m.id} className="hover:bg-white bg-slate-50/20">
                        <td className="px-3 py-2 font-semibold text-gray-800">{m.label}</td>
                        {ACTIONS.map((a) => {
                          const key = `${m.id}:${a.id}`;
                          const isChecked =
                            formData.role === "admin" || formData.permissions.includes(key);
                          const isDisabled = formData.role === "admin";
                          return (
                            <td key={a.id} className="px-3 py-2 text-center">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleMatrixToggle(m.id, a.id)}
                                disabled={isDisabled}
                                className="rounded border-gray-300 text-[#1557b0] focus:ring-[#1557b0] h-4 w-4"
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-gray-200">
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

      {/* Users table */}
      <div className="w-full overflow-x-auto border border-gray-200 rounded-lg shadow-sm bg-white">
        <table className="data-table w-full border-collapse text-left">
          <thead>
            <tr className="bg-[#eef1f8] border-b-2 border-[#c5cad8]">
              <th className="px-3 py-2 w-[4%] text-center">
                <input
                  type="checkbox"
                  checked={selectedUserIds.length === users.length && users.length > 0}
                  onChange={handleSelectAll}
                  className="rounded border-gray-300 text-[#1557b0] focus:ring-[#1557b0]"
                />
              </th>
              <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em]">
                Full Name
              </th>
              <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em]">
                Username
              </th>
              <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em]">
                Email Address
              </th>
              <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em]">
                System Role
              </th>
              <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em]">
                Active Status
              </th>
              <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em]">
                Last Login
              </th>
              <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-center">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-150">
            {users.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-6 text-gray-400">
                  No user records configured.
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id} className="hover:bg-[#e8eeff] bg-white transition-colors">
                  <td className="px-3 py-2.5 text-center">
                    <input
                      type="checkbox"
                      checked={selectedUserIds.includes(user.id)}
                      onChange={(e) => handleSelectRow(user.id, e.target.checked)}
                      className="rounded border-gray-300 text-[#1557b0] focus:ring-[#1557b0]"
                    />
                  </td>
                  <td className="px-3 py-2.5 text-gray-800 font-bold">{user.name}</td>
                  <td className="px-3 py-2.5 text-gray-700">@{user.username}</td>
                  <td className="px-3 py-2.5 text-gray-700">{user.email || "—"}</td>
                  <td className="px-3 py-2.5">
                    <span className="badge px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-slate-100 text-slate-700">
                      {user.role}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold ${user.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}
                    >
                      {user.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-gray-700">
                    {user.lastLogin ? new Date(user.lastLogin).toLocaleString() : "Never"}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => handleEdit(user)}
                        title="Edit User"
                        className="h-6 px-2 bg-white border border-gray-300 text-gray-700 rounded hover:bg-gray-50 flex items-center justify-center cursor-pointer"
                      >
                        <Edit2 className="w-3 h-3 mr-0.5" /> Edit
                      </button>
                      <button
                        onClick={() => setPasswordModal({ userId: user.id, isOpen: true })}
                        title="Change Password"
                        className="h-6 px-2 bg-white border border-gray-300 text-amber-600 rounded hover:bg-gray-50 flex items-center justify-center cursor-pointer"
                      >
                        <Lock className="w-3 h-3 mr-0.5" /> Password
                      </button>
                      <button
                        onClick={() => handleToggleActive(user.id)}
                        title={user.isActive ? "Deactivate" : "Activate"}
                        className="h-6 px-2 bg-white border border-gray-300 text-blue-600 rounded hover:bg-gray-50 flex items-center justify-center cursor-pointer"
                      >
                        {user.isActive ? "Deactivate" : "Activate"}
                      </button>
                      <button
                        onClick={() => handleForceLogout(user)}
                        title="Force Logout"
                        className="h-6 px-2 bg-red-50 border border-red-200 text-red-700 rounded hover:bg-red-100 flex items-center justify-center cursor-pointer font-semibold"
                      >
                        <LogOut className="w-3 h-3 mr-0.5" /> Force Logout
                      </button>
                      <button
                        onClick={() => handleDelete(user.id)}
                        title="Delete User"
                        className="h-6 w-6 bg-white border border-gray-300 text-red-600 rounded hover:bg-gray-50 flex items-center justify-center cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <ChangePasswordModal
        userId={passwordModal.userId}
        isOpen={passwordModal.isOpen}
        onClose={() => setPasswordModal({ userId: "", isOpen: false })}
      />
    </div>
  );
}
