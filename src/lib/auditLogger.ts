import { getDB } from "./db";

export type AuditAction =
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "POST"
  | "UNPOST"
  | "APPROVE"
  | "REJECT"
  | "LOCK"
  | "UNLOCK"
  | "LOGIN"
  | "LOGOUT"
  | "EXPORT"
  | "PRINT";

export type AuditModule =
  | "VOUCHER"
  | "INVOICE"
  | "LEDGER"
  | "ITEM"
  | "PARTY"
  | "EMPLOYEE"
  | "PAYROLL"
  | "ASSET"
  | "USER"
  | "SETTINGS"
  | "PERIOD_LOCK"
  | "BATCH"
  | "SERIAL";

export interface AuditEntry {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  action: AuditAction;
  module: AuditModule;
  recordId: string;
  recordNo: string;
  description: string;
  beforeData: Record<string, unknown> | null;
  afterData: Record<string, unknown> | null;
  ipAddress: string;
  deviceInfo: string;
  fiscalYear: string;
  companyId: string;
}

const FALLBACK_KEY = "sutra_audit_log";

function readFallbackLogs(): AuditEntry[] {
  try {
    if (typeof localStorage === "undefined") return [];
    const raw = localStorage.getItem(FALLBACK_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeFallbackLogs(logs: AuditEntry[]): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(FALLBACK_KEY, JSON.stringify(logs));
  } catch {
    // Never throw from audit fallback.
  }
}

function saveToFallback(entry: AuditEntry): void {
  try {
    const logs = readFallbackLogs();
    logs.push(entry);
    writeFallbackLogs(logs);
  } catch {
    // Never throw from audit fallback.
  }
}

function applyFilters(
  logs: AuditEntry[],
  filters?: {
    module?: AuditModule;
    recordId?: string;
    userId?: string;
    fromDate?: string;
    toDate?: string;
    action?: AuditAction;
    limit?: number;
  },
): AuditEntry[] {
  const limit = filters?.limit ?? 500;

  return logs
    .filter((log) => {
      if (filters?.module && log.module !== filters.module) return false;
      if (filters?.recordId && log.recordId !== filters.recordId) return false;
      if (filters?.userId && log.userId !== filters.userId) return false;
      if (filters?.action && log.action !== filters.action) return false;
      if (filters?.fromDate && log.timestamp < filters.fromDate) return false;
      if (filters?.toDate && log.timestamp > filters.toDate) return false;
      return true;
    })
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, limit);
}

export async function logAudit(
  entry: Omit<AuditEntry, "id" | "timestamp" | "ipAddress" | "deviceInfo">,
): Promise<void> {
  try {
    const fullEntry: AuditEntry = {
      ...entry,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      ipAddress: "local",
      deviceInfo:
        typeof navigator !== "undefined" ? navigator.userAgent.substring(0, 100) : "unknown",
    };

    try {
      const db = getDB() as any;
      if (db?.auditLog?.add) {
        await db.auditLog.add(fullEntry);
        return;
      }
      saveToFallback(fullEntry);
    } catch {
      saveToFallback(fullEntry);
    }
  } catch {
    // Audit logging must never break application flow.
  }
}

export async function getAuditLogs(filters?: {
  module?: AuditModule;
  recordId?: string;
  userId?: string;
  fromDate?: string;
  toDate?: string;
  action?: AuditAction;
  limit?: number;
}): Promise<AuditEntry[]> {
  try {
    let logs: AuditEntry[] = [];

    try {
      const db = getDB() as any;
      if (db?.auditLog?.toArray) {
        logs = await db.auditLog.toArray();
      } else {
        logs = readFallbackLogs();
      }
    } catch {
      logs = readFallbackLogs();
    }

    return applyFilters(logs, filters);
  } catch {
    return [];
  }
}

export async function getAuditLogsForRecord(
  recordId: string,
  module: AuditModule,
): Promise<AuditEntry[]> {
  return getAuditLogs({ recordId, module });
}

function csvEscape(value: unknown): string {
  const str = value == null ? "" : String(value);
  return `"${str.replace(/"/g, '""')}"`;
}

export function exportAuditLogToCSV(logs: AuditEntry[]): void {
  try {
    const headers = [
      "Timestamp",
      "User",
      "Action",
      "Module",
      "Record No",
      "Description",
      "Before",
      "After",
    ];

    const rows = logs.map((log) => [
      log.timestamp,
      log.userName,
      log.action,
      log.module,
      log.recordNo,
      log.description,
      JSON.stringify(log.beforeData),
      JSON.stringify(log.afterData),
    ]);

    const csv = [
      headers.map(csvEscape).join(","),
      ...rows.map((row) => row.map(csvEscape).join(",")),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const today = new Date().toISOString().split("T")[0];
    const link = document.createElement("a");
    link.href = url;
    link.download = `audit_log_${today}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  } catch {
    // Export should fail silently to avoid breaking UI.
  }
}

export function getDiffSummary(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): string {
  if (before === null) return "Created new record";
  if (after === null) return "Deleted record";

  const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));
  const changes: string[] = [];

  for (const key of keys) {
    const beforeValue = before[key];
    const afterValue = after[key];

    if (JSON.stringify(beforeValue) !== JSON.stringify(afterValue)) {
      changes.push(`${key} from ${JSON.stringify(beforeValue)} to ${JSON.stringify(afterValue)}`);
    }
  }

  const summary = changes.length > 0 ? `Changed: ${changes.join(", ")}` : "No changes";

  return summary.length > 200 ? `${summary.slice(0, 197)}...` : summary;
}
