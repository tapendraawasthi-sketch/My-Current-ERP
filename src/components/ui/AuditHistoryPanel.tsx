import React, { useState, useEffect } from "react";
import { Clock, AlertTriangle, User, Download } from "lucide-react";
import { getDB } from "../../lib/db";
import { exportToExcel as rawExportExcel } from "../../lib/exportUtils";

interface Props {
  entityId: string;
}

// Minimal computeDiff for the history panel
const computeDiff = (oldObj: any, newObj: any) => {
  const changes: any[] = [];
  if (!oldObj || !newObj) return changes;

  const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);
  allKeys.forEach((key) => {
    if (key === "updatedAt" || key === "createdAt" || key === "id") return;
    const oldVal = oldObj[key];
    const newVal = newObj[key];

    if (oldVal === undefined && newVal !== undefined) {
      changes.push({ field: key, oldValue: null, newValue: newVal, changeType: "added" });
    } else if (newVal === undefined && oldVal !== undefined) {
      changes.push({ field: key, oldValue: oldVal, newValue: null, changeType: "removed" });
    } else if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      changes.push({ field: key, oldValue: oldVal, newValue: newVal, changeType: "changed" });
    }
  });
  return changes;
};

const formatDiffValue = (val: any) => {
  if (val === null || val === undefined) return "—";
  if (typeof val === "object") return JSON.stringify(val);
  return String(val);
};

const actionClass = (action: string) => {
  const a = String(action || "").toLowerCase();
  if (a.includes("create")) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (a.includes("update")) return "bg-blue-50 text-blue-700 border-blue-200";
  if (a.includes("delete")) return "bg-red-50 text-red-700 border-red-200";
  return "bg-gray-50 text-gray-700 border-gray-200";
};

export const AuditHistoryPanel: React.FC<Props> = ({ entityId }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    if (!entityId) return;

    const fetchHistory = async () => {
      setLoading(true);
      setError(null);
      try {
        const db = getDB();
        let rows: any[] = [];

        // Try to get audit logs for this entity
        if (db.auditLogs?.where) {
          rows = await db.auditLogs.where("entityId").equals(entityId).toArray();
        } else {
          const allLogs = await db.auditLogs.toArray();
          rows = allLogs.filter((r: any) => r.entityId === entityId);
        }

        // Sort by timestamp ascending
        rows.sort(
          (a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
        );

        setHistory(rows);
      } catch (err) {
        console.error("Error fetching voucher history:", err);
        setError("Could not load audit history. " + (err as Error).message);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [entityId]);

  const firstEvent = history.length > 0 ? history[0] : null;
  const lastEvent = history.length > 1 ? history[history.length - 1] : null;

  const exportToExcel = () => {
    rawExportExcel(history, `History_${entityId}.xlsx`);
  };

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="flex-1 overflow-y-auto p-4">
        {loading && (
          <div className="flex items-center gap-2 text-[12px] text-gray-600">
            <Clock className="h-4 w-4 animate-spin" /> Loading history...
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3 text-[12px] text-red-700">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <div>{error}</div>
            </div>
          </div>
        )}

        {!loading && !error && (
          <>
            {history.length === 0 ? (
              <div className="text-center py-8 text-[12px] text-gray-500">
                No audit history found for this record. History will be recorded for future edits.
              </div>
            ) : (
              <div className="space-y-6">
                <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                  <p className="text-[11px] font-semibold text-blue-700">SUMMARY</p>
                  <p className="text-[12px] text-gray-700">
                    Created by{" "}
                    <span className="font-medium">
                      {firstEvent?.userName || firstEvent?.user || "System"}
                    </span>{" "}
                    on {firstEvent ? new Date(firstEvent.timestamp).toLocaleDateString() : "—"}
                  </p>
                  {lastEvent && lastEvent !== firstEvent && (
                    <p className="text-[12px] text-gray-700">
                      Last modified by{" "}
                      <span className="font-medium">
                        {lastEvent.userName || lastEvent?.user || "System"}
                      </span>{" "}
                      on {new Date(lastEvent.timestamp).toLocaleDateString()}
                    </p>
                  )}
                </div>

                <div className="relative pl-6 border-l-2 border-gray-200 space-y-6">
                  {history.map((event, index) => {
                    const diffs =
                      event.before && event.after ? computeDiff(event.before, event.after) : [];
                    return (
                      <div key={index} className="relative">
                        <div className="absolute -left-9 top-1 w-4 h-4 rounded-full bg-[var(--ds-action-primary)] border-4 border-white"></div>
                        <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] text-gray-500">
                                {new Date(event.timestamp).toLocaleString()}
                              </span>
                              <span
                                className={`inline-flex px-1.5 py-0.5 rounded border text-[10px] font-medium ${actionClass(event.action)}`}
                              >
                                {event.action}
                              </span>
                            </div>
                            <span className="text-[11px] text-gray-500 flex items-center gap-1">
                              <User className="h-3 w-3" /> {event.userName || event.user}
                            </span>
                          </div>
                          <p className="text-[12px] text-gray-700 mt-1">
                            {event.narration || event.description}
                          </p>
                          {diffs.length > 0 && (
                            <div className="mt-2 bg-gray-50 rounded border border-gray-200 overflow-hidden">
                              <table className="w-full text-[11px]">
                                <thead>
                                  <tr className="bg-gray-100">
                                    <th className="text-left px-2 py-1 text-[10px] font-semibold text-gray-500 uppercase w-1/4">
                                      Field
                                    </th>
                                    <th className="text-left px-2 py-1 text-[10px] font-semibold text-red-500 uppercase w-[37.5%]">
                                      Before
                                    </th>
                                    <th className="text-left px-2 py-1 text-[10px] font-semibold text-emerald-600 uppercase w-[37.5%]">
                                      After
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {diffs.map((d, i) => (
                                    <tr key={i} className="border-t border-gray-200">
                                      <td className="px-2 py-1 font-medium text-gray-700 capitalize">
                                        {d.field.replace(/_/g, " ")}
                                      </td>
                                      <td className="px-2 py-1">
                                        {d.changeType === "added" ? (
                                          <span className="text-gray-400 italic">—</span>
                                        ) : (
                                          <span className="text-red-600 line-through opacity-70">
                                            {formatDiffValue(d.oldValue)}
                                          </span>
                                        )}
                                      </td>
                                      <td className="px-2 py-1">
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
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div className="flex items-center justify-between p-4 border-t border-gray-200">
        <div></div>
        <button
          className="h-8 px-3 bg-[var(--ds-action-primary)] hover:bg-[var(--ds-action-primary-hover)] text-white text-[11px] font-medium rounded-md flex items-center gap-1.5"
          onClick={exportToExcel}
          disabled={loading}
        >
          <Download className="h-3 w-3" /> Export History
        </button>
      </div>
    </div>
  );
};

export default AuditHistoryPanel;
