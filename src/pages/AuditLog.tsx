import React, { useState, useEffect } from "react";
import { Search, Download, Shield } from "lucide-react";
import * as XLSX from "xlsx";
import toast from "react-hot-toast";
import { ADToBSString } from "../lib/nepaliDate";

export default function AuditLog() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  
  const [filters, setFilters] = useState({
    startDate: "",
    endDate: "",
    user: "",
    module: "",
    action: "",
  });
  
  const [page, setPage] = useState(1);
  const limit = 50;

  useEffect(() => {
    fetchLogs();
  }, [filters, page]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const query = new URLSearchParams({
        limit: limit.toString(),
        offset: ((page - 1) * limit).toString()
      });
      if (filters.startDate) query.append('startDate', filters.startDate);
      if (filters.endDate) query.append('endDate', filters.endDate);
      if (filters.module) query.append('module', filters.module);
      if (filters.action) query.append('action', filters.action);
      // Backend does not natively support user search yet but could be added, or handled here

      const res = await fetch(`/api/audit-logs?${query.toString()}`);
      const json = await res.json();
      if (json.success) {
        setLogs(json.data);
        setTotal(json.meta?.total || 0);
      } else {
        toast.error("Failed to load audit logs");
      }
    } catch (err) {
      toast.error("Network error");
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    const dataToExport = logs.map(log => {
      const bsDate = ADToBSString(log.timestamp.split("T")[0]) || log.timestamp.split("T")[0];
      const time = log.timestamp.split("T")[1]?.substring(0, 8) || "";
      
      return {
        "Timestamp (AD)": log.timestamp,
        "Timestamp (BS)": `${bsDate} ${time}`,
        "User Name": log.username || 'System',
        "User ID": log.user_id || '-',
        "Action": log.action?.toUpperCase() || "-",
        "Module": log.module || "-",
        "Record ID": log.entity_id || "-",
        "IP Address": log.ip_address || "Local",
      };
    });

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Audit Logs");
    XLSX.writeFile(wb, `Audit_Logs_${new Date().toISOString().split("T")[0]}.xlsx`);
    toast.success("Exported to Excel");
  };

  const getActionColor = (action: string) => {
    switch (action?.toLowerCase()) {
      case "create": return "bg-green-50 text-green-700 border-green-200";
      case "update": return "bg-[#D4EABD] text-[#000000] border-[#9DC07A]";
      case "delete": return "bg-red-50 text-red-700 border-red-200";
      case "close": return "bg-purple-50 text-purple-700 border-purple-200";
      default: return "bg-[#EBF5E2] text-[#000000] border-[#9DC07A]";
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-[#000000] flex items-center gap-2">
            <Shield className="w-5 h-5 text-[#1557b0]" /> System Audit Log
          </h1>
          <p className="text-[11px] text-[#000000] mt-0.5">Immutable record of all system activities</p>
        </div>
        <button onClick={handleExport} className="h-8 px-3 bg-[#3D6B25] hover:bg-[#2D5A1A] text-white text-[12px] font-medium rounded-md flex items-center gap-1.5 shadow-sm cursor-pointer">
          <Download className="w-4 h-4" /> Export Excel
        </button>
      </div>

      <div className="bg-white p-3 rounded-lg border border-[#9DC07A] mb-4 flex gap-3 shadow-sm">
        <div className="flex-1">
          <label className="block text-[10px] font-medium text-[#000000] uppercase tracking-wide mb-1">From Date</label>
          <input type="date" value={filters.startDate} onChange={e => {setFilters({...filters, startDate: e.target.value}); setPage(1);}} className="w-full h-8 px-2 text-[12px] border border-[#9DC07A] rounded focus:outline-none focus:border-[#1557b0]" />
        </div>
        <div className="flex-1">
          <label className="block text-[10px] font-medium text-[#000000] uppercase tracking-wide mb-1">To Date</label>
          <input type="date" value={filters.endDate} onChange={e => {setFilters({...filters, endDate: e.target.value}); setPage(1);}} className="w-full h-8 px-2 text-[12px] border border-[#9DC07A] rounded focus:outline-none focus:border-[#1557b0]" />
        </div>
        <div className="flex-1">
          <label className="block text-[10px] font-medium text-[#000000] uppercase tracking-wide mb-1">Module</label>
          <select value={filters.module} onChange={e => {setFilters({...filters, module: e.target.value}); setPage(1);}} className="w-full h-8 px-2 text-[12px] border border-[#9DC07A] rounded focus:outline-none focus:border-[#1557b0] bg-white cursor-pointer">
            <option value="">All Modules</option>
            <option value="FISCAL_YEAR">Fiscal Year</option>
            <option value="COMPANY_SETTINGS">Company Settings</option>
            <option value="BACKUP">Backup / Restore</option>
            <option value="SHORTCUTS">Shortcuts</option>
            <option value="AUDIT">Audit System</option>
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-[10px] font-medium text-[#000000] uppercase tracking-wide mb-1">Action</label>
          <select value={filters.action} onChange={e => {setFilters({...filters, action: e.target.value}); setPage(1);}} className="w-full h-8 px-2 text-[12px] border border-[#9DC07A] rounded focus:outline-none focus:border-[#1557b0] bg-white cursor-pointer">
            <option value="">All Actions</option>
            <option value="CREATE">Create</option>
            <option value="UPDATE">Update</option>
            <option value="DELETE">Delete</option>
            <option value="EXPORT">Export</option>
            <option value="IMPORT">Import</option>
            <option value="CLOSE">Close Year</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-[#9DC07A] overflow-hidden">
        {loading && logs.length === 0 ? (
          <div className="p-8 text-center text-[#000000] text-[12px]">Loading logs...</div>
        ) : (
          <>
            <table className="w-full">
              <thead className="bg-[#f5f6fa] border-b border-[#9DC07A]">
                <tr>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-[#000000] uppercase tracking-wide">Timestamp (BS)</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-[#000000] uppercase tracking-wide">User</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-[#000000] uppercase tracking-wide">Action</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-[#000000] uppercase tracking-wide">Module</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-[#000000] uppercase tracking-wide">Record ID</th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-[#000000] uppercase tracking-wide">IP Address</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-[12px] text-[#000000]">
                      No audit logs found matching criteria.
                    </td>
                  </tr>
                ) : (
                  logs.map(log => {
                    const bsDate = ADToBSString(log.timestamp.split("T")[0]) || log.timestamp.split("T")[0];
                    const time = log.timestamp.split("T")[1]?.substring(0, 8) || "";
                    
                    return (
                      <tr key={log.id} className="border-b border-[#9DC07A] hover:bg-[#EBF5E2]">
                        <td className="px-3 py-2.5">
                          <div className="text-[12px] font-medium text-[#000000]">{bsDate}</div>
                          <div className="text-[10px] text-[#000000]">{time}</div>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="text-[12px] font-medium text-[#000000]">{log.username || 'System'}</div>
                          <div className="text-[10px] text-[#000000]">{log.user_role}</div>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded border ${getActionColor(log.action)}`}>
                            {log.action || "UNKNOWN"}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-[12px] text-[#000000] font-medium">
                          {log.module || "-"}
                        </td>
                        <td className="px-3 py-2.5 text-[11px] font-mono text-[#000000]">
                          {log.entity_id || "-"}
                        </td>
                        <td className="px-3 py-2.5 text-right text-[11px] font-mono text-[#000000]">
                          {log.ip_address || "Local"}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
            
            {totalPages > 1 && (
              <div className="p-3 border-t border-[#9DC07A] flex items-center justify-between bg-[#EBF5E2]">
                <div className="text-[11px] text-[#000000]">
                  Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} entries
                </div>
                <div className="flex gap-1">
                  <button 
                    disabled={page === 1}
                    onClick={() => setPage(p => p - 1)}
                    className="px-2.5 py-1 text-[11px] font-medium border border-[#9DC07A] rounded bg-white text-[#000000] disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button 
                    disabled={page >= totalPages}
                    onClick={() => setPage(p => p + 1)}
                    className="px-2.5 py-1 text-[11px] font-medium border border-[#9DC07A] rounded bg-white text-[#000000] disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
