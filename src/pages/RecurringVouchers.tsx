// @ts-nocheck
import React, { useEffect, useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import { getDB, generateId } from "../lib/db";
import * as XLSX from "xlsx";
import toast from "react-hot-toast";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  Edit,
  Eye,
  FileSpreadsheet,
  Filter,
  History,
  Info,
  PauseCircle,
  PlayCircle,
  Plus,
  RefreshCcw,
  Repeat,
  Save,
  Search,
  Trash2,
  XCircle,
  X,
  Upload,
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
    const t = db?.table ? db.table(name) : db?.[name];
    if (t?.toArray) return t.toArray().catch(() => []);
    return Promise.resolve([]);
  } catch {
    return Promise.resolve([]);
  }
};

const tablePut = async (db: any, name: string, rows: any[]) => {
  try {
    if (!rows?.length) return;
    const t = db?.table ? db.table(name) : db?.[name];
    if (t?.bulkPut) await t.bulkPut(rows);
  } catch (err) {
    console.warn("bulkPut failed", name, err);
  }
};

const tableDelete = async (db: any, name: string, id: any) => {
  try {
    const t = db?.table ? db.table(name) : db?.[name];
    if (t?.delete) await t.delete(id);
  } catch (err) {
    console.warn("delete failed", name, err);
  }
};

const addDays = (date: string, days: number) => {
  const d = new Date(date || todayISO());
  d.setDate(d.getDate() + Number(days || 0));
  return d.toISOString().slice(0, 10);
};

const addMonths = (date: string, months: number) => {
  const d = new Date(date || todayISO());
  const day = d.getDate();
  d.setMonth(d.getMonth() + Number(months || 0));
  if (d.getDate() < day) d.setDate(0);
  return d.toISOString().slice(0, 10);
};

const addYears = (date: string, years: number) => {
  const d = new Date(date || todayISO());
  d.setFullYear(d.getFullYear() + Number(years || 0));
  return d.toISOString().slice(0, 10);
};

const nextRunDate = (lastRunDate: string, frequency: string, interval = 1) => {
  const base = lastRunDate || todayISO();
  const i = Number(interval || 1);

  if (frequency === "Daily") return addDays(base, i);
  if (frequency === "Weekly") return addDays(base, i * 7);
  if (frequency === "Fortnightly") return addDays(base, i * 14);
  if (frequency === "Monthly") return addMonths(base, i);
  if (frequency === "Quarterly") return addMonths(base, i * 3);
  if (frequency === "Half Yearly") return addMonths(base, i * 6);
  if (frequency === "Yearly") return addYears(base, i);
  return addMonths(base, 1);
};

const accountName = (accounts: any[], id: string) =>
  accounts.find((a) => a.id === id)?.name ||
  accounts.find((a) => a.accountId === id)?.name ||
  id ||
  "-";

const voucherTotal = (lines: any[]) => {
  const dr = (lines || []).reduce((sum, l) => sum + Number(l.debit || l.dr || 0), 0);
  const cr = (lines || []).reduce((sum, l) => sum + Number(l.credit || l.cr || 0), 0);
  return { dr, cr, diff: dr - cr };
};

const defaultLine = () => ({
  id: generateId(),
  accountId: "",
  debit: 0,
  credit: 0,
  narration: "",
  costCenterId: "",
});

const defaultTemplate = () => ({
  id: "",
  name: "",
  voucherType: "journal",
  frequency: "Monthly",
  interval: 1,
  startDate: todayISO(),
  endDate: "",
  nextDate: todayISO(),
  lastRunDate: "",
  autoPost: false,
  requireApproval: true,
  status: "Active",
  narration: "",
  lines: [defaultLine(), defaultLine()],
  createdAt: nowISO(),
  updatedAt: nowISO(),
});

const isDue = (t: any, asOf = todayISO()) => {
  if (t.status !== "Active") return false;
  if (t.endDate && t.endDate < asOf) return false;
  return String(t.nextDate || t.startDate || "") <= asOf;
};

const statusClass = (status: string) => {
  const s = String(status || "").toLowerCase();
  if (s === "active") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (s === "paused") return "bg-amber-50 text-amber-700 border-amber-200";
  if (s === "expired") return "bg-gray-50 text-gray-700 border-gray-200";
  if (s === "failed") return "bg-red-50 text-red-700 border-red-200";
  return "bg-blue-50 text-blue-700 border-blue-200";
};

const normalizeTemplate = (r: any) => ({
  id: r.id || generateId(),
  name: r.name || r.templateName || "Recurring Voucher",
  voucherType: r.voucherType || r.type || "journal",
  frequency: r.frequency || "Monthly",
  interval: Number(r.interval || 1),
  startDate: r.startDate || todayISO(),
  endDate: r.endDate || "",
  nextDate: r.nextDate || r.startDate || todayISO(),
  lastRunDate: r.lastRunDate || "",
  autoPost: !!r.autoPost,
  requireApproval: r.requireApproval !== false,
  status: r.status || "Active",
  narration: r.narration || r.description || "",
  lines:
    Array.isArray(r.lines) && r.lines.length
      ? r.lines.map((l) => ({
          id: l.id || generateId(),
          accountId: l.accountId || "",
          debit: Number(l.debit || l.dr || 0),
          credit: Number(l.credit || l.cr || 0),
          narration: l.narration || "",
          costCenterId: l.costCenterId || "",
        }))
      : [defaultLine(), defaultLine()],
  createdAt: r.createdAt || nowISO(),
  updatedAt: r.updatedAt || nowISO(),
});

const makeAuditRow = (currentUser: any, action: string, narration: string, risk = "Medium") => ({
  id: generateId(),
  timestamp: nowISO(),
  date: todayISO(),
  userId: currentUser?.id || "",
  userName: currentUser?.name || currentUser?.username || "System",
  role: currentUser?.role || "",
  module: "Recurring Vouchers",
  action,
  narration,
  status: "Success",
  risk,
  createdAt: nowISO(),
});

const Modal = ({ open, title, children, onClose }: any) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-[#f5f6fa]">
          <h3 className="text-[15px] font-semibold text-gray-800">{title}</h3>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-gray-200 text-gray-500">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
};

export default function RecurringVouchers() {
  const store = useStore();
  const currentUser = store.currentUser || store.user || {};
  const storeAccounts = store.accounts || [];
  const storeCostCenters = store.costCenters || [];
  const storeFiscalYear = store.currentFiscalYear || store.fiscalYear || {};

  const [activeTab, setActiveTab] = useState("Templates");
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [costCenters, setCostCenters] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [runHistory, setRunHistory] = useState<any[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [frequencyFilter, setFrequencyFilter] = useState("All");
  const [form, setForm] = useState<any>(defaultTemplate());
  const [modalType, setModalType] = useState("");
  const [selected, setSelected] = useState<any>(null);
  const [runDate, setRunDate] = useState(todayISO());
  const [previewRows, setPreviewRows] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const db = getDB();
      const [
        dbAccounts,
        dbCostCenters,
        dbTemplates,
        dbRunHistory,
      ] = await Promise.all([
        tableAll(db, "accounts"),
        tableAll(db, "costCenters"),
        tableAll(db, "recurringVouchers"),
        tableAll(db, "recurringVoucherRuns"),
      ]);

      setAccounts(dbAccounts?.length ? dbAccounts : storeAccounts);
      setCostCenters(dbCostCenters?.length ? dbCostCenters : storeCostCenters);
      setTemplates((dbTemplates || []).map(normalizeTemplate));
      setRunHistory((dbRunHistory || []).sort((a, b) => String(b.runAt || "").localeCompare(String(a.runAt || ""))));
    } catch (err) {
      console.error(err);
      toast.error("Could not load recurring vouchers");
    } finally {
      setLoading(false);
    }
  };

  const dueTemplates = useMemo(
    () => templates.filter((t) => isDue(t, todayISO())),
    [templates]
  );

  const filteredTemplates = useMemo(() => {
    const q = query.trim().toLowerCase();
    return templates.filter((t) => {
      if (statusFilter !== "All" && t.status !== statusFilter) return false;
      if (frequencyFilter !== "All" && t.frequency !== frequencyFilter) return false;
      if (!q) return true;
      const hay = [
        t.name,
        t.voucherType,
        t.frequency,
        t.status,
        t.narration,
        ...(t.lines || []).map((l) => accountName(accounts, l.accountId)),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [templates, query, statusFilter, frequencyFilter, accounts]);

  const stats = useMemo(() => {
    const active = templates.filter((t) => t.status === "Active").length;
    const paused = templates.filter((t) => t.status === "Paused").length;
    const expired = templates.filter((t) => t.endDate && t.endDate < todayISO()).length;
    const due = dueTemplates.length;
    const monthlyValue = templates
      .filter((t) => t.status === "Active")
      .reduce((sum, t) => sum + voucherTotal(t.lines).dr, 0);

    return {
      total: templates.length,
      active,
      paused,
      expired,
      due,
      monthlyValue,
      runs: runHistory.length,
    };
  }, [templates, dueTemplates, runHistory]);

  const openAdd = () => {
    const t = defaultTemplate();
    setForm({
      ...t,
      id: "",
      nextDate: t.startDate,
    });
    setSelected(null);
    setModalType("edit");
  };

  const openEdit = (t: any) => {
    setSelected(t);
    setForm(JSON.parse(JSON.stringify(normalizeTemplate(t))));
    setModalType("edit");
  };

  const cloneTemplate = (t: any) => {
    const copy = normalizeTemplate({
      ...t,
      id: "",
      name: `${t.name} (Copy)`,
      nextDate: todayISO(),
      lastRunDate: "",
      createdAt: nowISO(),
      updatedAt: nowISO(),
    });
    setSelected(null);
    setForm(copy);
    setModalType("edit");
  };

  const updateLine = (idx: number, key: string, value: any) => {
    setForm((f) => {
      const lines = [...(f.lines || [])];
      lines[idx] = {
        ...lines[idx],
        [key]: key === "debit" || key === "credit" ? Number(value || 0) : value,
      };

      if (key === "debit" && Number(value || 0) > 0) lines[idx].credit = 0;
      if (key === "credit" && Number(value || 0) > 0) lines[idx].debit = 0;
      return { ...f, lines };
    });
  };

  const addLine = () => {
    setForm((f) => ({
      ...f,
      lines: [...(f.lines || []), defaultLine()],
    }));
  };

  const removeLine = (idx: number) => {
    setForm((f) => ({
      ...f,
      lines: (f.lines || []).filter((_, i) => i !== idx),
    }));
  };

  const validateForm = () => {
    if (!form.name?.trim()) {
      toast.error("Enter template name");
      return false;
    }
    if (!form.startDate) {
      toast.error("Enter start date");
      return false;
    }
    if (!form.frequency) {
      toast.error("Select frequency");
      return false;
    }

    const cleanLines = (form.lines || []).filter(
      (l) => l.accountId && (Number(l.debit || 0) > 0 || Number(l.credit || 0) > 0)
    );

    if (cleanLines.length < 2) {
      toast.error("Enter at least two valid voucher lines");
      return false;
    }

    const total = voucherTotal(cleanLines);
    if (Math.abs(total.diff) > 0.01) {
      toast.error("Debit and credit totals must match");
      return false;
    }

    return true;
  };

  const saveTemplate = async () => {
    if (!validateForm()) return;

    try {
      const db = getDB();
      const cleanLines = (form.lines || [])
        .filter((l) => l.accountId && (Number(l.debit || 0) > 0 || Number(l.credit || 0) > 0))
        .map((l) => ({
          ...l,
          id: l.id || generateId(),
          debit: Number(l.debit || 0),
          credit: Number(l.credit || 0),
        }));

      const row = normalizeTemplate({
        ...form,
        id: form.id || selected?.id || generateId(),
        lines: cleanLines,
        nextDate: form.nextDate || form.startDate || todayISO(),
        createdAt: selected?.createdAt || nowISO(),
        updatedAt: nowISO(),
      });

      await tablePut(db, "recurringVouchers", [row]);
      await tablePut(db, "auditLogs", [
        makeAuditRow(
          currentUser,
          selected ? "Recurring Template Updated" : "Recurring Template Created",
          `${row.name} ${row.frequency} ${money(voucherTotal(row.lines).dr)}`,
          "Medium"
        ),
      ]);

      setTemplates((prev) => [row, ...prev.filter((x) => x.id !== row.id)]);
      setModalType("");
      toast.success("Recurring voucher template saved");
    } catch (err) {
      console.error(err);
      toast.error("Could not save recurring voucher");
    }
  };

  const deleteTemplate = async (t: any) => {
    if (!confirm(`Delete recurring voucher template "${t.name}"?`)) return;
    try {
      const db = getDB();
      await tableDelete(db, "recurringVouchers", t.id);
      await tablePut(db, "auditLogs", [
        makeAuditRow(currentUser, "Recurring Template Deleted", `${t.name} deleted`, "High"),
      ]);
      setTemplates((prev) => prev.filter((x) => x.id !== t.id));
      toast.success("Template deleted");
    } catch (err) {
      console.error(err);
      toast.error("Could not delete template");
    }
  };

  const toggleStatus = async (t: any) => {
    const nextStatus = t.status === "Active" ? "Paused" : "Active";
    try {
      const db = getDB();
      const row = normalizeTemplate({ ...t, status: nextStatus, updatedAt: nowISO() });
      await tablePut(db, "recurringVouchers", [row]);
      await tablePut(db, "auditLogs", [
        makeAuditRow(
          currentUser,
          nextStatus === "Active" ? "Recurring Template Activated" : "Recurring Template Paused",
          `${row.name} marked ${nextStatus}`,
          "Medium"
        ),
      ]);
      setTemplates((prev) => prev.map((x) => (x.id === row.id ? row : x)));
      toast.success(`Template ${nextStatus}`);
    } catch (err) {
      console.error(err);
      toast.error("Could not update template status");
    }
  };

  const makeVoucherFromTemplate = (t: any, date: string, mode = "manual") => {
    const total = voucherTotal(t.lines);
    return {
      id: generateId(),
      voucherNo: `RV-${date.replaceAll("-", "")}-${String(Date.now()).slice(-5)}`,
      type: t.voucherType || "journal",
      date,
      narration: t.narration || `Recurring voucher: ${t.name}`,
      lines: (t.lines || []).map((l) => ({
        id: generateId(),
        accountId: l.accountId,
        debit: Number(l.debit || 0),
        credit: Number(l.credit || 0),
        narration: l.narration || t.narration || `Recurring voucher: ${t.name}`,
        costCenterId: l.costCenterId || "",
      })),
      totalDebit: total.dr,
      totalCredit: total.cr,
      status: t.requireApproval ? "draft" : "posted",
      fiscalYearId: storeFiscalYear?.id || "",
      recurringTemplateId: t.id,
      recurringTemplateName: t.name,
      sourceType: "recurringVoucher",
      runMode: mode,
      createdBy: currentUser?.id || "",
      createdAt: nowISO(),
      updatedAt: nowISO(),
    };
  };

  const runTemplate = async (t: any, date = todayISO(), mode = "manual") => {
    if (!isDue(t, date) && mode !== "force") {
      toast.error("Template is not due for selected date");
      return null;
    }
    const total = voucherTotal(t.lines);
    if (Math.abs(total.diff) > 0.01) {
      toast.error("Template is unbalanced");
      return null;
    }

    try {
      const db = getDB();
      const voucher = makeVoucherFromTemplate(t, date, mode);
      const nextDate = nextRunDate(date, t.frequency, t.interval);

      const updatedTemplate = normalizeTemplate({
        ...t,
        lastRunDate: date,
        nextDate,
        updatedAt: nowISO(),
      });

      const historyRow = {
        id: generateId(),
        templateId: t.id,
        templateName: t.name,
        runDate: date,
        runAt: nowISO(),
        voucherId: voucher.id,
        voucherNo: voucher.voucherNo,
        amount: total.dr,
        status: "Success",
        mode,
        createdBy: currentUser?.id || "",
      };

      await tablePut(db, "vouchers", [voucher]);
      await tablePut(db, "recurringVouchers", [updatedTemplate]);
      await tablePut(db, "recurringVoucherRuns", [historyRow]);
      await tablePut(db, "auditLogs", [
        makeAuditRow(
          currentUser,
          "Recurring Voucher Generated",
          `${t.name} generated voucher ${voucher.voucherNo} for ${money(total.dr)}`,
          "Medium"
        ),
      ]);

      if (store.addVoucher) {
        try {
          store.addVoucher(voucher);
        } catch {
          // ignored
        }
      }

      setTemplates((prev) => prev.map((x) => (x.id === t.id ? updatedTemplate : x)));
      setRunHistory((prev) => [historyRow, ...prev]);

      toast.success(`Voucher ${voucher.voucherNo} generated`);
      return voucher;
    } catch (err) {
      console.error(err);
      toast.error("Could not generate voucher");
      return null;
    }
  };

  const runDueTemplates = async () => {
    const due = templates.filter((t) => isDue(t, runDate));
    if (!due.length) {
      toast.error("No templates due for selected date");
      return;
    }
    if (!confirm(`Generate vouchers for ${due.length} due templates?`)) return;

    setLoading(true);
    try {
      let ok = 0;
      for (const t of due) {
        const v = await runTemplate(t, runDate, "bulk");
        if (v) ok += 1;
      }
      toast.success(`${ok} recurring vouchers generated`);
      setModalType("");
    } finally {
      setLoading(false);
    }
  };

  const previewDue = () => {
    const rows = templates
      .filter((t) => isDue(t, runDate))
      .map((t) => ({
        ...t,
        amount: voucherTotal(t.lines).dr,
        balanced: Math.abs(voucherTotal(t.lines).diff) <= 0.01,
      }));
    setPreviewRows(rows);
    setModalType("preview");
  };

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        templates.map((t) => ({
          Name: t.name,
          VoucherType: t.voucherType,
          Frequency: t.frequency,
          Interval: t.interval,
          StartDate: t.startDate,
          EndDate: t.endDate,
          NextDate: t.nextDate,
          LastRunDate: t.lastRunDate,
          AutoPost: t.autoPost ? "Yes" : "No",
          RequireApproval: t.requireApproval ? "Yes" : "No",
          Status: t.status,
          Amount: voucherTotal(t.lines).dr,
          Narration: t.narration,
        }))
      ),
      "Templates"
    );

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        templates.flatMap((t) =>
          (t.lines || []).map((l, idx) => ({
            Template: t.name,
            LineNo: idx + 1,
            Account: accountName(accounts, l.accountId),
            AccountId: l.accountId,
            Debit: l.debit,
            Credit: l.credit,
            CostCenterId: l.costCenterId,
            Narration: l.narration,
          }))
        )
      ),
      "Template Lines"
    );

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        runHistory.map((h) => ({
          RunAt: h.runAt,
          RunDate: h.runDate,
          Template: h.templateName,
          VoucherNo: h.voucherNo,
          VoucherId: h.voucherId,
          Amount: h.amount,
          Status: h.status,
          Mode: h.mode,
        }))
      ),
      "Run History"
    );

    XLSX.writeFile(wb, `Recurring_Vouchers_${todayISO()}.xlsx`);
    toast.success("Recurring vouchers exported");
  };

  const renderSummary = () => (
    <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-7 gap-3">
      <div className={card}>
        <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Templates</p>
        <p className="text-xl font-semibold mt-1 text-gray-800">{stats.total}</p>
      </div>
      <div className={card}>
        <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Active</p>
        <p className="text-xl font-semibold mt-1 text-emerald-600">{stats.active}</p>
      </div>
      <div className={card}>
        <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Paused</p>
        <p className="text-xl font-semibold mt-1 text-amber-600">{stats.paused}</p>
      </div>
      <div className={card}>
        <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Expired</p>
        <p className="text-xl font-semibold mt-1 text-gray-500">{stats.expired}</p>
      </div>
      <div className={card}>
        <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Due Now</p>
        <p className="text-xl font-semibold mt-1 text-red-600">{stats.due}</p>
      </div>
      <div className={card}>
        <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Run Count</p>
        <p className="text-xl font-semibold mt-1 text-gray-800">{stats.runs}</p>
      </div>
      <div className={card}>
        <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Active Value</p>
        <p className="text-[14px] font-semibold mt-2 text-gray-800 truncate">{money(stats.monthlyValue)}</p>
      </div>
    </div>
  );

  const renderFilters = () => (
    <div className={card}>
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="md:col-span-2">
          <label className="text-[11px] font-medium text-gray-600 block mb-1">Search</label>
          <div className="relative">
            <Search className="h-4 w-4 absolute left-2.5 top-2 text-gray-400" />
            <input
              className={`${input} pl-8`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Template, narration, account..."
            />
          </div>
        </div>
        <div>
          <label className="text-[11px] font-medium text-gray-600 block mb-1">Status</label>
          <select className={input} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            {["All", "Active", "Paused", "Expired", "Failed"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[11px] font-medium text-gray-600 block mb-1">Frequency</label>
          <select className={input} value={frequencyFilter} onChange={(e) => setFrequencyFilter(e.target.value)}>
            {["All", "Daily", "Weekly", "Fortnightly", "Monthly", "Quarterly", "Half Yearly", "Yearly"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <button
            className={btn2}
            onClick={() => {
              setQuery("");
              setStatusFilter("All");
              setFrequencyFilter("All");
            }}
          >
            <RefreshCcw className="h-3 w-3" /> Reset
          </button>
        </div>
      </div>
    </div>
  );

  const renderTemplates = () => (
    <div className="space-y-4">
      {renderFilters()}

      <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
        <div className="overflow-auto max-h-[62vh]">
          <table className="w-full text-left border-collapse whitespace-nowrap min-w-[1200px]">
            <thead className="sticky top-0 z-10 bg-[#f5f6fa] shadow-sm">
              <tr>
                <th className={th}>Template</th>
                <th className={th}>Voucher Type</th>
                <th className={th}>Frequency</th>
                <th className={th}>Next Date</th>
                <th className={th}>Last Run</th>
                <th className={`${th} text-right`}>Amount</th>
                <th className={th}>Status</th>
                <th className={th}>Mode</th>
                <th className={`${th} text-center`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTemplates.map((t) => {
                const total = voucherTotal(t.lines);
                const due = isDue(t, todayISO());

                return (
                  <tr key={t.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                    <td className={`${td} font-medium text-gray-800`}>
                      <div className="flex items-center gap-2">
                        {t.name}
                        {due && (
                          <span className="inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-red-100 text-red-700">
                            Due
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-gray-500 font-normal mt-0.5 max-w-[200px] truncate">
                        {t.narration || "-"}
                      </div>
                    </td>
                    <td className={`${td} capitalize`}>{t.voucherType}</td>
                    <td className={td}>
                      <div className="font-medium text-gray-800">{t.frequency}</div>
                      <div className="text-[10px] text-gray-500 mt-0.5">Every {t.interval || 1} period(s)</div>
                    </td>
                    <td className={td}>
                      <span className={due ? "text-red-600 font-medium" : ""}>{t.nextDate || "-"}</span>
                    </td>
                    <td className={td}>{t.lastRunDate || "-"}</td>
                    <td className={`${td} text-right font-medium`}>
                      {money(total.dr)}
                      {Math.abs(total.diff) > 0.01 && (
                        <div className="text-[10px] text-red-600 mt-0.5 font-normal">
                          Diff {money(total.diff)}
                        </div>
                      )}
                    </td>
                    <td className={td}>
                      <span
                        className={`inline-flex px-1.5 py-0.5 rounded border text-[10px] font-medium ${statusClass(t.status)}`}
                      >
                        {t.endDate && t.endDate < todayISO() ? "Expired" : t.status}
                      </span>
                    </td>
                    <td className={td}>
                      <div className="text-[11px] font-medium">{t.autoPost ? "Auto Post" : "Manual"}</div>
                      <div className="text-[10px] text-gray-500 mt-0.5">
                        {t.requireApproval ? "Draft approval" : "Direct post"}
                      </div>
                    </td>
                    <td className={`${td} text-center p-1`}>
                      <div className="inline-flex gap-1 items-center justify-center">
                        <button
                          className="p-1 rounded text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                          onClick={() => runTemplate(t, todayISO(), due ? "manual" : "force")}
                          title="Generate voucher"
                        >
                          <PlayCircle className="h-4 w-4" />
                        </button>
                        <button
                          className="p-1 rounded text-gray-400 hover:text-[#1557b0] hover:bg-gray-100 transition-colors"
                          onClick={() => openEdit(t)}
                          title="Edit"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          className="p-1 rounded text-gray-400 hover:text-[#1557b0] hover:bg-gray-100 transition-colors"
                          onClick={() => cloneTemplate(t)}
                          title="Clone"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                        <button
                          className="p-1 rounded text-gray-400 hover:text-[#1557b0] hover:bg-gray-100 transition-colors"
                          onClick={() => {
                            setSelected(t);
                            setModalType("view");
                          }}
                          title="View"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          className="p-1 rounded text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                          onClick={() => toggleStatus(t)}
                          title={t.status === "Active" ? "Pause" : "Activate"}
                        >
                          {t.status === "Active" ? <PauseCircle className="h-4 w-4" /> : <PlayCircle className="h-4 w-4" />}
                        </button>
                        <button
                          className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          onClick={() => deleteTemplate(t)}
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!filteredTemplates.length && (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-[12px] text-gray-500">
                    No recurring voucher templates found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderDueRun = () => (
    <div className="space-y-4">
      <div className={card}>
        <div className="flex flex-wrap justify-between gap-3">
          <div>
            <h3 className="text-[14px] font-semibold text-gray-800 flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-gray-500" /> Due Voucher Generation
            </h3>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Preview and generate all recurring vouchers due up to selected run date.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 items-end">
            <div>
              <label className="text-[11px] font-medium text-gray-600 block mb-1">Run Date</label>
              <input type="date" className={input} value={runDate} onChange={(e) => setRunDate(e.target.value)} />
            </div>
            <button className={btn2} onClick={previewDue}>
              <Eye className="h-3 w-3" /> Preview Due
            </button>
            <button className={btn} onClick={runDueTemplates} disabled={loading}>
              <PlayCircle className="h-3 w-3" /> Generate Due
            </button>
          </div>
        </div>
      </div>

      <div className={card}>
        <h4 className="text-[13px] font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <Info className="h-4 w-4 text-gray-500" /> Due as of {runDate}
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="border border-gray-100 bg-gray-50/50 rounded-lg p-3">
            <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Due Templates</p>
            <p className="text-xl font-semibold mt-1 text-gray-800">
              {templates.filter((t) => isDue(t, runDate)).length}
            </p>
          </div>
          <div className="border border-gray-100 bg-gray-50/50 rounded-lg p-3">
            <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Due Amount</p>
            <p className="text-xl font-semibold mt-1 text-gray-800">
              {money(templates.filter((t) => isDue(t, runDate)).reduce((sum, t) => sum + voucherTotal(t.lines).dr, 0))}
            </p>
          </div>
          <div className="border border-gray-100 bg-gray-50/50 rounded-lg p-3">
            <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Unbalanced</p>
            <p className="text-xl font-semibold mt-1 text-red-600">
              {templates.filter((t) => isDue(t, runDate)).filter((t) => Math.abs(voucherTotal(t.lines).diff) > 0.01).length}
            </p>
          </div>
        </div>
      </div>

      <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
        <table className="w-full text-left border-collapse whitespace-nowrap min-w-[900px]">
          <thead className="sticky top-0 bg-[#f5f6fa] shadow-sm">
            <tr>
              <th className={th}>Template</th>
              <th className={th}>Frequency</th>
              <th className={th}>Next Date</th>
              <th className={`${th} text-right`}>Amount</th>
              <th className={th}>Balance</th>
              <th className={`${th} text-center`}>Run</th>
            </tr>
          </thead>
          <tbody>
            {templates.filter((t) => isDue(t, runDate)).map((t) => {
              const total = voucherTotal(t.lines);
              return (
                <tr key={t.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                  <td className={`${td} font-medium text-gray-800`}>{t.name}</td>
                  <td className={td}>{t.frequency}</td>
                  <td className={td}>{t.nextDate}</td>
                  <td className={`${td} text-right font-medium`}>{money(total.dr)}</td>
                  <td className={td}>
                    {Math.abs(total.diff) <= 0.01 ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-medium bg-emerald-50 text-emerald-700 border-emerald-200">
                        <CheckCircle2 className="h-3 w-3" /> Balanced
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-medium bg-red-50 text-red-700 border-red-200">
                        <AlertTriangle className="h-3 w-3" /> Diff {money(total.diff)}
                      </span>
                    )}
                  </td>
                  <td className={`${td} text-center`}>
                    <button className={btn2} onClick={() => runTemplate(t, runDate, "manual")}>
                      <PlayCircle className="h-3 w-3" /> Run
                    </button>
                  </td>
                </tr>
              );
            })}
            {!templates.filter((t) => isDue(t, runDate)).length && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-[12px] text-gray-500">
                  No due templates for selected date.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderHistory = () => (
    <div className="space-y-4">
      <div className={card}>
        <div className="flex flex-wrap justify-between gap-3">
          <div>
            <h3 className="text-[14px] font-semibold text-gray-800 flex items-center gap-2">
              <History className="h-4 w-4 text-gray-500" /> Run History
            </h3>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Generated voucher log for recurring voucher templates.
            </p>
          </div>
          <button className={btn2} onClick={exportExcel}>
            <Download className="h-3 w-3" /> Export
          </button>
        </div>
      </div>

      <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
        <table className="w-full text-left border-collapse whitespace-nowrap min-w-[950px]">
          <thead className="sticky top-0 bg-[#f5f6fa] shadow-sm">
            <tr>
              <th className={th}>Run At</th>
              <th className={th}>Run Date</th>
              <th className={th}>Template</th>
              <th className={th}>Voucher No</th>
              <th className={`${th} text-right`}>Amount</th>
              <th className={th}>Mode</th>
              <th className={th}>Status</th>
            </tr>
          </thead>
          <tbody>
            {runHistory.map((h) => (
              <tr key={h.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                <td className={td}>
                  <div className="font-medium">{String(h.runAt).slice(0, 10)}</div>
                  <div className="text-[10px] text-gray-500">{String(h.runAt).slice(11, 19)}</div>
                </td>
                <td className={`${td} font-medium`}>{h.runDate}</td>
                <td className={`${td} font-medium text-gray-800`}>{h.templateName}</td>
                <td className={td}>{h.voucherNo}</td>
                <td className={`${td} text-right font-medium`}>{money(h.amount)}</td>
                <td className={td}><span className="capitalize">{h.mode || "-"}</span></td>
                <td className={td}>
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-medium bg-emerald-50 text-emerald-700 border-emerald-200">
                    <CheckCircle2 className="h-3 w-3" /> {h.status || "Success"}
                  </span>
                </td>
              </tr>
            ))}
            {!runHistory.length && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-[12px] text-gray-500">
                  No recurring voucher run history.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderTemplateModal = () => {
    const total = voucherTotal(form.lines || []);

    return (
      <Modal
        open={modalType === "edit"}
        title={selected ? "Edit Recurring Voucher Template" : "Create Recurring Voucher Template"}
        onClose={() => setModalType("")}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <label className="text-[11px] font-medium text-gray-600 block mb-1">Template Name</label>
              <input
                className={input}
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Monthly Rent Accrual"
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-gray-600 block mb-1">Voucher Type</label>
              <select className={input} value={form.voucherType} onChange={(e) => setForm((f) => ({ ...f, voucherType: e.target.value }))}>
                {["journal", "payment", "receipt", "contra", "debit_note", "credit_note"].map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-medium text-gray-600 block mb-1">Status</label>
              <select className={input} value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
                {["Active", "Paused", "Expired", "Failed"].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-medium text-gray-600 block mb-1">Frequency</label>
              <select className={input} value={form.frequency} onChange={(e) => {
                  const frequency = e.target.value;
                  setForm((f) => ({
                    ...f,
                    frequency,
                    nextDate: f.nextDate || f.startDate || todayISO(),
                  }));
                }}>
                {["Daily", "Weekly", "Fortnightly", "Monthly", "Quarterly", "Half Yearly", "Yearly"].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-medium text-gray-600 block mb-1">Interval</label>
              <input
                type="number"
                className={input}
                value={form.interval}
                onChange={(e) => setForm((f) => ({ ...f, interval: Number(e.target.value || 1) }))}
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-gray-600 block mb-1">Start Date</label>
              <input
                type="date"
                className={input}
                value={form.startDate}
                onChange={(e) => setForm((f) => ({
                    ...f,
                    startDate: e.target.value,
                    nextDate: f.nextDate || e.target.value,
                  }))}
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-gray-600 block mb-1">End Date</label>
              <input type="date" className={input} value={form.endDate} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} />
            </div>
            <div>
              <label className="text-[11px] font-medium text-gray-600 block mb-1">Next Run Date</label>
              <input type="date" className={input} value={form.nextDate} onChange={(e) => setForm((f) => ({ ...f, nextDate: e.target.value }))} />
            </div>
            
            <div className="flex items-center gap-2 border border-gray-200 rounded-md p-2 bg-gray-50 md:col-span-3">
              <label className="flex items-center gap-2 cursor-pointer mr-4">
                <input type="checkbox" checked={form.autoPost} onChange={(e) => setForm((f) => ({ ...f, autoPost: e.target.checked }))} className="rounded text-[#1557b0] focus:ring-[#1557b0]" />
                <span className="text-[12px] font-medium text-gray-700">Auto-post when due</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.requireApproval} onChange={(e) => setForm((f) => ({ ...f, requireApproval: e.target.checked }))} className="rounded text-[#1557b0] focus:ring-[#1557b0]" />
                <span className="text-[12px] font-medium text-gray-700">Create as draft / approval required</span>
              </label>
            </div>

            <div className="md:col-span-4">
              <label className="text-[11px] font-medium text-gray-600 block mb-1">Narration</label>
              <textarea
                className={`${input} py-1.5 min-h-[48px]`}
                rows={2}
                value={form.narration}
                onChange={(e) => setForm((f) => ({ ...f, narration: e.target.value }))}
                placeholder="Voucher narration"
              />
            </div>
          </div>

          <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
            <div className="flex justify-between items-center px-3 py-2 bg-[#f5f6fa] border-b border-gray-200">
              <h4 className="text-[12px] font-semibold text-gray-800">Voucher Lines</h4>
              <button className="text-[11px] text-[#1557b0] font-medium hover:underline flex items-center gap-1" onClick={addLine}>
                <Plus className="h-3 w-3" /> Add Line
              </button>
            </div>

            <div className="overflow-auto max-h-[35vh]">
              <table className="w-full text-left border-collapse whitespace-nowrap min-w-[950px]">
                <thead className="bg-[#f5f6fa] sticky top-0 shadow-sm z-10">
                  <tr>
                    <th className={th}>Account</th>
                    <th className={`${th} text-right`}>Debit</th>
                    <th className={`${th} text-right`}>Credit</th>
                    <th className={th}>Cost Center</th>
                    <th className={th}>Narration</th>
                    <th className={`${th} text-center`}>Remove</th>
                  </tr>
                </thead>
                <tbody>
                  {(form.lines || []).map((l, idx) => (
                    <tr key={l.id || idx} className="border-b border-gray-100">
                      <td className={`${td} p-1.5`}>
                        <select className={input} value={l.accountId} onChange={(e) => updateLine(idx, "accountId", e.target.value)}>
                          <option value="">Select account...</option>
                          {accounts.map((a) => (
                            <option key={a.id} value={a.id}>{a.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className={`${td} p-1.5`}>
                        <input type="number" className={`${input} text-right`} placeholder="0.00" value={l.debit || ""} onChange={(e) => updateLine(idx, "debit", e.target.value)} />
                      </td>
                      <td className={`${td} p-1.5`}>
                        <input type="number" className={`${input} text-right`} placeholder="0.00" value={l.credit || ""} onChange={(e) => updateLine(idx, "credit", e.target.value)} />
                      </td>
                      <td className={`${td} p-1.5`}>
                        <select className={input} value={l.costCenterId} onChange={(e) => updateLine(idx, "costCenterId", e.target.value)}>
                          <option value="">None</option>
                          {costCenters.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className={`${td} p-1.5`}>
                        <input className={input} value={l.narration} onChange={(e) => updateLine(idx, "narration", e.target.value)} placeholder="Line narration" />
                      </td>
                      <td className={`${td} text-center p-1.5`}>
                        <button className="p-1.5 rounded-md text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors" onClick={() => removeLine(idx)}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="bg-[#f5f6fa] px-3 py-2 border-t border-gray-200 flex justify-between items-center text-[12px]">
              <span className="font-medium text-gray-600">Totals:</span>
              <div className="flex gap-4 font-semibold text-gray-800">
                <span>Dr: <span className={Math.abs(total.diff) > 0.01 ? "text-red-600" : "text-emerald-600"}>{money(total.dr)}</span></span>
                <span>Cr: <span className={Math.abs(total.diff) > 0.01 ? "text-red-600" : "text-emerald-600"}>{money(total.cr)}</span></span>
                <span className="ml-4">Diff: <span className={Math.abs(total.diff) > 0.01 ? "text-red-600" : "text-emerald-600"}>{money(total.diff)}</span></span>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-gray-200 mt-2">
            <button className={btn2} onClick={() => setModalType("")}>Cancel</button>
            <button className={btn} onClick={saveTemplate}><Save className="h-3 w-3" /> Save Template</button>
          </div>
        </div>
      </Modal>
    );
  };

  const renderViewModal = () => {
    if (!selected) return null;
    const total = voucherTotal(selected.lines || []);

    return (
      <Modal open={modalType === "view"} title="Recurring Voucher Details" onClose={() => setModalType("")}>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="border border-gray-100 bg-gray-50/50 rounded-lg p-3">
              <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Template</p>
              <p className="text-[13px] font-semibold mt-1 text-gray-800">{selected.name}</p>
            </div>
            <div className="border border-gray-100 bg-gray-50/50 rounded-lg p-3">
              <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Frequency</p>
              <p className="text-[13px] font-semibold mt-1 text-gray-800">{selected.frequency}</p>
            </div>
            <div className="border border-gray-100 bg-gray-50/50 rounded-lg p-3">
              <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Next Run</p>
              <p className="text-[13px] font-semibold mt-1 text-gray-800">{selected.nextDate}</p>
            </div>
            <div className="border border-gray-100 bg-gray-50/50 rounded-lg p-3">
              <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Amount</p>
              <p className="text-[13px] font-semibold mt-1 text-gray-800">{money(total.dr)}</p>
            </div>
          </div>

          <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead className="bg-[#f5f6fa] border-b border-gray-200">
                <tr>
                  <th className={th}>Account</th>
                  <th className={`${th} text-right`}>Debit</th>
                  <th className={`${th} text-right`}>Credit</th>
                  <th className={th}>Narration</th>
                </tr>
              </thead>
              <tbody>
                {(selected.lines || []).map((l: any) => (
                  <tr key={l.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                    <td className={`${td} font-medium text-gray-800`}>{accountName(accounts, l.accountId)}</td>
                    <td className={`${td} text-right font-medium`}>{l.debit ? money(l.debit) : "-"}</td>
                    <td className={`${td} text-right font-medium`}>{l.credit ? money(l.credit) : "-"}</td>
                    <td className={td}>{l.narration || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-gray-200 mt-2">
            <button className={btn2} onClick={() => setModalType("")}>Close</button>
            <button className={btn} onClick={() => runTemplate(selected, todayISO(), "force")}>
              <PlayCircle className="h-3 w-3" /> Generate Now
            </button>
          </div>
        </div>
      </Modal>
    );
  };

  const renderPreviewModal = () => (
    <Modal open={modalType === "preview"} title="Due Voucher Preview" onClose={() => setModalType("")}>
      <div className="space-y-4">
        <p className="text-[12px] text-gray-600">Review {previewRows.length} templates scheduled for {runDate}.</p>
        <div className="border border-gray-200 rounded-lg overflow-hidden bg-white max-h-96 overflow-y-auto">
          <table className="w-full text-left border-collapse whitespace-nowrap min-w-[850px]">
            <thead className="bg-[#f5f6fa] sticky top-0 shadow-sm z-10">
              <tr>
                <th className={th}>Template</th>
                <th className={th}>Frequency</th>
                <th className={th}>Next Date</th>
                <th className={`${th} text-right`}>Amount</th>
                <th className={`${th} text-center`}>Status</th>
              </tr>
            </thead>
            <tbody>
              {previewRows.map((r) => (
                <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                  <td className={`${td} font-medium text-gray-800`}>{r.name}</td>
                  <td className={td}>{r.frequency}</td>
                  <td className={td}>{r.nextDate}</td>
                  <td className={`${td} text-right font-medium`}>{money(r.amount)}</td>
                  <td className={`${td} text-center`}>
                    <div className="flex justify-center">
                      {r.balanced ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-medium bg-emerald-50 text-emerald-700 border-emerald-200">
                          <CheckCircle2 className="h-3 w-3" /> Balanced
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-medium bg-red-50 text-red-700 border-red-200">
                          <AlertTriangle className="h-3 w-3" /> Unbalanced
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!previewRows.length && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-[12px] text-gray-500">
                    No due templates in preview.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t border-gray-200 mt-2">
          <button className={btn2} onClick={() => setModalType("")}>Cancel</button>
          <button className={btn} onClick={runDueTemplates} disabled={!previewRows.length}>
            <PlayCircle className="h-3 w-3" /> Generate Due
          </button>
        </div>
      </div>
    </Modal>
  );

  return (
    <div className="min-h-screen bg-[#f5f6fa] p-4 text-gray-800">
      <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800 flex items-center gap-2">
            <Repeat className="h-4 w-4 text-[#1557b0]" /> Recurring Vouchers
          </h1>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Schedule, preview and generate recurring journal/payment/receipt vouchers.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button className={btn2} onClick={loadData} disabled={loading}>
            <RefreshCcw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
          <button className={btn2} onClick={exportExcel}>
            <FileSpreadsheet className="h-3 w-3" /> Export
          </button>
          <button className={btn} onClick={openAdd}>
            <Plus className="h-3 w-3" /> New Template
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4 border-b border-gray-200 pb-2">
        {[
          ["Templates", Repeat],
          ["Due Run", CalendarClock],
          ["Run History", History],
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
            <Icon className="h-3.5 w-3.5" /> {name}
          </button>
        ))}
      </div>

      {loading && (
        <div className={`${card} mb-4 flex items-center gap-2 text-[12px] text-gray-600 font-medium`}>
          <RefreshCcw className="h-4 w-4 animate-spin text-[#1557b0]" /> Processing recurring voucher operation...
        </div>
      )}

      <div className="space-y-4">
        {renderSummary()}
        {activeTab === "Templates" && renderTemplates()}
        {activeTab === "Due Run" && renderDueRun()}
        {activeTab === "Run History" && renderHistory()}
      </div>

      {renderTemplateModal()}
      {renderViewModal()}
      {renderPreviewModal()}
    </div>
  );
}
