// @ts-nocheck
import React, { useState, useEffect, useMemo } from "react";
import { useStore } from "../store/useStore";
import {
  Card,
  Badge,
  Button,
  Input,
  Select,
  Modal,
  Pagination,
  SearchableTable,
} from "../components/ui";
import {
  Shield,
  Download,
  Search,
  Filter,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  Eye,
  X,
  Calendar,
  User,
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Database,
  Settings,
  Archive,
  HardDrive,
  FileClock,
  CalendarDays,
  Lock,
  Unlock,
  Printer,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { logAuditEvent } from "../lib/auditLog";
import { exportToExcel } from "../lib/exportUtils";
import { AuditLogRecord } from "../lib/types";
import { useScreenF12 } from "../hooks/useF12Config";
import { getDB } from "../lib/db";
import { generateId } from "../lib/utils";
import { formatBSDate as formatBsDate } from "../lib/nepaliDate";
import { getNepaliMonths } from "../lib/nepaliDate";

const stringifySmall = (obj: any) => {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return String(obj);
  }
};

const formatDiffValue = (val: any) => {
  if (val === null || val === undefined) return "—";
  if (typeof val === "object") return JSON.stringify(val);
  return String(val);
};

const computeDiff = (beforeObj: any, afterObj: any) => {
  const diffEntries: any[] = [];
  if (!beforeObj) beforeObj = {};
  if (!afterObj) afterObj = {};

  const allKeys = new Set([...Object.keys(beforeObj), ...Object.keys(afterObj)]);

  for (const key of Array.from(allKeys)) {
    const beforeValue = beforeObj[key];
    const afterValue = afterObj[key];

    const hasBefore = key in beforeObj;
    const hasAfter = key in afterObj;

    if (!hasBefore && hasAfter) {
      diffEntries.push({
        field: key,
        oldValue: undefined,
        newValue: afterValue,
        changeType: "added",
      });
    } else if (hasBefore && !hasAfter) {
      diffEntries.push({
        field: key,
        oldValue: beforeValue,
        newValue: undefined,
        changeType: "removed",
      });
    } else if (hasBefore && hasAfter) {
      if (JSON.stringify(beforeValue) !== JSON.stringify(afterValue)) {
        diffEntries.push({
          field: key,
          oldValue: beforeValue,
          newValue: afterValue,
          changeType: "changed",
        });
      }
    }
  }
  return diffEntries;
};

const AuditLog = () => {
  // Register this screen with F12 system
  const getConfig = useScreenF12("audit-log");
  const config = getConfig();

  const { auditLogs, users, companySettings } = useStore();
  const [loading, setLoading] = useState(true);
  const [auditPage, setAuditPage] = useState(1);
  const [auditPageSize, setAuditPageSize] = useState(50);
  const [bsFiscalYear, setBsFiscalYear] = useState<string>("2081/82");
  const fiscalYears = ["2079/80", "2080/81", "2081/82", "2082/83"];

  const inferRisk = (row: any) => {
    const a = String(row.action || "").toLowerCase();
    const module = String(row.module || "").toLowerCase();
    const entityType = String(row.description || "").toLowerCase();

    // CRITICAL — most dangerous operations
    if (
      (a.includes("delete") && (module.includes("tax") || module.includes("payroll"))) ||
      (a.includes("delete") && entityType.includes("fiscalyear")) ||
      (a.includes("unlock") && module.includes("period lock")) ||
      (a.includes("purge") && module.includes("audit")) ||
      a.includes("audit logs purged")
    )
      return "Critical";

    // HIGH — dangerous but recoverable
    if (
      a.includes("delete") ||
      a.includes("void") ||
      a.includes("unlock") ||
      a.includes("restore") ||
      a.includes("security") ||
      a.includes("cancelled")
    )
      return "High";

    // MEDIUM — needs attention
    if (
      a.includes("failed") ||
      a.includes("denied") ||
      a.includes("blocked") ||
      module.includes("tax") ||
      module.includes("period lock") ||
      (a.includes("export") && module.includes("payroll"))
    )
      return "Medium";

    // LOW — informational
    if (a.includes("login") || a.includes("logout") || a.includes("export") || a.includes("print"))
      return "Low";

    return row.risk || "Low";
  };

  const processedLogs = useMemo(() => {
    return (auditLogs || []).map((log) => ({
      ...log,
      risk: inferRisk(log),
    }));
  }, [auditLogs]);

  const [filters, setFilters] = useState({
    fromDate: "",
    toDate: "",
    search: "",
    module: "All",
    action: "All",
    user: "All",
    risk: "All",
    status: "All",
    source: "All",
  });

  const [activeTab, setActiveTab] = useState("Activity Log");
  const [selectedLog, setSelectedLog] = useState<AuditLogRecord | null>(null);

  const [purgeModal, setPurgeModal] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  // Pre-calculate sources list from auditLogs
  const sources = useMemo(() => {
    const uniqueSources = new Set(auditLogs.map((log) => log.source));
    return ["All", ...Array.from(uniqueSources).sort()];
  }, [auditLogs]);

  // Stats calculation
  const stats = useMemo(() => {
    const result = processedLogs.reduce(
      (acc, log) => {
        acc.total++;
        if (log.risk === "High") acc.highRisk++;
        if (log.status === "Failed") acc.failed++;
        if (log.timestamp > new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) acc.today++;

        // Count modules
        acc.moduleCounts[log.module] = (acc.moduleCounts[log.module] || 0) + 1;

        // Count risks
        acc.riskCounts[log.risk] = (acc.riskCounts[log.risk] || 0) + 1;

        // Count actions
        acc.actionCounts[log.action] = (acc.actionCounts[log.action] || 0) + 1;

        return acc;
      },
      {
        total: 0,
        highRisk: 0,
        failed: 0,
        today: 0,
        moduleCounts: {} as Record<string, number>,
        riskCounts: {} as Record<string, number>,
        actionCounts: {} as Record<string, number>,
      },
    );
    return result;
  }, [processedLogs]);

  // Update filters
  const updateFilter = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setAuditPage(1);
  };

  const clearFilters = () => {
    setFilters({
      fromDate: "",
      toDate: "",
      search: "",
      module: "All",
      action: "All",
      user: "All",
      risk: "All",
      status: "All",
      source: "All",
    });
    setAuditPage(1);
  };

  // Filtered rows
  const filteredRows = useMemo(() => {
    return processedLogs.filter((r) => {
      if (filters.fromDate && r.timestamp < filters.fromDate) return false;
      if (filters.toDate && r.timestamp > filters.toDate) return false;
      if (
        filters.search &&
        !r.description.toLowerCase().includes(filters.search.toLowerCase()) &&
        !r.user.toLowerCase().includes(filters.search.toLowerCase())
      )
        return false;
      if (filters.module !== "All" && r.module !== filters.module) return false;
      if (filters.action !== "All" && r.action !== filters.action) return false;
      if (filters.user !== "All" && r.user !== filters.user) return false;
      if (filters.risk !== "All" && r.risk !== filters.risk) return false;
      if (filters.status !== "All" && r.status !== filters.status) return false;
      if (filters.source !== "All" && r.source !== filters.source) return false;
      return true;
    });
  }, [auditLogs, filters]);

  // Load audit data
  const loadAuditData = async () => {
    setLoading(true);
    try {
      // Simulate loading delay for UX
      await new Promise((resolve) => setTimeout(resolve, 300));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAuditData();
  }, []);

  // Render filters
  const renderFilters = () => {
    const card = "bg-white border border-gray-200 rounded-md p-4";
    const input =
      "w-full h-8 px-2.5 text-[11px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-[#1557b0] focus:border-[#1557b0]";
    const btn =
      "h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[11px] font-medium rounded-md flex items-center gap-1.5";
    const btn2 =
      "h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[11px] font-medium rounded-md hover:bg-gray-50 flex items-center gap-1.5";
    return (
      <div className={card}>
        <div className="flex items-center gap-2 mb-4">
          <Filter className="h-4 w-4 text-gray-500" />
          <h3 className="text-[13px] font-semibold text-gray-700 uppercase tracking-wide">
            Audit Filters
          </h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9 gap-3">
          <div>
            <label className="text-[11px] font-medium text-gray-600 block mb-1">From</label>
            <Input
              type="date"
              value={filters.fromDate}
              onChange={(e) => updateFilter("fromDate", e.target.value)}
              className={input}
            />
          </div>
          <div>
            <label className="text-[11px] font-medium text-gray-600 block mb-1">To</label>
            <Input
              type="date"
              value={filters.toDate}
              onChange={(e) => updateFilter("toDate", e.target.value)}
              className={input}
            />
          </div>
          <div>
            <label className="text-[11px] font-medium text-gray-600 block mb-1">Search</label>
            <Input
              placeholder="User, Description..."
              value={filters.search}
              onChange={(e) => updateFilter("search", e.target.value)}
              className={input}
            />
          </div>
          <div>
            <label className="text-[11px] font-medium text-gray-600 block mb-1">Module</label>
            <Select
              value={filters.module}
              onChange={(e) => updateFilter("module", e.target.value)}
              className={input}
            >
              {[
                "All",
                "Voucher",
                "Invoice",
                "Ledger",
                "Item",
                "Party",
                "Employee",
                "Payroll",
                "Asset",
                "User",
                "Settings",
                "Period Lock",
              ].map((m) => (
                <option key={m}>{m}</option>
              ))}
            </Select>
          </div>
          <div>
            <label className="text-[11px] font-medium text-gray-600 block mb-1">Action</label>
            <Select
              value={filters.action}
              onChange={(e) => updateFilter("action", e.target.value)}
              className={input}
            >
              {[
                "All",
                "Create",
                "Update",
                "Delete",
                "Approve",
                "Login",
                "Logout",
                "Import",
                "Export",
              ].map((a) => (
                <option key={a}>{a}</option>
              ))}
            </Select>
          </div>
          <div>
            <label className="text-[11px] font-medium text-gray-600 block mb-1">User</label>
            <Select
              value={filters.user}
              onChange={(e) => updateFilter("user", e.target.value)}
              className={input}
            >
              {["All", ...users.map((u) => u.name)].sort().map((u) => (
                <option key={u}>{u}</option>
              ))}
            </Select>
          </div>
          <div>
            <label className="text-[11px] font-medium text-gray-600 block mb-1">Risk</label>
            <Select
              value={filters.risk}
              onChange={(e) => updateFilter("risk", e.target.value)}
              className={input}
            >
              {["All", "Low", "Medium", "High", "Critical"].map((r) => (
                <option key={r}>{r}</option>
              ))}
            </Select>
          </div>
          <div>
            <label className="text-[11px] font-medium text-gray-600 block mb-1">Status</label>
            <select
              className={input}
              value={filters.status}
              onChange={(e) => updateFilter("status", e.target.value)}
            >
              {["All", "Success", "Failed", "Cancelled"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[11px] font-medium text-gray-600 block mb-1">Source</label>
            <select
              className={input}
              value={filters.source}
              onChange={(e) => updateFilter("source", e.target.value)}
            >
              {sources.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex items-center gap-3 mt-2 pt-2 border-t border-gray-100">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium text-gray-600">BS Fiscal Year:</span>
            <select
              className={input + " w-28"}
              value={bsFiscalYear}
              onChange={(e) => setBsFiscalYear(e.target.value)}
            >
              {fiscalYears.map((fy) => (
                <option key={fy}>{fy}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex gap-2 mt-3">
          <button className={btn2} onClick={clearFilters}>
            Clear Filters
          </button>
        </div>
      </div>
    );
  };

  // Render stats
  const renderStats = () => {
    const statCard = "bg-white border border-gray-200 rounded-md p-4 flex flex-col gap-1";
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className={statCard}>
          <div className="text-gray-500 text-[10px] font-medium uppercase">Total Entries</div>
          <div className="text-[24px] font-bold text-gray-800">{stats.total}</div>
        </div>
        <div className={statCard}>
          <div className="text-gray-500 text-[10px] font-medium uppercase">Today</div>
          <div className="text-[24px] font-bold text-gray-800">{stats.today}</div>
        </div>
        <div className={statCard}>
          <div className="text-gray-500 text-[10px] font-medium uppercase">High Risk</div>
          <div className="text-[24px] font-bold text-red-600">{stats.highRisk}</div>
        </div>
        <div className={statCard}>
          <div className="text-gray-500 text-[10px] font-medium uppercase">Failed</div>
          <div className="text-[24px] font-bold text-orange-600">{stats.failed}</div>
        </div>
      </div>
    );
  };

  // Render audit table
  const renderAuditTable = (rows: AuditLogRecord[]) => {
    const card = "bg-white border border-gray-200 rounded-md overflow-hidden";
    const th =
      "px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide";
    const td = "px-3 py-2.5 text-[12px] text-gray-700 align-top";

    return (
      <div className={card}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-max border-collapse">
            <thead>
              <tr className="bg-[#f5f6fa] border-b border-gray-200">
                {[
                  "#",
                  "Timestamp",
                  "User",
                  "Module",
                  "Action",
                  "Description",
                  "Risk",
                  "Status",
                  "Source",
                  "",
                ].map((h) => (
                  <th key={h} className={th}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r, i) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className={`${td} text-center align-middle`}>
                    {(auditPage - 1) * auditPageSize + i + 1}
                  </td>
                  <td className={td}>
                    <div className="font-medium text-gray-800 text-[11px]">
                      {(() => {
                        try {
                          return formatBsDate(r.timestamp);
                        } catch {
                          return String(r.timestamp).slice(0, 10);
                        }
                      })()}
                    </div>
                    <div className="text-[10px] text-gray-400">
                      {String(r.timestamp).slice(11, 19)}
                    </div>
                  </td>
                  <td className={td}>{r.user}</td>
                  <td className={td}>{r.module}</td>
                  <td className={td}>{r.action}</td>
                  <td className={td}>{r.description}</td>
                  <td className={td}>
                    <Badge
                      variant={
                        r.risk === "High"
                          ? "destructive"
                          : r.risk === "Medium"
                            ? "warning"
                            : r.risk === "Critical"
                              ? "outline"
                              : "secondary"
                      }
                    >
                      {r.risk}
                    </Badge>
                  </td>
                  <td className={td}>
                    <Badge
                      variant={
                        r.status === "Failed"
                          ? "destructive"
                          : r.status === "Cancelled"
                            ? "outline"
                            : "default"
                      }
                    >
                      {r.status}
                    </Badge>
                  </td>
                  <td className={td}>{r.source}</td>
                  <td className={`${td} text-center align-middle`}>
                    <button
                      className="text-gray-400 hover:text-[#1557b0] transition-colors p-1"
                      onClick={() => setSelectedLog(r)}
                      title="View details"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={9} className="p-6 text-center text-[12px] text-gray-500">
                    No audit rows found for selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // Export function
  const exportExcel = () => {
    const data = filteredRows.map((r) => ({
      Timestamp: format(parseISO(r.timestamp), "dd/MM/yyyy HH:mm:ss"),
      User: r.user,
      Module: r.module,
      Action: r.action,
      Description: r.description,
      Risk: r.risk,
      Status: r.status,
      Source: r.source,
    }));
    exportToExcel(data, "Audit_Logs.xlsx");
    logAuditEvent("EXPORT", "AUDIT_LOGS", "Audit logs exported to Excel", "INFO", "SYSTEM");
  };

  // Purge old logs
  const purgeOldLogs = async () => {
    if (confirmText !== "PURGE LOGS") {
      alert("Please type 'PURGE LOGS' to confirm.");
      return;
    }
    try {
      const db = getDB();
      const removable = auditLogs.filter((r) => r.timestamp < filters.fromDate); // Using filters.fromDate as purgeBefore equivalent for simplicity
      const ids = removable.map((r) => r.id);

      // Step 1: Insert purge marker in DB first (so the marker is preserved)
      const marker = {
        id: generateId(),
        timestamp: new Date().toISOString(),
        userId: users[0]?.id || "",
        userName: users[0]?.name || users[0]?.username || "System",
        module: "Audit Log",
        action: "Old Audit Logs Purged",
        narration: `${ids.length} audit rows before ${filters.fromDate} purged by ${users[0]?.name || "System"}`,
        status: "Success",
        risk: "Critical",
        createdAt: new Date().toISOString(),
      };

      if (db?.auditLogs?.put) await db.auditLogs.put(marker);

      // Step 2: Delete from IndexedDB
      if (db?.auditLogs?.bulkDelete && ids.length) {
        await db.auditLogs.bulkDelete(ids);
      }

      // Step 3: Delete from PostgreSQL backend
      try {
        await fetch(`/api/audit-logs/purge`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ beforeDate: filters.fromDate }),
        });
      } catch (apiErr) {
        console.warn("Backend purge failed (offline mode?):", apiErr);
        // Non-fatal: IndexedDB purge already succeeded
      }

      const normalizedMarker = {
        id: marker.id,
        timestamp: marker.timestamp,
        user: marker.userName,
        module: marker.module,
        action: marker.action,
        description: marker.narration,
        status: marker.status,
        risk: marker.risk,
        source: "auditLogs",
        additionalInfo: {},
      };

      useStore.setState((state) => ({
        auditLogs: [
          normalizedMarker,
          ...state.auditLogs.filter(
            (r: any) => !(r.source === "auditLogs" && r.timestamp < filters.fromDate),
          ),
        ],
      }));

      setPurgeModal(false);
      setConfirmText("");
      alert(`Purged ${ids.length} old audit rows`);
    } catch (err) {
      console.error(err);
      alert("Could not purge logs");
    }
  };

  // Analytics Charts
  const renderAnalyticsCharts = () => {
    if (!stats.total) return null;

    const renderBarChart = (title: string, data: Record<string, number>, colorClass: string) => {
      const entries = Object.entries(data)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
      const max = Math.max(...entries.map((e) => e[1]), 1);
      return (
        <div className="bg-white border border-gray-200 rounded-md p-4 flex-1 min-w-[250px]">
          <h4 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-3">
            {title}
          </h4>
          <div className="space-y-2">
            {entries.map(([label, count]) => (
              <div key={label}>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-gray-700 truncate mr-2" title={label}>
                    {label || "Unknown"}
                  </span>
                  <span className="text-gray-900 font-medium">{count}</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full ${colorClass}`}
                    style={{ width: `${(count / max) * 100}%` }}
                  ></div>
                </div>
              </div>
            ))}
            {entries.length === 0 && <div className="text-[11px] text-gray-400 py-2">No data</div>}
          </div>
        </div>
      );
    };

    return (
      <div className="flex flex-col md:flex-row gap-4 mb-4">
        {renderBarChart("Activity by Module", stats.moduleCounts, "bg-blue-400")}
        {renderBarChart("Events by Risk Level", stats.riskCounts, "bg-amber-400")}
        {renderBarChart("Top Actions", stats.actionCounts, "bg-emerald-400")}
      </div>
    );
  };

  // Tabs
  const renderPagination = (totalRecords: number) => {
    if (totalRecords === 0) return null;
    return (
      <div className="mt-2 mb-2">
        <Pagination
          page={auditPage}
          totalPages={Math.ceil(totalRecords / auditPageSize)}
          totalRecords={totalRecords}
          pageSize={auditPageSize}
          onPageChange={setAuditPage}
          onPageSizeChange={(s) => {
            setAuditPageSize(s);
            setAuditPage(1);
          }}
        />
      </div>
    );
  };

  const tabs = [
    { id: "Activity Log", label: "Activity Log" },
    { id: "Data Changes", label: "Data Changes" },
    { id: "Security Events", label: "Security Events" },
    { id: "Period Locks", label: "Period Locks" },
    { id: "Print & Export", label: "Print & Export" },
    { id: "Compliance Export", label: "Compliance Export" },
  ];

  const renderSecurityEvents = () => {
    const map: Record<string, any> = {};
    processedLogs.forEach((r) => {
      const name = r.user || "System";
      if (!map[name]) {
        map[name] = {
          name,
          loginCount: 0,
          createCount: 0,
          editCount: 0,
          deleteCount: 0,
          exportCount: 0,
          highRiskCount: 0,
          lastSeen: "",
          totalEvents: 0,
        };
      }
      const a = String(r.action).toLowerCase();
      map[name].totalEvents++;
      if (a.includes("login")) map[name].loginCount++;
      else if (a.includes("create") || a.includes("add") || a.includes("post"))
        map[name].createCount++;
      else if (a.includes("update") || a.includes("edit") || a.includes("modify"))
        map[name].editCount++;
      else if (a.includes("delete") || a.includes("void") || a.includes("cancel"))
        map[name].deleteCount++;
      else if (a.includes("export") || a.includes("print")) map[name].exportCount++;
      if (["High", "Critical"].includes(r.risk)) map[name].highRiskCount++;
      if (!map[name].lastSeen || r.timestamp > map[name].lastSeen) map[name].lastSeen = r.timestamp;
    });
    const userActivity = Object.values(map).sort((a: any, b: any) => b.totalEvents - a.totalEvents);

    const card = "bg-white border border-gray-200 rounded-md p-4";
    const th =
      "px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide bg-[#f5f6fa] border-b border-gray-200";
    const td = "px-3 py-2.5 text-[12px] text-gray-700 border-b border-gray-100";

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-[13px] font-semibold text-gray-800 flex items-center gap-2">
            <User className="h-4 w-4 text-gray-500" /> Security Events & User Activity
          </h3>
          <button
            className="h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[11px] font-medium rounded-md flex items-center gap-1.5"
            onClick={() => exportToExcel(userActivity, "User_Activity_Summary.xlsx")}
          >
            <Download className="h-3 w-3" /> Export Summary
          </button>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-[#f5f6fa]">
                <tr>
                  <th className={th}>User</th>
                  <th className={th}>Total Events</th>
                  <th className={th}>Logins</th>
                  <th className={th}>Creates</th>
                  <th className={th}>Edits</th>
                  <th className={th}>Deletes</th>
                  <th className={th}>Exports</th>
                  <th className={th}>High Risk</th>
                  <th className={th}>Last Seen</th>
                  <th className={th}>Flag</th>
                </tr>
              </thead>
              <tbody>
                {userActivity.map((u: any) => {
                  const isSuspicious = u.deleteCount > 0 && u.deleteCount >= u.createCount;
                  return (
                    <tr
                      key={u.name}
                      className={`hover:bg-gray-50/50 ${isSuspicious ? "bg-amber-50/30" : ""}`}
                    >
                      <td className={td}>
                        <span className="font-semibold text-gray-800">{u.name}</span>
                      </td>
                      <td className={td}>
                        <span className="font-bold text-blue-600">{u.totalEvents}</span>
                      </td>
                      <td className={td}>{u.loginCount}</td>
                      <td className={td}>
                        <span className="text-emerald-700">{u.createCount}</span>
                      </td>
                      <td className={td}>
                        <span className="text-amber-700">{u.editCount}</span>
                      </td>
                      <td className={td}>
                        <span className={u.deleteCount > 0 ? "text-red-700 font-semibold" : ""}>
                          {u.deleteCount}
                        </span>
                      </td>
                      <td className={td}>{u.exportCount}</td>
                      <td className={td}>
                        {u.highRiskCount > 0 ? (
                          <span className="inline-flex px-1.5 py-0.5 rounded bg-red-50 border border-red-200 text-red-700 text-[10px] font-bold">
                            {u.highRiskCount}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className={td}>
                        {u.lastSeen ? (
                          <span className="text-[11px]">
                            {(() => {
                              try {
                                return formatBsDate(u.lastSeen);
                              } catch {
                                return String(u.lastSeen).slice(0, 10);
                              }
                            })()}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className={td}>
                        {isSuspicious ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-semibold">
                            <AlertTriangle className="h-3 w-3" /> Review
                          </span>
                        ) : (
                          <span className="text-gray-300 text-[10px]">OK</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {userActivity.length === 0 && (
                  <tr>
                    <td colSpan={10} className="p-6 text-center text-[12px] text-gray-500">
                      No user activity data in selected filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {userActivity.some((u: any) => u.deleteCount >= u.createCount && u.deleteCount > 0) && (
          <div className="p-3 rounded bg-amber-50 border border-amber-200 text-[12px] text-amber-800">
            <p className="font-semibold">Suspicious Activity Detected</p>
            <p className="text-[11px] mt-0.5">
              One or more users have more delete/void events than create events in this period. This
              may indicate unauthorized data removal. Review their activity immediately.
            </p>
          </div>
        )}
      </div>
    );
  };

  const renderPeriodLocks = () => {
    const periodLockRows = processedLogs.filter(
      (r) => String(r.module).toLowerCase() === "period lock",
    );
    const periodMap: Record<
      string,
      { locked: boolean; lockedBy: string; lockedAt: string; history: any[] }
    > = {};

    [...periodLockRows].reverse().forEach((r) => {
      const key = r.description || r.user || "unknown";
      if (!periodMap[key])
        periodMap[key] = { locked: false, lockedBy: "", lockedAt: "", history: [] };
      periodMap[key].history.push(r);
      if (String(r.action).toLowerCase().includes("unlock")) {
        periodMap[key].locked = false;
        periodMap[key].lockedBy = r.user;
        periodMap[key].lockedAt = r.timestamp;
      } else if (String(r.action).toLowerCase().includes("lock")) {
        periodMap[key].locked = true;
        periodMap[key].lockedBy = r.user;
        periodMap[key].lockedAt = r.timestamp;
      }
    });

    const bsMonthLabels = getNepaliMonths();
    const card = "bg-white border border-gray-200 rounded-md p-4";

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-[13px] font-semibold text-gray-800 flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-gray-500" /> Period Lock Register
          </h3>
          <span className="text-[11px] text-gray-500">
            {Object.keys(periodMap).length} periods tracked
          </span>
        </div>

        {Object.keys(periodMap).length === 0 ? (
          <div className={`${card} text-[12px] text-gray-500 text-center py-8`}>
            No period lock events recorded yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {Object.entries(periodMap).map(([key, info]) => (
              <div
                key={key}
                className={`${card} border-l-4 ${info.locked ? "border-l-purple-500" : "border-l-emerald-400"}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[12px] font-semibold text-gray-800">{key}</span>
                  <span
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-medium ${info.locked ? "bg-purple-50 text-purple-700 border-purple-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"}`}
                  >
                    {info.locked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                    {info.locked ? "Locked" : "Open"}
                  </span>
                </div>
                <p className="text-[10px] text-gray-500">
                  Last action by {info.lockedBy || "System"} on{" "}
                  {String(info.lockedAt).slice(0, 10) || "—"}
                </p>
                {info.history.length > 1 && (
                  <div className="mt-2 border-t border-gray-100 pt-2 space-y-1 max-h-32 overflow-y-auto">
                    {info.history.slice(0, 5).map((h, i) => (
                      <div key={i} className="text-[10px] text-gray-500 flex items-center gap-1">
                        {String(h.action).toLowerCase().includes("unlock") ? (
                          <Unlock className="h-2.5 w-2.5 text-emerald-500 shrink-0" />
                        ) : (
                          <Lock className="h-2.5 w-2.5 text-purple-500 shrink-0" />
                        )}
                        {h.action} by {h.user} — {String(h.timestamp).slice(0, 10)}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className={card}>
          <p className="text-[11px] font-semibold text-gray-600 mb-2 uppercase tracking-wide">
            Nepal Fiscal Year BS Months
          </p>
          <div className="grid grid-cols-4 md:grid-cols-6 xl:grid-cols-12 gap-2">
            {bsMonthLabels.map((month, i) => {
              const fiscalOrder = i >= 3 ? i - 3 : i + 9;
              const hasLock = Object.values(periodMap).some(
                (p) =>
                  p.locked &&
                  (p.lockedBy ||
                    p.history.some((h) =>
                      String(h.description || h.user || "")
                        .toLowerCase()
                        .includes(month.toLowerCase()),
                    )),
              );
              return (
                <div
                  key={month}
                  className={`rounded p-2 text-center border text-[10px] font-medium ${hasLock ? "bg-purple-50 border-purple-200 text-purple-700" : "bg-gray-50 border-gray-200 text-gray-600"}`}
                >
                  <div>{month.slice(0, 3)}</div>
                  <div className="text-[9px] opacity-60">M{i + 1}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const renderComplianceExport = () => {
    const tdsRows = processedLogs.filter(
      (r) =>
        String(r.description).toLowerCase().includes("tds") ||
        String(r.action).toLowerCase().includes("tds"),
    );

    const vatRows = processedLogs.filter(
      (r) =>
        String(r.description).toLowerCase().includes("vat") ||
        String(r.action).toLowerCase().includes("vat") ||
        String(r.module).toLowerCase().includes("billing") ||
        String(r.module).toLowerCase().includes("invoice"),
    );

    const vatByMonth: Record<string, number> = {};
    vatRows.forEach((r) => {
      const month = String(r.timestamp).slice(0, 7);
      vatByMonth[month] = (vatByMonth[month] || 0) + 1;
    });

    const exportCompliancePack = () => {
      exportToExcel(processedLogs, "Full_Compliance_Pack.xlsx");
    };

    const actionClass = (action: string) => "bg-gray-100 text-gray-700 border-gray-200";
    const riskClass = (risk: string) => {
      if (risk === "Critical") return "bg-red-100 text-red-800 border-red-300";
      if (risk === "High") return "bg-orange-100 text-orange-800 border-orange-300";
      if (risk === "Medium") return "bg-yellow-100 text-yellow-800 border-yellow-300";
      return "bg-green-100 text-green-800 border-green-300";
    };

    const card = "bg-white border border-gray-200 rounded-md p-4";
    const btn =
      "h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[11px] font-medium rounded-md flex items-center gap-1.5";
    const btn2 =
      "h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[11px] font-medium rounded-md hover:bg-gray-50 flex items-center gap-1.5";
    const th =
      "px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide bg-[#f5f6fa] border-b border-gray-200";
    const td = "px-3 py-2.5 text-[12px] text-gray-700 border-b border-gray-100";

    return (
      <div className="space-y-4">
        {/* TDS Register */}
        <div className={card}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[13px] font-semibold text-gray-800">TDS Transaction Register</h3>
            <span className="text-[11px] text-gray-500">
              {tdsRows.length} TDS events in selected period
            </span>
          </div>
          {tdsRows.length === 0 ? (
            <p className="text-[12px] text-gray-500">
              No TDS events found. Ensure TDS-related vouchers include "TDS" in their narration.
            </p>
          ) : (
            <div className="overflow-x-auto max-h-64">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr>
                    <th className={th}>Date</th>
                    <th className={th}>User</th>
                    <th className={th}>Action</th>
                    <th className={th}>Narration</th>
                    <th className={th}>Status</th>
                    <th className={th}>Risk</th>
                  </tr>
                </thead>
                <tbody>
                  {tdsRows.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className={td}>{String(r.timestamp).slice(0, 10)}</td>
                      <td className={td}>{r.user}</td>
                      <td className={td}>
                        <span
                          className={`inline-flex px-1.5 py-0.5 rounded border text-[10px] font-medium ${actionClass(r.action)}`}
                        >
                          {r.action}
                        </span>
                      </td>
                      <td className={`${td} max-w-[240px] truncate`}>{r.description}</td>
                      <td className={td}>
                        <span
                          className={`inline-flex px-1.5 py-0.5 rounded border text-[10px] font-medium ${String(r.status).toLowerCase().includes("fail") ? "bg-red-50 text-red-700 border-red-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"}`}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td className={td}>
                        <span
                          className={`inline-flex px-1.5 py-0.5 rounded border text-[10px] font-medium ${riskClass(r.risk)}`}
                        >
                          {r.risk}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="mt-3 p-2 rounded bg-amber-50 border border-amber-200 text-[11px] text-amber-800">
            Nepal TDS Rule: TDS must be deposited with IRD by the 25th of the following month per
            Income Tax Act Section 90. Ensure all TDS payment vouchers have narrations including
            "TDS" and the section of IT Act applied.
          </div>
        </div>

        {/* VAT Monthly Summary */}
        <div className={card}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[13px] font-semibold text-gray-800">VAT Activity by Month</h3>
            <button
              className={btn2}
              onClick={() => exportToExcel(vatRows, "VAT_Audit_Register.xlsx")}
            >
              <Download className="h-3 w-3" /> Export VAT Register
            </button>
          </div>
          {Object.keys(vatByMonth).length === 0 ? (
            <p className="text-[12px] text-gray-500">
              No VAT/billing events found in selected period.
            </p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {Object.entries(vatByMonth)
                .sort()
                .map(([month, count]) => (
                  <div
                    key={month}
                    className="bg-gray-50 rounded border border-gray-200 p-2 text-center"
                  >
                    <p className="text-[11px] font-semibold text-gray-700">{month}</p>
                    <p className="text-xl font-bold text-blue-600">{count}</p>
                    <p className="text-[10px] text-gray-500">billing events</p>
                  </div>
                ))}
            </div>
          )}
          <div className="mt-3 p-2 rounded bg-amber-50 border border-amber-200 text-[11px] text-amber-800">
            Nepal VAT Rule: VAT return (VAT-13) must be filed by the 25th of the following month per
            VAT Act Nepal. Cross-check billing event count with your VAT-13 submission totals.
          </div>
        </div>

        {/* Export button */}
        <div className="flex gap-2">
          <button className={btn} onClick={() => exportToExcel(tdsRows, "TDS_Register.xlsx")}>
            <Download className="h-3 w-3" /> Export TDS Register
          </button>
          <button className={btn2} onClick={exportCompliancePack}>
            <Shield className="h-3 w-3 text-[#1557b0]" /> Full Compliance Pack
          </button>
        </div>
      </div>
    );
  };

  const renderPrintRegister = () => {
    const printRows = processedLogs.filter(
      (r) =>
        String(r.action).toLowerCase().includes("print") ||
        String(r.action).toLowerCase().includes("export"),
    );

    // Group by entityId to find documents printed more than once
    const docPrintCount: Record<string, number> = {};
    printRows.forEach((r) => {
      const key = `${r.module || "doc"}-${r.description?.slice(0, 20) || "unknown"}`;
      docPrintCount[key] = (docPrintCount[key] || 0) + 1;
    });

    const reprintWarnings = Object.entries(docPrintCount)
      .filter(([, count]) => count > 1)
      .map(([key]) => key);

    const actionClass = (action: string) => "bg-gray-100 text-gray-700 border-gray-200";
    const btn2 =
      "h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[11px] font-medium rounded-md hover:bg-gray-50 flex items-center gap-1.5";
    const th =
      "px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide bg-[#f5f6fa] border-b border-gray-200";
    const td = "px-3 py-2.5 text-[12px] text-gray-700 border-b border-gray-100";

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-[13px] font-semibold text-gray-800 flex items-center gap-2">
            <Printer className="h-4 w-4 text-gray-500" /> Print & Export Register
          </h3>
          <div className="flex items-center gap-2">
            {reprintWarnings.length > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-amber-50 border border-amber-200 text-[10px] font-semibold text-amber-700">
                <AlertTriangle className="h-3 w-3" /> {reprintWarnings.length} docs printed multiple
                times
              </span>
            )}
            <button
              className={btn2}
              onClick={() => exportToExcel(printRows, "Print_Register.xlsx")}
            >
              <Download className="h-3 w-3" /> Export Register
            </button>
          </div>
        </div>

        {reprintWarnings.length > 0 && (
          <div className="p-3 rounded bg-amber-50 border border-amber-200 text-[12px] text-amber-800">
            <p className="font-semibold mb-1">⚠ Documents Printed Multiple Times</p>
            <p className="text-[11px]">
              The following documents were printed or exported more than once. Review to ensure no
              post-edit reprinting occurred:
            </p>
            <div className="mt-2 flex flex-wrap gap-1">
              {reprintWarnings.map((key) => (
                <span
                  key={key}
                  className="bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded text-[10px] font-medium"
                >
                  {key} ({docPrintCount[key]}×)
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto max-h-[500px]">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-[#f5f6fa] z-10">
                <tr>
                  <th className={th}>Date/Time</th>
                  <th className={th}>Printed By</th>
                  <th className={th}>Document</th>
                  <th className={th}>Action</th>
                  <th className={th}>Narration</th>
                  <th className={th}>Times Printed</th>
                </tr>
              </thead>
              <tbody>
                {printRows.map((r) => {
                  const key = `${r.module || "doc"}-${r.description?.slice(0, 20) || "unknown"}`;
                  const count = docPrintCount[key] || 1;
                  return (
                    <tr
                      key={r.id}
                      className={`hover:bg-gray-50/50 ${count > 1 ? "bg-amber-50/30" : ""}`}
                    >
                      <td className={td}>
                        <div className="font-medium">{String(r.timestamp).slice(0, 10)}</div>
                        <div className="text-[10px] text-gray-400">
                          {String(r.timestamp).slice(11, 19)}
                        </div>
                      </td>
                      <td className={td}>{r.user}</td>
                      <td className={td}>
                        <div className="font-medium text-[11px]">{r.module || "Document"}</div>
                        <div className="text-[10px] text-gray-400">—</div>
                      </td>
                      <td className={td}>
                        <span
                          className={`inline-flex px-1.5 py-0.5 rounded border text-[10px] font-medium ${actionClass(r.action)}`}
                        >
                          {r.action}
                        </span>
                      </td>
                      <td className={`${td} max-w-[200px] truncate`}>{r.description || "—"}</td>
                      <td className={td}>
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${count > 1 ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-600"}`}
                        >
                          {count}×
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {printRows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-[12px] text-gray-500">
                      No print or export events found for selected filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#f5f6fa] p-4 text-gray-800">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-[15px] font-semibold text-gray-800 flex items-center gap-2">
              <Shield className="h-4 w-4 text-[#1557b0]" /> Audit Log
            </h1>
            <p className="text-[11px] text-gray-500 mt-0.5">
              User activity, data change history, security access trail and compliance export.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[11px] font-medium rounded-md hover:bg-gray-50 flex items-center gap-1.5"
              onClick={loadAuditData}
              disabled={loading}
            >
              <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} /> Refresh
            </button>
            <button
              className="h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[11px] font-medium rounded-md flex items-center gap-1.5"
              onClick={() => exportExcel()}
            >
              <Download className="h-3 w-3" /> Export
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`px-4 py-2 text-[12px] font-medium transition-colors ${
                activeTab === tab.id
                  ? "bg-white text-[#1557b0] border-b-2 border-[#1557b0]"
                  : "text-gray-500 hover:text-gray-800 hover:bg-gray-50"
              }`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loading && (
          <div className="bg-white border border-gray-200 rounded-md p-4 mb-4 flex items-center gap-2 text-[12px] text-gray-600">
            <RefreshCw className="h-4 w-4 animate-spin text-[#1557b0]" /> Loading audit data...
          </div>
        )}

        {activeTab === "Activity Log" && (
          <div className="space-y-4">
            {renderFilters()}
            {renderStats()}
            {renderAnalyticsCharts()}
            {renderPagination(filteredRows.length)}
            {renderAuditTable(pagedRows)}
            {renderPagination(filteredRows.length)}
          </div>
        )}

        {activeTab === "Data Changes" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[14px] font-semibold text-gray-800">Data Changes</h2>
              <button className="h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[11px] font-medium rounded-md">
                Export Changes
              </button>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 text-[12px] text-yellow-800">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <div>
                  <strong>Data Change Tracking is Disabled</strong>
                  <br />
                  Enable this feature in System Settings to track all modifications to vouchers,
                  ledgers, and master data.
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "Security Events" && (
          <div className="space-y-4">{renderSecurityEvents()}</div>
        )}

        {activeTab === "Period Locks" && <div className="space-y-4">{renderPeriodLocks()}</div>}

        {activeTab === "Print & Export" && <div className="space-y-4">{renderPrintRegister()}</div>}

        {activeTab === "Compliance Export" && (
          <div className="space-y-4">{renderComplianceExport()}</div>
        )}
      </div>

      {/* View Log Modal */}
      {selectedLog && (
        <Modal open={!!selectedLog} onClose={() => setSelectedLog(null)}>
          <div className="w-full max-w-2xl">
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <h3 className="text-[15px] font-semibold text-gray-800">Audit Log Details</h3>
                <button
                  onClick={() => setSelectedLog(null)}
                  className="p-1 rounded-md hover:bg-gray-100 text-gray-500"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="p-4 text-[12px] space-y-3 max-h-96 overflow-y-auto">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-gray-500">Timestamp</div>
                    <p className="text-[12px] font-medium text-gray-800">
                      {(() => {
                        try {
                          return formatBsDate(selectedLog.timestamp);
                        } catch {
                          return selectedLog.timestamp;
                        }
                      })()}
                    </p>
                    <p className="text-[10px] text-gray-400">{selectedLog.timestamp}</p>
                  </div>
                  <div>
                    <div className="text-gray-500">User</div>
                    <div>{selectedLog.user}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Module</div>
                    <div>{selectedLog.module}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Action</div>
                    <div>{selectedLog.action}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Risk Level</div>
                    <div>
                      <Badge
                        variant={
                          selectedLog.risk === "High"
                            ? "destructive"
                            : selectedLog.risk === "Medium"
                              ? "warning"
                              : selectedLog.risk === "Critical"
                                ? "outline"
                                : "secondary"
                        }
                      >
                        {selectedLog.risk}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500">Status</div>
                    <div>
                      <Badge
                        variant={
                          selectedLog.status === "Failed"
                            ? "destructive"
                            : selectedLog.status === "Cancelled"
                              ? "outline"
                              : "default"
                        }
                      >
                        {selectedLog.status}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500">Source</div>
                    <div>{selectedLog.source}</div>
                  </div>
                </div>
                <div>
                  <div className="text-gray-500">Description</div>
                  <div>{selectedLog.description}</div>
                </div>
                <div>
                  <div className="text-gray-500">Additional Info</div>
                  <pre className="whitespace-pre-wrap break-words bg-gray-50 p-2 rounded text-[11px] max-h-40 overflow-y-auto">
                    {JSON.stringify(selectedLog.additionalInfo || {}, null, 2)}
                  </pre>
                </div>
                {(selectedLog.before || selectedLog.after) &&
                  (() => {
                    const diffs = computeDiff(selectedLog.before, selectedLog.after);
                    return (
                      <div className="space-y-2">
                        <p className="text-[10px] font-semibold text-gray-500 uppercase">
                          Data Changes
                        </p>
                        {diffs.length > 0 ? (
                          <div className="bg-gray-50 rounded-md border border-gray-200 overflow-hidden">
                            <table className="w-full text-[11px]">
                              <thead>
                                <tr className="bg-gray-100">
                                  <th className="text-left px-3 py-1.5 text-[10px] font-semibold text-gray-500 uppercase w-1/4">
                                    Field
                                  </th>
                                  <th className="text-left px-3 py-1.5 text-[10px] font-semibold text-red-500 uppercase w-[37.5%]">
                                    Before
                                  </th>
                                  <th className="text-left px-3 py-1.5 text-[10px] font-semibold text-emerald-600 uppercase w-[37.5%]">
                                    After
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {diffs.map((d, i) => (
                                  <tr key={i} className="border-t border-gray-200">
                                    <td className="px-3 py-1.5 font-medium text-gray-700 capitalize">
                                      {d.field.replace(/_/g, " ")}
                                    </td>
                                    <td className="px-3 py-1.5">
                                      {d.changeType === "added" ? (
                                        <span className="text-gray-400 italic">—</span>
                                      ) : (
                                        <span className="text-red-600 line-through opacity-70">
                                          {formatDiffValue(d.oldValue)}
                                        </span>
                                      )}
                                    </td>
                                    <td className="px-3 py-1.5">
                                      {d.changeType === "removed" ? (
                                        <span className="text-gray-400 italic">—</span>
                                      ) : (
                                        <span className="text-emerald-700 font-medium">
                                          {formatDiffValue(d.newValue)}
                                        </span>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {selectedLog.before && (
                              <div className="bg-gray-50 rounded-md p-3 border border-gray-200">
                                <p className="text-[10px] font-semibold text-gray-500 uppercase mb-1">
                                  Before (raw)
                                </p>
                                <pre className="text-[11px] text-gray-700 bg-white p-2 rounded border border-gray-200 overflow-auto max-h-48 font-mono">
                                  {stringifySmall(selectedLog.before)}
                                </pre>
                              </div>
                            )}
                            {selectedLog.after && (
                              <div className="bg-gray-50 rounded-md p-3 border border-gray-200">
                                <p className="text-[10px] font-semibold text-gray-500 uppercase mb-1">
                                  After (raw)
                                </p>
                                <pre className="text-[11px] text-gray-700 bg-white p-2 rounded border border-gray-200 overflow-auto max-h-48 font-mono">
                                  {stringifySmall(selectedLog.after)}
                                </pre>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })()}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Purge Modal */}
      {purgeModal && (
        <Modal open={purgeModal} onClose={() => setPurgeModal(false)}>
          <div className="w-full max-w-md">
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <h3 className="text-[15px] font-semibold text-red-600">Purge Old Audit Logs</h3>
                <button
                  onClick={() => setPurgeModal(false)}
                  className="p-1 rounded-md hover:bg-gray-100 text-gray-500"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="p-4 text-[12px] space-y-3">
                <div className="flex items-start gap-2 text-red-600">
                  <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <div>
                    <p>This action will permanently delete audit logs older than 6 months.</p>
                    <p className="mt-1">This cannot be undone. Please proceed with caution.</p>
                  </div>
                </div>
                <p>
                  Type <strong>PURGE LOGS</strong> below to confirm:
                </p>
                <Input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="PURGE LOGS"
                  className="w-full"
                />
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[11px] font-medium rounded-md hover:bg-gray-50"
                    onClick={() => setPurgeModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    className="h-8 px-3 bg-red-600 hover:bg-red-700 text-white text-[11px] font-medium rounded-md"
                    onClick={purgeOldLogs}
                  >
                    Confirm Purge
                  </button>
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default AuditLog;
