import { getDB, generateId } from "./db";
import { mergeSystemConfiguration } from "./systemConfiguration";

const AUTO_BACKUP_TABLES = [
  "companySettings",
  "fiscalYears",
  "accounts",
  "parties",
  "items",
  "warehouses",
  "units",
  "costCenters",
  "vouchers",
  "invoices",
  "stockMovements",
  "bankAccounts",
  "employees",
  "payHeads",
  "payrollRuns",
  "users",
  "roles",
  "priceLists",
  "priceLevels",
];

const LAST_AUTO_BACKUP_KEY = "sutra_last_auto_backup";
const BACKUP_HISTORY_KEY = "busy_backup_history";

async function tableAll(db: ReturnType<typeof getDB>, name: string): Promise<unknown[]> {
  try {
    return await db.table(name).toArray();
  } catch {
    return [];
  }
}

function safeStringify(value: unknown): string {
  return JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? v.toString() : v));
}

export interface AutoBackupResult {
  id: string;
  tableCount: number;
  rowCount: number;
  size: number;
}

export async function runAutoBackup(companySettings?: {
  name?: string;
  companyName?: string;
  legalName?: string;
  systemConfiguration?: unknown;
}): Promise<AutoBackupResult | null> {
  const config = mergeSystemConfiguration(
    companySettings?.systemConfiguration as Parameters<typeof mergeSystemConfiguration>[0],
  );
  if (!config.backup.autoBackupEnabled) return null;

  const db = getDB();
  const tables: Record<string, unknown[]> = {};

  for (const name of AUTO_BACKUP_TABLES) {
    tables[name] = await tableAll(db, name);
  }

  const backup = {
    __busyBackup: true,
    id: generateId(),
    app: "BUSY ERP",
    version: "1.0",
    createdAt: new Date().toISOString(),
    createdBy: "Auto Backup",
    companyName:
      companySettings?.name ||
      companySettings?.companyName ||
      companySettings?.legalName ||
      "Company",
    tables,
    metadata: {
      tableCount: Object.keys(tables).length,
      rowCount: Object.values(tables).reduce((sum, arr) => sum + (arr?.length || 0), 0),
      auto: true,
      compressed: config.backup.compress,
    },
  };

  const text = safeStringify(backup);

  try {
    const raw = localStorage.getItem(BACKUP_HISTORY_KEY);
    const history = raw ? JSON.parse(raw) : [];
    const next = [
      {
        id: backup.id,
        createdAt: backup.createdAt,
        type: "Auto Backup",
        tableCount: backup.metadata.tableCount,
        rowCount: backup.metadata.rowCount,
        size: text.length,
        status: "Stored",
      },
      ...(Array.isArray(history) ? history : []),
    ].slice(0, config.backup.retentionCount);

    localStorage.setItem(BACKUP_HISTORY_KEY, JSON.stringify(next));
    localStorage.setItem(LAST_AUTO_BACKUP_KEY, backup.createdAt);

    if (config.backup.compress) {
      localStorage.setItem(`sutra_auto_backup_${backup.id}`, text);
      pruneStoredBackups(config.backup.retentionCount);
    }
  } catch {
    /* storage quota — skip persist */
  }

  return {
    id: backup.id,
    tableCount: backup.metadata.tableCount,
    rowCount: backup.metadata.rowCount,
    size: text.length,
  };
}

function pruneStoredBackups(retention: number): void {
  try {
    const keys = Object.keys(localStorage)
      .filter((k) => k.startsWith("sutra_auto_backup_"))
      .sort()
      .reverse();
    keys.slice(retention).forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}

export function getLastAutoBackupAt(): string | null {
  try {
    return localStorage.getItem(LAST_AUTO_BACKUP_KEY);
  } catch {
    return null;
  }
}

export function getAutoBackupIntervalMs(frequency: "daily" | "weekly" | "monthly"): number {
  switch (frequency) {
    case "weekly":
      return 7 * 24 * 60 * 60 * 1000;
    case "monthly":
      return 30 * 24 * 60 * 60 * 1000;
    default:
      return 24 * 60 * 60 * 1000;
  }
}

export function isAutoBackupDue(
  frequency: "daily" | "weekly" | "monthly",
  lastAt: string | null,
): boolean {
  if (!lastAt) return true;
  const elapsed = Date.now() - new Date(lastAt).getTime();
  return elapsed >= getAutoBackupIntervalMs(frequency);
}
