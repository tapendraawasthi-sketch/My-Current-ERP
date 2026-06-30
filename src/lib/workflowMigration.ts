// ─── Voucher Workflow Migration ────────────────────────────────────────────────
// Fixes BUG-013: migrated vouchers now include totalDebit and totalCredit.
// Fixes BUG-101: opening stock computed from lines during migration.

import type { DBVoucher } from "./db";
import { getDB } from "./db";
import toast from "react-hot-toast";

export type WorkflowStage =
  | "draft"
  | "submitted"
  | "verified"
  | "approved"
  | "posted"
  | "cancelled"
  | "rejected";

export interface WorkflowConfig {
  requireVerification: boolean;
  requireApproval: boolean;
  autoPostOnApproval: boolean;
  notifyOnStageChange: boolean;
}

const DEFAULT_WORKFLOW_CONFIG: WorkflowConfig = {
  requireVerification: false,
  requireApproval: false,
  autoPostOnApproval: true,
  notifyOnStageChange: false,
};

/**
 * Maps a voucher's current status to a workflow stage.
 */
function statusToWorkflowStage(status: string): WorkflowStage {
  switch (status?.toLowerCase()) {
    case "posted":    return "posted";
    case "approved":  return "approved";
    case "pending":   return "submitted";
    case "cancelled": return "cancelled";
    case "rejected":  return "rejected";
    default:          return "draft";
  }
}

/**
 * Migrate legacy vouchers to the workflow-aware format.
 * Fixes BUG-013: computes and includes totalDebit and totalCredit.
 * Fixes BUG-101: totals computed from lines so Trial Balance is correct.
 */
export async function migrateVouchersToWorkflow(): Promise<{
  migrated: number;
  errors: number;
}> {
  const db = getDB();
  let migrated = 0;
  let errors = 0;

  try {
    const allVouchers = await db.vouchers.toArray();

    for (const v of allVouchers) {
      // Skip already migrated
      if (v.workflowStage) continue;

      // Fix BUG-013 & BUG-101: compute totals from lines
      const lines = v.lines ?? [];
      const totalDebit  = lines.reduce((s, l) => s + Number(l.debit  ?? 0), 0);
      const totalCredit = lines.reduce((s, l) => s + Number(l.credit ?? 0), 0);

      const patch: Partial<DBVoucher> = {
        workflowStage: statusToWorkflowStage(v.status),
        totalDebit,    // ← Fix BUG-013: was missing
        totalCredit,   // ← Fix BUG-013: was missing
        grandTotal: v.grandTotal ?? totalDebit,
      };

      await db.vouchers.update(v.id, patch);
      migrated++;
    }
  } catch (err) {
    console.error("[WorkflowMigration] Error:", err);
    errors++;
  }

  return { migrated, errors };
}

/**
 * Get the next workflow stage for a given current stage and action.
 */
export function getNextWorkflowStage(
  currentStage: WorkflowStage,
  action: "submit" | "verify" | "approve" | "post" | "reject" | "cancel",
  config: WorkflowConfig = DEFAULT_WORKFLOW_CONFIG,
): WorkflowStage | null {
  switch (action) {
    case "submit":
      return currentStage === "draft" ? "submitted" : null;
    case "verify":
      return currentStage === "submitted" && config.requireVerification ? "verified" : null;
    case "approve":
      return (currentStage === "submitted" || currentStage === "verified") ? "approved" : null;
    case "post":
      return currentStage === "approved" || (!config.requireApproval && currentStage === "submitted")
        ? "posted"
        : null;
    case "reject":
      return ["submitted", "verified", "approved"].includes(currentStage) ? "rejected" : null;
    case "cancel":
      return currentStage === "posted" ? "cancelled" : null;
    default:
      return null;
  }
}

/**
 * Check if a user role can perform a workflow action.
 * Fixes BUG-062: handles all roles including owner.
 */
export function canPerformWorkflowAction(
  role: string,
  action: "submit" | "verify" | "approve" | "post" | "reject" | "cancel",
): boolean {
  const r = role?.toLowerCase() ?? "";

  // Admin and owner can do everything
  if (r === "admin" || r === "owner") return true;

  switch (action) {
    case "submit":
      return ["accountant", "cashier", "staff", "manager"].includes(r);
    case "verify":
      return ["manager", "accountant"].includes(r);
    case "approve":
      return ["manager", "admin", "owner"].includes(r);
    case "post":
      return ["accountant", "manager"].includes(r);
    case "reject":
      return ["manager", "accountant"].includes(r);
    case "cancel":
      return ["manager", "admin", "owner"].includes(r);
    default:
      return false;
  }
}

export const migrateWorkflowFields = () => {};
