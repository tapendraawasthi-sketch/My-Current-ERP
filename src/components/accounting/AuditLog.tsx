import React, { useState, useMemo } from "react";
import { AuditAction } from "@/types";
import { useAccountingStore } from "@/store/accountingStore";

const ACTION_COLORS: Record<AuditAction, string> = {
  [AuditAction.CREATE]: "bg-blue-50 text-blue-700 border-blue-200",
  [AuditAction.UPDATE]: "bg-amber-50 text-amber-700 border-amber-200",
  [AuditAction.DELETE]: "bg-red-50 text-red-700 border-red-200",
  [AuditAction.VOID]: "bg-red-50 text-red-700 border-red-200",
  [AuditAction.POST]: "bg-green-50 text-green-700 border-green-200",
  [AuditAction.APPROVE]: "bg-purple-50 text-purple-700 border-purple-200",
  [AuditAction.LOCK]: "bg-orange-50 text-orange-700 border-orange-200",
  [AuditAction.UNLOCK]: "bg-teal-50 text-teal-700 border-teal-200",
};

export function AuditLog() {
  const { auditLogs } = useAccountingStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [filterAction, setFilterAction] = useState<AuditAction | "">("");
  const [filterEntity, setFilterEntity] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const perPage = 20;

  const filteredLogs = useMemo(() => {
    return auditLogs.filter((log) => {
      if (filterAction && log.action !== filterAction) return false;
      if (filterEntity && log.entityType !== filterEntity) return false;
      if (fromDate && log.timestamp < fromDate) return false;
      if (toDate && log.timestamp > toDate + "T23:59:59") return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!log.entityId.toLowerCase().includes(q) && !log.entityDescription?.toLowerCase().includes(q) && !log.userName?.toLowerCase().includes(q) && !log.entityType.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [auditLogs, filterAction, filterEntity, fromDate, toDate, searchQuery]);

  const totalPages = Math.ceil(filteredLogs.length / perPage);
  const paginatedLogs = filteredLogs.slice((page - 1) * perPage, page * perPage);
  const entityTypes = [...new Set(auditLogs.map((l) => l.entityType))];

  const exportCSV = () => {
    const rows = [["Timestamp", "User", "Action", "Entity Type", "Entity ID", "Description"], ...filteredLogs.map((l) => [l.timestamp, l.userName || l.userId, l.action, l.entityType, l.entityId, l.entityDescription || ""])];
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit_log_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  return (
    <div className="p-4 bg-[#f5f6fa] min-h-screen">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-[15px] font-semibold text-gray-800">Audit Log</h1>
            <p className="text-[11px] text-gray-500 mt-0.5">Complete append-only transaction trail — {auditLogs.length} events</p>
          </div>
          <button onClick={exportCSV} className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50">Export CSV</button>
        </div>

        <div className="bg-white border border-gray-200 shadow-sm p-4 mb-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="lg:col-span-2">
              <label className="block text-[11px] font-medium text-gray-600 mb-1">Search</label>
              <input type="text" value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }} placeholder="Search user, entity..." className="w-full h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]" />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-600 mb-1">Action</label>
              <select value={filterAction} onChange={(e) => { setFilterAction(e.target.value as AuditAction | ""); setPage(1); }} className="w-full h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]">
                <option value="">All Actions</option>
                {Object.values(AuditAction).map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-600 mb-1">Entity Type</label>
              <select value={filterEntity} onChange={(e) => { setFilterEntity(e.target.value); setPage(1); }} className="w-full h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]">
                <option value="">All Types</option>
                {entityTypes.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-600 mb-1">Date Range</label>
              <div className="flex gap-1">
                <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-full h-8 px-1.5 text-[11px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]" />
                <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-full h-8 px-1.5 text-[11px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]" />
              </div>
            </div>
          </div>
          <div className="mt-2 text-[10px] text-gray-500 font-semibold uppercase tracking-wide">Showing {filteredLogs.length} of {auditLogs.length} events</div>
        </div>

        <div className="bg-white border border-gray-200 shadow-sm">
          {paginatedLogs.length === 0 ? (
            <div className="text-center py-12 text-gray-500 text-[12px]">No audit log entries found.</div>
          ) : (
            <table className="w-full text-[12px] border-collapse">
              <thead>
                <tr className="bg-[#f5f6fa] border-b border-gray-200">
                  <th className="text-left py-2.5 px-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Timestamp (UTC)</th>
                  <th className="text-left py-2.5 px-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">User</th>
                  <th className="text-left py-2.5 px-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Action</th>
                  <th className="text-left py-2.5 px-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Entity Type</th>
                  <th className="text-left py-2.5 px-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Entity / Description</th>
                  <th className="text-center py-2.5 px-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-16">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginatedLogs.map((log) => (
                  <React.Fragment key={log.id}>
                    <tr className="hover:bg-gray-50">
                      <td className="py-2 px-3 text-[11px] text-gray-600 font-mono">{new Date(log.timestamp).toLocaleString("en-US", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}</td>
                      <td className="py-2 px-3"><div className="font-medium text-gray-800">{log.userName || "System"}</div><div className="text-gray-400 text-[10px] font-mono">{log.userId}</div></td>
                      <td className="py-2 px-3"><span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${ACTION_COLORS[log.action] || "bg-gray-50 text-gray-600 border-gray-200"}`}>{log.action}</span></td>
                      <td className="py-2 px-3 text-[11px] text-gray-700">{log.entityType}</td>
                      <td className="py-2 px-3"><div className="text-[11px] font-medium text-gray-800">{log.entityDescription || log.entityId}</div>{log.entityDescription && <div className="text-[10px] text-gray-400 font-mono">{log.entityId.slice(0, 12)}...</div>}</td>
                      <td className="py-2 px-3 text-center">{(log.beforeState || log.afterState) && <button onClick={() => setExpandedId(expandedId === log.id ? null : log.id)} className="text-[11px] font-medium text-[#1557b0] hover:underline">{expandedId === log.id ? "Hide" : "View"}</button>}</td>
                    </tr>
                    {expandedId === log.id && (
                      <tr className="bg-[#f8fafc] border-b border-gray-200">
                        <td colSpan={6} className="px-6 py-4">
                          <div className="grid grid-cols-2 gap-6 text-[11px]">
                            {log.beforeState && <div><div className="font-semibold text-gray-700 mb-1.5 uppercase tracking-wide text-[10px]">Before:</div><pre className="bg-white border border-gray-200 p-2 overflow-auto text-gray-700 max-h-48 font-mono">{JSON.stringify(log.beforeState, null, 2)}</pre></div>}
                            {log.afterState && <div><div className="font-semibold text-[#1557b0] mb-1.5 uppercase tracking-wide text-[10px]">After:</div><pre className="bg-blue-50 border border-blue-100 p-2 overflow-auto text-blue-900 max-h-48 font-mono">{JSON.stringify(log.afterState, null, 2)}</pre></div>}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          )}
          {totalPages > 1 && (
            <div className="flex justify-between items-center px-4 py-3 border-t border-gray-200 bg-[#f5f6fa]">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="h-7 px-2.5 text-[11px] font-medium text-gray-700 bg-white border border-gray-300 rounded disabled:opacity-50 hover:bg-gray-50">← Prev</button>
              <span className="text-[11px] text-gray-600 font-medium">Page {page} of {totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="h-7 px-2.5 text-[11px] font-medium text-gray-700 bg-white border border-gray-300 rounded disabled:opacity-50 hover:bg-gray-50">Next →</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
