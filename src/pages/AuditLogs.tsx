// @ts-nocheck
import React, { useState, useMemo, useCallback, useEffect } from "react";
import {
  ShieldCheck,
  Search,
  Download,
  Filter,
  XCircle,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Eye,
} from "lucide-react";
import { useStore } from "../store/useStore";
import { getActionLabel, getSeverityStyles } from "../lib/auditUtils";
import type { DBAuditLog } from "../lib/db";
import { getDB } from "../lib/db";

// ─── Action Color Config ──────────────────────────────────────────────────────

const ACTION_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  LOGIN: { bg: "bg-gray-100", text: "text-gray-700", border: "border-gray-200" },
  LOGOUT: { bg: "bg-gray-50", text: "text-gray-600", border: "border-gray-200" },
  LOGIN_FAILED: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
  CREATE: { bg: "bg-green-50", text: "text-green-700", border: "border-green-200" },
  UPDATE: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  DELETE: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
  SOFT_DELETE: { bg: "bg-red-50", text: "text-red-600", border: "border-red-200" },
  RESTORE: { bg: "bg-emerald-50", text: "text-emerald-600", border: "border-emerald-200" },
  POST: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  UNPOST: { bg: "bg-blue-50", text: "text-blue-600", border: "border-blue-200" },
  CANCEL: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
  VOID: { bg: "bg-red-100", text: "text-red-800", border: "border-red-300" },
  APPROVE: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  REJECT: { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200" },
  SUBMIT: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  CONFIG_CHANGE: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
  FISCAL_YEAR_CLOSE: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
  FISCAL_YEAR_OPEN: { bg: "bg-green-50", text: "text-green-700", border: "border-green-200" },
  DATA_IMPORT: { bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200" },
  DATA_EXPORT: { bg: "bg-indigo-50", text: "text-indigo-600", border: "border-indigo-200" },
  BACKUP: { bg: "bg-cyan-50", text: "text-cyan-700", border: "border-cyan-200" },
  PERMISSION_CHANGE: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
  SCHEMA_MIGRATION: { bg: "bg-yellow-50", text: "text-yellow-700", border: "border-yellow-200" },
  CBMS_SUBMIT: { bg: "bg-teal-50", text: "text-teal-700", border: "border-teal-200" },
  CBMS_RESUBMIT: { bg: "bg-teal-50", text: "text-teal-600", border: "border-teal-200" },
  CBMS_SYNC: { bg: "bg-teal-50", text: "text-teal-600", border: "border-teal-200" },
  REPORT_GENERATED: { bg: "bg-sky-50", text: "text-sky-700", border: "border-sky-200" },
  REPORT_EXPORTED: { bg: "bg-sky-50", text: "text-sky-600", border: "border-sky-200" },
  REPORT_PRINTED: { bg: "bg-sky-50", text: "text-sky-600", border: "border-sky-200" },
  STOCK_ADJUSTMENT: { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200" },
  PHYSICAL_STOCK_COUNT: {
    bg: "bg-orange-50",
    text: "text-orange-600",
    border: "border-orange-200",
  },
  PERIOD_LOCKED: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
  PERIOD_UNLOCKED: { bg: "bg-green-50", text: "text-green-700", border: "border-green-200" },
  BANK_RECONCILIATION_DONE: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  CHEQUE_ISSUED: { bg: "bg-violet-50", text: "text-violet-700", border: "border-violet-200" },
  CHEQUE_CLEARED: { bg: "bg-green-50", text: "text-green-700", border: "border-green-200" },
  CHEQUE_BOUNCED: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
  CHEQUE_CANCELLED: { bg: "bg-red-50", text: "text-red-600", border: "border-red-200" },
};

function getActionColor(action: string): { bg: string; text: string; border: string } {
  return (
    ACTION_COLORS[action] ?? { bg: "bg-gray-100", text: "text-gray-700", border: "border-gray-200" }
  );
}

// ─── Severity Badge ───────────────────────────────────────────────────────────

const SEVERITY_BADGE: Record<string, string> = {
  INFO: "bg-blue-100 text-blue-700",
  WARNING: "bg-amber-100 text-amber-700",
  CRITICAL: "bg-red-100 text-red-700",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTimestamp(ts: string): string {
  if (!ts) return "—";
  try {
    const d = new Date(ts);
    const pad = (n: number) => String(n).padStart(2, "0");
    return (
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
      `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
    );
  } catch {
    return ts;
  }
}

function todayISODate(): string {
  return new Date().toISOString().split("T")[0];
}

function isThisWeek(ts: string): boolean {
  try {
    const d = new Date(ts);
    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(now.getDate() - 7);
    return d >= weekAgo && d <= now;
  } catch {
    return false;
  }
}

function formatJsonForDisplay(raw: string | undefined): string {
  if (!raw) return "";
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

function exportToCsv(logs: DBAuditLog[]): void {
  const headers = [
    "ID",
    "Timestamp",
    "User",
    "User Role",
    "Action",
    "Entity Type",
    "Entity ID",
    "Entity Name",
    "Change Description",
    "Severity",
    "Checksum",
  ];

  const rows = logs.map((log) => [
    String(log.id ?? ""),
    log.timestamp,
    log.userName,
    log.userRole ?? "",
    log.action,
    log.entityType,
    log.entityId,
    log.entityName ?? "",
    (log.changeDescription ?? "").replace(/"/g, '""'),
    log.severity,
    log.checksum ?? "",
  ]);

  const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `audit_log_${todayISODate()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────

interface DetailModalProps {
  log: DBAuditLog;
  onClose: () => void;
}

const DetailModal: React.FC<DetailModalProps> = ({ log, onClose }) => {
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const actionColor = getActionColor(log.action);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 bg-[#f5f6fa]">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[#1557b0]" />
            <span className="text-[13px] font-semibold text-gray-800">
              Audit Log Entry #{log.id}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close"
          >
            <XCircle className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Badges */}
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`px-2 py-0.5 text-[10px] font-semibold uppercase rounded border ${actionColor.bg} ${actionColor.text} ${actionColor.border}`}
            >
              {log.action}
            </span>
            <span
              className={`px-2 py-0.5 text-[10px] font-semibold uppercase rounded ${SEVERITY_BADGE[log.severity] ?? "bg-gray-100 text-gray-700"}`}
            >
              {log.severity}
            </span>
            <span className="px-2 py-0.5 text-[10px] font-semibold uppercase rounded bg-gray-100 text-gray-700">
              {log.entityType}
            </span>
          </div>

          {/* Metadata grid */}
          <div className="grid grid-cols-2 gap-3 text-[12px]">
            <div className="col-span-2">
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-0.5">
                Timestamp
              </p>
              <p className="text-gray-800 font-mono">{formatTimestamp(log.timestamp)}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-0.5">
                User
              </p>
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-full bg-[#1557b0]/10 flex items-center justify-center text-[10px] font-bold text-[#1557b0]">
                  {(log.userName || "?").charAt(0).toUpperCase()}
                </div>
                <span className="text-gray-800">{log.userName}</span>
              </div>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-0.5">
                Role
              </p>
              <p className="text-gray-700">{log.userRole || "—"}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-0.5">
                Entity ID
              </p>
              <p className="text-gray-700 font-mono text-[11px] break-all">{log.entityId || "—"}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-0.5">
                Entity Name
              </p>
              <p className="text-gray-700">{log.entityName || "—"}</p>
            </div>
            {log.sessionId && (
              <div className="col-span-2">
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-0.5">
                  Session ID
                </p>
                <p className="text-gray-600 font-mono text-[11px] break-all">{log.sessionId}</p>
              </div>
            )}
          </div>

          {/* Change Description */}
          <div>
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Change Description
            </p>
            <div className="bg-[#f5f6fa] border border-gray-200 rounded-md px-3 py-2.5 text-[12px] text-gray-700 whitespace-pre-wrap break-words">
              {log.changeDescription || "—"}
            </div>
          </div>

          {/* Old Value */}
          {log.oldValue && (
            <div>
              <button
                type="button"
                onClick={() => setShowOld((v) => !v)}
                className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-600 hover:text-gray-800 mb-1"
              >
                <ChevronRight
                  className={`h-3.5 w-3.5 transition-transform ${showOld ? "rotate-90" : ""}`}
                />
                Previous Value (Before Change)
              </button>
              {showOld && (
                <pre className="bg-red-50 border border-red-100 rounded-md px-3 py-2.5 text-[11px] text-red-800 font-mono whitespace-pre-wrap break-words max-h-48 overflow-auto">
                  {formatJsonForDisplay(log.oldValue)}
                </pre>
              )}
            </div>
          )}

          {/* New Value */}
          {log.newValue && (
            <div>
              <button
                type="button"
                onClick={() => setShowNew((v) => !v)}
                className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-600 hover:text-gray-800 mb-1"
              >
                <ChevronRight
                  className={`h-3.5 w-3.5 transition-transform ${showNew ? "rotate-90" : ""}`}
                />
                New Value (After Change)
              </button>
              {showNew && (
                <pre className="bg-green-50 border border-green-100 rounded-md px-3 py-2.5 text-[11px] text-green-800 font-mono whitespace-pre-wrap break-words max-h-48 overflow-auto">
                  {formatJsonForDisplay(log.newValue)}
                </pre>
              )}
            </div>
          )}

          {/* Checksum */}
          {log.checksum && (
            <div>
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-0.5">
                Integrity Checksum
              </p>
              <p className="font-mono text-[11px] text-gray-500 break-all bg-[#f5f6fa] border border-gray-200 rounded px-2 py-1">
                {log.checksum}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-200 bg-[#f5f6fa] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const PAGE_SIZE_OPTIONS = [25, 50, 100, 200];

const AuditLogs: React.FC = () => {
  const { auditLogs: storeLogs } = useStore();

  const [allLogs, setAllLogs] = useState<DBAuditLog[]>([]);
  const [loading, setLoading] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [entityTypeFilter, setEntityTypeFilter] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Detail modal
  const [selectedLog, setSelectedLog] = useState<DBAuditLog | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const db = getDB();
      if (!db.auditLogs) throw new Error("Table auditLogs not found");
      const logs = (await db.auditLogs.orderBy("timestamp").reverse().limit(2000).toArray()).map(
        (log) => ({
          ...log,
          details: log.details && typeof log.details === "object" ? log.details : {},
        }),
      );
      setAllLogs(logs);
    } catch {
      setAllLogs(storeLogs ?? []);
    } finally {
      setLoading(false);
    }
  }, [storeLogs]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const actionOptions = useMemo(
    () => Array.from(new Set(allLogs.map((l) => l.action))).sort(),
    [allLogs],
  );
  const entityTypeOptions = useMemo(
    () => Array.from(new Set(allLogs.map((l) => l.entityType))).sort(),
    [allLogs],
  );

  const filteredLogs = useMemo(() => {
    let result = allLogs;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (l) =>
          (l.userName ?? "").toLowerCase().includes(q) ||
          (l.entityName ?? "").toLowerCase().includes(q) ||
          (l.changeDescription ?? "").toLowerCase().includes(q) ||
          (l.entityId ?? "").toLowerCase().includes(q) ||
          (l.action ?? "").toLowerCase().includes(q),
      );
    }
    if (actionFilter) result = result.filter((l) => l.action === actionFilter);
    if (entityTypeFilter) result = result.filter((l) => l.entityType === entityTypeFilter);
    if (severityFilter) result = result.filter((l) => l.severity === severityFilter);
    if (fromDate) result = result.filter((l) => l.timestamp >= fromDate);
    if (toDate) result = result.filter((l) => l.timestamp <= toDate + "T23:59:59");
    return result;
  }, [allLogs, search, actionFilter, entityTypeFilter, severityFilter, fromDate, toDate]);

  const todayCount = useMemo(
    () => allLogs.filter((l) => l.timestamp?.startsWith(todayISODate())).length,
    [allLogs],
  );
  const weekCount = useMemo(() => allLogs.filter((l) => isThisWeek(l.timestamp)).length, [allLogs]);

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / pageSize));
  const paginatedLogs = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredLogs.slice(start, start + pageSize);
  }, [filteredLogs, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [search, actionFilter, entityTypeFilter, severityFilter, fromDate, toDate, pageSize]);

  const clearFilters = () => {
    setSearch("");
    setActionFilter("");
    setEntityTypeFilter("");
    setSeverityFilter("");
    setFromDate("");
    setToDate("");
  };

  const hasActiveFilters = !!(
    search ||
    actionFilter ||
    entityTypeFilter ||
    severityFilter ||
    fromDate ||
    toDate
  );

  return (
    <div className="p-4 md:p-6 bg-[#f5f6fa] min-h-screen">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800">Secure Audit Monitor Logs</h1>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Immutable compliance ledger — all system actions recorded
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchLogs}
            disabled={loading}
            className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => exportToCsv(filteredLogs)}
            disabled={filteredLogs.length === 0}
            className="h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md flex items-center gap-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-gray-200 rounded-lg p-3 mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search user, entity, description…"
            className="h-8 pl-8 pr-3 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
          />
        </div>
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
        >
          <option value="">All Actions</option>
          {actionOptions.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <select
          value={entityTypeFilter}
          onChange={(e) => setEntityTypeFilter(e.target.value)}
          className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
        >
          <option value="">All Entity Types</option>
          {entityTypeOptions.map((et) => (
            <option key={et} value={et}>
              {et}
            </option>
          ))}
        </select>
        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
          className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
        >
          <option value="">All Severities</option>
          <option value="INFO">INFO</option>
          <option value="WARNING">WARNING</option>
          <option value="CRITICAL">CRITICAL</option>
        </select>
        <input
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          title="From date"
          className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
        />
        <input
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          title="To date"
          className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
        />
        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 flex items-center gap-1.5 transition-colors"
          >
            <XCircle className="h-3.5 w-3.5" />
            Clear
          </button>
        )}
      </div>

      {/* Summary Bar */}
      <div className="flex items-center justify-between mb-3 px-1">
        <p className="text-[11px] text-gray-500 font-medium">
          Showing{" "}
          <span className="font-semibold text-gray-700">
            {Math.min((page - 1) * pageSize + 1, filteredLogs.length)}–
            {Math.min(page * pageSize, filteredLogs.length)}
          </span>{" "}
          of <span className="font-semibold text-gray-700">{filteredLogs.length}</span>{" "}
          {hasActiveFilters ? "filtered " : ""}entries
          {" · "}
          <span className="font-semibold text-gray-700">{todayCount}</span> today
          {" · "}
          <span className="font-semibold text-gray-700">{weekCount}</span> this week
        </p>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-gray-500">Rows:</span>
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="h-7 px-2 text-[11px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-[#1557b0]/20"
          >
            {PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-gray-400">
            <RefreshCw className="h-5 w-5 animate-spin" />
            <span className="text-[12px] font-medium">Loading audit logs…</span>
          </div>
        ) : paginatedLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <ShieldCheck className="h-12 w-12 mb-3 opacity-30" />
            <p className="text-[13px] font-semibold text-gray-500">
              {hasActiveFilters ? "No entries match your filters" : "No audit log entries yet"}
            </p>
            <p className="text-[11px] text-gray-400 mt-1">
              {hasActiveFilters
                ? "Try clearing some filters to see more results"
                : "All system actions will be recorded here automatically"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="bg-[#f5f6fa] border-b border-gray-200">
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-36">
                    Timestamp
                  </th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-28">
                    User
                  </th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-28">
                    Action
                  </th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-28">
                    Entity Type
                  </th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-32">
                    Entity Name
                  </th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                    Change Description
                  </th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-20">
                    Severity
                  </th>
                  <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-14">
                    View
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginatedLogs.map((log) => {
                  const actionColor = getActionColor(log.action);
                  return (
                    <tr
                      key={log.id}
                      className="hover:bg-[#f5f6fa] transition-colors cursor-pointer"
                      onClick={() => setSelectedLog(log)}
                    >
                      <td className="px-3 py-2.5 text-[11px] text-gray-700 font-mono whitespace-nowrap">
                        {formatTimestamp(log.timestamp)}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <div className="h-5 w-5 rounded-full bg-[#1557b0]/10 flex items-center justify-center text-[9px] font-bold text-[#1557b0] shrink-0">
                            {(log.userName || "?").charAt(0).toUpperCase()}
                          </div>
                          <span
                            className="text-[12px] text-gray-700 truncate max-w-[80px]"
                            title={log.userName}
                          >
                            {log.userName || "—"}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={`inline-block px-2 py-0.5 text-[10px] font-semibold uppercase rounded border ${actionColor.bg} ${actionColor.text} ${actionColor.border}`}
                        >
                          {log.action}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="inline-block px-2 py-0.5 text-[10px] font-semibold uppercase rounded bg-gray-100 text-gray-700">
                          {log.entityType}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-[12px] text-gray-700 max-w-[120px]">
                        <span className="truncate block" title={log.entityName}>
                          {log.entityName || "—"}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-[12px] text-gray-700 max-w-[240px]">
                        <span className="block truncate" title={log.changeDescription}>
                          {(log.changeDescription ?? "").length > 120
                            ? (log.changeDescription ?? "").slice(0, 120) + "…"
                            : log.changeDescription || "—"}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={`inline-block px-2 py-0.5 text-[10px] font-semibold uppercase rounded ${SEVERITY_BADGE[log.severity] ?? "bg-gray-100 text-gray-700"}`}
                        >
                          {log.severity}
                        </span>
                      </td>
                      <td
                        className="px-3 py-2.5 text-center"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedLog(log);
                        }}
                      >
                        <button
                          type="button"
                          className="h-6 w-6 rounded flex items-center justify-center text-gray-400 hover:text-[#1557b0] hover:bg-[#1557b0]/10 transition-colors mx-auto"
                          title="View details"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && filteredLogs.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-[#f5f6fa]">
            <p className="text-[11px] text-gray-500">
              Page <span className="font-semibold text-gray-700">{page}</span> of{" "}
              <span className="font-semibold text-gray-700">{totalPages}</span>
            </p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPage(1)}
                disabled={page === 1}
                className="h-7 w-7 flex items-center justify-center rounded border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="First page"
              >
                <span className="text-[11px] font-bold">«</span>
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="h-7 w-7 flex items-center justify-center rounded border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="Previous page"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>

              {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 7) pageNum = i + 1;
                else if (page <= 4) pageNum = i + 1;
                else if (page >= totalPages - 3) pageNum = totalPages - 6 + i;
                else pageNum = page - 3 + i;
                return (
                  <button
                    key={pageNum}
                    type="button"
                    onClick={() => setPage(pageNum)}
                    className={`h-7 min-w-[28px] px-1.5 rounded border text-[11px] font-medium transition-colors ${
                      pageNum === page
                        ? "bg-[#1557b0] border-[#1557b0] text-white"
                        : "bg-white border-gray-300 text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="h-7 w-7 flex items-center justify-center rounded border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="Next page"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setPage(totalPages)}
                disabled={page === totalPages}
                className="h-7 w-7 flex items-center justify-center rounded border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="Last page"
              >
                <span className="text-[11px] font-bold">»</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedLog && <DetailModal log={selectedLog} onClose={() => setSelectedLog(null)} />}
    </div>
  );
};

export default AuditLogs;
