// @ts-nocheck
import React, { useState, useEffect } from "react";
import { UserPlus, Edit2, Trash2, Shield, Eye, EyeOff, Save, X } from "lucide-react";
import { useStore } from "../store/useStore";
import { User, UserRole } from "../lib/types";
import toast from "react-hot-toast";

const permissionGroups = {
  Accounting: ["vouchers.create", "vouchers.edit", "vouchers.delete", "ledgers.view"],
  Inventory: ["items.create", "items.edit", "stock.manage"],
  Reports: ["reports.view", "reports.export"],
  Settings: ["settings.edit", "settings.reset"],
  Payroll: ["payroll.run", "payroll.view"],
  POS: ["pos.access", "pos.void"]
};

const getDefaultPermissions = (role: UserRole): string[] => {
  switch(role) {
    case UserRole.ADMIN:
      return Object.values(permissionGroups).flat();
    case UserRole.ACCOUNTANT:
      return [...permissionGroups.Accounting, ...permissionGroups.Reports, ...permissionGroups.Inventory];
    case UserRole.VIEWER:
      return [...permissionGroups.Reports];
    case UserRole.CASHIER:
      return [...permissionGroups.POS];
    case UserRole.MANAGER:
      return [...permissionGroups.Accounting, ...permissionGroups.Reports, ...permissionGroups.Inventory, "payroll.view"];
    case UserRole.PAYROLL_OFFICER:
      return [...permissionGroups.Payroll, "reports.view"];
    default:
      return [];
  }
};

export default function UsersManagement() {
  const { users, currentUser, addUser, updateUser, deleteUser, checkPermission } = useStore();

  const [showModal, setShowModal] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    username: "",
    email: "",
    role: UserRole.ACCOUNTANT,
    password: "",
    confirmPassword: "",
    isActive: true,
    permissions: [] as string[]
  });

  const handleRoleChange = (role: UserRole) => {
    setFormData(prev => ({
      ...prev,
      role,
      permissions: getDefaultPermissions(role)
    }));
  };

  const togglePermission = (perm: string) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(perm)
        ? prev.permissions.filter(p => p !== perm)
        : [...prev.permissions, perm]
    }));
  };

  const openModal = (user?: User) => {
    if (user) {
      setSelectedUser(user);
      setFormData({
        name: user.name,
        username: user.username,
        email: user.email || "",
        role: user.role,
        password: "",
        confirmPassword: "",
        isActive: user.isActive,
        permissions: user.permissions || getDefaultPermissions(user.role)
      });
    } else {
      setSelectedUser(null);
      setFormData({
        name: "",
        username: "",
        email: "",
        role: UserRole.ACCOUNTANT,
        password: "",
        confirmPassword: "",
        isActive: true,
        permissions: getDefaultPermissions(UserRole.ACCOUNTANT)
      });
    }
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkPermission("settings.edit")) {
      toast.error("Access denied — insufficient permissions");
      return;
    }

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
          permissions: formData.permissions
        });
        toast.success("User updated");
      } else {
        await addUser({
          name: formData.name,
          username: formData.username,
          email: formData.email,
          role: formData.role,
          password: formData.password,
          isActive: formData.isActive,
          permissions: formData.permissions,
          companyId: "company-default"
        });
        toast.success("User created");
      }
      setShowModal(false);
    } catch (e: any) {
      toast.error(e.message || "Failed to save user");
    }
  };

  const toggleStatus = async (user: User) => {
    if (!checkPermission("settings.edit")) {
      toast.error("Access denied — insufficient permissions");
      return;
    }
    if (user.id === currentUser?.id) {
      toast.error("Cannot deactivate your own account");
      return;
    }
    await updateUser(user.id, { isActive: !user.isActive });
    toast.success(`User ${!user.isActive ? "activated" : "deactivated"}`);
  };

  return (
    <div className="p-6">
      <div className="page-header">
  <div>
    <div className="page-title">Users & Roles</div>
    <div className="page-subtitle">Manage access controls and permissions</div>
  </div>
  <div className="page-actions">
    <button onClick={() => openModal()} className="h-8 px-3 bg-[#3D6B25] hover:bg-[#2D5A1A] text-white text-[12px] font-medium rounded-md flex items-center gap-1.5 shadow-sm">
            <UserPlus className="w-4 h-4" /> Add User
          </button>
  </div>
</div>

      <div className="bg-white rounded-lg shadow-sm border border-[#9DC07A] overflow-hidden">
        <table className="w-full">
          <thead className="bg-[#f5f6fa] border-b border-[#9DC07A]">
            <tr>
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-[#000000] uppercase tracking-wide">Name / Username</th>
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-[#000000] uppercase tracking-wide">Email</th>
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-[#000000] uppercase tracking-wide">Role</th>
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-[#000000] uppercase tracking-wide">Last Login</th>
              <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-[#000000] uppercase tracking-wide">Status</th>
              <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-[#000000] uppercase tracking-wide">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className="border-b border-[#9DC07A] hover:bg-[#EBF5E2]">
                <td className="px-3 py-2.5">
                  <div className="text-[12px] font-medium text-[#000000]">{u.name}</div>
                  <div className="text-[11px] text-[#000000]">@{u.username}</div>
                </td>
                <td className="px-3 py-2.5 text-[12px] text-[#000000]">{u.email || "-"}</td>
                <td className="px-3 py-2.5">
                  <span className={`px-2 py-0.5 text-[10px] font-semibold uppercase rounded-md ${
                    u.role === UserRole.ADMIN ? "bg-purple-100 text-purple-700" :
                    u.role === UserRole.MANAGER ? "bg-[#D4EABD] text-[#000000]" :
                    u.role === UserRole.CASHIER ? "bg-green-100 text-green-700" :
                    "bg-[#EBF5E2] text-[#000000]"
                  }`}>
                    {u.role.replace("_", " ")}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-[11px] text-[#000000]">
                  {u.lastLogin ? new Date(u.lastLogin).toLocaleString() : "Never"}
                </td>
                <td className="px-3 py-2.5 text-center">
                  <button onClick={() => toggleStatus(u)} className={`px-2 py-0.5 text-[10px] font-semibold uppercase rounded-md border ${
                    u.isActive ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"
                  }`}>
                    {u.isActive ? "Active" : "Inactive"}
                  </button>
                </td>
                <td className="px-3 py-2.5 text-right">
                  <button onClick={() => openModal(u)} className="p-1 text-[#000000] hover:text-[#1557b0]">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  {u.id !== currentUser?.id && (
                    <button onClick={() => deleteUser(u.id)} className="p-1 text-[#000000] hover:text-red-600 ml-1">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl overflow-hidden flex flex-col my-auto">
            <div className="p-4 border-b border-[#9DC07A] flex items-center justify-between bg-[#f5f6fa]">
              <h2 className="text-[14px] font-semibold text-[#000000] flex items-center gap-2">
                <Shield className="w-4 h-4 text-[#1557b0]" /> {selectedUser ? "Edit User & Permissions" : "Add New User"}
              </h2>
              <button type="button" onClick={() => setShowModal(false)} className="text-[#000000] hover:text-[#000000]">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-[11px] font-medium text-[#000000] mb-1">Full Name</label>
                  <input type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full h-8 px-2.5 text-[12px] border border-[#9DC07A] rounded-md focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]" />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[#000000] mb-1">Username</label>
                  <input type="text" required value={formData.username} onChange={e => setFormData({...formData, username: e.target.value.toLowerCase()})} className="w-full h-8 px-2.5 text-[12px] border border-[#9DC07A] rounded-md focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]" />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[#000000] mb-1">Email</label>
                  <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full h-8 px-2.5 text-[12px] border border-[#9DC07A] rounded-md focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]" />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[#000000] mb-1">Role</label>
                  <select value={formData.role} onChange={e => handleRoleChange(e.target.value as UserRole)} className="w-full h-8 px-2.5 text-[12px] border border-[#9DC07A] rounded-md focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] bg-white">
                    {Object.values(UserRole).map(r => (
                      <option key={r} value={r}>{r.toUpperCase().replace("_", " ")}</option>
                    ))}
                  </select>
                </div>
                {!selectedUser && (
                  <>
                    <div>
                      <label className="block text-[11px] font-medium text-[#000000] mb-1">Password</label>
                      <div className="relative">
                        <input type={showPassword ? "text" : "password"} required value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full h-8 px-2.5 pr-8 text-[12px] border border-[#9DC07A] rounded-md focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]" />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2 top-2 text-[#000000]">
                          {showPassword ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-[#000000] mb-1">Confirm Password</label>
                      <input type="password" required value={formData.confirmPassword} onChange={e => setFormData({...formData, confirmPassword: e.target.value})} className="w-full h-8 px-2.5 text-[12px] border border-[#9DC07A] rounded-md focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]" />
                    </div>
                  </>
                )}
              </div>

              {/* Permissions Grid */}
              <div className="border-t border-[#9DC07A] pt-4">
                <h3 className="text-[13px] font-semibold text-[#000000] mb-3">Module Permissions</h3>
                {formData.role === UserRole.ADMIN && (
                  <div className="bg-purple-50 text-purple-700 text-[11px] p-2 rounded mb-3 border border-purple-100">
                    Admin role automatically inherits all permissions. Modifications here are visual only.
                  </div>
                )}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {Object.entries(permissionGroups).map(([module, perms]) => (
                    <div key={module} className="bg-[#EBF5E2] p-3 rounded border border-[#9DC07A]">
                      <div className="text-[11px] font-bold text-[#000000] uppercase tracking-wide mb-2 border-b border-[#9DC07A] pb-1">{module}</div>
                      <div className="space-y-1.5">
                        {perms.map(p => (
                          <label key={p} className="flex items-center gap-2 cursor-pointer group">
                            <input
                              type="checkbox"
                              checked={formData.permissions.includes(p)}
                              onChange={() => togglePermission(p)}
                              disabled={formData.role === UserRole.ADMIN}
                              className="w-3.5 h-3.5 rounded border-[#9DC07A] text-[#1557b0] focus:ring-[#1557b0]"
                            />
                            <span className="text-[11px] text-[#000000] group-hover:text-[#000000]">{p}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-[#9DC07A]">
                <button type="button" onClick={() => setShowModal(false)} className="h-8 px-4 bg-white border border-[#9DC07A] text-[#000000] text-[12px] font-medium rounded-md hover:bg-[#EBF5E2]">
                  Cancel
                </button>
                <button type="submit" className="h-8 px-4 bg-[#3D6B25] hover:bg-[#2D5A1A] text-white text-[12px] font-medium rounded-md flex items-center gap-1.5 shadow-sm">
                  <Save className="w-4 h-4" /> Save User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
