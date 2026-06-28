// @ts-nocheck
import React, { useEffect, useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import { getDB, generateId } from "../lib/db";
import * as XLSX from "xlsx";
import toast from "react-hot-toast";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Database,
  Download,
  Eye,
  FileDown,
  Filter,
  History,
  Info,
  KeyRound,
  Lock,
  RefreshCcw,
  Search,
  Shield,
  Trash2,
  Unlock,
  User,
  XCircle,
  X
} from "lucide-react";

const money = (v: any) =>
  `Rs. ${Number(v || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const btn =
  "inline-flex items-center justify-center gap-2 h-8 px-3 rounded-md bg-[#1557b0] text-white text-[12px] font-medium hover:bg-[#0f4a96] disabled:opacity-50 disabled:cursor-not-allowed transition-colors";
const btn2 =
  "inline-flex items-center justify-center gap-2 h-8 px-3 rounded-md bg-white border border-gray-300 text-gray-700 text-[12px] font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors";
const btnDanger =
  "inline-flex items-center justify-center gap-2 h-8 px-3 rounded-md bg-red-600 text-white text-[12px] font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors";
const input =
  "w-full h-8 px-2.5 rounded-md border border-gray-300 bg-white text-[12px] text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#1557b0]/20 focus:border-[#1557b0]";
const card =
  "bg-white border border-gray-200 rounded-lg shadow-sm p-4 text-gray-800";
const th =
  "px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide bg-[#f5f6fa] border-b border-gray-200";
const td =
  "px-3 py-2.5 text-[12px] text-gray-700 border-b border-gray-200 align-top";

const todayISO = () => new Date().toISOString().slice(0, 10);
const nowISO = () => new Date().toISOString();

const tableAll = (db: any, name: string) => {
  try {
    const t = db?.[name];
    if (t?.toArray) return t.toArray().catch(() => []);
    return Promise.resolve([]);
  } catch {
    return Promise.resolve([]);
  }
};

const safeBulkPut = async (db: any, table: string, rows: any[]) => {
  try {
    if (!rows?.length) return;
    if (db?.[table]?.bulkPut) await db[table].bulkPut(rows);
  } catch {
    // silent fallback
  }
};

const actionClass = (action: string) => {
  const a = String(action || "").toLowerCase();
  if (a.includes("delete") || a.includes("remove") || a.includes("void"))
    return "bg-red-50 text-red-700 border-red-200";
  if (a.includes("login") || a.includes("access"))
    return "bg-blue-50 text-blue-700 border-blue-200";
  if (a.includes("lock") || a.includes("unlock"))
    return "bg-purple-50 text-purple-700 border-purple-200";
  if (a.includes("create") || a.includes("add") || a.includes("post"))
    return "bg-green-50 text-green-700 border-green-200";
  if (a.includes("update") || a.includes("edit") || a.includes("modify"))
    return "bg-amber-50 text-amber-700 border-amber-200";
  if (a.includes("export") || a.includes("print"))
    return "bg-indigo-50 text-indigo-700 border-indigo-200";
  return "bg-gray-50 text-gray-700 border-gray-200";
};

const riskClass = (risk: string) => {
  const r = String(risk || "").toLowerCase();
  if (r === "critical") return "bg-red-700 text-white border-red-800";
  if (r === "high") return "bg-red-50 text-red-700 border-red-200";
  if (r === "medium") return "bg-amber-50 text-amber-700 border-amber-200";
  if (r === "low") return "bg-green-50 text-green-700 border-green-200";
  return "bg-gray-50 text-gray-700 border-gray-200";
};

const inferRisk = (row: any) => {
  const a = String(row.action || row.event || row.type || "").toLowerCase();
  const module = String(row.module || "").toLowerCase();

  if (
    a.includes("delete") ||
    a.includes("void") ||
    a.includes("unlock") ||
    a.includes("restore") ||
    a.includes("security")
  )
    return "High";

  if (
    a.includes("failed") ||
    a.includes("denied") ||
    a.includes("blocked") ||
    module.includes("tax") ||
    module.includes("period lock")
  )
    return "Medium";

  if (a.includes("login") || a.includes("export") || a.includes("print"))
    return "Low";

  return row.risk || "Low";
};

const normalizeAuditRow = (row: any, source = "auditLogs") => {
  const timestamp =
    row.timestamp || row.createdAt || row.dateTime || row.time || row.date || nowISO();

  return {
    id: row.id || row._id || generateId(),
    timestamp,
    date: String(timestamp).slice(0, 10),
    userId: row.userId || row.uid || row.user || "",
    userName:
      row.userName || row.username || row.name || row.actor || row.user || "System",
    role: row.role || row.userRole || "",
    module: row.module || row.page || row.entity || row.area || "General",
    action: row.action || row.event || row.type || "Activity",
    entityType: row.entityType || row.table || row.model || "",
    entityId: row.entityId || row.recordId || row.refId || "",
    narration:
      row.narration || row.description || row.message || row.details || row.note || "",
    before: row.before || row.oldValue || row.oldData || null,
    after: row.after || row.newValue || row.newData || null,
    ipAddress: row.ipAddress || row.ip || row.clientIp || "",
    device: row.device || row.userAgent || row.browser || "",
    branchId: row.branchId || row.branch || "",
    status: row.status || (String(row.action || "").toLowerCase().includes("fail") ? "Failed" : "Success"),
    risk: row.risk || inferRisk(row),
    source,
    raw: row,
  };
};

const stringifySmall = (v: any) => {
  if (v === null || v === undefined || v === "") return "-";
  if (typeof v === "string") return v;
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
};

const dateInRange = (date: string, from: string, to: string) => {
  if (!date) return true;
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
};

const buildSystemAuditFromVouchers = (vouchers: any[], users: any[]) => {
  const userMap = Object.fromEntries((users || []).map((u) => [u.id, u]));
  return (vouchers || []).slice(-100).map((v) => {
    const u = userMap[v.createdBy] || userMap[v.userId] || {};
    return normalizeAuditRow(
      {
        id: `voucher-audit-${v.id}`,
        timestamp: v.createdAt || v.updatedAt || v.date || nowISO(),
        userId: v.createdBy || v.userId || "",
        userName: u.name || u.username || v.createdByName || "System",
        module: "Vouchers",
        action: v.status === "draft" ? "Draft Voucher Saved" : "Voucher Posted",
        entityType: "voucher",
        entityId: v.id,
        narration: `${v.type || "Voucher"} ${v.voucherNo || v.number || ""} ${money(v.total || v.amount || 0)}`,
        status: v.status === "cancelled" ? "Cancelled" : "Success",
        risk: v.status === "cancelled" ? "High" : "Low",
      },
      "vouchers"
    );
  });
};

const buildSystemAuditFromInvoices = (invoices: any[], users: any[]) => {
  const userMap = Object.fromEntries((users || []).map((u) => [u.id, u]));
  return (invoices || []).slice(-100).map((inv) => {
    const u = userMap[inv.createdBy] || userMap[inv.userId] || {};
    return normalizeAuditRow(
      {
        id: `invoice-audit-${inv.id}`,
        timestamp: inv.createdAt || inv.updatedAt || inv.date || nowISO(),
        userId: inv.createdBy || inv.userId || "",
        userName: u.name || u.username || inv.createdByName || "System",
        module: "Billing",
        action: inv.status === "cancelled" ? "Invoice Cancelled" : "Invoice Saved",
        entityType: "invoice",
        entityId: inv.id,
        narration: `${inv.invoiceNo || inv.number || ""} ${money(inv.grandTotal || inv.total || 0)}`,
        status: inv.status === "cancelled" ? "Cancelled" : "Success",
        risk: inv.status === "cancelled" ? "High" : "Low",
      },
      "invoices"
    );
  });
};

const groupBy = (arr: any[], key: string) =>
  arr.reduce((acc, r) => {
    const k = r[key] || "Unknown";
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});

const Modal = ({ open, title, children, onClose }: any) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h3 className="text-[15px] font-semibold text-gray-800">{title}</h3>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-gray-100 text-gray-500">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
};

export default function AuditLog() {
  const store = useStore();
  const currentUser = store.currentUser || store.user || {};
  const storeUsers = store.users || [];
  const storeVouchers = store.vouchers || [];
  const storeInvoices = store.invoices || [];

  const [activeTab, setActiveTab] = useState("Activity Log");
  const [loading, setLoading] = useState(false);
  const [auditRows, setAuditRows] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [vouchers, setVouchers] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);

  const [filters, setFilters] = useState({
    from: "",
    to: todayISO(),
    search: "",
    module: "All",
    action: "All",
    user: "All",
    status: "All",
    risk: "All",
    source: "All",
  });

  const [purgeModal, setPurgeModal] = useState(false);
  const [purgeBefore, setPurgeBefore] = useState("");
  const [confirmText, setConfirmText] = useState("");

  useEffect(() => {
    loadAuditData();
  }, []);

  const loadAuditData = async () => {
    setLoading(true);
    try {
      const db = getDB();

      const [
        dbAuditLogs,
        dbAuditEvents,
        dbLoginEvents,
        dbUsers,
        dbVouchers,
        dbInvoices,
        dbSecurityEvents,
        dbPeriodLocks,
      ] = await Promise.all([
        tableAll(db, "auditLogs"),
        tableAll(db, "auditEvents"),
        tableAll(db, "loginAudit"),
        tableAll(db, "users"),
        tableAll(db, "vouchers"),
        tableAll(db, "invoices"),
        tableAll(db, "securityEvents"),
        tableAll(db, "periodLocks"),
      ]);

      const allUsers = dbUsers?.length ? dbUsers : storeUsers || [];
      const allVouchers = dbVouchers?.length ? dbVouchers : storeVouchers || [];
      const allInvoices = dbInvoices?.length ? dbInvoices : storeInvoices || [];

      const normalized = [
        ...(dbAuditLogs || []).map((r) => normalizeAuditRow(r, "auditLogs")),
        ...(dbAuditEvents || []).map((r) => normalizeAuditRow(r, "auditEvents")),
        ...(dbLoginEvents || []).map((r) => normalizeAuditRow(r, "loginAudit")),
        ...(dbSecurityEvents || []).map((r) => normalizeAuditRow(r, "securityEvents")),
        ...(dbPeriodLocks || []).map((r) =>
          normalizeAuditRow(
            {
              id: `period-lock-${r.id || r.periodKey}`,
              timestamp: r.updatedAt || r.lockedAt || nowISO(),
              userName: r.lockedByName || r.updatedByName || "System",
              module: "Period Lock",
              action: r.locked ? "Period Locked" : "Period Unlocked",
              entityType: "periodLock",
              entityId: r.periodKey || r.id,
              narration: `${r.periodName || r.periodKey || ""}`,
              status: "Success",
              risk: r.locked ? "Medium" : "High",
              raw: r,
            },
            "periodLocks"
          )
        ),
        ...buildSystemAuditFromVouchers(allVouchers, allUsers),
        ...buildSystemAuditFromInvoices(allInvoices, allUsers),
      ];

      const dedup = Object.values(
        normalized.reduce((acc: any, r: any) => {
          acc[r.id] = r;
          return acc;
        }, {})
      ).sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      setUsers(allUsers);
      setVouchers(allVouchers);
      setInvoices(allInvoices);
      setAuditRows(dedup);

      if (!dbAuditLogs?.length && !dbAuditEvents?.length && dedup.length) {
        await safeBulkPut(
          db,
          "auditLogs",
          dedup.slice(0, 20).map((r: any) => ({
            id: r.id,
            timestamp: r.timestamp,
            userId: r.userId,
            userName: r.userName,
            module: r.module,
            action: r.action,
            entityType: r.entityType,
            entityId: r.entityId,
            narration: r.narration,
            ipAddress: r.ipAddress,
            status: r.status,
            risk: r.risk,
            createdAt: nowISO(),
          }))
        );
      }
    } catch (err) {
      console.error(err);
      toast.error("Could not load audit log");
    } finally {
      setLoading(false);
    }
  };

  const modules = useMemo(
    () => ["All", ...Array.from(new Set(auditRows.map((r) => r.module).filter(Boolean))).sort()],
    [auditRows]
  );
  const actions = useMemo(
    () => ["All", ...Array.from(new Set(auditRows.map((r) => r.action).filter(Boolean))).sort()],
    [auditRows]
  );
  const userOptions = useMemo(
    () => ["All", ...Array.from(new Set(auditRows.map((r) => r.userName).filter(Boolean))).sort()],
    [auditRows]
  );
  const sources = useMemo(
    () => ["All", ...Array.from(new Set(auditRows.map((r) => r.source).filter(Boolean))).sort()],
    [auditRows]
  );

  const filteredRows = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    return auditRows.filter((r) => {
      if (!dateInRange(r.date, filters.from, filters.to)) return false;
      if (filters.module !== "All" && r.module !== filters.module) return false;
      if (filters.action !== "All" && r.action !== filters.action) return false;
      if (filters.user !== "All" && r.userName !== filters.user) return false;
      if (filters.status !== "All" && r.status !== filters.status) return false;
      if (filters.risk !== "All" && r.risk !== filters.risk) return false;
      if (filters.source !== "All" && r.source !== filters.source) return false;

      if (!q) return true;
      const hay = [
        r.userName,
        r.module,
        r.action,
        r.entityType,
        r.entityId,
        r.narration,
        r.ipAddress,
        r.device,
        r.status,
        r.risk,
        r.source,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [auditRows, filters]);

  const stats = useMemo(() => {
    const total = filteredRows.length;
    const success = filteredRows.filter((r) => r.status === "Success").length;
    const failed = filteredRows.filter((r) => String(r.status).toLowerCase().includes("fail")).length;
    const highRisk = filteredRows.filter((r) => ["High", "Critical"].includes(r.risk)).length;
    const uniqueUsers = new Set(filteredRows.map((r) => r.userName)).size;
    return {
      total,
      success,
      failed,
      highRisk,
      uniqueUsers,
      moduleCounts: groupBy(filteredRows, "module"),
      riskCounts: groupBy(filteredRows, "risk"),
      actionCounts: groupBy(filteredRows, "action"),
    };
  }, [filteredRows]);

  const dataChangeRows = useMemo(
    () =>
      filteredRows.filter(
        (r) =>
          r.before ||
          r.after ||
          String(r.action).toLowerCase().includes("update") ||
          String(r.action).toLowerCase().includes("edit") ||
          String(r.action).toLowerCase().includes("delete") ||
          String(r.action).toLowerCase().includes("create")
      ),
    [filteredRows]
  );

  const accessRows = useMemo(
    () =>
      filteredRows.filter((r) => {
        const a = String(r.action).toLowerCase();
        const m = String(r.module).toLowerCase();
        return (
          a.includes("login") ||
          a.includes("logout") ||
          a.includes("access") ||
          a.includes("permission") ||
          a.includes("password") ||
          a.includes("security") ||
          m.includes("security") ||
          m.includes("user")
        );
      }),
    [filteredRows]
  );

  const updateFilter = (k: string, v: any) => setFilters((f) => ({ ...f, [k]: v }));
  const resetFilters = () => {
    setFilters({
      from: "",
      to: todayISO(),
      search: "",
      module: "All",
      action: "All",
      user: "All",
      status: "All",
      risk: "All",
      source: "All",
    });
  };

  const exportExcel = (rows = filteredRows, fileName = "Audit_Log.xlsx") => {
    if (!rows.length) {
      toast.error("No rows to export");
      return;
    }
    const exportRows = rows.map((r) => ({
      "Date/Time": r.timestamp,
      Date: r.date,
      User: r.userName,
      Role: r.role,
      Module: r.module,
      Action: r.action,
      "Entity Type": r.entityType,
      "Entity ID": r.entityId,
      Narration: r.narration,
      Status: r.status,
      Risk: r.risk,
      "IP Address": r.ipAddress,
      Device: r.device,
      Source: r.source,
    }));
    const summaryRows = [
      { Metric: "Total Events", Value: stats.total },
      { Metric: "Successful Events", Value: stats.success },
      { Metric: "Failed Events", Value: stats.failed },
      { Metric: "High/Critical Risk Events", Value: stats.highRisk },
      { Metric: "Unique Users", Value: stats.uniqueUsers },
      { Metric: "Exported At", Value: nowISO() },
      { Metric: "Exported By", Value: currentUser?.name || currentUser?.username || "System" },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(exportRows), "Audit Log");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), "Summary");
    XLSX.writeFile(wb, fileName);
    toast.success("Audit log exported");
  };

  const exportCompliancePack = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        filteredRows.map((r) => ({
          Timestamp: r.timestamp,
          User: r.userName,
          Module: r.module,
          Action: r.action,
          Status: r.status,
          Risk: r.risk,
          Narration: r.narration,
          Source: r.source,
        }))
      ),
      "All Events"
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        dataChangeRows.map((r) => ({
          Timestamp: r.timestamp,
          User: r.userName,
          Module: r.module,
          Action: r.action,
          Entity: `${r.entityType || ""} ${r.entityId || ""}`,
          Before: stringifySmall(r.before),
          After: stringifySmall(r.after),
          Risk: r.risk,
        }))
      ),
      "Data Changes"
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        accessRows.map((r) => ({
          Timestamp: r.timestamp,
          User: r.userName,
          Action: r.action,
          Status: r.status,
          IP: r.ipAddress,
          Device: r.device,
          Risk: r.risk,
        }))
      ),
      "Access Trail"
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet([
        {
          "Report Name": "Audit Compliance Export",
          "Generated At": nowISO(),
          "Generated By": currentUser?.name || currentUser?.username || "System",
          "Total Rows": filteredRows.length,
          "From Date": filters.from || "Beginning",
          "To Date": filters.to || "Today",
          "High Risk Count": stats.highRisk,
          "Failed Count": stats.failed,
        },
      ]),
      "Certificate"
    );
    XLSX.writeFile(wb, `Audit_Compliance_Pack_${todayISO()}.xlsx`);
    toast.success("Compliance pack exported");
  };

  const createManualAuditMarker = async () => {
    try {
      const db = getDB();
      const row = {
        id: generateId(),
        timestamp: nowISO(),
        date: todayISO(),
        userId: currentUser?.id || "",
        userName: currentUser?.name || currentUser?.username || "System",
        role: currentUser?.role || "",
        module: "Audit Log",
        action: "Manual Audit Review Marker",
        entityType: "audit",
        entityId: "",
        narration: "User reviewed audit log and inserted verification marker",
        ipAddress: "",
        device: navigator.userAgent || "",
        status: "Success",
        risk: "Low",
        createdAt: nowISO(),
      };
      if (db?.auditLogs?.put) await db.auditLogs.put(row);
      setAuditRows((prev) => [normalizeAuditRow(row), ...prev]);
      toast.success("Audit review marker inserted");
    } catch (err) {
      console.error(err);
      toast.error("Could not insert audit marker");
    }
  };

  const purgeOldLogs = async () => {
    if (!purgeBefore) {
      toast.error("Select purge-before date");
      return;
    }
    if (confirmText !== "PURGE") {
      toast.error("Type PURGE to confirm");
      return;
    }
    try {
      const db = getDB();
      const removable = auditRows.filter((r) => r.date < purgeBefore);
      const ids = removable.map((r) => r.id);
      if (db?.auditLogs?.bulkDelete && ids.length) {
        await db.auditLogs.bulkDelete(ids);
      }
      const marker = {
        id: generateId(),
        timestamp: nowISO(),
        userId: currentUser?.id || "",
        userName: currentUser?.name || currentUser?.username || "System",
        module: "Audit Log",
        action: "Old Audit Logs Purged",
        narration: `${ids.length} audit rows before ${purgeBefore} purged`,
        status: "Success",
        risk: "High",
        createdAt: nowISO(),
      };
      if (db?.auditLogs?.put) await db.auditLogs.put(marker);
      setAuditRows((prev) => [
        normalizeAuditRow(marker),
        ...prev.filter((r) => !(r.source === "auditLogs" && r.date < purgeBefore)),
      ]);
      setPurgeModal(false);
      setConfirmText("");
      toast.success("Old audit logs purged");
    } catch (err) {
      console.error(err);
      toast.error("Could not purge logs");
    }
  };

  const renderFilters = () => (
    <div className={card}>
      <div className="flex items-center gap-2 mb-4">
        <Filter className="h-4 w-4 text-gray-500" />
        <h3 className="text-[13px] font-semibold text-gray-700 uppercase tracking-wide">Audit Filters</h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-8 gap-3">
        <div>
          <label className="text-[11px] font-medium text-gray-600 block mb-1">From</label>
          <input type="date" className={input} value={filters.from} onChange={(e) => updateFilter("from", e.target.value)} />
        </div>
        <div>
          <label className="text-[11px] font-medium text-gray-600 block mb-1">To</label>
          <input type="date" className={input} value={filters.to} onChange={(e) => updateFilter("to", e.target.value)} />
        </div>
        <div className="lg:col-span-2">
          <label className="text-[11px] font-medium text-gray-600 block mb-1">Search</label>
          <div className="relative">
            <Search className="h-4 w-4 absolute left-2.5 top-2 text-gray-400" />
            <input className={`${input} pl-8`} value={filters.search} onChange={(e) => updateFilter("search", e.target.value)} placeholder="User, module, narration..." />
          </div>
        </div>
        <div>
          <label className="text-[11px] font-medium text-gray-600 block mb-1">Module</label>
          <select className={input} value={filters.module} onChange={(e) => updateFilter("module", e.target.value)}>
            {modules.map((m) => <option key={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[11px] font-medium text-gray-600 block mb-1">Action</label>
          <select className={input} value={filters.action} onChange={(e) => updateFilter("action", e.target.value)}>
            {actions.map((a) => <option key={a}>{a}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[11px] font-medium text-gray-600 block mb-1">User</label>
          <select className={input} value={filters.user} onChange={(e) => updateFilter("user", e.target.value)}>
            {userOptions.map((u) => <option key={u}>{u}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[11px] font-medium text-gray-600 block mb-1">Risk</label>
          <select className={input} value={filters.risk} onChange={(e) => updateFilter("risk", e.target.value)}>
            {["All", "Low", "Medium", "High", "Critical"].map((r) => <option key={r}>{r}</option>)}
          </select>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 mt-4">
        <button className={btn2} onClick={resetFilters}>
          <RefreshCcw className="h-3 w-3" /> Reset
        </button>
        <button className={btn2} onClick={() => exportExcel()}>
          <FileDown className="h-3 w-3" /> Export Filtered
        </button>
        <button className={btn2} onClick={exportCompliancePack}>
          <Shield className="h-3 w-3 text-[#1557b0]" /> Compliance Pack
        </button>
      </div>
    </div>
  );

  const renderStats = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
      <div className={card}>
        <div className="flex justify-between items-start">
          <div>
            <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Total Events</p>
            <p className="text-xl font-semibold mt-1">{stats.total}</p>
          </div>
          <Activity className="h-5 w-5 text-blue-500" />
        </div>
      </div>
      <div className={card}>
        <div className="flex justify-between items-start">
          <div>
            <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Successful</p>
            <p className="text-xl font-semibold mt-1 text-emerald-600">{stats.success}</p>
          </div>
          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
        </div>
      </div>
      <div className={card}>
        <div className="flex justify-between items-start">
          <div>
            <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Failed</p>
            <p className="text-xl font-semibold mt-1 text-red-600">{stats.failed}</p>
          </div>
          <XCircle className="h-5 w-5 text-red-500" />
        </div>
      </div>
      <div className={card}>
        <div className="flex justify-between items-start">
          <div>
            <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">High Risk</p>
            <p className="text-xl font-semibold mt-1 text-amber-600">{stats.highRisk}</p>
          </div>
          <AlertTriangle className="h-5 w-5 text-amber-500" />
        </div>
      </div>
      <div className={card}>
        <div className="flex justify-between items-start">
          <div>
            <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Unique Users</p>
            <p className="text-xl font-semibold mt-1">{stats.uniqueUsers}</p>
          </div>
          <User className="h-5 w-5 text-indigo-500" />
        </div>
      </div>
    </div>
  );

  const renderAuditTable = (rows: any[]) => (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
      <div className="overflow-x-auto max-h-[500px]">
        <table className="w-full text-left border-collapse whitespace-nowrap">
          <thead className="sticky top-0 bg-[#f5f6fa] z-10 shadow-sm">
            <tr>
              <th className={th}>Date / Time</th>
              <th className={th}>User</th>
              <th className={th}>Module</th>
              <th className={th}>Action</th>
              <th className={th}>Narration</th>
              <th className={th}>Status</th>
              <th className={th}>Risk</th>
              <th className={th}>Source</th>
              <th className={`${th} text-center`}>View</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50/50">
                <td className={td}>
                  <div className="font-medium text-gray-800">{String(r.timestamp).slice(0, 10)}</div>
                  <div className="text-[10px] text-gray-400">{String(r.timestamp).slice(11, 19)}</div>
                </td>
                <td className={td}>
                  <div className="font-medium text-gray-800">{r.userName || "System"}</div>
                  <div className="text-[10px] text-gray-400">{r.role || r.userId || "-"}</div>
                </td>
                <td className={td}>
                  <span className="font-medium text-gray-700">{r.module}</span>
                  {r.entityType && (
                    <div className="text-[10px] text-gray-400">
                      {r.entityType} {r.entityId}
                    </div>
                  )}
                </td>
                <td className={td}>
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-medium ${actionClass(r.action)}`}>
                    {r.action}
                  </span>
                </td>
                <td className={`${td} whitespace-normal min-w-[250px]`}>
                  <div className="line-clamp-2 leading-snug">{r.narration || "-"}</div>
                  {(r.ipAddress || r.device) && (
                    <div className="text-[10px] text-gray-400 mt-0.5">
                      {r.ipAddress || "-"} {r.device ? "• device logged" : ""}
                    </div>
                  )}
                </td>
                <td className={td}>
                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-medium ${
                      String(r.status).toLowerCase().includes("fail") || String(r.status).toLowerCase().includes("cancel")
                        ? "bg-red-50 text-red-700 border-red-200"
                        : "bg-emerald-50 text-emerald-700 border-emerald-200"
                    }`}>
                    {String(r.status).toLowerCase().includes("fail") ? <XCircle className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
                    {r.status}
                  </span>
                </td>
                <td className={td}>
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-medium ${riskClass(r.risk)}`}>
                    {r.risk}
                  </span>
                </td>
                <td className={td}>
                  <span className="text-[10px] font-medium text-gray-500 uppercase">{r.source}</span>
                </td>
                <td className={`${td} text-center align-middle`}>
                  <button className="text-gray-400 hover:text-[#1557b0] transition-colors p-1" onClick={() => setSelected(r)} title="View details">
                    <Eye className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={9} className="p-6 text-center text-[12px] text-gray-500">
                  No audit rows found for selected filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f5f6fa] p-4 text-gray-800">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800 flex items-center gap-2">
            <Shield className="h-4 w-4 text-[#1557b0]" /> Audit Log
          </h1>
          <p className="text-[11px] text-gray-500 mt-0.5">
            User activity, data change history, security access trail and compliance export.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className={btn2} onClick={loadAuditData} disabled={loading}>
            <RefreshCcw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
          <button className={btn} onClick={() => exportExcel()}>
            <Download className="h-3 w-3" /> Export
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4 border-b border-gray-200 pb-2">
        {[
          ["Activity Log", Activity],
          ["Data Changes", Database],
          ["Access Trail", KeyRound],
          ["Compliance Export", Shield],
        ].map(([name, Icon]: any) => (
          <button
            key={name}
            onClick={() => setActiveTab(name)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors ${
              activeTab === name
                ? "bg-[#1557b0] text-white"
                : "bg-white border border-gray-300 text-gray-600 hover:bg-gray-50"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {name}
          </button>
        ))}
      </div>

      {loading && (
        <div className={`${card} mb-4 flex items-center gap-2 text-[12px] text-gray-600`}>
          <RefreshCcw className="h-4 w-4 animate-spin text-[#1557b0]" /> Loading audit data...
        </div>
      )}

      {activeTab === "Activity Log" && (
        <div className="space-y-4">
          {renderFilters()}
          {renderStats()}
          {renderAuditTable(filteredRows)}
        </div>
      )}

      {activeTab === "Data Changes" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-[13px] font-semibold text-gray-800 flex items-center gap-2">
              <Database className="h-4 w-4 text-gray-500" /> Data Change Trail
            </h3>
            <button className={btn2} onClick={() => exportExcel(dataChangeRows, "Data_Change_Audit.xlsx")}>
              <Download className="h-3 w-3" /> Export Changes
            </button>
          </div>
          {renderAuditTable(dataChangeRows)}
        </div>
      )}

      {activeTab === "Access Trail" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-[13px] font-semibold text-gray-800 flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-gray-500" /> Access & Security Trail
            </h3>
            <button className={btn2} onClick={() => exportExcel(accessRows, "Access_Security_Audit.xlsx")}>
              <Download className="h-3 w-3" /> Export Access Trail
            </button>
          </div>
          {renderAuditTable(accessRows)}
        </div>
      )}

      {activeTab === "Compliance Export" && (
        <div className="space-y-4">
          <div className={card}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-[14px] font-semibold text-gray-800">Compliance Export & Audit Controls</h3>
                <p className="text-[11px] text-gray-500 mt-0.5">Manage audit registers, review markers, and old log retention.</p>
              </div>
              <div className="flex gap-2">
                <button className={btn2} onClick={createManualAuditMarker}>
                  <History className="h-3 w-3 text-[#1557b0]" /> Insert Review Marker
                </button>
                <button className={btn} onClick={exportCompliancePack}>
                  <FileDown className="h-3 w-3" /> Export Compliance Pack
                </button>
                <button className={btnDanger} onClick={() => setPurgeModal(true)}>
                  <Trash2 className="h-3 w-3" /> Purge Old Logs
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Modal open={!!selected} title="Audit Event Details" onClose={() => setSelected(null)}>
        {selected && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="bg-gray-50 rounded-md p-3 border border-gray-200">
                <p className="text-[10px] font-semibold text-gray-500 uppercase mb-0.5">Timestamp</p>
                <p className="text-[12px] font-medium text-gray-800">{selected.timestamp}</p>
              </div>
              <div className="bg-gray-50 rounded-md p-3 border border-gray-200">
                <p className="text-[10px] font-semibold text-gray-500 uppercase mb-0.5">User</p>
                <p className="text-[12px] font-medium text-gray-800">{selected.userName}</p>
              </div>
              <div className="bg-gray-50 rounded-md p-3 border border-gray-200">
                <p className="text-[10px] font-semibold text-gray-500 uppercase mb-0.5">Risk</p>
                <span className={`inline-flex px-1.5 py-0.5 rounded border text-[10px] font-medium mt-1 ${riskClass(selected.risk)}`}>
                  {selected.risk}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-md p-3 border border-gray-200">
                <p className="text-[10px] font-semibold text-gray-500 uppercase mb-0.5">Module / Action</p>
                <p className="text-[12px] font-medium text-gray-800">{selected.module} / {selected.action}</p>
              </div>
              <div className="bg-gray-50 rounded-md p-3 border border-gray-200">
                <p className="text-[10px] font-semibold text-gray-500 uppercase mb-0.5">Entity</p>
                <p className="text-[12px] font-medium text-gray-800">{selected.entityType || "-"} {selected.entityId || ""}</p>
              </div>
            </div>
            <div className="bg-gray-50 rounded-md p-3 border border-gray-200">
              <p className="text-[10px] font-semibold text-gray-500 uppercase mb-1">Narration</p>
              <p className="text-[12px] text-gray-700 whitespace-pre-wrap">{selected.narration || "-"}</p>
            </div>
            {(selected.before || selected.after) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-md p-3 border border-gray-200">
                  <p className="text-[10px] font-semibold text-gray-500 uppercase mb-1">Before</p>
                  <pre className="text-[11px] text-gray-700 bg-white p-2 rounded border border-gray-200 overflow-auto max-h-48 font-mono">
                    {stringifySmall(selected.before)}
                  </pre>
                </div>
                <div className="bg-gray-50 rounded-md p-3 border border-gray-200">
                  <p className="text-[10px] font-semibold text-gray-500 uppercase mb-1">After</p>
                  <pre className="text-[11px] text-gray-700 bg-white p-2 rounded border border-gray-200 overflow-auto max-h-48 font-mono">
                    {stringifySmall(selected.after)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal open={purgeModal} title="Purge Old Audit Logs" onClose={() => setPurgeModal(false)}>
        <div className="space-y-4">
          <div className="p-3 rounded-md border border-red-200 bg-red-50 text-red-800 flex gap-2 items-start">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <p className="text-[12px] font-semibold">Dangerous audit maintenance action</p>
              <p className="text-[11px] mt-1 opacity-90">
                Purging removes old rows from the audit log. A purge marker will be inserted.
                Export your logs first if you need archive retention.
              </p>
            </div>
          </div>
          <div>
            <label className="text-[11px] font-semibold text-gray-600 block mb-1">Purge rows before date</label>
            <input type="date" className={input} value={purgeBefore} onChange={(e) => setPurgeBefore(e.target.value)} />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-gray-600 block mb-1">
              Type <span className="font-bold text-red-600">PURGE</span> to confirm
            </label>
            <input className={input} value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="PURGE" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button className={btn2} onClick={() => setPurgeModal(false)}>Cancel</button>
            <button className={btnDanger} onClick={purgeOldLogs}>
              <Trash2 className="h-3 w-3" /> Purge Logs
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
