import React, { useState, useEffect } from "react";
import { Search, Download, Shield } from "lucide-react";
import * as XLSX from "xlsx";
import toast from "react-hot-toast";

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
      const bsDate = window.ADToBSString ? window.ADToBSString(log.timestamp.split("T")[0]) : log.timestamp.split("T")[0];
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
      case "update": return "bg-blue-50 text-blue-700 border-blue-200";
      case "delete": return "bg-red-50 text-red-700 border-red-200";
      case "close": return "bg-purple-50 text-purple-700 border-purple-200";
      default: return "bg-gray-50 text-gray-700 border-gray-200";
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800 flex items-center gap-2">
            <Shield className="w-5 h-5 text-[#1557b0]" /> System Audit Log
          </h1>
          <p className="text-[11px] text-gray-500 mt-0.5">Immutable record of all system activities</p>
        </div>
        <button onClick={handleExport} className="h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md flex items-center gap-1.5 shadow-sm cursor-pointer">
          <Download className="w-4 h-4" /> Export Excel
        </button>
      </div>

      <div className="bg-white p-3 rounded-lg border border-gray-200 mb-4 flex gap-3 shadow-sm">
        <div className="flex-1">
          <label className="block text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1">From Date</label>
          <input type="date" value={filters.startDate} onChange={e => {setFilters({...filters, startDate: e.target.value}); setPage(1);}} className="w-full h-8 px-2 text-[12px] border border-gray-300 rounded focus:outline-none focus:border-[#1557b0]" />
        </div>
        <div className="flex-1">
          <label className="block text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1">To Date</label>
          <input type="date" value={filters.endDate} onChange={e => {setFilters({...filters, endDate: e.target.value}); setPage(1);}} className="w-full h-8 px-2 text-[12px] border border-gray-300 rounded focus:outline-none focus:border-[#1557b0]" />
        </div>
        <div className="flex-1">
          <label className="block text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1">Module</label>
          <select value={filters.module} onChange={e => {setFilters({...filters, module: e.target.value}); setPage(1);}} className="w-full h-8 px-2 text-[12px] border border-gray-300 rounded focus:outline-none focus:border-[#1557b0] bg-white cursor-pointer">
            <option value="">All Modules</option>
            <option value="FISCAL_YEAR">Fiscal Year</option>
            <option value="COMPANY_SETTINGS">Settings</option>
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1">Action</label>
          <select value={filters.action} onChange={e => {setFilters({...filters, action: e.target.value}); setPage(1);}} className="w-full h-8 px-2 text-[12px] border border-gray-300 rounded focus:outline-none focus:border-[#1557b0] bg-white cursor-pointer">
            <option value="">All Actions</option>
            <option value="CREATE">Create</option>
            <option value="UPDATE">Update</option>
            <option value="DELETE">Delete</option>
            <option value="CLOSE">Close</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {loading && logs.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-[12px]">Loading logs...</div>
        ) : (
          <>
            <table className="w-full">
              <thead className="bg-[#f5f6fa] border-b border-gray-200">
                <tr>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Timestamp (BS)</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">User</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Action</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Module</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Record ID</th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">IP Address</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-[12px] text-gray-500">
                      No audit logs found matching criteria.
                    </td>
                  </tr>
                ) : (
                  logs.map(log => {
                    const bsDate = window.ADToBSString ? window.ADToBSString(log.timestamp.split("T")[0]) : log.timestamp.split("T")[0];
                    const time = log.timestamp.split("T")[1]?.substring(0, 8) || "";
                    
                    return (
                      <tr key={log.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-3 py-2.5">
                          <div className="text-[12px] font-medium text-gray-800">{bsDate}</div>
                          <div className="text-[10px] text-gray-500">{time}</div>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="text-[12px] font-medium text-gray-800">{log.username || 'System'}</div>
                          <div className="text-[10px] text-gray-500">{log.user_role}</div>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded border ${getActionColor(log.action)}`}>
                            {log.action || "UNKNOWN"}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-700 font-medium">
                          {log.module || "-"}
                        </td>
                        <td className="px-3 py-2.5 text-[11px] font-mono text-gray-500">
                          {log.entity_id || "-"}
                        </td>
                        <td className="px-3 py-2.5 text-right text-[11px] font-mono text-gray-500">
                          {log.ip_address || "Local"}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
            
            {totalPages > 1 && (
              <div className="p-3 border-t border-gray-200 flex items-center justify-between bg-gray-50">
                <div className="text-[11px] text-gray-500">
                  Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} entries
                </div>
                <div className="flex gap-1">
                  <button 
                    disabled={page === 1}
                    onClick={() => setPage(p => p - 1)}
                    className="px-2.5 py-1 text-[11px] font-medium border border-gray-300 rounded bg-white text-gray-700 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button 
                    disabled={page >= totalPages}
                    onClick={() => setPage(p => p + 1)}
                    className="px-2.5 py-1 text-[11px] font-medium border border-gray-300 rounded bg-white text-gray-700 disabled:opacity-50"
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
