// src/store/permissionsStore.ts
// Loaded ONCE at login, never refetched on render.
// @ts-nocheck
import { create } from "zustand";
import { getDB } from "../lib/db";
import { enforcePostingPeriodLock } from "../lib/ledger/postingPeriodGuard";
import { UserPermission, getDefaultPermissionsForRole } from "../lib/permissions";

// ─── Pending Approval record shape ────────────────────────────────────────────

export interface PendingApproval {
  id: string;
  voucherId: string;
  voucherNo: string;
  voucherType: string;
  voucherDate: string;
  amount: number;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  status: "pending" | "approved" | "rejected";
  approvedBy?: string;
  approvedByName?: string;
  approvedAt?: string;
  rejectionReason?: string;
  narration?: string;
  partyName?: string;
}

// ─── Store Interface ──────────────────────────────────────────────────────────

interface PermissionsState {
  /** Current user's full permission profile */
  permissions: UserPermission | null;
  /** Whether permissions have been loaded (prevents flash) */
  isLoaded: boolean;
  /** Badge count for pending approvals (manager/admin only) */
  pendingApprovalCount: number;

  /** Call at login — loads from DB or falls back to role defaults */
  loadPermissions: (userId: string, role: string) => Promise<void>;
  /** Call at logout */
  clearPermissions: () => void;
  /** Save a user's custom permission profile to DB */
  saveUserPermissions: (perm: UserPermission) => Promise<void>;
  /** Re-count pending approvals (call after approving/rejecting) */
  refreshPendingCount: () => Promise<void>;

  // Approval workflow actions
  submitForApproval: (
    approval: Omit<PendingApproval, "id" | "status" | "createdAt">,
  ) => Promise<string>;
  approveVoucher: (approvalId: string, approvedBy: string, approvedByName: string) => Promise<void>;
  rejectVoucher: (
    approvalId: string,
    reason: string,
    approvedBy: string,
    approvedByName: string,
  ) => Promise<void>;
  getPendingApprovals: () => Promise<PendingApproval[]>;
}

// ─── Store Implementation ─────────────────────────────────────────────────────

export const usePermissionsStore = create<PermissionsState>((set, get) => ({
  permissions: null,
  isLoaded: false,
  pendingApprovalCount: 0,

  // ── Load permissions ─────────────────────────────────────────────────────

  loadPermissions: async (userId: string, role: string) => {
    try {
      const db = getDB() as any;

      // Try custom permissions from DB first
      let perm: UserPermission | null = null;
      if (db.userPermissions) {
        const stored = await db.userPermissions.get(userId);
        if (stored?.screenPermissions) {
          perm = stored as UserPermission;
        }
      }

      // Fall back to role defaults
      if (!perm) {
        perm = getDefaultPermissionsForRole(role, userId);
      }

      set({ permissions: perm, isLoaded: true });

      // Count pending approvals for manager/admin
      if (role === "admin" || role === "manager") {
        await get().refreshPendingCount();
      }
    } catch {
      // Always fall back gracefully — never block the app
      const perm = getDefaultPermissionsForRole(role, userId);
      set({ permissions: perm, isLoaded: true });
    }
  },

  // ── Save custom permissions ──────────────────────────────────────────────

  saveUserPermissions: async (perm: UserPermission) => {
    try {
      const db = getDB() as any;
      if (db.userPermissions) {
        await db.userPermissions.put({ ...perm, updatedAt: new Date().toISOString() });
      }
      // Update cached permissions if editing current user
      const current = get().permissions;
      if (current?.userId === perm.userId) {
        set({ permissions: { ...perm, updatedAt: new Date().toISOString() } });
      }
    } catch (err) {
      console.error("[PermissionsStore] saveUserPermissions failed:", err);
      throw err;
    }
  },

  // ── Clear on logout ──────────────────────────────────────────────────────

  clearPermissions: () => set({ permissions: null, isLoaded: false, pendingApprovalCount: 0 }),

  // ── Approval count refresh ───────────────────────────────────────────────

  refreshPendingCount: async () => {
    try {
      const db = getDB() as any;
      if (db.pendingApprovals) {
        const count = await db.pendingApprovals.where("status").equals("pending").count();
        set({ pendingApprovalCount: count });
      }
    } catch {
      /* non-blocking */
    }
  },

  // ── Approval workflow ────────────────────────────────────────────────────

  submitForApproval: async (data) => {
    const db = getDB() as any;
    const id = `apr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const record: PendingApproval = {
      ...data,
      id,
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    if (db.pendingApprovals) {
      await db.pendingApprovals.add(record);
    }
    // Bump count
    set((s) => ({ pendingApprovalCount: s.pendingApprovalCount + 1 }));
    return id;
  },

  approveVoucher: async (approvalId, approvedBy, approvedByName) => {
    const db = getDB() as any;
    if (db.pendingApprovals) {
      await db.pendingApprovals.update(approvalId, {
        status: "approved",
        approvedBy,
        approvedByName,
        approvedAt: new Date().toISOString(),
      });
    }
    // Update the actual voucher status to POSTED
    const approval = (await db.pendingApprovals?.get(approvalId)) as PendingApproval | undefined;
    if (approval?.voucherId) {
      if (approval.voucherDate) {
        await enforcePostingPeriodLock(String(approval.voucherDate).slice(0, 10), db);
      }
      const voucherTbl = db.vouchers ?? db.invoices;
      await voucherTbl?.update(approval.voucherId, { status: "posted" });
    }
    await get().refreshPendingCount();
  },

  rejectVoucher: async (approvalId, reason, approvedBy, approvedByName) => {
    const db = getDB() as any;
    if (db.pendingApprovals) {
      await db.pendingApprovals.update(approvalId, {
        status: "rejected",
        rejectionReason: reason,
        approvedBy,
        approvedByName,
        approvedAt: new Date().toISOString(),
      });
    }
    const approval = (await db.pendingApprovals?.get(approvalId)) as PendingApproval | undefined;
    if (approval?.voucherId) {
      const voucherTbl = db.vouchers ?? db.invoices;
      await voucherTbl?.update(approval.voucherId, {
        status: "rejected",
        cancellationReason: `Rejected: ${reason}`,
      });
      // Notify creator via notifications table
      if (db.notifications) {
        await db.notifications.add({
          id: `notif-${Date.now()}`,
          message: `Your voucher ${approval.voucherNo} was rejected: ${reason}`,
          read: false,
          timestamp: new Date().toISOString(),
          type: "approval_rejected",
          targetUserId: approval.createdBy,
        });
      }
    }
    await get().refreshPendingCount();
  },

  getPendingApprovals: async () => {
    try {
      const db = getDB() as any;
      if (db.pendingApprovals) {
        return await db.pendingApprovals.where("status").equals("pending").reverse().toArray();
      }
      return [];
    } catch {
      return [];
    }
  },
}));
