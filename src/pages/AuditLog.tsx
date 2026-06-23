import React, { useState, useMemo } from "react";
import { useStore } from "../store/useStore";
import { Search, Download, ChevronDown, ChevronRight, FileText } from "lucide-react";
import { Card, Badge, Input, Select, Button } from "../components/ui";

export default function AuditLog() {
  const { auditLogs } = useStore();
  const [filters, setFilters] = useState({
    startDate: "",
    endDate: "",
    user: "",
    module: "",
    action: "",
    search: "",
  });
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const filteredLogs = useMemo(() => {
    return auditLogs.filter((log) => {
      const date = log.timestamp.split("T")[0];
      if (filters.startDate && date < filters.startDate) return false;
      if (filters.endDate && date > filters.endDate) return false;
      if (filters.user && log.userName !== filters.user && log.userId !== filters.user) return false;
      if (filters.module && log.module !== filters.module) return false;
      if (filters.action && log.action !== filters.action) return false;
      if (
        filters.search &&
        !log.recordId?.toLowerCase().includes(filters.search.toLowerCase()) &&
        !log.recordType?.toLowerCase().includes(filters.search.toLowerCase())
      ) {
        return false;
      }
      return true;
    }).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }, [auditLogs, filters]);

  const uniqueUsers = useMemo(() => Array.from(new Set(auditLogs.map(l => l.userName))), [auditLogs]);
  const uniqueModules = useMemo(() => Array.from(new Set(auditLogs.map(l => l.module))), [auditLogs]);
  const uniqueActions = useMemo(() => Array.from(new Set(auditLogs.map(l => l.action))), [auditLogs]);

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
      ["Timestamp", "User", "Action", "Module", "Record ID", "Record Type", "Old Value", "New Value"],
      ...filteredLogs.map((log) => [
        log.timestamp,
        log.userName,
        log.action,
        log.module,
        log.recordId || "-",
        log.recordType || "-",
        log.oldValue ? JSON.stringify(log.oldValue).replace(/,/g, ";") : "",
        log.newValue ? JSON.stringify(log.newValue).replace(/,/g, ";") : "",
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
    let oldJson = "", newJson = "";
    try { oldJson = typeof oldVal === "string" ? oldVal : JSON.stringify(oldVal, null, 2); } catch {}
    try { newJson = typeof newVal === "string" ? newVal : JSON.stringify(newVal, null, 2); } catch {}

    return (
      <div className="grid grid-cols-2 gap-4 font-mono text-xs">
        {oldJson && (
          <div>
            <h4 className="font-semibold text-red-600 mb-2">Old Value:</h4>
            <pre className="bg-red-50 p-3 rounded border border-red-200 overflow-auto max-h-[300px]">
              {oldJson}
            </pre>
          </div>
        )}
        {newJson && (
          <div>
            <h4 className="font-semibold text-green-600 mb-2">New Value:</h4>
            <pre className="bg-green-50 p-3 rounded border border-green-200 overflow-auto max-h-[300px]">
              {newJson}
            </pre>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="page-wrapper">
      <div className="page-toolbar">
        <div className="page-toolbar-left">
          <div className="page-title">Audit Log</div>
          <div className="page-subtitle">Immutable system activity and change history</div>
        </div>
        <div className="page-toolbar-right">
          <Button variant="outline" onClick={handleExport}>
            <Download className="w-4 h-4 mr-1" />
            Export CSV
          </Button>
        </div>
      </div>

      <div className="page-content-area">
        <Card className="mb-4">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <div className="col-span-2">
              <Input
                label="Search Records"
                value={filters.search}
                onChange={(v) => setFilters({ ...filters, search: v })}
                placeholder="Search by ID or Type..."
              />
            </div>
            <Input
              label="Start Date"
              type="date"
              value={filters.startDate}
              onChange={(v) => setFilters({ ...filters, startDate: v })}
            />
            <Input
              label="End Date"
              type="date"
              value={filters.endDate}
              onChange={(v) => setFilters({ ...filters, endDate: v })}
            />
            <Select
              label="User"
              value={filters.user}
              onChange={(v) => setFilters({ ...filters, user: v })}
              options={[
                { value: "", label: "All Users" },
                ...uniqueUsers.map(u => ({ value: u, label: u }))
              ]}
            />
            <Select
              label="Module"
              value={filters.module}
              onChange={(v) => setFilters({ ...filters, module: v })}
              options={[
                { value: "", label: "All Modules" },
                ...uniqueModules.map(m => ({ value: m, label: m }))
              ]}
            />
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="w-8"></th>
                  <th>Timestamp</th>
                  <th>User</th>
                  <th>Action</th>
                  <th>Module</th>
                  <th>Record Type</th>
                  <th>Record ID</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-gray-500 text-[13px]">
                      No audit logs match the current filters.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => (
                    <React.Fragment key={log.id}>
                      <tr>
                        <td className="text-center">
                          {(log.oldValue || log.newValue) && (
                            <button
                              onClick={() => toggleRow(log.id)}
                              className="text-gray-400 hover:text-gray-600 focus:outline-none"
                            >
                              {expandedRows.has(log.id) ? (
                                <ChevronDown className="w-4 h-4" />
                              ) : (
                                <ChevronRight className="w-4 h-4" />
                              )}
                            </button>
                          )}
                        </td>
                        <td>
                          {new Date(log.timestamp).toLocaleDateString()}{" "}
                          <span className="text-[10px] text-gray-400">
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </span>
                        </td>
                        <td className="font-medium">{log.userName}</td>
                        <td>{getActionBadge(log.action)}</td>
                        <td>{log.module}</td>
                        <td className="capitalize">{log.recordType?.replace("_", " ") || "-"}</td>
                        <td className="font-mono text-gray-600">{log.recordId || "-"}</td>
                      </tr>
                      {expandedRows.has(log.id) && (
                        <tr>
                          <td colSpan={7} className="bg-gray-50 border-b border-gray-200">
                            <div className="p-4">
                              {renderDiff(log.oldValue, log.newValue)}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
