import React, { useEffect, useMemo, useState } from "react";
import {
  Shield,
  Download,
  Search,
  Filter,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  AlertCircle,
} from "lucide-react";
import {
  getAuditLogs,
  exportAuditLogToCSV,
  type AuditEntry,
  type AuditModule,
  type AuditAction,
} from "@/lib/auditLogger";

const PAGE_SIZE = 50;

const MODULE_OPTIONS = [
  "ALL",
  "VOUCHER",
  "INVOICE",
  "LEDGER",
  "ITEM",
  "PARTY",
  "EMPLOYEE",
  "PAYROLL",
  "ASSET",
  "USER",
  "SETTINGS",
  "PERIOD_LOCK",
];

const ACTION_OPTIONS = [
  "ALL",
  "CREATE",
  "UPDATE",
  "DELETE",
  "POST",
  "UNPOST",
  "APPROVE",
  "REJECT",
  "LOCK",
  "UNLOCK",
  "LOGIN",
  "LOGOUT",
  "EXPORT",
  "PRINT",
];

function getActionColor(action: string): string {
  switch (action) {
    case "CREATE":
      return "bg-green-100 text-green-700";
    case "UPDATE":
      return "bg-blue-100 text-blue-700";
    case "DELETE":
      return "bg-red-100 text-red-700";
    case "POST":
      return "bg-blue-100 text-blue-700";
    case "APPROVE":
      return "bg-emerald-100 text-emerald-700";
    case "REJECT":
      return "bg-red-100 text-red-700";
    case "LOCK":
      return "bg-orange-100 text-orange-700";
    case "UNLOCK":
      return "bg-cyan-100 text-cyan-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

function formatTimestamp(timestamp: string): string {
  if (!timestamp) return "—";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;

  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");

  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
}

export default function AuditTrailLog() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterModule, setFilterModule] = useState("ALL");
  const [filterAction, setFilterAction] = useState("ALL");
  const [filterUser, setFilterUser] = useState("");
  const [searchText, setSearchText] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const loadLogs = async () => {
    try {
      setLoading(true);

      const filters: {
        module?: AuditModule;
        action?: AuditAction;
        fromDate?: string;
        toDate?: string;
        limit: number;
      } = { limit: 1000 };

      if (filterModule !== "ALL") filters.module = filterModule as AuditModule;
      if (filterAction !== "ALL") filters.action = filterAction as AuditAction;
      if (fromDate) filters.fromDate = `${fromDate}T00:00:00`;
      if (toDate) filters.toDate = `${toDate}T23:59:59`;

      const data = await getAuditLogs(filters);
      setLogs(data);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getAuditLogs({ limit: 1000 })
      .then(setLogs)
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  }, []);

  const filteredLogs = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    const userQ = filterUser.trim().toLowerCase();

    return logs
      .filter((log) => {
        if (filterModule !== "ALL" && log.module !== filterModule) return false;
        if (filterAction !== "ALL" && log.action !== filterAction) return false;

        if (userQ && !log.userName.toLowerCase().includes(userQ)) return false;

        if (
          q &&
          !log.description.toLowerCase().includes(q) &&
          !log.recordNo.toLowerCase().includes(q)
        ) {
          return false;
        }

        if (fromDate && log.timestamp < `${fromDate}T00:00:00`) return false;
        if (toDate && log.timestamp > `${toDate}T23:59:59`) return false;

        return true;
      })
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }, [logs, filterModule, filterAction, filterUser, searchText, fromDate, toDate]);

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / PAGE_SIZE));

  const paginatedLogs = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredLogs.slice(start, start + PAGE_SIZE);
  }, [filteredLogs, page]);

  const anyFilterActive =
    filterModule !== "ALL" ||
    filterAction !== "ALL" ||
    filterUser ||
    searchText ||
    fromDate ||
    toDate;

  const clearFilters = () => {
    setFilterModule("ALL");
    setFilterAction("ALL");
    setFilterUser("");
    setSearchText("");
    setFromDate("");
    setToDate("");
    setPage(1);
  };

  const handleExport = () => {
    exportAuditLogToCSV(filteredLogs);
  };

  return (
    <div className="p-6 bg-[#f5f6fa] min-h-screen">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800 flex items-center gap-2">
            <Shield className="h-4 w-4 text-[#1557b0]" />
            Audit Trail Log
          </h1>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Immutable record of all system changes and user actions
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadLogs}
            className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 flex items-center gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={handleExport}
            className="h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md flex items-center gap-1.5"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-3 mb-4 flex flex-wrap gap-3 items-center">
        <div className="relative">
          <Filter className="h-3.5 w-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
          <select
            value={filterModule}
            onChange={(event) => {
              setFilterModule(event.target.value);
              setPage(1);
            }}
            className="h-8 pl-7 pr-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-36"
          >
            {MODULE_OPTIONS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>

        <select
          value={filterAction}
          onChange={(event) => {
            setFilterAction(event.target.value);
            setPage(1);
          }}
          className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-36"
        >
          {ACTION_OPTIONS.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>

        <input
          value={filterUser}
          onChange={(event) => {
            setFilterUser(event.target.value);
            setPage(1);
          }}
          placeholder="Filter by user"
          className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-40"
        />

        <input
          type="date"
          value={fromDate}
          onChange={(event) => {
            setFromDate(event.target.value);
            setPage(1);
          }}
          className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-36"
        />

        <input
          type="date"
          value={toDate}
          onChange={(event) => {
            setToDate(event.target.value);
            setPage(1);
          }}
          className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-36"
        />

        <div className="relative">
          <Search className="h-3.5 w-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={searchText}
            onChange={(event) => {
              setSearchText(event.target.value);
              setPage(1);
            }}
            placeholder="Search description..."
            className="h-8 pl-7 pr-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-48"
          />
        </div>

        {anyFilterActive && (
          <button
            type="button"
            onClick={clearFilters}
            className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50"
          >
            Clear Filters
          </button>
        )}
      </div>

      <div className="flex gap-4 mb-3 text-[11px] text-gray-500">
        <span>
          Showing {filteredLogs.length} of {logs.length} total entries
        </span>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="py-16 flex justify-center">
            <div className="animate-spin w-6 h-6 border-2 border-[#1557b0] border-t-transparent rounded-full" />
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="py-16 text-center">
            <AlertCircle className="h-8 w-8 text-gray-400 mx-auto mb-2" />
            <p className="text-[12px] text-gray-400">No audit entries found</p>
          </div>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[#f5f6fa] border-b border-gray-200">
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                  Timestamp
                </th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                  User
                </th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                  Action
                </th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                  Module
                </th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                  Record No
                </th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                  Description
                </th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                  Changes
                </th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                  IP
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedLogs.map((log) => {
                const hasDiff = log.beforeData !== null || log.afterData !== null;
                const isExpanded = expandedRow === log.id;

                return (
                  <React.Fragment key={log.id}>
                    <tr className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-3 py-2.5 text-[12px] text-gray-700 font-mono">
                        {formatTimestamp(log.timestamp)}
                      </td>
                      <td className="px-3 py-2.5 text-[12px] text-gray-700">
                        {log.userName}
                      </td>
                      <td className="px-3 py-2.5 text-[12px] text-gray-700">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${getActionColor(log.action)}`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-[12px] text-gray-600">
                        {log.module}
                      </td>
                      <td className="px-3 py-2.5 text-[12px] text-gray-700 font-mono">
                        {log.recordNo}
                      </td>
                      <td className="px-3 py-2.5 text-[12px] text-gray-700 max-w-[300px] truncate">
                        {log.description}
                      </td>
                      <td className="px-3 py-2.5 text-[12px] text-gray-700">
                        {hasDiff ? (
                          <button
                            type="button"
                            onClick={() => setExpandedRow(isExpanded ? null : log.id)}
                            className="h-6 px-2 text-[11px] border border-gray-300 rounded bg-white hover:bg-gray-50 inline-flex items-center gap-1"
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-3 w-3" />
                            ) : (
                              <ChevronRight className="h-3 w-3" />
                            )}
                            View Diff
                          </button>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-[12px] text-gray-700">
                        {log.ipAddress}
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr className="border-b border-gray-100">
                        <td colSpan={8} className="p-3 bg-gray-50">
                          <div className="grid grid-cols-2 gap-3">
                            <div className="bg-red-50 border border-red-100 rounded-md">
                              <div className="px-2 py-1 text-[11px] font-semibold text-red-700 border-b border-red-100">
                                Before
                              </div>
                              <pre className="text-[10px] overflow-auto max-h-32 p-2 text-gray-700">
                                {JSON.stringify(log.beforeData, null, 2)}
                              </pre>
                            </div>
                            <div className="bg-green-50 border border-green-100 rounded-md">
                              <div className="px-2 py-1 text-[11px] font-semibold text-green-700 border-b border-green-100">
                                After
                              </div>
                              <pre className="text-[10px] overflow-auto max-h-32 p-2 text-gray-700">
                                {JSON.stringify(log.afterData, null, 2)}
                              </pre>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setExpandedRow(null)}
                            className="mt-2 text-[11px] text-[#1557b0] hover:underline"
                          >
                            Close
                          </button>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {filteredLogs.length > PAGE_SIZE && (
        <div className="flex justify-end items-center gap-2 mt-4">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-[12px] text-gray-600">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
