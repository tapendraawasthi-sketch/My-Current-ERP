import React, { useState } from "react";
import { ActionToolbar } from "../components/ui";
import { Search, Download, ChevronDown, ChevronRight } from "lucide-react";

interface AuditLog {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  module: string;
  recordId: string;
  description: string;
  oldValue?: any;
  newValue?: any;
}

export default function AuditLog() {
  const [filters, setFilters] = useState({
    startDate: "",
    endDate: "",
    user: "",
    module: "",
    action: "",
  });
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const logs: AuditLog[] = [
    {
      id: "1",
      timestamp: "2024-01-15 10:30:15",
      user: "admin",
      action: "login",
      module: "Auth",
      recordId: "-",
      description: "User logged in successfully",
    },
    {
      id: "2",
      timestamp: "2024-01-15 11:15:22",
      user: "admin",
      action: "create",
      module: "Voucher",
      recordId: "JV001",
      description: "Created new journal voucher",
      newValue: { voucherNo: "JV001", amount: 50000, date: "2024-01-15" },
    },
    {
      id: "3",
      timestamp: "2024-01-15 12:00:45",
      user: "accountant",
      action: "update",
      module: "Ledger",
      recordId: "L001",
      description: "Updated Cash ledger",
      oldValue: { name: "Cash", balance: 100000 },
      newValue: { name: "Cash in Hand", balance: 150000 },
    },
    {
      id: "4",
      timestamp: "2024-01-15 14:30:10",
      user: "admin",
      action: "delete",
      module: "Customer",
      recordId: "C015",
      description: "Deleted customer record",
      oldValue: { name: "Old Customer Ltd.", pan: "123456789" },
    },
  ];

  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const handleExport = () => {
    const csv = [
      ["Timestamp", "User", "Action", "Module", "Record ID", "Description"],
      ...logs.map((log) => [
        log.timestamp,
        log.user,
        log.action,
        log.module,
        log.recordId,
        log.description,
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit_log_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  const getActionBadge = (action: string) => {
    const act = (action || "").toLowerCase();
    const styles = {
      create: "bg-green-100 text-green-700",
      update: "bg-blue-100 text-blue-700",
      delete: "bg-red-100 text-red-700",
      login: "bg-gray-100 text-gray-600",
      logout: "bg-gray-100 text-gray-600",
    };
    const cls = styles[act as keyof typeof styles] || "bg-gray-100 text-gray-750";
    return (
      <span
        className={`inline-flex items-center px-2 py-0.5 text-[10px] font-semibold uppercase rounded ${cls}`}
      >
        {action}
      </span>
    );
  };

  const renderDiff = (oldVal: any, newVal: any) => {
    if (!oldVal && !newVal) return null;

    return (
      <div className="grid grid-cols-2 gap-4 font-mono text-xs">
        {oldVal && (
          <div>
            <h4 className="font-semibold text-red-600 mb-2">Old Value:</h4>
            <pre className="bg-red-50 p-3 rounded border border-red-200 overflow-auto">
              {JSON.stringify(oldVal, null, 2)}
            </pre>
          </div>
        )}
        {newVal && (
          <div>
            <h4 className="font-semibold text-green-600 mb-2">New Value:</h4>
            <pre className="bg-green-50 p-3 rounded border border-green-200 overflow-auto">
              {JSON.stringify(newVal, null, 2)}
            </pre>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <ActionToolbar title="Audit Log" subtitle="System activity and change history" />
      <div className="flex justify-end mb-4">
        <button onClick={handleExport} className="btn-primary flex items-center space-x-2">
          <Download className="w-4 h-4" />
          <span>Export CSV</span>
        </button>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <div className="grid grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
              className="input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
              className="input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">User</label>
            <select
              value={filters.user}
              onChange={(e) => setFilters({ ...filters, user: e.target.value })}
              className="input"
            >
              <option value="">All Users</option>
              <option value="admin">admin</option>
              <option value="accountant">accountant</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Module</label>
            <select
              value={filters.module}
              onChange={(e) => setFilters({ ...filters, module: e.target.value })}
              className="input"
            >
              <option value="">All Modules</option>
              <option value="Auth">Auth</option>
              <option value="Voucher">Voucher</option>
              <option value="Ledger">Ledger</option>
              <option value="Customer">Customer</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Action</label>
            <select
              value={filters.action}
              onChange={(e) => setFilters({ ...filters, action: e.target.value })}
              className="input"
            >
              <option value="">All Actions</option>
              <option value="create">Create</option>
              <option value="update">Update</option>
              <option value="delete">Delete</option>
              <option value="login">Login</option>
              <option value="logout">Logout</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="w-8 px-6 py-3"></th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Timestamp
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                User
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Action
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Module
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Record ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Description
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {logs.map((log) => (
              <React.Fragment key={log.id}>
                <tr className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    {(log.oldValue || log.newValue) && (
                      <button
                        onClick={() => toggleRow(log.id)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        {expandedRows.has(log.id) ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </button>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {log.timestamp}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {log.user}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">{getActionBadge(log.action)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {log.module}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {log.recordId}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{log.description}</td>
                </tr>
                {expandedRows.has(log.id) && (
                  <tr>
                    <td colSpan={7} className="px-6 py-4 bg-gray-50">
                      {renderDiff(log.oldValue, log.newValue)}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
