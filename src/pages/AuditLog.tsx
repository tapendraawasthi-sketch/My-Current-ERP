import React, { useState, useEffect } from "react";
import { Search, Download, Shield } from "lucide-react";
import { getDB } from "../lib/db";
import { AuditLog as IAuditLog } from "../lib/types";
import { ADToBSString } from "../lib/nepaliDate";
import * as XLSX from "xlsx";
import toast from "react-hot-toast";

export default function AuditLog() {
  const [logs, setLogs] = useState<IAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [filters, setFilters] = useState({
    startDate: "",
    endDate: "",
    user: "",
    module: "",
    action: "",
  });

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const db = getDB();
        const data = await db.auditLogs.orderBy("timestamp").reverse().toArray();
        setLogs(data);
      } catch (err) {
        console.error(err);
        toast.error("Failed to load audit logs");
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, []);

  const filteredLogs = logs.filter(log => {
    const date = log.timestamp.split("T")[0];
    if (filters.startDate && date < filters.startDate) return false;
    if (filters.endDate && date > filters.endDate) return false;
    if (filters.user && !log.userName.toLowerCase().includes(filters.user.toLowerCase())) return false;
    if (filters.module && log.module?.toLowerCase() !== filters.module.toLowerCase()) return false;
    if (filters.action && log.action?.toLowerCase() !== filters.action.toLowerCase()) return false;
    return true;
  });

  const handleExport = () => {
    const dataToExport = filteredLogs.map(log => {
      const adDate = log.timestamp.split("T")[0];
      const bsDate = ADToBSString(adDate);
      const time = log.timestamp.split("T")[1]?.substring(0, 8) || "";
      
      return {
        "Timestamp (AD)": log.timestamp,
        "Timestamp (BS)": `${bsDate} ${time}`,
        "User Name": log.userName,
        "User ID": log.userId,
        "Action": log.action?.toUpperCase() || "-",
        "Module": log.module || "-",
        "Record ID": log.recordId || "-",
        "IP Address": "Local",
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
      case "payment_reminder": return "bg-purple-50 text-purple-700 border-purple-200";
      default: return "bg-gray-50 text-gray-700 border-gray-200";
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800 flex items-center gap-2">
            <Shield className="w-5 h-5 text-[#1557b0]" /> System Audit Log
          </h1>
          <p className="text-[11px] text-gray-500 mt-0.5">Immutable record of all system activities</p>
        </div>
        <button onClick={handleExport} className="h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md flex items-center gap-1.5 shadow-sm">
          <Download className="w-4 h-4" /> Export Excel
        </button>
      </div>

      <div className="bg-white p-3 rounded-lg border border-gray-200 mb-4 flex gap-3 shadow-sm">
        <div className="flex-1">
          <label className="block text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1">From Date</label>
          <input type="date" value={filters.startDate} onChange={e => setFilters({...filters, startDate: e.target.value})} className="w-full h-8 px-2 text-[12px] border border-gray-300 rounded focus:outline-none focus:border-[#1557b0]" />
        </div>
        <div className="flex-1">
          <label className="block text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1">To Date</label>
          <input type="date" value={filters.endDate} onChange={e => setFilters({...filters, endDate: e.target.value})} className="w-full h-8 px-2 text-[12px] border border-gray-300 rounded focus:outline-none focus:border-[#1557b0]" />
        </div>
        <div className="flex-1">
          <label className="block text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1">User</label>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2 top-2.5" />
            <input type="text" placeholder="Search user..." value={filters.user} onChange={e => setFilters({...filters, user: e.target.value})} className="w-full h-8 pl-7 pr-2 text-[12px] border border-gray-300 rounded focus:outline-none focus:border-[#1557b0]" />
          </div>
        </div>
        <div className="flex-1">
          <label className="block text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1">Module</label>
          <select value={filters.module} onChange={e => setFilters({...filters, module: e.target.value})} className="w-full h-8 px-2 text-[12px] border border-gray-300 rounded focus:outline-none focus:border-[#1557b0] bg-white">
            <option value="">All Modules</option>
            <option value="Vouchers">Vouchers</option>
            <option value="Invoices">Invoices</option>
            <option value="Settings">Settings</option>
            <option value="Users">Users</option>
            <option value="BillWise">Bill Wise</option>
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1">Action</label>
          <select value={filters.action} onChange={e => setFilters({...filters, action: e.target.value})} className="w-full h-8 px-2 text-[12px] border border-gray-300 rounded focus:outline-none focus:border-[#1557b0] bg-white">
            <option value="">All Actions</option>
            <option value="create">Create</option>
            <option value="update">Update</option>
            <option value="delete">Delete</option>
            <option value="payment_reminder">Payment Reminder</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500 text-[12px]">Loading logs...</div>
        ) : (
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
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-[12px] text-gray-500">
                    No audit logs found matching criteria.
                  </td>
                </tr>
              ) : (
                filteredLogs.map(log => {
                  const adDate = log.timestamp.split("T")[0];
                  const bsDate = ADToBSString(adDate);
                  const time = log.timestamp.split("T")[1]?.substring(0, 8) || "";
                  
                  return (
                    <tr key={log.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-3 py-2.5">
                        <div className="text-[12px] font-medium text-gray-800">{bsDate}</div>
                        <div className="text-[10px] text-gray-500">{time}</div>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="text-[12px] font-medium text-gray-800">{log.userName}</div>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded border ${getActionColor(log.action || "")}`}>
                          {log.action || "UNKNOWN"}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-[12px] text-gray-700 font-medium">
                        {log.module || "-"}
                      </td>
                      <td className="px-3 py-2.5 text-[11px] font-mono text-gray-500">
                        {log.recordId || "-"}
                      </td>
                      <td className="px-3 py-2.5 text-right text-[11px] font-mono text-gray-500">
                        Local
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
