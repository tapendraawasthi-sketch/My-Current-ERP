// src/lib/auditLogger.ts
// Structured audit logging — writes to Dexie `auditLogs` table.
// Never throws or blocks user workflow.
// @ts-nocheck

import { getDB } from './db';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AuditAction =
  | 'create'
  | 'edit'
  | 'delete'
  | 'login'
  | 'logout'
  | 'export'
  | 'print'
  | 'approve'
  | 'reject'
  | 'cancel'
  | 'password_change'
  | 'permission_change'
  | 'force_logout';

export interface AuditChange {
  field: string;
  oldValue: unknown;
  newValue: unknown;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  action: AuditAction;
  entityType: string;       // e.g. 'salesVoucher', 'ledger', 'user'
  entityId?: string;
  entityNo?: string;        // human-readable number e.g. 'SI-00104'
  changes?: AuditChange[];  // field-level diff
  amount?: number;          // for voucher-level auditing
  ipAddress?: string;
  sessionId?: string;
  notes?: string;
}

// ─── Session ID ───────────────────────────────────────────────────────────────

function getSessionId(): string {
  let id = sessionStorage.getItem('_erp_sid');
  if (!id) {
    id = `ses-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    sessionStorage.setItem('_erp_sid', id);
  }
  return id;
}

function generateId(): string {
  return `alog-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ─── Core write function ──────────────────────────────────────────────────────

export async function writeAuditLog(
  entry: Omit<AuditLogEntry, 'id' | 'timestamp' | 'sessionId'>
): Promise<void> {
  try {
    const db = getDB();
    const log: AuditLogEntry = {
      ...entry,
      id: generateId(),
      timestamp: new Date().toISOString(),
      sessionId: getSessionId(),
    };
    await (db as any).auditLogs.add(log);
  } catch {
    // Silent — audit logging must never interrupt user workflow
  }
}

// ─── Diff helper ──────────────────────────────────────────────────────────────

const IGNORE_KEYS = new Set(['updatedAt', 'createdAt', 'id', 'passwordHash', '__v']);

export function diffObjects(
  oldObj: Record<string, unknown>,
  newObj: Record<string, unknown>,
  ignoreKeys: string[] = []
): AuditChange[] {
  const skip = new Set([...IGNORE_KEYS, ...ignoreKeys]);
  const changes: AuditChange[] = [];
  const keys = new Set([...Object.keys(oldObj ?? {}), ...Object.keys(newObj ?? {})]);

  for (const key of keys) {
    if (skip.has(key)) continue;
    const oldVal = (oldObj ?? {})[key];
    const newVal = (newObj ?? {})[key];
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      changes.push({ field: key, oldValue: oldVal, newValue: newVal });
    }
  }
  return changes;
}

// ─── Convenience wrappers ─────────────────────────────────────────────────────

export function logLogin(userId: string, userName: string): Promise<void> {
  return writeAuditLog({
    userId, userName, action: 'login', entityType: 'system',
    notes: `User logged in`,
  });
}

export function logLogout(userId: string, userName: string): Promise<void> {
  return writeAuditLog({
    userId, userName, action: 'logout', entityType: 'system',
  });
}

export function logCreate(
  userId: string, userName: string,
  entityType: string, entityId: string, entityNo?: string,
  data?: Record<string, unknown>, amount?: number
): Promise<void> {
  return writeAuditLog({
    userId, userName, action: 'create',
    entityType, entityId, entityNo, amount,
    changes: data ? [{ field: '_new', oldValue: null, newValue: data }] : undefined,
  });
}

export function logEdit(
  userId: string, userName: string,
  entityType: string, entityId: string, entityNo?: string,
  oldData?: Record<string, unknown>, newData?: Record<string, unknown>
): Promise<void> {
  const changes = oldData && newData ? diffObjects(oldData, newData) : undefined;
  return writeAuditLog({
    userId, userName, action: 'edit',
    entityType, entityId, entityNo, changes,
  });
}

export function logDelete(
  userId: string, userName: string,
  entityType: string, entityId: string, entityNo?: string,
  snapshot?: Record<string, unknown>
): Promise<void> {
  return writeAuditLog({
    userId, userName, action: 'delete',
    entityType, entityId, entityNo,
    changes: snapshot ? [{ field: '_deleted', oldValue: snapshot, newValue: null }] : undefined,
  });
}

export function logExport(userId: string, userName: string, entityType: string, notes?: string): Promise<void> {
  return writeAuditLog({ userId, userName, action: 'export', entityType, notes });
}

export function logPrint(userId: string, userName: string, entityType: string, entityNo?: string): Promise<void> {
  return writeAuditLog({ userId, userName, action: 'print', entityType, entityNo });
}

export function logApprove(
  userId: string, userName: string,
  entityType: string, entityId: string, entityNo?: string, amount?: number
): Promise<void> {
  return writeAuditLog({ userId, userName, action: 'approve', entityType, entityId, entityNo, amount });
}

export function logReject(
  userId: string, userName: string,
  entityType: string, entityId: string, entityNo?: string, notes?: string
): Promise<void> {
  return writeAuditLog({ userId, userName, action: 'reject', entityType, entityId, entityNo, notes });
}

export function logPermissionChange(
  userId: string, userName: string,
  targetUserId: string, targetUserName: string,
  changes: AuditChange[]
): Promise<void> {
  return writeAuditLog({
    userId, userName, action: 'permission_change',
    entityType: 'user', entityId: targetUserId, entityNo: targetUserName, changes,
  });
}
