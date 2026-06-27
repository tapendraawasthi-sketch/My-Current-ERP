// src/pages/AuditLog.tsx
// @ts-nocheck
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ShieldCheck, Search, AlertTriangle, Download, Filter,
  ChevronDown, ChevronUp, Eye, RefreshCw, Clock, User,
} from 'lucide-react';
import { getDB } from '../lib/db';
import { useStore } from '../store';
import toast from 'react-hot-toast';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuditChange { field: string; oldValue: unknown; newValue: unknown }

interface AuditLogEntry {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  action: string;
  entityType: string;
  entityId?: string;
  entityNo?: string;
  changes?: AuditChange[];
  amount?: number;
  ipAddress?: string;
  sessionId?: string;
  notes?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ACTION_BADGE: Record<string, string> = {
  create:           'bg-green-100 text-green-700 border border-green-200',
  edit:             'bg-amber-100 text-amber-700 border border-amber-200',
  delete:           'bg-red-100 text-red-700 border border-red-200',
  login:            'bg-blue-100 text-blue-700 border border-blue-200',
  logout:           'bg-gray-100 text-gray-600 border border-gray-200',
  export:           'bg-purple-100 text-purple-700 border border-purple-200',
  print:            'bg-indigo-100 text-indigo-700 border border-indigo-200',
  approve:          'bg-emerald-100 text-emerald-700 border border-emerald-200',
  reject:           'bg-rose-100 text-rose-700 border border-rose-200',
  cancel:           'bg-orange-100 text-orange-700 border border-orange-200',
  permission_change:'bg-yellow-100 text-yellow-800 border border-yellow-200',
};

const ALL_ACTIONS = ['create','edit','delete','login','logout','export','print','approve','reject','cancel','permission_change'];
const ALL_ENTITY_TYPES = [
  'salesVoucher','purchaseVoucher','paymentVoucher','receiptVoucher',
  'journalVoucher','contraVoucher','creditNote','debitNote',
  'ledger','party','item','user','system','companySettings',
];

// Suspicious patterns — thresholds
const SUSPICIOUS_AMOUNT = 500000;    // Rs. 5L+
const SUSPICIOUS_DELETE_WINDOW_MINS = 10; // many deletes in short time

// ─── Sub-components ───────────────────────────────────────────────────────────

const DiffViewer: React.FC<{ changes: AuditChange[] }> = ({ changes }) => {
  if (!changes || changes.length === 0) return <span className="text-[11px] text-gray-400">—</span>;
  return (
    <div className="space-y-1 mt-1">
      {changes.map((c, i) => (
        <div key={i} className="text-[10px] flex flex-wrap gap-1 items-center">
          <span className="font-semibold text-gray-600 bg-gray-100 px-1 rounded">{c.field}</span>
          {c.oldValue !== undefined && c.oldValue !== null && (
            <span className="bg-red-50 text-red-600 line-through px-1 rounded font-mono max-w-[180px] truncate" title={String(c.oldValue)}>
              {typeof c.oldValue === 'object' ? '[object]' : String(c.oldValue)}
            </span>
          )}
          <span className="text-gray-400">→</span>
          {c.newValue !== undefined && c.newValue !== null && (
            <span className="bg-green-50 text-green-700 px-1 rounded font-mono max-w-[180px] truncate" title={String(c.newValue)}>
              {typeof c.newValue === 'object' ? '[object]' : String(c.newValue)}
            </span>
          )}
        </div>
      ))}
    </div>
  );
};

const ExpandableRow: React.FC<{
  log: AuditLogEntry;
  isSuspicious?: boolean;
  reason?: string;
}> = ({ log, isSuspicious, reason }) => {
  const [expanded, setExpanded] = useState(false);
  const hasChanges = log.changes && log.changes.length > 0;

  return (
    <>
      <tr
        className={`border-b border-[#9DC07A] transition-colors ${
          isSuspicious ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-[#EBF5E2]'
        }`}
      >
        <td className="px-3 py-2.5 text-[11px] text-gray-500 font-mono whitespace-nowrap">
          {new Date(log.timestamp).toLocaleString('en-NP', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit',
          })}
        </td>
        <td className="px-3 py-2.5">
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-full bg-[#D4EABD] flex items-center justify-center text-[10px] font-bold text-[#2D5A1A] shrink-0">
              {(log.userName || 'S').charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="text-[12px] font-medium text-gray-800">{log.userName || '—'}</div>
              <div className="text-[10px] text-gray-400">{log.userId}</div>
            </div>
          </div>
        </td>
        <td className="px-3 py-2.5">
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${ACTION_BADGE[log.action] || 'bg-gray-100 text-gray-600'}`}>
            {log.action}
          </span>
        </td>
        <td className="px-3 py-2.5">
          <div className="text-[12px] font-medium text-gray-800 capitalize">{log.entityType}</div>
          {log.entityNo && <div className="text-[10px] text-[#1557b0] font-mono">{log.entityNo}</div>}
        </td>
        <td className="px-3 py-2.5 text-right text-[11px] font-mono text-gray-700">
          {log.amount ? `Rs. ${log.amount.toLocaleString('en-IN')}` : '—'}
        </td>
        <td className="px-3 py-2.5 text-[11px] text-gray-600 max-w-[200px] truncate">
          {isSuspicious && (
            <div className="flex items-center gap-1 text-red-600 font-medium text-[10px] mb-0.5">
              <AlertTriangle className="w-3 h-3" /> {reason}
            </div>
          )}
          {log.notes && <span>{log.notes}</span>}
        </td>
        <td className="px-3 py-2.5 text-right">
          {hasChanges && (
            <button
              onClick={() => setExpanded((e) => !e)}
              className="p-1 text-gray-400 hover:text-[#3D6B25] rounded"
              title="View field changes"
            >
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          )}
        </td>
      </tr>
      {expanded && hasChanges && (
        <tr className="bg-gray-50 border-b border-[#9DC07A]">
          <td colSpan={7} className="px-4 py-2">
            <div className="text-[10px] font-semibold text-gray-500 uppercase mb-1">Field Changes</div>
            <DiffViewer changes={log.changes!} />
          </td>
        </tr>
      )}
    </>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AuditLog() {
  const { currentUser } = useStore();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'suspicious'>('all');

  // Filters
  const [search, setSearch]         = useState('');
  const [filterUser, setFilterUser] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [filterEntity, setFilterEntity] = useState('');
  const [fromDate, setFromDate]     = useState('');
  const [toDate, setToDate]         = useState('');
  const [page, setPage]             = useState(1);
  const PAGE_SIZE = 50;

  // ── Load logs ──────────────────────────────────────────────────────────────
  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const db = getDB() as any;
      const all: AuditLogEntry[] = await db.auditLogs
        .orderBy('timestamp')
        .reverse()
        .toArray();
      setLogs(all);
    } catch (err) {
      console.error('AuditLog load error:', err);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  // ── Unique users for filter ────────────────────────────────────────────────
  const uniqueUsers = useMemo(() => {
    const set = new Set(logs.map((l) => l.userName).filter(Boolean));
    return [...set].sort();
  }, [logs]);

  // ── Filtered logs ──────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return logs.filter((l) => {
      if (filterUser && l.userName !== filterUser) return false;
      if (filterAction && l.action !== filterAction) return false;
      if (filterEntity && l.entityType !== filterEntity) return false;
      if (fromDate && l.timestamp < fromDate) return false;
      if (toDate && l.timestamp > toDate + 'T23:59:59') return false;
      if (search) {
        const s = search.toLowerCase();
        const match =
          l.userName?.toLowerCase().includes(s) ||
          l.entityType?.toLowerCase().includes(s) ||
          l.entityNo?.toLowerCase().includes(s) ||
          l.action?.toLowerCase().includes(s) ||
          l.notes?.toLowerCase().includes(s);
        if (!match) return false;
      }
      return true;
    });
  }, [logs, filterUser, filterAction, filterEntity, fromDate, toDate, search]);

  // ── Suspicious activity detection ─────────────────────────────────────────
  const suspicious = useMemo(() => {
    const flagged: { log: AuditLogEntry; reason: string }[] = [];
    const deletesByUser: Map<string, AuditLogEntry[]> = new Map();

    for (const log of logs) {
      const reasons: string[] = [];

      // Large amount
      if (log.amount && log.amount >= SUSPICIOUS_AMOUNT) {
        reasons.push(`High-value transaction: Rs. ${log.amount.toLocaleString('en-IN')}`);
      }
      // Backdated entry
      if (log.action === 'create' && log.notes?.includes('backdated')) {
        reasons.push('Back-dated voucher entry');
      }
      // Delete actions
      if (log.action === 'delete') {
        const arr = deletesByUser.get(log.userId) || [];
        arr.push(log);
        deletesByUser.set(log.userId, arr);
      }
      // Permission changes (non-admin making changes)
      if (log.action === 'permission_change') {
        reasons.push('Permission profile modified');
      }
      // Login outside business hours (before 8AM or after 8PM)
      if (log.action === 'login') {
        const hr = new Date(log.timestamp).getHours();
        if (hr < 8 || hr >= 20) {
          reasons.push(`Login at unusual hour: ${new Date(log.timestamp).toLocaleTimeString()}`);
        }
      }

      if (reasons.length > 0) {
        flagged.push({ log, reason: reasons.join(' · ') });
      }
    }

    // Multiple deletes within window
    for (const [, dels] of deletesByUser) {
      if (dels.length < 3) continue;
      // Sort by time and find clusters
      const sorted = [...dels].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
      for (let i = 0; i < sorted.length - 2; i++) {
        const t0 = new Date(sorted[i].timestamp).getTime();
        const t2 = new Date(sorted[i + 2].timestamp).getTime();
        if ((t2 - t0) / 60000 <= SUSPICIOUS_DELETE_WINDOW_MINS) {
          // Mark all three
          for (let j = i; j <= i + 2; j++) {
            const existing = flagged.find((f) => f.log.id === sorted[j].id);
            if (existing) {
              existing.reason += ' · Multiple deletes in short period';
            } else {
              flagged.push({ log: sorted[j], reason: 'Multiple deletes in short period' });
            }
          }
          break;
        }
      }
    }

    return flagged;
  }, [logs]);

  // ── Pagination ─────────────────────────────────────────────────────────────
  const displayLogs = activeTab === 'suspicious'
    ? suspicious.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
    : filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.ceil(
    (activeTab === 'suspicious' ? suspicious.length : filtered.length) / PAGE_SIZE
  );

  // ── Reset page on filter change ───────────────────────────────────────────
  useEffect(() => setPage(1), [search, filterUser, filterAction, filterEntity, fromDate, toDate, activeTab]);

  // ── Export to Excel ────────────────────────────────────────────────────────
  const exportToExcel = async () => {
    try {
      const XLSX = await import('xlsx');
      const rows = filtered.map((l) => ({
        Timestamp: new Date(l.timestamp).toLocaleString(),
        User: l.userName,
        UserID: l.userId,
        Action: l.action.toUpperCase(),
        EntityType: l.entityType,
        EntityNo: l.entityNo || '',
        Amount: l.amount || '',
        SessionID: l.sessionId || '',
        Notes: l.notes || '',
        Changes: l.changes ? l.changes.map((c) => `${c.field}: ${c.oldValue} → ${c.newValue}`).join(' | ') : '',
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'AuditLog');
      XLSX.writeFile(wb, `AuditLog_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success('Audit log exported to Excel');
    } catch {
      toast.error('Excel export failed');
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-[15px] font-semibold text-[#000000] flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#3D6B25]" />
            Secure Audit Trail
          </h1>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Immutable compliance ledger — all actions logged, none can be deleted
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadLogs}
            className="h-8 px-3 bg-white border border-[#9DC07A] text-[#000000] text-[12px] rounded-md flex items-center gap-1.5 hover:bg-[#EBF5E2]"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
          <button
            onClick={exportToExcel}
            className="h-8 px-3 bg-[#3D6B25] hover:bg-[#2D5A1A] text-white text-[12px] rounded-md flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" /> Export Excel
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-[#9DC07A]">
        {(['all', 'suspicious'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-[12px] font-medium border-b-2 -mb-px transition-colors ${
              activeTab === tab
                ? 'border-[#3D6B25] text-[#3D6B25]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab === 'all' ? `All Logs (${filtered.length})` : (
              <span className="flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                Suspicious Activity {suspicious.length > 0 && (
                  <span className="bg-red-500 text-white text-[9px] rounded-full px-1.5 py-0.5 font-bold">
                    {suspicious.length}
                  </span>
                )}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Filters (only on All tab) */}
      {activeTab === 'all' && (
        <div className="bg-[#f5f6fa] border border-[#9DC07A] rounded-lg p-3 mb-4 flex flex-wrap gap-2 items-center">
          <Filter className="w-3.5 h-3.5 text-gray-400 shrink-0" />

          {/* Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search logs..."
              className="h-7 pl-8 pr-2.5 text-[11px] border border-[#9DC07A] rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-[#3D6B25] w-44"
            />
          </div>

          {/* User filter */}
          <select
            value={filterUser}
            onChange={(e) => setFilterUser(e.target.value)}
            className="h-7 px-2 text-[11px] border border-[#9DC07A] rounded-md bg-white focus:outline-none w-36"
          >
            <option value="">All Users</option>
            {uniqueUsers.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>

          {/* Action filter */}
          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="h-7 px-2 text-[11px] border border-[#9DC07A] rounded-md bg-white focus:outline-none w-36"
          >
            <option value="">All Actions</option>
            {ALL_ACTIONS.map((a) => (
              <option key={a} value={a}>{a.toUpperCase()}</option>
            ))}
          </select>

          {/* Entity filter */}
          <select
            value={filterEntity}
            onChange={(e) => setFilterEntity(e.target.value)}
            className="h-7 px-2 text-[11px] border border-[#9DC07A] rounded-md bg-white focus:outline-none w-40"
          >
            <option value="">All Entity Types</option>
            {ALL_ENTITY_TYPES.map((e) => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>

          {/* Date range */}
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="h-7 px-2 text-[11px] border border-[#9DC07A] rounded-md bg-white focus:outline-none"
          />
          <span className="text-[11px] text-gray-400">to</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="h-7 px-2 text-[11px] border border-[#9DC07A] rounded-md bg-white focus:outline-none"
          />

          {(search || filterUser || filterAction || filterEntity || fromDate || toDate) && (
            <button
              onClick={() => { setSearch(''); setFilterUser(''); setFilterAction(''); setFilterEntity(''); setFromDate(''); setToDate(''); }}
              className="h-7 px-2 text-[11px] text-red-600 border border-red-200 rounded-md hover:bg-red-50"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {/* Suspicious banner */}
      {activeTab === 'suspicious' && suspicious.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
          <div>
            <div className="text-[12px] font-semibold text-red-700">
              {suspicious.length} suspicious event(s) detected
            </div>
            <div className="text-[11px] text-red-600 mt-0.5">
              Flagged for: high-value transactions, unusual login times, bulk deletions, and permission changes.
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border border-[#9DC07A] overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead className="bg-[#f5f6fa] border-b border-[#9DC07A]">
            <tr>
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Timestamp</th>
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">User</th>
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Action</th>
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Entity / Ref</th>
              <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Amount</th>
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Notes / Flags</th>
              <th className="px-3 py-2.5 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-[12px] text-gray-400">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-[#3D6B25] border-t-transparent rounded-full animate-spin" />
                    Loading audit logs...
                  </div>
                </td>
              </tr>
            ) : displayLogs.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-[12px] text-gray-400">
                  {activeTab === 'suspicious'
                    ? '✓ No suspicious activity detected'
                    : 'No audit logs found for the selected filters'}
                </td>
              </tr>
            ) : activeTab === 'suspicious' ? (
              (displayLogs as { log: AuditLogEntry; reason: string }[]).map(({ log, reason }) => (
                <ExpandableRow key={log.id} log={log} isSuspicious reason={reason} />
              ))
            ) : (
              (displayLogs as AuditLogEntry[]).map((log) => (
                <ExpandableRow key={log.id} log={log} />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-3">
          <span className="text-[11px] text-gray-500">
            Showing {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, activeTab === 'suspicious' ? suspicious.length : filtered.length)} of {activeTab === 'suspicious' ? suspicious.length : filtered.length}
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="h-7 px-3 text-[11px] border border-[#9DC07A] rounded-md disabled:opacity-40 hover:bg-[#EBF5E2]"
            >
              ‹ Prev
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const start = Math.max(1, page - 2);
              const p = start + i;
              if (p > totalPages) return null;
              return (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`h-7 px-3 text-[11px] border rounded-md ${
                    p === page
                      ? 'bg-[#3D6B25] text-white border-[#3D6B25]'
                      : 'border-[#9DC07A] hover:bg-[#EBF5E2]'
                  }`}
                >
                  {p}
                </button>
              );
            })}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="h-7 px-3 text-[11px] border border-[#9DC07A] rounded-md disabled:opacity-40 hover:bg-[#EBF5E2]"
            >
              Next ›
            </button>
          </div>
        </div>
      )}

      {/* Immutability notice */}
      <div className="mt-4 bg-[#EBF5E2] border border-[#9DC07A] rounded-lg p-3 text-[11px] text-gray-600 flex items-center gap-2">
        <ShieldCheck className="w-3.5 h-3.5 text-[#3D6B25] shrink-0" />
        Audit logs are write-once and cannot be modified or deleted by any user, including administrators.
        They are your company's legal compliance record.
      </div>
    </div>
  );
}
