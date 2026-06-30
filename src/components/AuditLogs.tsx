/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from "react";
import { useStore } from "../store/useStore";
import { Card, Badge, Input, Pagination } from "./ui";
import { ShieldCheck, Search } from "lucide-react";

interface AuditLog {
  id: string;
  timestamp: string;
  user: string;
  action: "CREATE" | "UPDATE" | "DELETE" | "LOGIN" | "LOGOUT";
  description: string;
  status: "SUCCESS" | "WARNING" | "CRITICAL";
}

const ACTION_COLORS: Record<string, string> = {
  CREATE: "bg-green-50 text-green-700 border border-green-200",
  UPDATE: "bg-amber-50 text-amber-700 border border-amber-200",
  DELETE: "bg-red-50 text-red-700 border border-red-200",
  LOGIN: "bg-[#e5e7eb] text-[#1f2937] border border-[#d1d5db]",
  LOGOUT: "bg-[#f9fafb] text-[#1f2937] border border-[#d1d5db]",
};

const AuditLogs: React.FC = () => {
  const { currentUser } = useStore();
  const [searchTerm, setSearchTerm] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [realLogs, setRealLogs] = useState<AuditLog[]>([]);

  useEffect(() => {
    const loadLogs = async () => {
      try {
        const { getDB } = await import("../lib/db");
        const db = getDB();
        const logs = await db.table("auditLogs").orderBy("timestamp").reverse().limit(500).toArray();
        setRealLogs(
          logs.map((l: any) => ({
            id: String(l.id || Math.random()),
            timestamp: l.timestamp || l.createdAt || new Date().toISOString(),
            user: l.userName || l.user || "System",
            action: (l.action || "UPDATE").toUpperCase() as AuditLog["action"],
            description: l.narration || l.description || l.action || "",
            status: (l.status || "SUCCESS").toUpperCase() as AuditLog["status"],
          }))
        );
      } catch (err) {
        console.warn("Could not load audit logs from DB", err);
        setRealLogs([]);
      }
    };
    loadLogs();
  }, []);

  const filteredLogs = useMemo(() => {
    return realLogs.filter((l) => {
      const matchesSearch =
        l.user.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesAction = actionFilter === "" || l.action === actionFilter;
      return matchesSearch && matchesAction;
    });
  }, [realLogs, searchTerm, actionFilter]);

  const paginatedLogs = useMemo(() => {
    const startIndex = (page - 1) * pageSize;
    return filteredLogs.slice(startIndex, startIndex + pageSize);
  }, [filteredLogs, page, pageSize]);

  const totalPages = Math.ceil(filteredLogs.length / pageSize);

  return (
    <div className="flex flex-col gap-4 animate-fadeIn pb-4 text-xs select-none">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-[#1f2937]">Secure Audit Monitor Logs</h1>
          <p className="text-[11px] text-[#1f2937] mt-0.5">
            Sutra Built-in Irreversible Compliance Ledger
          </p>
        </div>
      </div>

      {/* FILTER PANEL */}
      <div className="page-toolbar mb-3">
        <div className="page-toolbar-left gap-3">
          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#1f2937] pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Query security logs..."
              className="h-8 pl-8 pr-2.5 text-[12px] border border-[#d1d5db] rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-64"
            />
          </div>
          <select
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setPage(1);
            }}
            className="h-8 px-2.5 text-[12px] border border-[#d1d5db] rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
          >
            <option value="">All Actions</option>
            <option value="CREATE">Create</option>
            <option value="UPDATE">Update</option>
            <option value="DELETE">Delete</option>
            <option value="LOGIN">Login</option>
          </select>
        </div>
      </div>

      {/* Table register */}
      <div
        className="bg-white border rounded-lg overflow-hidden animate-fadeIn"
        style={{ borderColor: "var(--border)" }}
      >
        <table className="data-table">
          <thead>
            <tr className="bg-[#eef1f8] border-b-2 border-[#c5cad8]">
              <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-left">
                Log Timestamp
              </th>
              <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-left">
                Identity Operator
              </th>
              <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-left">
                Action
              </th>
              <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-left">
                Executed Operational Description
              </th>
              <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-center">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {paginatedLogs.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-8 text-[#1f2937]">
                  No operations logs matched query.
                </td>
              </tr>
            ) : (
              paginatedLogs.map((log) => (
                <tr key={log.id} className="hover:bg-[#e8eeff]">
                  <td className="px-3 py-[7px] text-[12px] text-[#1f2937] font-mono">
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td className="px-3 py-[7px] text-[12px] text-[#1f2937] font-bold">
                    <div className="flex items-center gap-1.5 align-middle">
                      <div className="h-5 w-5 rounded-full bg-[#f9fafb] flex items-center justify-center font-bold text-[10px] text-[#1f2937]">
                        {log.user.charAt(0).toUpperCase()}
                      </div>
                      <span>{log.user}</span>
                    </div>
                  </td>
                  <td className="px-3 py-[7px] text-[12px]">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${ACTION_COLORS[log.action] || "bg-[#f9fafb] text-[#1f2937]"}`}
                    >
                      {log.action}
                    </span>
                  </td>
                  <td className="px-3 py-[7px] text-[12px] text-[#1f2937]">{log.description}</td>
                  <td className="px-3 py-[7px] text-[12px] text-center">
                    <span className="badge bg-green-50 text-green-700 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase">
                      {log.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <Pagination
        page={page}
        totalPages={totalPages}
        totalRecords={filteredLogs.length}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(s) => {
          setPageSize(s);
          setPage(1);
        }}
      />
    </div>
  );
};

export default AuditLogs;
