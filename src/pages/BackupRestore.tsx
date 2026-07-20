// @ts-nocheck
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@/store/useStore";
import { getDB, generateId } from "../lib/db";
import * as XLSX from "xlsx";
import toast from "@/lib/appToast";
import { useBranchFilter } from "../hooks/useBranchFilter";
import { matchesBranchFilter, readActiveBranchId } from "../lib/activeBranch";
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  Clock,
  Database,
  Download,
  FileArchive,
  FileDown,
  FileJson,
  FileSpreadsheet,
  HardDriveDownload,
  HardDriveUpload,
  History,
  Info,
  Lock,
  RefreshCcw,
  RotateCcw,
  Save,
  Search,
  Settings,
  ShieldCheck,
  Trash2,
  Upload,
  XCircle,
  X,
} from "lucide-react";

const money = (v: any) =>
  `Rs. ${Number(v || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const btn =
  "inline-flex items-center justify-center gap-2 h-8 px-3 rounded-md bg-[var(--ds-action-primary)] text-white text-[12px] font-medium hover:bg-[var(--ds-action-primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors";
const btn2 =
  "inline-flex items-center justify-center gap-2 h-8 px-3 rounded-md bg-white border border-gray-300 text-gray-700 text-[12px] font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors";
const btnDanger =
  "inline-flex items-center justify-center gap-2 h-8 px-3 rounded-md bg-red-600 text-white text-[12px] font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors";
const input =
  "w-full h-8 px-2.5 rounded-md border border-gray-300 bg-white text-[12px] text-gray-700 focus:outline-none focus:ring-1 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]";
const card = "bg-white border border-gray-200 rounded-lg shadow-sm p-4 text-gray-700";
const th =
  "px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide bg-gray-50 border-b border-gray-200";
const td = "px-3 py-2.5 text-[12px] text-gray-700 border-b border-gray-200 align-top";

const todayISO = () => new Date().toISOString().slice(0, 10);
const nowISO = () => new Date().toISOString();

const DEFAULT_TABLES = [
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
  "auditLogs",
  "auditEvents",
  "loginAudit",
  "securitySettings",
  "periodLocks",
  "priceLevels",
  "priceLists",
  "partyPriceLevel",
  "boms",
  "productionOrders",
  "jobWorkOrders",
  "budgets",
  "recurringVouchers",
  "bankStatements",
  "tdsPayments",
  "tdsDeductions",
  "vatReturns",
  "openingBalances",
];

const CRITICAL_TABLES = [
  "companySettings",
  "fiscalYears",
  "accounts",
  "parties",
  "items",
  "vouchers",
  "invoices",
  "stockMovements",
  "users",
];

/** Tables whose rows may carry branchId — filtered on branch-scoped backup. */
const BRANCH_SCOPED_TABLES = new Set([
  "vouchers",
  "invoices",
  "stockMovements",
  "warehouses",
  "bankAccounts",
  "periodLocks",
  "budgets",
  "payrollRuns",
  "tdsPayments",
  "tdsDeductions",
  "vatReturns",
  "openingBalances",
  "bankStatements",
  "recurringVouchers",
  "productionOrders",
  "jobWorkOrders",
]);

function filterRowsForBranch(tableName: string, rows: any[], branchFilter: string) {
  if (!BRANCH_SCOPED_TABLES.has(tableName) || !branchFilter || branchFilter === "all") {
    return rows || [];
  }
  return (rows || []).filter((r) => matchesBranchFilter(r?.branchId, branchFilter));
}

function stampRowsForBranch(tableName: string, rows: any[]) {
  if (!BRANCH_SCOPED_TABLES.has(tableName)) return rows || [];
  const active = readActiveBranchId() || undefined;
  if (!active) return rows || [];
  return (rows || []).map((r) =>
    r && (r.branchId == null || r.branchId === "")
      ? { ...r, branchId: active }
      : r,
  );
}

const tableAll = (db: any, name: string) => {
  try {
    const t = db?.table ? db.table(name) : db?.[name];
    if (t?.toArray) return t.toArray().catch(() => []);
    return Promise.resolve([]);
  } catch {
    return Promise.resolve([]);
  }
};

const tablePut = async (db: any, name: string, rows: any[]) => {
  if (!rows?.length) return;
  const t = db?.table ? db.table(name) : db?.[name];
  if (!t?.bulkPut) throw new Error(`Table ${name} not found`);
  await t.bulkPut(rows);
};

const tableClear = async (db: any, name: string) => {
  try {
    const t = db?.table ? db.table(name) : db?.[name];
    if (t?.clear) await t.clear();
  } catch (err) {
    console.warn("clear failed", name, err);
  }
};

const getKnownTables = (db: any) => {
  try {
    const dexieTables = (db?.tables || []).map((t: any) => t.name).filter(Boolean);
    return Array.from(new Set([...dexieTables, ...DEFAULT_TABLES])).sort();
  } catch {
    return DEFAULT_TABLES;
  }
};

const bytes = (n: any) => {
  const v = Number(n || 0);
  if (v < 1024) return `${v} B`;
  if (v < 1024 * 1024) return `${(v / 1024).toFixed(1)} KB`;
  return `${(v / (1024 * 1024)).toFixed(2)} MB`;
};

const safeStringify = (obj: any) => JSON.stringify(obj, null, 2);

const downloadText = (filename: string, text: string, mime = "application/json") => {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

const readFileText = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsText(file);
  });

const readFileArrayBuffer = (file: File) =>
  new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });

const normalizeBackup = (payload: any) => {
  if (!payload) return null;

  if (payload.__busyBackup && payload.tables) return payload;

  if (payload.tables && typeof payload.tables === "object") {
    return {
      __busyBackup: true,
      id: payload.id || generateId(),
      version: payload.version || "legacy",
      createdAt: payload.createdAt || nowISO(),
      companyName: payload.companyName || "",
      tables: payload.tables,
      metadata: payload.metadata || {},
    };
  }

  if (typeof payload === "object") {
    const tableLike: any = {};
    Object.entries(payload).forEach(([k, v]: any) => {
      if (Array.isArray(v)) tableLike[k] = v;
    });

    if (Object.keys(tableLike).length) {
      return {
        __busyBackup: true,
        id: generateId(),
        version: "legacy-object",
        createdAt: nowISO(),
        companyName: "",
        tables: tableLike,
        metadata: { legacyObject: true },
      };
    }
  }

  return null;
};

const makeAuditRow = (currentUser: any, action: string, narration: string, risk = "Medium") => ({
  id: generateId(),
  timestamp: nowISO(),
  date: todayISO(),
  userId: currentUser?.id || "",
  userName: currentUser?.name || currentUser?.username || "System",
  role: currentUser?.role || "",
  module: "Backup & restore",
  action,
  entityType: "backup",
  entityId: "",
  narration,
  status: "Success",
  risk,
  createdAt: nowISO(),
});

const validateRows = (tableName: string, rows: any[]) => {
  const issues: any[] = [];

  if (!Array.isArray(rows)) {
    issues.push({
      table: tableName,
      severity: "Critical",
      message: "Table data is not an array",
    });
    return issues;
  }

  rows.forEach((r, idx) => {
    if (!r || typeof r !== "object") {
      issues.push({
        table: tableName,
        severity: "High",
        message: `Row ${idx + 1} is not an object`,
      });
    }

    if (r && typeof r === "object" && !r.id) {
      issues.push({
        table: tableName,
        severity: "Warning",
        message: `Row ${idx + 1} has no id; an id will be generated on restore`,
      });
    }
  });

  if (CRITICAL_TABLES.includes(tableName) && rows.length === 0) {
    issues.push({
      table: tableName,
      severity: "Warning",
      message: "Critical table exists but contains no rows",
    });
  }

  return issues;
};

const severityClass = (s: string) => {
  const x = String(s || "").toLowerCase();
  if (x === "critical") return "bg-red-700 text-white border-red-800";
  if (x === "high") return "bg-red-100 text-red-700 border-red-200";
  if (x === "warning") return "bg-yellow-100 text-yellow-700 border-yellow-200";
  return "bg-green-100 text-green-700 border-green-200";
};

const Modal = ({ open, title, children, onClose }: any) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h3 className="text-[15px] font-semibold text-gray-700">{title}</h3>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-gray-100 text-gray-500">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4 overflow-y-auto max-h-[78vh]">{children}</div>
      </div>
    </div>
  );
};

export default function BackupRestore() {
  const store = useStore();
  const currentUser = store.currentUser || store.user || {};
  const companySettings = store.companySettings || store.company || {};
  const fileInputRef = useRef<HTMLInputElement>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);
  const { branchFilter, setBranchFilter, branchOptions } = useBranchFilter();

  const [activeTab, setActiveTab] = useState("Backup");
  const [loading, setLoading] = useState(false);
  const [tableStats, setTableStats] = useState<any[]>([]);
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [backupHistory, setBackupHistory] = useState<any[]>([]);
  const [previewBackup, setPreviewBackup] = useState<any>(null);
  const [restoreIssues, setRestoreIssues] = useState<any[]>([]);
  const [restoreMode, setRestoreMode] = useState("merge");
  const [restoreConfirm, setRestoreConfirm] = useState("");
  const [restoreModal, setRestoreModal] = useState(false);
  const [query, setQuery] = useState("");

  const [settings, setSettings] = useState({
    autoReminder: true,
    reminderDays: 7,
    includeAuditLogs: true,
    encryptLabel: false,
    localHistoryLimit: 10,
  });

  useEffect(() => {
    refreshStats();
    loadHistory();
    loadSettings();
  }, [branchFilter]);

  const loadSettings = async () => {
    try {
      const raw = localStorage.getItem("busy_backup_settings");
      if (raw) setSettings((s) => ({ ...s, ...JSON.parse(raw) }));
    } catch {
      // ignore
    }
  };

  const saveSettings = async () => {
    localStorage.setItem("busy_backup_settings", JSON.stringify(settings));

    try {
      const db = getDB();
      const audit = makeAuditRow(
        currentUser,
        "Backup Settings Updated",
        "Backup and restore preferences updated",
        "Low",
      );
      await tablePut(db, "auditLogs", [audit]);
    } catch {
      // ignore
    }

    toast.success("Backup settings saved");
  };

  const loadHistory = () => {
    try {
      const raw = localStorage.getItem("busy_backup_history");
      setBackupHistory(raw ? JSON.parse(raw) : []);
    } catch {
      setBackupHistory([]);
    }
  };

  const addHistory = (row: any) => {
    const next = [
      {
        id: generateId(),
        createdAt: nowISO(),
        ...row,
      },
      ...backupHistory,
    ].slice(0, Number(settings.localHistoryLimit || 10));

    setBackupHistory(next);
    localStorage.setItem("busy_backup_history", JSON.stringify(next));
  };

  const refreshStats = async () => {
    setLoading(true);

    try {
      const db = getDB();
      const tableNames = getKnownTables(db);

      const rows = await Promise.all(
        tableNames.map(async (name) => {
          const data = filterRowsForBranch(name, await tableAll(db, name), branchFilter);
          const json = safeStringify(data);

          return {
            name,
            count: data.length,
            size: json.length,
            selected: true,
            critical: CRITICAL_TABLES.includes(name),
            sample: data[0] || null,
          };
        }),
      );

      const existing = rows.filter((r) => r.count > 0 || DEFAULT_TABLES.includes(r.name));
      setTableStats(existing);

      if (!selectedTables.length) {
        setSelectedTables(
          existing
            .filter(
              (r) => settings.includeAuditLogs || !String(r.name).toLowerCase().includes("audit"),
            )
            .map((r) => r.name),
        );
      }
    } catch (err) {
      console.error(err);
      toast.error("Could not read database tables");
    } finally {
      setLoading(false);
    }
  };

  const selectedStats = useMemo(
    () => tableStats.filter((t) => selectedTables.includes(t.name)),
    [tableStats, selectedTables],
  );

  const totals = useMemo(() => {
    const rows = selectedStats.reduce((sum, t) => sum + Number(t.count || 0), 0);
    const size = selectedStats.reduce((sum, t) => sum + Number(t.size || 0), 0);
    const allRows = tableStats.reduce((sum, t) => sum + Number(t.count || 0), 0);
    return { rows, size, tables: selectedStats.length, allRows };
  }, [selectedStats, tableStats]);

  const filteredTableStats = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tableStats;
    return tableStats.filter((t) => t.name.toLowerCase().includes(q));
  }, [tableStats, query]);

  const toggleTable = (name: string) => {
    setSelectedTables((prev) =>
      prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name],
    );
  };

  const selectAll = () => setSelectedTables(tableStats.map((t) => t.name));

  const selectCore = () =>
    setSelectedTables(
      tableStats
        .filter(
          (t) =>
            CRITICAL_TABLES.includes(t.name) ||
            [
              "warehouses",
              "units",
              "costCenters",
              "bankAccounts",
              "employees",
              "payHeads",
              "periodLocks",
              "securitySettings",
            ].includes(t.name),
        )
        .map((t) => t.name),
    );

  const clearSelection = () => setSelectedTables([]);

  const createBackupObject = async () => {
    const db = getDB();
    const tables: any = {};

    for (const name of selectedTables) {
      const rows = await tableAll(db, name);
      tables[name] = filterRowsForBranch(name, rows, branchFilter);
    }

    const backup = {
      __busyBackup: true,
      id: generateId(),
      app: "BUSY ERP",
      version: "1.0",
      createdAt: nowISO(),
      createdBy: currentUser?.name || currentUser?.username || "System",
      companyName:
        companySettings?.name ||
        companySettings?.companyName ||
        companySettings?.legalName ||
        "Company",
      fiscalYear:
        store.currentFiscalYear?.name ||
        store.fiscalYear?.name ||
        companySettings?.fiscalYear ||
        "",
      branchFilter: branchFilter || "all",
      tables,
      metadata: {
        tableCount: Object.keys(tables).length,
        rowCount: Object.values(tables).reduce(
          (sum: number, arr: any) => sum + (arr?.length || 0),
          0,
        ),
        generatedFrom: window.location.origin,
        userAgent: navigator.userAgent,
        branchFilter: branchFilter || "all",
      },
    };

    return backup;
  };

  const downloadJsonBackup = async () => {
    if (!selectedTables.length) {
      toast.error("Select at least one table");
      return;
    }

    setLoading(true);

    try {
      const backup = await createBackupObject();
      const text = safeStringify(backup);
      const company =
        String(backup.companyName || "Company")
          .replace(/[^a-z0-9]+/gi, "_")
          .replace(/^_+|_+$/g, "") || "Company";

      downloadText(`BUSY_Backup_${company}_${todayISO()}.json`, text);

      addHistory({
        type: "JSON Backup",
        tableCount: backup.metadata.tableCount,
        rowCount: backup.metadata.rowCount,
        size: text.length,
        status: "Downloaded",
      });

      const db = getDB();
      await tablePut(db, "auditLogs", [
        makeAuditRow(
          currentUser,
          "JSON Backup Downloaded",
          `${backup.metadata.tableCount} tables and ${backup.metadata.rowCount} rows exported`,
          "Medium",
        ),
      ]);

      toast.success("JSON backup downloaded");
    } catch (err) {
      console.error(err);
      toast.error("Backup failed");
    } finally {
      setLoading(false);
    }
  };

  const downloadExcelBackup = async () => {
    if (!selectedTables.length) {
      toast.error("Select at least one table");
      return;
    }

    setLoading(true);

    try {
      const backup = await createBackupObject();
      const wb = XLSX.utils.book_new();

      const summary = [
        { Field: "App", Value: backup.app },
        { Field: "Backup ID", Value: backup.id },
        { Field: "Created At", Value: backup.createdAt },
        { Field: "Created By", Value: backup.createdBy },
        { Field: "Company", Value: backup.companyName },
        { Field: "Fiscal Year", Value: backup.fiscalYear },
        { Field: "Table Count", Value: backup.metadata.tableCount },
        { Field: "Row Count", Value: backup.metadata.rowCount },
      ];

      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), "_Summary");

      Object.entries(backup.tables).forEach(([name, rows]: any) => {
        const sheetRows =
          rows?.length > 0
            ? rows.map((r: any) => {
                const out: any = {};
                Object.entries(r).forEach(([k, v]) => {
                  out[k] = typeof v === "object" && v !== null ? JSON.stringify(v) : v;
                });
                return out;
              })
            : [{ _empty: true }];

        const ws = XLSX.utils.json_to_sheet(sheetRows);
        XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
      });

      const company =
        String(backup.companyName || "Company")
          .replace(/[^a-z0-9]+/gi, "_")
          .replace(/^_+|_+$/g, "") || "Company";

      XLSX.writeFile(wb, `BUSY_Backup_${company}_${todayISO()}.xlsx`);

      addHistory({
        type: "Excel Backup",
        tableCount: backup.metadata.tableCount,
        rowCount: backup.metadata.rowCount,
        size: 0,
        status: "Downloaded",
      });

      const db = getDB();
      await tablePut(db, "auditLogs", [
        makeAuditRow(
          currentUser,
          "Excel Backup Downloaded",
          `${backup.metadata.tableCount} tables and ${backup.metadata.rowCount} rows exported`,
          "Medium",
        ),
      ]);

      toast.success("Excel backup downloaded");
    } catch (err) {
      console.error(err);
      toast.error("Excel backup failed");
    } finally {
      setLoading(false);
    }
  };

  const validateBackup = (backup: any) => {
    const issues: any[] = [];

    if (!backup?.__busyBackup) {
      issues.push({
        table: "Backup",
        severity: "Critical",
        message: "Invalid backup file marker",
      });
    }

    if (!backup?.tables || typeof backup.tables !== "object") {
      issues.push({
        table: "Backup",
        severity: "Critical",
        message: "Backup does not contain tables object",
      });
      return issues;
    }

    Object.entries(backup.tables).forEach(([name, rows]: any) => {
      issues.push(...validateRows(name, rows));
    });

    const hasCritical = CRITICAL_TABLES.some((t) => Array.isArray(backup.tables[t]));
    if (!hasCritical) {
      issues.push({
        table: "Backup",
        severity: "High",
        message: "Backup does not appear to include core accounting tables",
      });
    }

    return issues;
  };

  const handleJsonFile = async (file: File) => {
    setLoading(true);

    try {
      const text = await readFileText(file);
      const parsed = JSON.parse(text);
      const backup = normalizeBackup(parsed);

      if (!backup) {
        toast.error("Invalid backup format");
        return;
      }

      const issues = validateBackup(backup);
      setPreviewBackup(backup);
      setRestoreIssues(issues);
      setRestoreModal(true);

      if (issues.some((i) => i.severity === "Critical")) {
        toast.error("Backup loaded with critical validation errors");
      } else {
        toast.success("Backup file loaded for preview");
      }
    } catch (err) {
      console.error(err);
      toast.error("Could not read JSON backup");
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleExcelFile = async (file: File) => {
    setLoading(true);

    try {
      const buf = await readFileArrayBuffer(file);
      const wb = XLSX.read(buf, { type: "array" });
      const tables: any = {};

      wb.SheetNames.forEach((name) => {
        if (name === "_Summary") return;
        const ws = wb.Sheets[name];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });

        tables[name] = rows
          .filter((r: any) => !r._empty)
          .map((r: any) => {
            const out: any = {};
            Object.entries(r).forEach(([k, v]: any) => {
              if (typeof v === "string") {
                const trimmed = v.trim();
                if (
                  (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
                  (trimmed.startsWith("[") && trimmed.endsWith("]"))
                ) {
                  try {
                    out[k] = JSON.parse(trimmed);
                  } catch {
                    out[k] = v;
                  }
                } else {
                  out[k] = v;
                }
              } else {
                out[k] = v;
              }
            });
            return out;
          });
      });

      const backup = normalizeBackup({
        __busyBackup: true,
        id: generateId(),
        app: "BUSY ERP",
        version: "excel-import",
        createdAt: nowISO(),
        companyName: "",
        tables,
        metadata: {
          importedFromExcel: true,
          sheetCount: wb.SheetNames.length,
        },
      });

      const issues = validateBackup(backup);
      setPreviewBackup(backup);
      setRestoreIssues(issues);
      setRestoreModal(true);

      toast.success("Excel backup loaded for preview");
    } catch (err) {
      console.error(err);
      toast.error("Could not read Excel backup");
    } finally {
      setLoading(false);
      if (excelInputRef.current) excelInputRef.current.value = "";
    }
  };

  const normalizeRowsForRestore = (rows: any[], tableName?: string) => {
    const stamped = stampRowsForBranch(tableName || "", rows || []);
    return stamped.map((r) => ({
      id: r.id || generateId(),
      ...r,
      restoredAt: nowISO(),
    }));
  };

  const restoreBackup = async () => {
    if (!previewBackup) {
      toast.error("No backup loaded");
      return;
    }

    if (restoreConfirm !== "RESTORE") {
      toast.error("Type RESTORE to confirm");
      return;
    }

    const criticalIssues = restoreIssues.filter((i) => i.severity === "Critical");
    if (criticalIssues.length) {
      toast.error("Cannot restore backup with critical errors");
      return;
    }

    setLoading(true);

    try {
      const db = getDB();
      const tables = previewBackup.tables || {};
      const names = Object.keys(tables);
      let rowCount = 0;

      for (const name of names) {
        const rows = normalizeRowsForRestore(tables[name] || [], name);
        rowCount += rows.length;

        if (restoreMode === "replace") {
          await tableClear(db, name);
        }

        await tablePut(db, name, rows);
      }

      await tablePut(db, "auditLogs", [
        makeAuditRow(
          currentUser,
          restoreMode === "replace"
            ? "Database Restored Replace Mode"
            : "Database Restored Merge Mode",
          `${names.length} tables and ${rowCount} rows restored from backup ${previewBackup.id || ""}`,
          "High",
        ),
      ]);

      addHistory({
        type: restoreMode === "replace" ? "Restore Replace" : "Restore Merge",
        tableCount: names.length,
        rowCount,
        size: 0,
        status: "Completed",
      });

      setRestoreModal(false);
      setRestoreConfirm("");
      await refreshStats();

      toast.success("Backup restored successfully. Reload app if old state is still visible.");
    } catch (err) {
      console.error(err);
      toast.error("Restore failed");
    } finally {
      setLoading(false);
    }
  };

  const exportSelectedTablesAsWorkbook = async () => {
    if (!selectedTables.length) {
      toast.error("Select tables first");
      return;
    }

    setLoading(true);

    try {
      const db = getDB();
      const wb = XLSX.utils.book_new();

      for (const name of selectedTables) {
        const rows = await tableAll(db, name);
        const clean = rows.length
          ? rows.map((r) => {
              const out: any = {};
              Object.entries(r).forEach(([k, v]) => {
                out[k] = typeof v === "object" && v !== null ? JSON.stringify(v) : v;
              });
              return out;
            })
          : [{ _empty: true }];

        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(clean), name.slice(0, 31));
      }

      XLSX.writeFile(wb, `BUSY_Selected_Tables_${todayISO()}.xlsx`);
      toast.success("Selected tables exported");
    } catch (err) {
      console.error(err);
      toast.error("Export failed");
    } finally {
      setLoading(false);
    }
  };

  const downloadEmptyTemplate = () => {
    const wb = XLSX.utils.book_new();

    DEFAULT_TABLES.forEach((name) => {
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet([{ id: "", name: "", createdAt: "" }]),
        name.slice(0, 31),
      );
    });

    XLSX.writeFile(wb, `BUSY_Import_Template_${todayISO()}.xlsx`);
    toast.success("Template downloaded");
  };

  const clearLocalHistory = () => {
    localStorage.removeItem("busy_backup_history");
    setBackupHistory([]);
    toast.success("Local backup history cleared");
  };

  const renderSummaryCards = () => (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
      <div className={card}>
        <div className="flex justify-between items-start">
          <div>
            <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">
              Selected Tables
            </p>
            <p className="text-xl font-semibold mt-1">{totals.tables}</p>
          </div>
          <Database className="h-5 w-5 text-[var(--ds-action-primary)]" />
        </div>
      </div>

      <div className={card}>
        <div className="flex justify-between items-start">
          <div>
            <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">
              Selected Rows
            </p>
            <p className="text-xl font-semibold mt-1">{totals.rows}</p>
          </div>
          <Archive className="h-5 w-5 text-[var(--ds-action-primary)]" />
        </div>
      </div>

      <div className={card}>
        <div className="flex justify-between items-start">
          <div>
            <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">
              Approx Size
            </p>
            <p className="text-xl font-semibold mt-1">{bytes(totals.size)}</p>
          </div>
          <FileArchive className="h-5 w-5 text-[var(--ds-action-primary)]" />
        </div>
      </div>

      <div className={card}>
        <div className="flex justify-between items-start">
          <div>
            <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">
              Total DB Rows
            </p>
            <p className="text-xl font-semibold mt-1">{totals.allRows}</p>
          </div>
          <ShieldCheck className="h-5 w-5 text-[var(--ds-action-primary)]" />
        </div>
      </div>
    </div>
  );

  const renderTableSelector = () => (
    <div className={card}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-[14px] font-semibold text-gray-700 flex items-center gap-2">
            <Database className="h-4 w-4 text-gray-500" />
            Database Tables
          </h3>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Choose tables to include in backup/export.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button className={btn2} onClick={selectAll}>
            Select All
          </button>
          <button className={btn2} onClick={selectCore}>
            Core Only
          </button>
          <button className={btn2} onClick={clearSelection}>
            Clear
          </button>
          <button className={btn2} onClick={refreshStats} disabled={loading}>
            <RefreshCcw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      <div className="relative mb-3 max-w-sm">
        <Search className="h-4 w-4 absolute left-2.5 top-2 text-gray-400" />
        <input
          className={`${input} pl-8`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search table..."
        />
      </div>

      <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
        <div className="overflow-auto max-h-[48vh]">
          <table className="w-full min-w-[800px] text-left border-collapse whitespace-nowrap">
            <thead className="sticky top-0 z-10 bg-gray-50 shadow-sm">
              <tr>
                <th className={`${th} w-10 text-center`}>
                  <input
                    type="checkbox"
                    checked={selectedTables.length === tableStats.length && tableStats.length > 0}
                    onChange={(e) => (e.target.checked ? selectAll() : clearSelection())}
                    className="h-3 w-3"
                  />
                </th>
                <th className={th}>Table</th>
                <th className={`${th} text-right`}>Rows</th>
                <th className={`${th} text-right`}>Approx Size</th>
                <th className={th}>Type</th>
                <th className={th}>Sample</th>
              </tr>
            </thead>

            <tbody>
              {filteredTableStats.map((t) => (
                <tr key={t.name} className="hover:bg-gray-50/50">
                  <td className={`${td} text-center`}>
                    <input
                      type="checkbox"
                      checked={selectedTables.includes(t.name)}
                      onChange={() => toggleTable(t.name)}
                      className="h-3 w-3"
                    />
                  </td>

                  <td className={td}>
                    <div className="font-medium text-gray-700">{t.name}</div>
                  </td>

                  <td className={`${td} text-right font-medium`}>{t.count}</td>
                  <td className={`${td} text-right`}>{bytes(t.size)}</td>

                  <td className={td}>
                    {t.critical ? (
                      <span className="inline-flex px-1.5 py-0.5 rounded border text-[10px] font-medium bg-red-50 text-red-700 border-red-200">
                        Critical
                      </span>
                    ) : (
                      <span className="inline-flex px-1.5 py-0.5 rounded border text-[10px] font-medium bg-gray-50 text-gray-600 border-gray-200">
                        Optional
                      </span>
                    )}
                  </td>

                  <td className={td}>
                    <div className="text-[10px] text-gray-500 max-w-[320px] truncate">
                      {t.sample ? Object.keys(t.sample).slice(0, 8).join(", ") : "-"}
                    </div>
                  </td>
                </tr>
              ))}

              {!filteredTableStats.length && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-[12px] text-gray-500">
                    No tables found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderBackup = () => (
    <div className="space-y-4">
      {renderSummaryCards()}

      <div className={card}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-[14px] font-semibold text-gray-700 flex items-center gap-2">
              <HardDriveDownload className="h-4 w-4 text-gray-500" />
              Create Backup
            </h3>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Download a full database backup as JSON or Excel workbook.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button className={btn} onClick={downloadJsonBackup} disabled={loading}>
              <FileJson className="h-4 w-4" />
              Download JSON
            </button>

            <button className={btn2} onClick={downloadExcelBackup} disabled={loading}>
              <FileSpreadsheet className="h-4 w-4" />
              Download Excel
            </button>
          </div>
        </div>
      </div>

      {renderTableSelector()}
    </div>
  );

  const renderRestore = () => (
    <div className="space-y-4">
      <div className={card}>
        <div className="flex flex-wrap justify-between items-center gap-3">
          <div>
            <h3 className="text-[14px] font-semibold text-gray-700 flex items-center gap-2">
              <HardDriveUpload className="h-4 w-4 text-gray-500" />
              Restore Database
            </h3>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Upload JSON backup or Excel workbook, validate, preview and restore.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleJsonFile(e.target.files[0])}
            />

            <input
              ref={excelInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleExcelFile(e.target.files[0])}
            />

            <button className={btn} onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-4 w-4" />
              Upload JSON
            </button>

            <button className={btn2} onClick={() => excelInputRef.current?.click()}>
              <FileSpreadsheet className="h-4 w-4" />
              Upload Excel
            </button>
          </div>
        </div>
      </div>

      <div className="p-3 rounded-md border border-amber-200 bg-amber-50 text-amber-800 flex gap-2 items-start">
        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
        <div>
          <p className="text-[12px] font-semibold">Restore Safety Notice</p>
          <p className="text-[11px] mt-1 opacity-90">
            Merge mode adds/updates records. Replace mode clears included tables before restore.
            Always download a fresh backup before restoring.
          </p>
        </div>
      </div>

      {previewBackup && (
        <div className={card}>
          <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
            <div>
              <h3 className="text-[14px] font-semibold text-gray-700">Loaded Backup Preview</h3>
              <p className="text-[11px] text-gray-500 mt-0.5">
                {previewBackup.companyName || "Company"} • {previewBackup.createdAt}
              </p>
            </div>

            <button className={btnDanger} onClick={() => setRestoreModal(true)}>
              <RotateCcw className="h-4 w-4" />
              Continue Restore
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
                Backup ID
              </p>
              <p className="text-[12px] font-medium text-gray-700 truncate">{previewBackup.id}</p>
            </div>

            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
                Tables
              </p>
              <p className="text-[14px] font-semibold text-gray-700">
                {Object.keys(previewBackup.tables || {}).length}
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
                Rows
              </p>
              <p className="text-[14px] font-semibold text-gray-700">
                {Object.values(previewBackup.tables || {}).reduce(
                  (sum: number, arr: any) => sum + (arr?.length || 0),
                  0,
                )}
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
                Issues
              </p>
              <p className="text-[14px] font-semibold text-gray-700">{restoreIssues.length}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderExportTools = () => (
    <div className="space-y-4">
      <div className={card}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-[14px] font-semibold text-gray-700 flex items-center gap-2">
              <FileDown className="h-4 w-4 text-gray-500" />
              Export Tools
            </h3>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Export selected tables or download blank import template.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button className={btn} onClick={exportSelectedTablesAsWorkbook} disabled={loading}>
              <Download className="h-4 w-4" />
              Export Selected
            </button>

            <button className={btn2} onClick={downloadEmptyTemplate}>
              <FileSpreadsheet className="h-4 w-4" />
              Blank Template
            </button>
          </div>
        </div>
      </div>

      {renderTableSelector()}
    </div>
  );

  const renderHistory = () => (
    <div className="space-y-4">
      <div className={card}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-[14px] font-semibold text-gray-700 flex items-center gap-2">
              <History className="h-4 w-4 text-gray-500" />
              Local Backup History
            </h3>
            <p className="text-[11px] text-gray-500 mt-0.5">
              This history is stored locally in this browser for tracking downloads/restores.
            </p>
          </div>

          <button className={btnDanger} onClick={clearLocalHistory}>
            <Trash2 className="h-4 w-4" />
            Clear History
          </button>
        </div>
      </div>

      <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
        <table className="w-full min-w-[800px] text-left border-collapse whitespace-nowrap">
          <thead>
            <tr>
              <th className={th}>Date / Time</th>
              <th className={th}>Type</th>
              <th className={`${th} text-right`}>Tables</th>
              <th className={`${th} text-right`}>Rows</th>
              <th className={`${th} text-right`}>Size</th>
              <th className={th}>Status</th>
            </tr>
          </thead>
          <tbody>
            {backupHistory.map((h) => (
              <tr key={h.id} className="hover:bg-gray-50/50">
                <td className={td}>
                  <div className="font-medium text-gray-700">
                    {String(h.createdAt).slice(0, 10)}
                  </div>
                  <div className="text-[10px] text-gray-400">
                    {String(h.createdAt).slice(11, 19)}
                  </div>
                </td>
                <td className={`${td} font-medium`}>{h.type}</td>
                <td className={`${td} text-right font-medium`}>{h.tableCount || 0}</td>
                <td className={`${td} text-right font-medium`}>{h.rowCount || 0}</td>
                <td className={`${td} text-right`}>{h.size ? bytes(h.size) : "-"}</td>
                <td className={td}>
                  <span className="inline-flex px-1.5 py-0.5 rounded border text-[10px] font-medium bg-emerald-50 text-emerald-700 border-emerald-200">
                    {h.status || "Done"}
                  </span>
                </td>
              </tr>
            ))}
            {!backupHistory.length && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-[12px] text-gray-500">
                  No local backup history available.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderSettings = () => (
    <div className="space-y-4">
      <div className={card}>
        <h3 className="text-[14px] font-semibold text-gray-700 flex items-center gap-2 mb-4">
          <Settings className="h-4 w-4 text-gray-500" />
          Backup Preferences
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="flex items-center gap-2 border border-gray-200 rounded-lg p-3 hover:bg-gray-50 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.autoReminder}
              onChange={(e) => setSettings((s) => ({ ...s, autoReminder: e.target.checked }))}
              className="h-4 w-4"
            />
            <span className="text-[12px] font-medium text-gray-700">Show backup reminder</span>
          </label>

          <div>
            <label className="text-[11px] font-medium text-gray-600 block mb-1">
              Reminder interval days
            </label>
            <input
              type="number"
              className={input}
              value={settings.reminderDays}
              onChange={(e) =>
                setSettings((s) => ({ ...s, reminderDays: Number(e.target.value || 0) }))
              }
            />
          </div>

          <label className="flex items-center gap-2 border border-gray-200 rounded-lg p-3 hover:bg-gray-50 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.includeAuditLogs}
              onChange={(e) => setSettings((s) => ({ ...s, includeAuditLogs: e.target.checked }))}
              className="h-4 w-4"
            />
            <span className="text-[12px] font-medium text-gray-700">
              Include audit logs by default
            </span>
          </label>

          <label className="flex items-center gap-2 border border-gray-200 rounded-lg p-3 hover:bg-gray-50 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.encryptLabel}
              onChange={(e) => setSettings((s) => ({ ...s, encryptLabel: e.target.checked }))}
              className="h-4 w-4"
            />
            <span className="text-[12px] font-medium text-gray-700">
              Mark backups as confidential
            </span>
          </label>

          <div>
            <label className="text-[11px] font-medium text-gray-600 block mb-1">
              Local history limit
            </label>
            <input
              type="number"
              className={input}
              value={settings.localHistoryLimit}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  localHistoryLimit: Number(e.target.value || 10),
                }))
              }
            />
          </div>
        </div>

        <div className="mt-4 border-t border-gray-200 pt-4">
          <button className={btn} onClick={saveSettings}>
            <Save className="h-4 w-4" />
            Save Settings
          </button>
        </div>
      </div>

      <div className="p-3 rounded-md border border-blue-200 bg-blue-50 text-blue-800 flex gap-2 items-start">
        <Info className="h-4 w-4 shrink-0 mt-0.5" />
        <div>
          <p className="text-[12px] font-semibold">Recommended policy</p>
          <p className="text-[11px] mt-1 opacity-90">
            Download a JSON backup daily, Excel backup monthly, and always before restore, year-end
            close, bulk import, migration or database maintenance.
          </p>
        </div>
      </div>
    </div>
  );

  const backupTablesPreview = useMemo(() => {
    if (!previewBackup?.tables) return [];
    return Object.entries(previewBackup.tables).map(([name, rows]: any) => ({
      name,
      count: Array.isArray(rows) ? rows.length : 0,
      valid: Array.isArray(rows),
    }));
  }, [previewBackup]);

  return (
    <div className="min-h-screen bg-gray-50 p-4 text-gray-700">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-900 flex items-center gap-2">
            <Archive className="h-4 w-4 text-[var(--ds-action-primary)]" /> Backup & restore
          </h1>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Secure database backup, Excel export, restore validation and local backup history.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {branchOptions.length > 0 ? (
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
              aria-label="Branch filter"
            >
              <option value="all">All branches</option>
              {branchOptions.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name || b.code || b.id}
                </option>
              ))}
            </select>
          ) : null}
          <button className={btn2} onClick={refreshStats} disabled={loading}>
            <RefreshCcw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
          <button className={btn} onClick={downloadJsonBackup} disabled={loading}>
            <Download className="h-3 w-3" /> Quick Backup
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4 border-b border-gray-200 pb-2">
        {[
          ["Backup", HardDriveDownload],
          ["Restore", HardDriveUpload],
          ["Export Tools", FileDown],
          ["History", History],
          ["Settings", Settings],
        ].map(([name, Icon]: any) => (
          <button
            key={name}
            onClick={() => setActiveTab(name)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors ${
              activeTab === name
                ? "bg-[var(--ds-action-primary)] text-white"
                : "bg-white border border-gray-300 text-gray-600 hover:bg-gray-50"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {name}
          </button>
        ))}
      </div>

      {loading && (
        <div className={`${card} mb-4 flex items-center gap-2 text-[12px] text-gray-600`}>
          <RefreshCcw className="h-4 w-4 animate-spin text-[var(--ds-action-primary)]" /> Processing database
          operation...
        </div>
      )}

      {activeTab === "Backup" && renderBackup()}
      {activeTab === "Restore" && renderRestore()}
      {activeTab === "Export Tools" && renderExportTools()}
      {activeTab === "History" && renderHistory()}
      {activeTab === "Settings" && renderSettings()}

      <Modal
        open={restoreModal}
        title="Restore Preview & Confirmation"
        onClose={() => setRestoreModal(false)}
      >
        {previewBackup && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  Backup ID
                </p>
                <p className="text-[12px] font-medium text-gray-700 truncate">{previewBackup.id}</p>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  Created At
                </p>
                <p className="text-[12px] font-medium text-gray-700">
                  {String(previewBackup.createdAt).slice(0, 19)}
                </p>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  Company
                </p>
                <p className="text-[12px] font-medium text-gray-700 truncate">
                  {previewBackup.companyName || "-"}
                </p>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  Tables
                </p>
                <p className="text-[12px] font-medium text-gray-700">
                  {backupTablesPreview.length}
                </p>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-medium text-gray-600 block mb-1">
                Restore Mode
              </label>
              <select
                className={input}
                value={restoreMode}
                onChange={(e) => setRestoreMode(e.target.value)}
              >
                <option value="merge">Merge / Update existing records</option>
                <option value="replace">Replace included tables first</option>
              </select>
            </div>

            <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
              <div className="overflow-auto max-h-64">
                <table className="w-full text-left border-collapse whitespace-nowrap">
                  <thead className="sticky top-0 bg-gray-50 shadow-sm">
                    <tr>
                      <th className={th}>Table</th>
                      <th className={`${th} text-right`}>Rows</th>
                      <th className={th}>Validation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {backupTablesPreview.map((t) => (
                      <tr
                        key={t.name}
                        className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50"
                      >
                        <td className={`${td} font-medium`}>{t.name}</td>
                        <td className={`${td} text-right font-medium`}>{t.count}</td>
                        <td className={td}>
                          {t.valid ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-medium bg-emerald-50 text-emerald-700 border-emerald-200">
                              <CheckCircle2 className="h-3 w-3" /> OK
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-medium bg-red-50 text-red-700 border-red-200">
                              <XCircle className="h-3 w-3" /> Invalid
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {restoreIssues.length > 0 && (
              <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
                <div className="px-3 py-2 bg-amber-50 border-b border-amber-200 text-[12px] font-semibold text-amber-800 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" /> Validation Issues
                </div>

                <div className="overflow-auto max-h-52">
                  <table className="w-full text-left border-collapse whitespace-nowrap">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className={th}>Severity</th>
                        <th className={th}>Table</th>
                        <th className={th}>Message</th>
                      </tr>
                    </thead>
                    <tbody>
                      {restoreIssues.map((i, idx) => (
                        <tr
                          key={idx}
                          className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50"
                        >
                          <td className={td}>
                            <span
                              className={`inline-flex px-1.5 py-0.5 rounded border text-[10px] font-medium ${severityClass(i.severity)}`}
                            >
                              {i.severity}
                            </span>
                          </td>
                          <td className={`${td} font-medium`}>{i.table}</td>
                          <td className={td}>{i.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div>
              <label className="text-[11px] font-medium text-red-600 block mb-1">
                Type <span className="font-bold">RESTORE</span> to confirm overwrite
              </label>
              <input
                className={`${input} border-red-300 focus:ring-red-500/20 focus:border-red-500`}
                value={restoreConfirm}
                onChange={(e) => setRestoreConfirm(e.target.value)}
                placeholder="RESTORE"
              />
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-gray-200 mt-2">
              <button className={btn2} onClick={() => setRestoreModal(false)}>
                Cancel
              </button>
              <button className={btnDanger} onClick={restoreBackup}>
                <HardDriveUpload className="h-4 w-4" /> Restore Database
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
