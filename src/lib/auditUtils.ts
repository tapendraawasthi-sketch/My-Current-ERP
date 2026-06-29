/**
 * src/lib/auditUtils.ts
 *
 * Utility functions for the immutable audit log system.
 * Provides: change diffing, checksum generation, entry creation helpers.
 */

import type { DBAuditLog } from "./db";

// ─── Types ────────────────────────────────────────────────────────────────────

export type AuditAction =
  | "LOGIN"
  | "LOGOUT"
  | "LOGIN_FAILED"
  | "PASSWORD_CHANGED"
  | "SESSION_EXPIRED"
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "SOFT_DELETE"
  | "RESTORE"
  | "SUBMIT"
  | "APPROVE"
  | "REJECT"
  | "POST"
  | "UNPOST"
  | "CANCEL"
  | "VOID"
  | "CONFIG_CHANGE"
  | "FISCAL_YEAR_CLOSE"
  | "FISCAL_YEAR_OPEN"
  | "DATA_IMPORT"
  | "DATA_EXPORT"
  | "BACKUP"
  | "PERMISSION_CHANGE"
  | "SCHEMA_MIGRATION"
  | "CBMS_SUBMIT"
  | "CBMS_RESUBMIT"
  | "CBMS_SYNC"
  | "REPORT_GENERATED"
  | "REPORT_EXPORTED"
  | "REPORT_PRINTED"
  | "STOCK_ADJUSTMENT"
  | "PHYSICAL_STOCK_COUNT"
  | "BATCH_CREATE"
  | "BATCH_EXPIRE"
  | "CHEQUE_ISSUED"
  | "CHEQUE_CLEARED"
  | "CHEQUE_BOUNCED"
  | "CHEQUE_CANCELLED"
  | "BANK_RECONCILIATION_DONE"
  | "PERIOD_LOCKED"
  | "PERIOD_UNLOCKED";

export type EntityType =
  | "ACCOUNT"
  | "PARTY"
  | "ITEM"
  | "WAREHOUSE"
  | "UNIT"
  | "COST_CENTER"
  | "VOUCHER"
  | "VOUCHER_LINE"
  | "INVOICE"
  | "INVOICE_LINE"
  | "STOCK_MOVEMENT"
  | "STOCK_TRANSFER"
  | "PHYSICAL_STOCK"
  | "USER"
  | "ROLE"
  | "COMPANY_SETTINGS"
  | "FISCAL_YEAR"
  | "BUDGET"
  | "PRICE_LIST"
  | "BILL_SUNDRY"
  | "NARRATION"
  | "BATCH"
  | "SERIAL"
  | "PURCHASE_ORDER"
  | "SALES_ORDER"
  | "QUOTATION"
  | "DELIVERY_CHALLAN"
  | "GOODS_RECEIPT"
  | "FIXED_ASSET"
  | "DEPRECIATION"
  | "BANK_RECONCILIATION"
  | "POS_SESSION"
  | "PAYROLL"
  | "EMPLOYEE"
  | "TDS_CERTIFICATE"
  | "CBMS_RECORD"
  | "CHEQUE"
  | "AUDIT_LOG";

export interface AuditEntryInput {
  userId: string;
  userName: string;
  userRole?: string;
  action: AuditAction;
  entityType: EntityType;
  entityId: string;
  entityName?: string;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  changeDescription?: string;
  severity?: "INFO" | "WARNING" | "CRITICAL";
  ipAddress?: string;
  sessionId?: string;
  companyId?: string;
  fiscalYearId?: string;
}

// ─── Simple Hash (SHA-256 not available in browser without Web Crypto) ─────────

function simpleHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  // Combine with a simple hex representation and length for uniqueness
  const hex = Math.abs(hash).toString(16).padStart(8, "0");
  return hex + "_" + input.length.toString(36);
}

// ─── Object Diff ───────────────────────────────────────────────────────────────

export function diffObjects(
  oldObj: Record<string, unknown> | undefined,
  newObj: Record<string, unknown> | undefined,
): string {
  if (!oldObj && !newObj) return "No change data available";
  if (!oldObj) return "Created new record";
  if (!newObj) return "Record deleted";

  const changes: string[] = [];

  const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);

  for (const key of allKeys) {
    // Skip internal fields
    if (["id", "createdAt", "updatedAt", "checksum", "auditLogId"].includes(key)) {
      continue;
    }

    const oldVal = oldObj[key];
    const newVal = newObj[key];

    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      if (oldVal === undefined) {
        changes.push(`ADDED "${key}": ${JSON.stringify(newVal)}`);
      } else if (newVal === undefined) {
        changes.push(`REMOVED "${key}": ${JSON.stringify(oldVal)}`);
      } else {
        const oldStr = typeof oldVal === "object" ? JSON.stringify(oldVal) : String(oldVal);
        const newStr = typeof newVal === "object" ? JSON.stringify(newVal) : String(newVal);
        if (oldStr.length > 100 || newStr.length > 100) {
          changes.push(`CHANGED "${key}"`);
        } else {
          changes.push(`CHANGED "${key}": "${oldStr}" → "${newStr}"`);
        }
      }
    }
  }

  return changes.length > 0 ? changes.join("; ") : "No visible changes detected";
}

// ─── Create Audit Entry ────────────────────────────────────────────────────────

let lastChecksum = "";

export function createAuditEntry(input: AuditEntryInput): Omit<DBAuditLog, "id"> {
  const timestamp = new Date().toISOString();

  const oldJson = input.oldValue ? JSON.stringify(input.oldValue) : undefined;
  const newJson = input.newValue ? JSON.stringify(input.newValue) : undefined;

  const changeDesc = input.changeDescription || diffObjects(input.oldValue, input.newValue);

  // Build checksum chain for tamper detection
  const rawEntry = JSON.stringify({
    timestamp,
    userId: input.userId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    changeDescription: changeDesc,
  });

  const currentChecksum = simpleHash(lastChecksum + rawEntry);
  lastChecksum = currentChecksum;

  return {
    timestamp,
    timestampNepali: "", // Will be populated by the caller if needed
    userId: input.userId,
    userName: input.userName,
    userRole: input.userRole || "",
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    entityName: input.entityName || "",
    oldValue: oldJson,
    newValue: newJson,
    changeDescription: changeDesc,
    severity: input.severity || "INFO",
    ipAddress: input.ipAddress || "",
    sessionId: input.sessionId || "",
    companyId: input.companyId || "",
    fiscalYearId: input.fiscalYearId || "",
    checksum: currentChecksum,
  };
}

// ─── Action Label Mapper ───────────────────────────────────────────────────────

const ACTION_LABELS: Record<string, string> = {
  LOGIN: "User logged in",
  LOGOUT: "User logged out",
  LOGIN_FAILED: "Login attempt failed",
  PASSWORD_CHANGED: "Password changed",
  SESSION_EXPIRED: "Session expired",
  CREATE: "Created",
  UPDATE: "Updated",
  DELETE: "Deleted",
  SOFT_DELETE: "Soft-deleted",
  RESTORE: "Restored",
  SUBMIT: "Submitted for approval",
  APPROVE: "Approved",
  REJECT: "Rejected",
  POST: "Posted",
  UNPOST: "Unposted",
  CANCEL: "Cancelled",
  VOID: "Voided",
  CONFIG_CHANGE: "Configuration changed",
  FISCAL_YEAR_CLOSE: "Fiscal year closed",
  FISCAL_YEAR_OPEN: "Fiscal year opened",
  DATA_IMPORT: "Data imported",
  DATA_EXPORT: "Data exported",
  BACKUP: "Backup created",
  PERMISSION_CHANGE: "Permissions changed",
  SCHEMA_MIGRATION: "Schema migrated",
  CBMS_SUBMIT: "CBMS submission",
  CBMS_RESUBMIT: "CBMS resubmission",
  CBMS_SYNC: "CBMS sync",
  REPORT_GENERATED: "Report generated",
  REPORT_EXPORTED: "Report exported",
  REPORT_PRINTED: "Report printed",
  STOCK_ADJUSTMENT: "Stock adjusted",
  PHYSICAL_STOCK_COUNT: "Physical stock counted",
  BATCH_CREATE: "Batch created",
  BATCH_EXPIRE: "Batch expired",
  CHEQUE_ISSUED: "Cheque issued",
  CHEQUE_CLEARED: "Cheque cleared",
  CHEQUE_BOUNCED: "Cheque bounced",
  CHEQUE_CANCELLED: "Cheque cancelled",
  BANK_RECONCILIATION_DONE: "Bank reconciliation done",
  PERIOD_LOCKED: "Period locked",
  PERIOD_UNLOCKED: "Period unlocked",
};

export function getActionLabel(action: string): string {
  return ACTION_LABELS[action] || action;
}

// ─── Severity Color Mapper ─────────────────────────────────────────────────────

export function getSeverityStyles(severity: string): {
  bg: string;
  text: string;
  border: string;
} {
  switch (severity) {
    case "CRITICAL":
      return { bg: "bg-red-50", text: "text-red-700", border: "border-red-200" };
    case "WARNING":
      return { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" };
    case "INFO":
    default:
      return { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" };
  }
}
