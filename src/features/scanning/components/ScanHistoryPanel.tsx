/**
 * scanning/components/ScanHistoryPanel.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Slide-in panel showing past scan sessions.
 */

import React, { useState } from "react";
import { useScanHistory } from "../hooks/useScanHistory";
import type { ScanSession } from "../types";

interface ScanHistoryPanelProps {
  open: boolean;
  onClose: () => void;
}

export const ScanHistoryPanel: React.FC<ScanHistoryPanelProps> = ({
  open,
  onClose,
}) => {
  const { history, stats, clearHistory } = useScanHistory();
  const [expanded, setExpanded] = useState<string | null>(null);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/20"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative w-[420px] max-w-full bg-white border-l border-gray-200 h-full flex flex-col shadow-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-[#f5f6fa]">
          <div>
            <h2 className="text-[15px] font-semibold text-gray-800">Scan History</h2>
            <p className="text-[11px] text-gray-500 mt-0.5">
              {stats.sessions} sessions · {stats.total} scans · {stats.errors} errors
            </p>
          </div>
          <div className="flex items-center gap-2">
            {history.length > 0 && (
              <button
                id="clear-scan-history-btn"
                onClick={clearHistory}
                className="h-7 px-2.5 bg-white border border-gray-300 text-gray-700 text-[11px] font-medium rounded-md hover:bg-gray-50"
              >
                Clear
              </button>
            )}
            <button
              id="close-scan-history-btn"
              onClick={onClose}
              className="h-7 px-2 text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {history.length === 0 ? (
            <p className="text-[12px] text-gray-400 text-center mt-8">
              No scan history yet.
            </p>
          ) : (
            history.map((session) => (
              <SessionRow
                key={session.sessionId}
                session={session}
                expanded={expanded === session.sessionId}
                onToggle={() =>
                  setExpanded(
                    expanded === session.sessionId ? null : session.sessionId
                  )
                }
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Session Row ──────────────────────────────────────────────────────────────

const SessionRow: React.FC<{
  session: ScanSession;
  expanded: boolean;
  onToggle: () => void;
}> = ({ session, expanded, onToggle }) => {
  const duration = session.endedAt
    ? Math.round(
        (new Date(session.endedAt).getTime() -
          new Date(session.startedAt).getTime()) /
          1000
      )
    : null;

  return (
    <div className="border border-gray-200 rounded-md overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-gray-50 transition-colors"
        onClick={onToggle}
      >
        <div>
          <div className="text-[12px] font-medium text-gray-800">
            {session.mode} · {session.source}
          </div>
          <div className="text-[10px] text-gray-400 mt-0.5">
            {new Date(session.startedAt).toLocaleString()}
            {duration !== null && <> · {duration}s</>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-gray-600">{session.totalScans} scans</span>
          {session.errorCount > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-red-100 text-red-700 rounded">
              {session.errorCount} err
            </span>
          )}
          <span className="text-gray-400">{expanded ? "▲" : "▼"}</span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-100 px-3 py-2 space-y-1.5 bg-gray-50">
          {session.results.length === 0 ? (
            <p className="text-[11px] text-gray-400">No results in this session.</p>
          ) : (
            session.results.map((r) => (
              <div key={r.id} className="text-[11px] text-gray-700 font-mono break-all border-b border-gray-100 pb-1 last:border-0">
                {r.rawValue}
                <span className="text-gray-400 ml-2 font-sans">
                  {new Date(r.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
