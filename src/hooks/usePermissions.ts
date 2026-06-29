// src/hooks/usePermissions.ts
// @ts-nocheck
import { useCallback } from "react";
import { usePermissionsStore } from "../store/permissionsStore";
import { ScreenId, ScreenAction, VoucherScreenId } from "../lib/permissions";
import { useStore } from "../store";

// ─── Return type ──────────────────────────────────────────────────────────────

export interface DateCheckResult {
  allowed: boolean;
  reason: string;
}

export interface AmountCheckResult {
  allowed: boolean;
  exceeded: boolean;
  limit: number;
  message: string;
}

export interface UsePermissionsReturn {
  /**
   * Check if current user can perform an action on a screen.
   * @example can('salesVoucher', 'canCreate')
   */
  can: (screen: ScreenId, action: ScreenAction) => boolean;

  /**
   * Get max amount allowed for a voucher type (0 = unlimited).
   * @example maxAmount('paymentVoucher') // 50000
   */
  maxAmount: (voucherScreen: VoucherScreenId) => number;

  /**
   * Validate a voucher date against the user's date restrictions.
   * @example checkVoucherDate('2082-09-15', 'paymentVoucher')
   */
  checkVoucherDate: (dateISO: string, voucherScreen: VoucherScreenId) => DateCheckResult;

  /**
   * Validate a voucher amount against the user's limit for that type.
   * Returns { allowed, exceeded, limit, message }
   */
  checkVoucherAmount: (amount: number, voucherScreen: VoucherScreenId) => AmountCheckResult;

  /**
   * Check if the user can alter/edit a voucher that was posted at a given time.
   */
  canAlterVoucher: (postedAtISO: string) => boolean;

  /**
   * Check if user can cancel a voucher.
   */
  canCancelVoucher: () => boolean;

  /**
   * Check if user can delete a voucher.
   */
  canDeleteVoucher: () => boolean;

  /** True when permissions are loaded from DB/store */
  isLoaded: boolean;

  /** Count of vouchers pending approval (relevant for manager/admin) */
  pendingCount: number;

  /** Raw permission object (for advanced use) */
  rawPermissions: ReturnType<typeof usePermissionsStore.getState>["permissions"];
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function usePermissions(): UsePermissionsReturn {
  const { permissions, isLoaded, pendingApprovalCount } = usePermissionsStore();
  const { currentUser } = useStore();

  const isAdmin = currentUser?.role === "admin";

  // ── can ────────────────────────────────────────────────────────────────────
  const can = useCallback(
    (screen: ScreenId, action: ScreenAction): boolean => {
      if (isAdmin) return true;
      if (!permissions) return false;
      const sp = permissions.screenPermissions?.[screen];
      if (!sp) return false;
      return Boolean(sp[action]);
    },
    [permissions, isAdmin],
  );

  // ── maxAmount ──────────────────────────────────────────────────────────────
  const maxAmount = useCallback(
    (voucherScreen: VoucherScreenId): number => {
      if (isAdmin) return 0; // unlimited
      if (!permissions) return 0;
      return permissions.voucherAmountLimits?.[voucherScreen]?.maxAmountPerVoucher ?? 0;
    },
    [permissions, isAdmin],
  );

  // ── checkVoucherDate ───────────────────────────────────────────────────────
  const checkVoucherDate = useCallback(
    (dateISO: string, _voucherScreen: VoucherScreenId): DateCheckResult => {
      if (isAdmin) return { allowed: true, reason: "" };
      if (!permissions) return { allowed: false, reason: "Permissions not loaded." };

      const { dateRestrictions } = permissions;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const vDate = new Date(dateISO);
      vDate.setHours(0, 0, 0, 0);

      // Future date check
      if (vDate > today) {
        if (!dateRestrictions.allowFutureDate) {
          return {
            allowed: false,
            reason: "Future-dated voucher entry is not permitted for your account.",
          };
        }
        return { allowed: true, reason: "" };
      }

      // Back date check
      if (vDate < today) {
        if (!dateRestrictions.allowBackDate) {
          return {
            allowed: false,
            reason: "Back-dated entry is not permitted for your account.",
          };
        }
        const diffDays = Math.floor((today.getTime() - vDate.getTime()) / 86_400_000);
        if (diffDays > dateRestrictions.backDateDaysAllowed) {
          return {
            allowed: false,
            reason: `You can only enter vouchers up to ${dateRestrictions.backDateDaysAllowed} day(s) in the past. This date is ${diffDays} days ago.`,
          };
        }
      }

      return { allowed: true, reason: "" };
    },
    [permissions, isAdmin],
  );

  // ── checkVoucherAmount ─────────────────────────────────────────────────────
  const checkVoucherAmount = useCallback(
    (amount: number, voucherScreen: VoucherScreenId): AmountCheckResult => {
      if (isAdmin) return { allowed: true, exceeded: false, limit: 0, message: "" };
      const limit = maxAmount(voucherScreen);
      if (limit === 0) return { allowed: true, exceeded: false, limit: 0, message: "" };
      if (amount > limit) {
        const fmtLimit = `Rs. ${limit.toLocaleString("en-IN")}`;
        const fmtAmt = `Rs. ${amount.toLocaleString("en-IN")}`;
        return {
          allowed: false,
          exceeded: true,
          limit,
          message: `Your authorization limit is ${fmtLimit}. This voucher (${fmtAmt}) will be sent for manager approval.`,
        };
      }
      return { allowed: true, exceeded: false, limit, message: "" };
    },
    [maxAmount, isAdmin],
  );

  // ── canAlterVoucher ────────────────────────────────────────────────────────
  const canAlterVoucher = useCallback(
    (postedAtISO: string): boolean => {
      if (isAdmin) return true;
      if (!permissions) return false;
      const { alterationRestrictions: ar } = permissions;
      if (!ar.canAlterPostedVoucher) return false;
      if (ar.canAlterWithinDays === 0) return true; // unlimited
      const posted = new Date(postedAtISO);
      const now = new Date();
      const diffDays = Math.floor((now.getTime() - posted.getTime()) / 86_400_000);
      return diffDays <= ar.canAlterWithinDays;
    },
    [permissions, isAdmin],
  );

  // ── canCancelVoucher ───────────────────────────────────────────────────────
  const canCancelVoucher = useCallback((): boolean => {
    if (isAdmin) return true;
    if (!permissions) return false;
    return Boolean(permissions.alterationRestrictions?.canCancelVoucher);
  }, [permissions, isAdmin]);

  // ── canDeleteVoucher ───────────────────────────────────────────────────────
  const canDeleteVoucher = useCallback((): boolean => {
    if (isAdmin) return true;
    if (!permissions) return false;
    return Boolean(permissions.alterationRestrictions?.canDeleteVoucher);
  }, [permissions, isAdmin]);

  return {
    can,
    maxAmount,
    checkVoucherDate,
    checkVoucherAmount,
    canAlterVoucher,
    canCancelVoucher,
    canDeleteVoucher,
    isLoaded,
    pendingCount: pendingApprovalCount,
    rawPermissions: permissions,
  };
}
