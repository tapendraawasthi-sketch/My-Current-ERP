import React, { useEffect, useState } from "react";
import { getDB } from "../lib/db";

export default function Troubleshooting() {
  const [stats, setStats] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const db = getDB();
      const tables = db.tables;
      const newStats: Record<string, number> = {};

      for (const table of tables) {
        newStats[table.name] = await table.count();
      }
      setStats(newStats);
    } catch (error) {
      console.error("Failed to fetch DB stats:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleClearCache = () => {
    if (
      window.confirm(
        "Are you sure you want to clear local storage and reload? This will log you out.",
      )
    ) {
      localStorage.clear();
      sessionStorage.clear();
      window.location.reload();
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800">Troubleshooting</h1>
          <p className="text-[11px] text-gray-500 mt-0.5">System diagnostics and utilities</p>
        </div>
      </div>

      <div className="bg-white rounded-md border border-gray-200 p-4 mb-6">
        <h2 className="text-[13px] font-semibold text-gray-800 mb-3">System Actions</h2>
        <div className="flex gap-3">
          <button
            onClick={handleClearCache}
            className="h-8 px-3 bg-red-600 hover:bg-red-700 text-white text-[12px] font-medium rounded-md transition-colors"
          >
            Clear Cache & Reload
          </button>
          <button
            onClick={fetchStats}
            className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 transition-colors"
          >
            Refresh Stats
          </button>
        </div>
      </div>

      <div className="bg-white rounded-md border border-gray-200 p-4">
        <h2 className="text-[13px] font-semibold text-gray-800 mb-3">Database Statistics</h2>
        {loading ? (
          <div className="text-[12px] text-gray-500">Loading database statistics...</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {Object.entries(stats)
              .sort((a, b) => b[1] - a[1])
              .map(([table, count]) => (
                <div
                  key={table}
                  className="bg-gray-50 p-3 rounded border border-gray-100 flex flex-col"
                >
                  <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide truncate">
                    {table}
                  </span>
                  <span className="text-[15px] font-semibold text-gray-800 mt-1">{count}</span>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
