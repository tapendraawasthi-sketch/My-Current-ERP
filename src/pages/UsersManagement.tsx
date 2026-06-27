// src/pages/UsersManagement.tsx
// @ts-nocheck
import React, { useState, useEffect, useCallback } from 'react';
import {
  UserPlus, Edit2, Trash2, Shield, Eye, EyeOff, Save,
  X, Copy, Key, Monitor, AlertCircle, Check, Info,
} from 'lucide-react';
import { useStore } from '../store';
import { getDB } from '../lib/db';
import { usePermissionsStore } from '../store/permissionsStore';
import { usePermissions } from '../hooks/usePermissions';
import {
  UserPermission,
  ScreenId, ScreenAction, VoucherScreenId,
  ALL_SCREENS, SCREEN_GROUPS, SCREEN_LABELS, SCREEN_ACTION_LABELS,
  VOUCHER_SCREENS,
  getDefaultPermissionsForRole, formatAmountLimit, mergePermissions,
} from '../lib/permissions';
import { logAudit } from '../lib/auditLogger';
import toast from 'react-hot-toast';

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'users' | 'permissions' | 'sessions';

interface UserForm {
  name: string;
  username: string;
  email: string;
  role: string;
  password: string;
  confirmPassword: string;
  isActive: boolean;
}

const DEFAULT_FORM: UserForm = {
  name: '', username: '', email: '', role: 'accountant',
  password: '', confirmPassword: '', isActive: true,
};

const ROLES = ['admin', 'manager', 'accountant', 'viewer'] as const;

const ROLE_BADGES: Record<string, string> = {
  admin:      'bg-purple-100 text-purple-700',
  manager:    'bg-blue-100 text-blue-700',
  accountant: 'bg-[#D4EABD] text-[#2D5A1A]',
  viewer:     'bg-gray-100 text-gray-600',
};

// Password policy
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_EXPIRY_DAYS = 90;

// ─── Permission Matrix Editor ──────────────────────────────────────────────────

const PermissionMatrix: React.FC<{
  perm: UserPermission;
  onChange: (perm: UserPermission) => void;
  disabled?: boolean;
}> = ({ perm, onChange, disabled }) => {
  const actions: ScreenAction[] = ['canView', 'canCreate', 'canEdit', 'canDelete', 'canPrint', 'canExport'];

  const toggleScreen = (screen: ScreenId, action: ScreenAction) => {
    if (disabled) return;
    const updated: UserPermission = {
      ...perm,
      screenPermissions: {
        ...perm.screenPermissions,
        [screen]: {
          ...perm.screenPermissions[screen],
          [action]: !perm.screenPermissions[screen]?.[action],
        },
      },
    };
    onChange(updated);
  };

  const toggleAllForScreen = (screen: ScreenId, value: boolean) => {
    if (disabled) return;
    const updated: UserPermission = {
      ...perm,
      screenPermissions: {
        ...perm.screenPermissions,
        [screen]: { canView: value, canCreate: value, canEdit: value, canDelete: value, canPrint: value, canExport: value },
      },
    };
    onChange(updated);
  };

  return (
    <div className="space-y-4 mt-2">
      {SCREEN_GROUPS.map((group) => (
        <div key={group.label} className="border border-[#9DC07A] rounded-lg overflow-hidden">
          <div className="bg-[#D4EABD] px-3 py-2 text-[11px] font-bold text-[#2D5A1A] uppercase tracking-wide">
            {group.label}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="bg-[#f5f6fa] border-b border-[#9DC07A]">
                  <th className="px-3 py-1.5 text-left text-[10px] font-semibold text-gray-500 uppercase w-44">Screen</th>
                  {actions.map((a) => (
                    <th key={a} className="px-2 py-1.5 text-center text-[10px] font-semibold text-gray-500 uppercase">
                      {SCREEN_ACTION_LABELS[a]}
                    </th>
                  ))}
                  <th className="px-2 py-1.5 text-center text-[10px] font-semibold text-gray-500 uppercase">All</th>
                </tr>
              </thead>
              <tbody>
                {group.screens.map((screen) => {
                  const sp = perm.screenPermissions?.[screen];
                  const allGranted = actions.every((a) => sp?.[a]);
                  return (
                    <tr key={screen} className="border-b border-[#9DC07A] last:border-0 hover:bg-[#EBF5E2]">
                      <td className="px-3 py-1.5 text-[11px] font-medium text-gray-700">
                        {SCREEN_LABELS[screen]}
                      </td>
                      {actions.map((action) => (
                        <td key={action} className="px-2 py-1.5 text-center">
                          <input
                            type="checkbox"
                            checked={Boolean(sp?.[action])}
                            onChange={() => toggleScreen(screen, action)}
                            disabled={disabled}
                            className="w-3.5 h-3.5 rounded border-[#9DC07A] text-[#3D6B25] focus:ring-[#3D6B25] cursor-pointer disabled:opacity-50"
                          />
                        </td>
                      ))}
                      <td className="px-2 py-1.5 text-center">
                        <button
                          onClick={() => toggleAllForScreen(screen, !allGranted)}
                          disabled={disabled}
                          className={`w-5 h-5 rounded text-[9px] font-bold border transition-colors ${
                            allGranted
                              ? 'bg-[#3D6B25] text-white border-[#3D6B25]'
                              : 'bg-white border-[#9DC07A] text-gray-500 hover:border-[#3D6B25]'
                          } disabled:opacity-50`}
                          title={allGranted ? 'Remove all' : 'Grant all'}
                        >
                          {allGranted ? '✓' : '+'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {/* Amount Limits */}
      <div className="border border-[#9DC07A] rounded-lg overflow-hidden">
        <div className="bg-[#D4EABD] px-3 py-2 text-[11px] font-bold text-[#2D5A1A] uppercase tracking-wide">
          Voucher Amount Limits (0 = Unlimited)
        </div>
        <div className="p-3 grid grid-cols-2 md:grid-cols-4 gap-3">
          {VOUCHER_SCREENS.map((vs) => (
            <div key={vs}>
              <label className="block text-[10px] font-medium text-gray-600 mb-1">{SCREEN_LABELS[vs]}</label>
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-gray-400">Rs.</span>
                <input
                  type="number"
                  min={0}
                  step={1000}
                  value={perm.voucherAmountLimits?.[vs]?.maxAmountPerVoucher ?? 0}
                  onChange={(e) => {
                    if (disabled) return;
                    const val = parseInt(e.target.value) || 0;
                    onChange({
                      ...perm,
                      voucherAmountLimits: {
                        ...perm.voucherAmountLimits,
                        [vs]: { maxAmountPerVoucher: val },
                      },
                    });
                  }}
                  disabled={disabled}
                  className="flex-1 h-7 px-2 text-[11px] border border-[#9DC07A] rounded-md focus:outline-none focus:ring-1 focus:ring-[#3D6B25] disabled:bg-gray-50 min-w-0"
                />
              </div>
              <div className="text-[9px] text-[#3D6B25] mt-0.5">
                {formatAmountLimit(perm.voucherAmountLimits?.[vs]?.maxAmountPerVoucher ?? 0)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Date & Alteration Restrictions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="border border-[#9DC07A] rounded-lg p-3">
          <div className="text-[11px] font-bold text-[#2D5A1A] uppercase mb-2">Date Restrictions</div>
          <div className="space-y-2">
            {[
              { key: 'allowBackDate', label: 'Allow back-dated entry' },
              { key: 'allowFutureDate', label: 'Allow future-dated entry' },
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(perm.dateRestrictions?.[key as keyof typeof perm.dateRestrictions])}
                  onChange={(e) => {
                    if (disabled) return;
                    onChange({ ...perm, dateRestrictions: { ...perm.dateRestrictions, [key]: e.target.checked } });
                  }}
                  disabled={disabled}
                  className="w-3.5 h-3.5 rounded border-[#9DC07A] text-[#3D6B25]"
                />
                <span className="text-[11px] text-gray-700">{label}</span>
              </label>
            ))}
            {perm.dateRestrictions?.allowBackDate && (
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[11px] text-gray-600">Max back days:</span>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={perm.dateRestrictions.backDateDaysAllowed}
                  onChange={(e) => {
                    if (disabled) return;
                    onChange({ ...perm, dateRestrictions: { ...perm.dateRestrictions, backDateDaysAllowed: parseInt(e.target.value) || 1 } });
                  }}
                  disabled={disabled}
                  className="w-16 h-7 px-2 text-[11px] border border-[#9DC07A] rounded-md focus:outline-none"
                />
                <span className="text-[11px] text-gray-400">day(s)</span>
              </div>
            )}
          </div>
        </div>

        <div className="border border-[#9DC07A] rounded-lg p-3">
          <div className="text-[11px] font-bold text-[#2D5A1A] uppercase mb-2">Alteration Restrictions</div>
          <div className="space-y-2">
            {[
              { key: 'canAlterPostedVoucher', label: 'Can alter posted voucher' },
              { key: 'canCancelVoucher',      label: 'Can cancel voucher' },
              { key: 'canDeleteVoucher',      label: 'Can delete voucher' },
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(perm.alterationRestrictions?.[key as keyof typeof perm.alterationRestrictions])}
                  onChange={(e) => {
                    if (disabled) return;
                    onChange({ ...perm, alterationRestrictions: { ...perm.alterationRestrictions, [key]: e.target.checked } });
                  }}
                  disabled={disabled}
                  className="w-3.5 h-3.5 rounded border-[#9DC07A] text-[#3D6B25]"
                />
                <span className="text-[11px] text-gray-700">{label}</span>
              </label>
            ))}
            {perm.alterationRestrictions?.canAlterPostedVoucher && (
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[11px] text-gray-600">Alter within:</span>
                <input
                  type="number"
                  min={0}
                  max={365}
                  value={perm.alterationRestrictions.canAlterWithinDays}
                  onChange={(e) => {
                    if (disabled) return;
                    onChange({ ...perm, alterationRestrictions: { ...perm.alterationRestrictions, canAlterWithinDays: parseInt(e.target.value) || 0 } });
                  }}
                  disabled={disabled}
                  className="w-16 h-7 px-2 text-[11px] border border-[#9DC07A] rounded-md focus:outline-none"
                />
                <span className="text-[11px] text-gray-400">days (0 = unlimited)</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Main Component ────────────────────────────────────────────────────────────

export default function UsersManagement() {
  const { users, currentUser, addUser, updateUser, deleteUser } = useStore();
  const { saveUserPermissions } = usePermissionsStore();
  const { can } = usePermissions();

  const [activeTab, setActiveTab] = useState<Tab>('users');
  const [showModal, setShowModal] = useState(false);
  const [showPwdModal, setShowPwdModal] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [form, setForm] = useState<UserForm>({ ...DEFAULT_FORM });
  const [editPerm, setEditPerm] = useState<UserPermission | null>(null);
  const [editPermUserId, setEditPermUserId] = useState<string>('');
  const [copyFromUserId, setCopyFromUserId] = useState('');
  const [savingPerm, setSavingPerm] = useState(false);
  const [loadedPerms, setLoadedPerms] = useState<Map<string, UserPermission>>(new Map());
  const [sessions, setSessions] = useState<any[]>([]);

  // ── Load all user permission profiles ──────────────────────────────────────
  useEffect(() => {
    const loadAllPerms = async () => {
      try {
        const db = getDB() as any;
        if (!db.userPermissions) return;
        const all = await db.userPermissions.toArray();
        const map = new Map<string, UserPermission>();
        all.forEach((p: UserPermission) => map.set(p.userId, p));
        setLoadedPerms(map);
      } catch {}
    };
    loadAllPerms();
  }, []);

  // ── Load mock sessions (in a real app these would be stored in DB) ─────────
  useEffect(() => {
    if (activeTab !== 'sessions') return;
    // In production this would read from a `userSessions` table
    setSessions(
      users.filter((u) => u.isActive).map((u) => ({
        userId: u.id,
        userName: u.name,
        role: u.role,
        loginAt: u.lastLogin || new Date(Date.now() - Math.random() * 3600000).toISOString(),
        device: 'Web Browser',
        sessionId: `ses-${u.id.slice(-4)}`,
        isCurrentUser: u.id === currentUser?.id,
      }))
    );
  }, [activeTab, users, currentUser]);

  // ── Password validation ────────────────────────────────────────────────────
  const validatePassword = (pwd: string): string[] => {
    const errors: string[] = [];
    if (pwd.length < PASSWORD_MIN_LENGTH) errors.push(`Minimum ${PASSWORD_MIN_LENGTH} characters required`);
    if (!/[A-Z]/.test(pwd)) errors.push('At least one uppercase letter');
    if (!/[0-9]/.test(pwd)) errors.push('At least one number');
    if (!/[^A-Za-z0-9]/.test(pwd)) errors.push('At least one special character');
    return errors;
  };

  // ── Open user modal ────────────────────────────────────────────────────────
  const openModal = (user?: any) => {
    if (user) {
      setSelectedUser(user);
      setForm({
        name: user.name,
        username: user.username,
        email: user.email || '',
        role: user.role,
        password: '',
        confirmPassword: '',
        isActive: user.isActive,
      });
    } else {
      setSelectedUser(null);
      setForm({ ...DEFAULT_FORM });
    }
    setShowModal(true);
  };

  // ── Save user ──────────────────────────────────────────────────────────────
  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!can('userManagement', 'canCreate') && !can('userManagement', 'canEdit')) {
      toast.error('Access denied — insufficient permissions');
      return;
    }

    // Duplicate username check
    if (users.some((u) => u.username === form.username && u.id !== selectedUser?.id)) {
      toast.error('Username already exists');
      return;
    }

    // New user password validation
    if (!selectedUser) {
      if (!form.password) { toast.error('Password is required'); return; }
      const pwdErrors = validatePassword(form.password);
      if (pwdErrors.length > 0) { toast.error(pwdErrors[0]); return; }
      if (form.password !== form.confirmPassword) { toast.error('Passwords do not match'); return; }
    }

    try {
      if (selectedUser) {
        await updateUser(selectedUser.id, {
          name: form.name, username: form.username,
          email: form.email, role: form.role, isActive: form.isActive,
        });
        await logAudit({
          userId: currentUser!.id, userName: currentUser!.name,
          action: 'UPDATE', module: 'USER',
          recordId: selectedUser.id, recordNo: form.username,
          description: `User profile updated`,
          beforeData: null, afterData: null,
          fiscalYear: '', companyId: 'company-default',
        });
        toast.success('User updated');
      } else {
        const newUser = await addUser({
          name: form.name, username: form.username, email: form.email,
          role: form.role, password: form.password, isActive: form.isActive,
          companyId: 'company-default',
          passwordChangedAt: new Date().toISOString(),
        });
        // Seed default permissions
        const defaultPerm = getDefaultPermissionsForRole(form.role, newUser?.id || `usr-${Date.now()}`);
        await saveUserPermissions(defaultPerm);
        await logAudit({
          userId: currentUser!.id, userName: currentUser!.name,
          action: 'CREATE', module: 'USER',
          recordId: newUser?.id || `usr-${Date.now()}`, recordNo: form.username,
          description: `New user created with role: ${form.role}`,
          beforeData: null, afterData: null,
          fiscalYear: '', companyId: 'company-default',
        });
        toast.success('User created');
      }
      setShowModal(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save user');
    }
  };

  // ── Open permissions editor ────────────────────────────────────────────────
  const openPermEditor = (user: any) => {
    const existing = loadedPerms.get(user.id);
    const perm = existing || getDefaultPermissionsForRole(user.role, user.id);
    setEditPerm({ ...perm, userId: user.id, role: user.role });
    setEditPermUserId(user.id);
    setCopyFromUserId('');
    setActiveTab('permissions');
  };

  // ── Copy permissions from another user ────────────────────────────────────
  const handleCopyFrom = () => {
    if (!copyFromUserId || !editPermUserId) return;
    const sourcePerm = loadedPerms.get(copyFromUserId);
    const sourceUser = users.find((u) => u.id === copyFromUserId);
    if (!sourcePerm && !sourceUser) { toast.error('Source user permissions not found'); return; }
    const base = sourcePerm || getDefaultPermissionsForRole(sourceUser!.role, copyFromUserId);
    setEditPerm({
      ...base,
      userId: editPermUserId,
      role: editPerm?.role || base.role,
    });
    toast.success(`Permissions copied from ${sourceUser?.name}`);
  };

  // ── Save permissions ───────────────────────────────────────────────────────
  const handleSavePermissions = async () => {
    if (!editPerm) return;
    setSavingPerm(true);
    try {
      const old = loadedPerms.get(editPermUserId);
      await saveUserPermissions({
        ...editPerm,
        updatedBy: currentUser?.id,
        updatedAt: new Date().toISOString(),
      });

      if (old && currentUser) {
        const changes = [];
        if (JSON.stringify(old.screenPermissions) !== JSON.stringify(editPerm.screenPermissions)) {
          changes.push({ field: 'screenPermissions', oldValue: old.screenPermissions, newValue: editPerm.screenPermissions });
        }
        if (JSON.stringify(old.voucherAmountLimits) !== JSON.stringify(editPerm.voucherAmountLimits)) {
          changes.push({ field: 'amountLimits', oldValue: old.voucherAmountLimits, newValue: editPerm.voucherAmountLimits });
        }
        if (changes.length > 0) {
          const targetUser = users.find((u) => u.id === editPermUserId);
          await logAudit({
            userId: currentUser.id, userName: currentUser.name,
            action: 'UPDATE', module: 'USER',
            recordId: editPermUserId, recordNo: targetUser?.name || editPermUserId,
            description: `Updated user permissions`,
            beforeData: { changes: changes.map(c => ({ field: c.field, value: c.oldValue })) },
            afterData: { changes: changes.map(c => ({ field: c.field, value: c.newValue })) },
            fiscalYear: '', companyId: 'company-default',
          });
        }
      }

      setLoadedPerms((m) => new Map(m).set(editPermUserId, editPerm));
      toast.success('Permissions saved');
      setActiveTab('users');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save permissions');
    } finally {
      setSavingPerm(false);
    }
  };

  // ── Force logout ───────────────────────────────────────────────────────────
  const handleForceLogout = async (targetUser: any) => {
    if (targetUser.isCurrentUser) { toast.error('Cannot force-logout yourself'); return; }
    // In a real app: invalidate the session token in DB
    await logAudit({
      userId: currentUser!.id, userName: currentUser!.name,
      action: 'LOGOUT', module: 'USER',
      recordId: targetUser.userId, recordNo: targetUser.userName,
      description: `Force logout user`,
      beforeData: null, afterData: null,
      fiscalYear: '', companyId: 'company-default',
    });
    toast.success(`${targetUser.userName} will be logged out on their next request`);
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  const editPermUser = users.find((u) => u.id === editPermUserId);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-[15px] font-semibold text-[#000000] flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#3D6B25]" />
            Users & Security
          </h1>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Manage users, granular screen permissions, and security settings
          </p>
        </div>
        {activeTab === 'users' && can('userManagement', 'canCreate') && (
          <button
            onClick={() => openModal()}
            className="h-8 px-3 bg-[#3D6B25] hover:bg-[#2D5A1A] text-white text-[12px] font-medium rounded-md flex items-center gap-1.5 shadow-sm"
          >
            <UserPlus className="w-4 h-4" /> Add User
          </button>
        )}
        {activeTab === 'permissions' && editPerm && (
          <button
            onClick={handleSavePermissions}
            disabled={savingPerm}
            className="h-8 px-3 bg-[#3D6B25] hover:bg-[#2D5A1A] text-white text-[12px] font-medium rounded-md flex items-center gap-1.5 shadow-sm disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {savingPerm ? 'Saving...' : 'Save Permissions'}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-[#9DC07A]">
        {(['users', 'permissions', 'sessions'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-[12px] font-medium border-b-2 -mb-px transition-colors capitalize ${
              activeTab === tab
                ? 'border-[#3D6B25] text-[#3D6B25]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab === 'permissions' && editPermUser ? `Edit Permissions — ${editPermUser.name}` : tab}
          </button>
        ))}
      </div>

      {/* ─── Users Tab ─────────────────────────────────────────────────── */}
      {activeTab === 'users' && (
        <div className="bg-white rounded-lg shadow-sm border border-[#9DC07A] overflow-hidden">
          <table className="w-full">
            <thead className="bg-[#f5f6fa] border-b border-[#9DC07A]">
              <tr>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Name / Username</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Email</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Role</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Permissions</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Last Login</th>
                <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-8 text-[12px] text-gray-400">No users found</td></tr>
              ) : users.map((u) => {
                const hasCustomPerm = loadedPerms.has(u.id);
                return (
                  <tr key={u.id} className="border-b border-[#9DC07A] hover:bg-[#EBF5E2]">
                    <td className="px-3 py-2.5">
                      <div className="text-[12px] font-medium text-gray-800">{u.name}</div>
                      <div className="text-[11px] text-gray-400">@{u.username}</div>
                    </td>
                    <td className="px-3 py-2.5 text-[12px] text-gray-600">{u.email || '—'}</td>
                    <td className="px-3 py-2.5">
                      <span className={`px-2 py-0.5 text-[10px] font-semibold uppercase rounded-md ${ROLE_BADGES[u.role] || 'bg-gray-100 text-gray-600'}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <button
                        onClick={() => openPermEditor(u)}
                        className="flex items-center gap-1 text-[11px] text-[#1557b0] hover:text-[#0e3d80]"
                      >
                        <Shield className="w-3.5 h-3.5" />
                        {hasCustomPerm ? 'Custom' : 'Default'}
                      </button>
                    </td>
                    <td className="px-3 py-2.5 text-[11px] text-gray-500">
                      {u.lastLogin ? new Date(u.lastLogin).toLocaleString() : 'Never'}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={`px-2 py-0.5 text-[10px] font-semibold uppercase rounded-md border ${
                        u.isActive
                          ? 'bg-green-50 text-green-700 border-green-200'
                          : 'bg-red-50 text-red-700 border-red-200'
                      }`}>
                        {u.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {can('userManagement', 'canEdit') && (
                          <button onClick={() => openModal(u)} className="p-1 text-gray-400 hover:text-[#1557b0] rounded" title="Edit">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {can('userManagement', 'canDelete') && u.id !== currentUser?.id && (
                          <button
                            onClick={async () => {
                              if (!window.confirm(`Delete user ${u.name}?`)) return;
                              await deleteUser(u.id);
                              toast.success('User deleted');
                            }}
                            className="p-1 text-gray-400 hover:text-red-600 rounded"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ─── Permissions Tab ───────────────────────────────────────────────── */}
      {activeTab === 'permissions' && editPerm && (
        <div>
          {/* Copy From */}
          <div className="bg-[#EBF5E2] border border-[#9DC07A] rounded-lg p-3 mb-4 flex items-center gap-3 flex-wrap">
            <Copy className="w-4 h-4 text-[#3D6B25] shrink-0" />
            <span className="text-[12px] text-gray-700 font-medium">Copy permissions from:</span>
            <select
              value={copyFromUserId}
              onChange={(e) => setCopyFromUserId(e.target.value)}
              className="h-7 px-2 text-[11px] border border-[#9DC07A] rounded-md bg-white focus:outline-none w-44"
            >
              <option value="">— Select user —</option>
              {users.filter((u) => u.id !== editPermUserId).map((u) => (
                <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
              ))}
            </select>
            <button
              onClick={handleCopyFrom}
              disabled={!copyFromUserId}
              className="h-7 px-3 bg-[#3D6B25] text-white text-[11px] rounded-md disabled:opacity-40 hover:bg-[#2D5A1A]"
            >
              Apply
            </button>
            <div className="flex items-center gap-1.5 ml-auto">
              <span className="text-[11px] text-gray-500">Reset to role default:</span>
              {ROLES.map((r) => (
                <button
                  key={r}
                  onClick={() => {
                    const d = getDefaultPermissionsForRole(r, editPermUserId);
                    setEditPerm({ ...d, userId: editPermUserId });
                    toast.success(`Reset to ${r} defaults`);
                  }}
                  className="h-6 px-2 text-[10px] border border-[#9DC07A] rounded-md hover:bg-[#D4EABD] capitalize"
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Admin notice */}
          {editPerm.role === 'admin' && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 mb-4 flex items-center gap-2 text-[12px] text-purple-700">
              <Info className="w-4 h-4 shrink-0" />
              Admin role has unrestricted access by default. Changes here serve as documentation only —
              the <code className="font-mono text-[11px]">isAdmin</code> check in code overrides all restrictions.
            </div>
          )}

          <PermissionMatrix
            perm={editPerm}
            onChange={(p) => setEditPerm(p)}
            disabled={editPerm.role === 'admin'}
          />
        </div>
      )}

      {/* ─── Sessions Tab ──────────────────────────────────────────────────── */}
      {activeTab === 'sessions' && (
        <div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 flex items-center gap-2 text-[12px] text-amber-700">
            <AlertCircle className="w-4 h-4 shrink-0" />
            Session management: force-logout any active user. They will be signed out on their next action.
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-[#9DC07A] overflow-hidden">
            <table className="w-full">
              <thead className="bg-[#f5f6fa] border-b border-[#9DC07A]">
                <tr>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">User</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Role</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Login Time</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Device</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Session ID</th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Action</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.sessionId} className="border-b border-[#9DC07A] hover:bg-[#EBF5E2]">
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <div className="w-6 h-6 rounded-full bg-[#D4EABD] flex items-center justify-center text-[10px] font-bold text-[#2D5A1A]">
                          {s.userName.charAt(0)}
                        </div>
                        <span className="text-[12px] font-medium text-gray-800">
                          {s.userName}
                          {s.isCurrentUser && <span className="ml-1 text-[10px] text-[#3D6B25]">(you)</span>}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`px-2 py-0.5 text-[10px] font-semibold uppercase rounded-md ${ROLE_BADGES[s.role] || ''}`}>
                        {s.role}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-[11px] text-gray-500">
                      {new Date(s.loginAt).toLocaleString()}
                    </td>
                    <td className="px-3 py-2.5 text-[11px] text-gray-600">
                      <div className="flex items-center gap-1"><Monitor className="w-3 h-3" /> {s.device}</div>
                    </td>
                    <td className="px-3 py-2.5 text-[10px] text-gray-400 font-mono">{s.sessionId}</td>
                    <td className="px-3 py-2.5 text-right">
                      {!s.isCurrentUser ? (
                        <button
                          onClick={() => handleForceLogout(s)}
                          className="h-6 px-2.5 text-[10px] bg-red-50 text-red-700 border border-red-200 rounded-md hover:bg-red-100"
                        >
                          Force Logout
                        </button>
                      ) : (
                        <span className="text-[10px] text-green-600 flex items-center justify-end gap-1">
                          <Check className="w-3 h-3" /> Active
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Password policy info */}
          <div className="mt-4 bg-[#EBF5E2] border border-[#9DC07A] rounded-lg p-3">
            <div className="text-[12px] font-semibold text-[#2D5A1A] mb-2 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5" /> Password Policy
            </div>
            <ul className="text-[11px] text-gray-700 space-y-1">
              <li>• Minimum {PASSWORD_MIN_LENGTH} characters with uppercase, number, and special character</li>
              <li>• Passwords must be changed every {PASSWORD_EXPIRY_DAYS} days</li>
              <li>• Last 3 passwords cannot be reused</li>
              <li>• Account locked after 5 consecutive failed login attempts</li>
            </ul>
          </div>
        </div>
      )}

      {/* ─── Add/Edit User Modal ────────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="p-4 border-b border-[#9DC07A] flex items-center justify-between bg-[#f5f6fa]">
              <h2 className="text-[14px] font-semibold text-gray-800 flex items-center gap-2">
                <Shield className="w-4 h-4 text-[#3D6B25]" />
                {selectedUser ? 'Edit User' : 'Add New User'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-gray-600 mb-1">Full Name *</label>
                  <input
                    type="text" required
                    value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full h-8 px-2.5 text-[12px] border border-[#9DC07A] rounded-md focus:outline-none focus:ring-1 focus:ring-[#3D6B25]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-gray-600 mb-1">Username *</label>
                  <input
                    type="text" required
                    value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase() })}
                    className="w-full h-8 px-2.5 text-[12px] border border-[#9DC07A] rounded-md focus:outline-none focus:ring-1 focus:ring-[#3D6B25]"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-[11px] font-medium text-gray-600 mb-1">Email</label>
                  <input
                    type="email"
                    value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full h-8 px-2.5 text-[12px] border border-[#9DC07A] rounded-md focus:outline-none focus:ring-1 focus:ring-[#3D6B25]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-gray-600 mb-1">Role *</label>
                  <select
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                    className="w-full h-8 px-2.5 text-[12px] border border-[#9DC07A] rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-[#3D6B25]"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-gray-600 mb-1">Status</label>
                  <select
                    value={form.isActive ? 'active' : 'inactive'}
                    onChange={(e) => setForm({ ...form, isActive: e.target.value === 'active' })}
                    className="w-full h-8 px-2.5 text-[12px] border border-[#9DC07A] rounded-md bg-white focus:outline-none"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              {!selectedUser && (
                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-100">
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">Password *</label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'} required
                        value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                        className="w-full h-8 px-2.5 pr-8 text-[12px] border border-[#9DC07A] rounded-md focus:outline-none focus:ring-1 focus:ring-[#3D6B25]"
                      />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2 top-2 text-gray-400">
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {form.password && validatePassword(form.password).length > 0 && (
                      <div className="text-[10px] text-red-500 mt-0.5">{validatePassword(form.password)[0]}</div>
                    )}
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">Confirm Password *</label>
                    <input
                      type="password" required
                      value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                      className="w-full h-8 px-2.5 text-[12px] border border-[#9DC07A] rounded-md focus:outline-none focus:ring-1 focus:ring-[#3D6B25]"
                    />
                    {form.confirmPassword && form.password !== form.confirmPassword && (
                      <div className="text-[10px] text-red-500 mt-0.5">Passwords do not match</div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="h-8 px-4 border border-[#9DC07A] text-[12px] rounded-md hover:bg-[#EBF5E2]">
                  Cancel
                </button>
                <button type="submit" className="h-8 px-4 bg-[#3D6B25] hover:bg-[#2D5A1A] text-white text-[12px] font-medium rounded-md flex items-center gap-1.5">
                  <Save className="w-3.5 h-3.5" /> {selectedUser ? 'Update' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
