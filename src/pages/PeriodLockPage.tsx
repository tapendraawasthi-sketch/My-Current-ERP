// @ts-nocheck
import React, { useState, useEffect, useMemo } from "react";
import { useStore } from "../store/useStore";
import { getDB, generateId } from "../lib/db";
import toast from "react-hot-toast";
import * as XLSX from "xlsx";
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Lock,
  Unlock,
  ChevronRight,
  RefreshCw,
  Shield,
  Activity,
  Download,
  Settings,
  AlertCircle,
} from "lucide-react";

function money(v: number): string {
  const abs = Math.abs(Number(v || 0));
  const s = abs.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return v < 0 ? `(${s})` : s;
}

const cardClass = "bg-white border border-gray-200 rounded-md shadow-sm p-4";
const tableHeadClass =
  "bg-[#f5f6fa] border-b border-gray-200 px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide";
const tableCellClass = "px-3 py-2.5 text-[12px] text-gray-700 border-b border-gray-100";

const primaryBtn =
  "h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md flex items-center justify-center gap-1.5 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed";
const outlineBtn =
  "h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 transition-colors flex items-center justify-center gap-1.5 shadow-sm";
const dangerBtn =
  "h-8 px-3 bg-red-600 hover:bg-red-700 text-white text-[12px] font-medium rounded-md flex items-center justify-center gap-1.5 transition-colors shadow-sm disabled:opacity-50";
const inputClass =
  "h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] transition-shadow w-full";

export function isPeriodLocked(dateString: string, periodLocks: any[]): boolean {
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const key = `${year}-${month}`;
  return (periodLocks || []).some((l) => l.periodKey === key);
}

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

function getPeriodKey(date: string) {
  const d = new Date(date);
  return `${d.getFullYear()}-${d.getMonth() + 1}`;
}

function monthName(date: Date) {
  return date.toLocaleString("default", { month: "long", year: "numeric" });
}

function buildPeriods(currentFiscalYear: any) {
  const start = new Date(currentFiscalYear?.startDate || new Date(new Date().getFullYear(), 0, 1));
  const periods = [];

  for (let i = 0; i < 12; i++) {
    const s = new Date(start.getFullYear(), start.getMonth() + i, 1);
    const e = new Date(s.getFullYear(), s.getMonth() + 1, 0);

    periods.push({
      periodKey: `${s.getFullYear()}-${s.getMonth() + 1}`,
      label: monthName(s),
      startDate: s.toISOString().split("T")[0],
      endDate: e.toISOString().split("T")[0],
      year: s.getFullYear(),
      month: s.getMonth() + 1,
    });
  }

  return periods;
}

function severityClass(severity: string) {
  if (severity === "Critical") return "bg-red-100 text-red-700 border border-red-200";
  if (severity === "High") return "bg-orange-100 text-orange-700 border border-orange-200";
  if (severity === "Warning") return "bg-amber-100 text-amber-700 border border-amber-200";
  return "bg-green-100 text-green-700 border border-green-200";
}

function Modal({ open, title, children, onClose }) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white border border-gray-200 shadow-xl rounded-lg w-full flex flex-col max-w-xl max-h-[90vh]">
        <div className="flex justify-between items-center p-4 border-b border-gray-200 bg-gray-50 rounded-t-lg">
          <h2 className="text-[15px] font-semibold text-gray-800">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-xl leading-none"
          >
            &times;
          </button>
        </div>
        <div className="p-5 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

export default function PeriodLockPage() {
  const {
    currentFiscalYear = {},
    fiscalYears = [],
    vouchers = [],
    currentUser = {},
    accounts = [],
    items = [],
    stockMovements = [],
    invoices = [],
    employees = [],
    parties = [],
  } = useStore();

  const [activeTab, setActiveTab] = useState("Period Lock");
  const [periodLocks, setPeriodLocks] = useState([]);
  const [requiredPin, setRequiredPin] = useState("");
  const [pinEntry, setPinEntry] = useState("");

  const [confirmModal, setConfirmModal] = useState(false);
  const [actionPeriod, setActionPeriod] = useState(null);
  const [actionType, setActionType] = useState("");

  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");

  const [autoLockEnabled, setAutoLockEnabled] = useState(false);
  const [autoLockDays, setAutoLockDays] = useState(30);

  const [healthChecks, setHealthChecks] = useState([]);
  const [expandedHealthIndex, setExpandedHealthIndex] = useState(null);

  useEffect(() => {
    const db = getDB();

    db.table("periodLocks")
      .toArray()
      .catch(() => [])
      .then(setPeriodLocks);

    db.table("securitySettings")
      .get("global")
      .catch(() => null)
      .then((s) => {
        setRequiredPin(s?.periodLockPin || "");
        setAutoLockEnabled(Boolean(s?.autoLockEnabled));
        setAutoLockDays(Number(s?.autoLockDays || 30));
      });
  }, []);

  const periods = useMemo(() => buildPeriods(currentFiscalYear), [currentFiscalYear]);

  useEffect(() => {
    if (!autoLockEnabled) return;
    runAutoLock();
  }, [autoLockEnabled, autoLockDays, periods]);

  async function runAutoLock() {
    const db = getDB();
    const now = new Date();

    for (const p of periods) {
      const ended = new Date(p.endDate);
      const daysPast = Math.floor((now.getTime() - ended.getTime()) / 86400000);
      const alreadyLocked = periodLocks.some((l) => l.periodKey === p.periodKey);

      if (daysPast > autoLockDays && !alreadyLocked) {
        const row = {
          id: generateId(),
          periodKey: p.periodKey,
          lockedAt: new Date().toISOString(),
          lockedBy: "system",
          lockedByName: "Auto Lock",
          requiresPin: false,
        };
        await db
          .table("periodLocks")
          .put(row)
          .catch(() => {});
        setPeriodLocks((locks) => [...locks, row]);
      }
    }
  }

  function getLockForPeriod(periodKey: string) {
    return periodLocks.find((l) => l.periodKey === periodKey);
  }

  function openLockModal(period: any) {
    setActionPeriod(period);
    setActionType("lock");
    setPinEntry("");
    setConfirmModal(true);
  }

  function openUnlockModal(period: any) {
    if (currentUser?.role !== "admin") {
      toast.error("Only admin can unlock periods");
      return;
    }

    setActionPeriod(period);
    setActionType("unlock");
    setPinEntry("");
    setConfirmModal(true);
  }

  async function confirmPeriodAction() {
    if (requiredPin && pinEntry !== requiredPin) return toast.error("Invalid PIN");
    if (!actionPeriod) return;

    const db = getDB();

    if (actionType === "lock") {
      const row = {
        id: generateId(),
        periodKey: actionPeriod.periodKey,
        lockedAt: new Date().toISOString(),
        lockedBy: currentUser?.id,
        lockedByName: currentUser?.name,
        requiresPin: Boolean(requiredPin),
      };

      await db
        .table("periodLocks")
        .put(row)
        .catch(() => {});
      setPeriodLocks((locks) => locks.filter((l) => l.periodKey !== row.periodKey).concat(row));
      toast.success("Period locked.");
    }

    if (actionType === "unlock") {
      const lock = getLockForPeriod(actionPeriod.periodKey);
      if (lock) {
        await db
          .table("periodLocks")
          .delete(lock.id)
          .catch(() => {});
        setPeriodLocks((locks) => locks.filter((l) => l.id !== lock.id));
        toast.success("Period unlocked.");
      }
    }

    setConfirmModal(false);
  }

  async function savePin() {
    if (!/^\d{4}$/.test(newPin)) return toast.error("PIN must be exactly 4 digits");
    if (newPin !== confirmPin) return toast.error("PIN and confirmation do not match");

    const db = getDB();
    const existing = await db
      .table("securitySettings")
      .get("global")
      .catch(() => null);

    await db
      .table("securitySettings")
      .put({
        ...(existing || {}),
        id: "global",
        periodLockPin: newPin,
        pinSetAt: new Date().toISOString(),
        pinSetBy: currentUser?.name,
        autoLockEnabled,
        autoLockDays,
      })
      .catch(() => {});

    setRequiredPin(newPin);
    setNewPin("");
    setConfirmPin("");
    toast.success("Period lock PIN saved");
  }

  async function clearPin() {
    const db = getDB();
    const existing = await db
      .table("securitySettings")
      .get("global")
      .catch(() => null);

    await db
      .table("securitySettings")
      .put({
        ...(existing || {}),
        id: "global",
        periodLockPin: "",
        autoLockEnabled,
        autoLockDays,
      })
      .catch(() => {});

    setRequiredPin("");
    toast.success("PIN cleared");
  }

  async function saveAutoLockSettings() {
    const db = getDB();
    const existing = await db
      .table("securitySettings")
      .get("global")
      .catch(() => null);

    await db
      .table("securitySettings")
      .put({
        ...(existing || {}),
        id: "global",
        periodLockPin: requiredPin,
        autoLockEnabled,
        autoLockDays,
        autoLockSavedAt: new Date().toISOString(),
      })
      .catch(() => {});

    toast.success("Auto-lock settings saved");
  }

  function runHealthCheck() {
    const unbalanced = (vouchers || []).filter((v) => {
      const dr = (v.lines || []).reduce((s, l) => s + Number(l.debit || 0), 0);
      const cr = (v.lines || []).reduce((s, l) => s + Number(l.credit || 0), 0);
      return Math.abs(dr - cr) > 0.01 && v.status === "posted";
    });

    const noNarration = (vouchers || []).filter((v) => !v.narration && v.status === "posted");

    const noParentAccounts = (accounts || []).filter(
      (a) => !a.isGroup && !a.parentId && a.level !== "group",
    );

    const itemsNoUnit = (items || []).filter((i) => !i.unit && !i.uom);

    const invoicePartyIds = Array.from(
      new Set((invoices || []).map((i) => i.partyId).filter(Boolean)),
    );
    const partiesNoPAN = invoicePartyIds
      .map((id) => parties?.find((p: any) => p.id === id))
      .filter((p) => p && !p.panNumber);

    const negativeStockItems = (items || []).filter((item) => {
      const stock = (stockMovements || [])
        .filter((m) => m.itemId === item.id)
        .reduce(
          (a, m) => {
            const qty = Number(m.quantity || m.qty || 0);
            const type = String(m.type || "").toLowerCase();
            return type === "in" || type === "purchase" || type.includes("in") ? a + qty : a - qty;
          },
          Number(item.currentStock || 0),
        );
      return stock < 0;
    });

    const invoicesNoParty = (invoices || []).filter(
      (i) => !i.partyId && i.type === "sales-invoice",
    );

    const healthChecks = [
      {
        category: "Vouchers",
        issue: "Unbalanced voucher lines",
        severity: "Critical",
        count: unbalanced.length,
        canAutoFix: false,
        records: unbalanced.slice(0, 10),
      },
      {
        category: "Vouchers",
        issue: "Vouchers with no narration",
        severity: "Warning",
        count: noNarration.length,
        canAutoFix: false,
        records: noNarration.slice(0, 10),
      },
      {
        category: "Accounts",
        issue: "Accounts with no parent group assigned",
        severity: "Warning",
        count: noParentAccounts.length,
        canAutoFix: false,
        records: noParentAccounts.slice(0, 10),
      },
      {
        category: "Items",
        issue: "Items with no unit of measure",
        severity: "Warning",
        count: itemsNoUnit.length,
        canAutoFix: true,
        records: itemsNoUnit.slice(0, 10),
      },
      {
        category: "Parties",
        issue: "Parties with no PAN number (TDS risk)",
        severity: "Warning",
        count: partiesNoPAN.length,
        canAutoFix: false,
        records: partiesNoPAN.slice(0, 10),
      },
      {
        category: "Stock",
        issue: "Negative stock quantities",
        severity: "Critical",
        count: negativeStockItems.length,
        canAutoFix: false,
        records: negativeStockItems.slice(0, 10),
      },
      {
        category: "Invoices",
        issue: "Invoices with no party assigned",
        severity: "High",
        count: invoicesNoParty.length,
        canAutoFix: false,
        records: invoicesNoParty.slice(0, 10),
      },
    ];

    setHealthChecks(healthChecks);
    toast.success("Health check completed");
  }

  const healthScore = useMemo(() => {
    if (!healthChecks.length) return 100;

    const scores = healthChecks.map((c) => {
      if (c.count === 0) return 100;
      if (c.severity === "Critical") return 0;
      if (c.severity === "High") return 50;
      if (c.severity === "Warning") return 90;
      return 100;
    });

    return Math.round(scores.reduce((s, v) => s + v, 0) / scores.length);
  }, [healthChecks]);

  async function autoFix(check: any) {
    if (check.issue === "Items with no unit of measure") {
      const db = getDB();
      const rows = (items || []).filter((i) => !i.unit && !i.uom);

      for (const item of rows) {
        await db
          .table("items")
          .update(item.id, { unit: "PCS", uom: "PCS" })
          .catch(() => {});
      }

      toast.success(`${rows.length} items updated with default unit PCS`);
      runHealthCheck();
    }
  }

  function exportHealthReport() {
    const rows = healthChecks.flatMap((c) =>
      (c.records || []).length
        ? c.records.map((r) => ({
            Category: c.category,
            Issue: c.issue,
            Severity: c.severity,
            Count: c.count,
            RecordID: r.id || "",
            RecordName: r.name || r.invoiceNo || r.voucherNo || "",
          }))
        : [
            {
              Category: c.category,
              Issue: c.issue,
              Severity: c.severity,
              Count: c.count,
              RecordID: "",
              RecordName: "",
            },
          ],
    );

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Health Report");
    XLSX.writeFile(wb, "Data_Health_Report.xlsx");
  }

  const tabs = [
    { id: "Period Lock", label: "Period Lock", icon: <Lock size={14} /> },
    { id: "Lock Settings", label: "Lock Settings", icon: <Settings size={14} /> },
    { id: "Data Health Check", label: "Data Health Check", icon: <Activity size={14} /> },
  ];

  return (
    <div className="min-h-screen bg-[#f5f6fa] p-4 text-gray-800">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800 flex items-center gap-2">
            <Shield size={18} className="text-[#1557b0]" /> Period Lock & Data Health
          </h1>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Lock accounting periods, configure lock PINs, and run data integrity checks.
          </p>
        </div>
      </div>

      <div className="flex gap-2 mb-6 border-b border-gray-200 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-[12px] font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === t.id
                ? "border-[#1557b0] text-[#1557b0]"
                : "border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50"
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "Period Lock" && (
        <div className={cardClass}>
          <div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-2">
            <h2 className="text-[14px] font-semibold text-gray-800">
              Accounting Periods - {currentFiscalYear?.name}
            </h2>
          </div>

          <div className="overflow-x-auto rounded-md border border-gray-200">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  {[
                    "Period",
                    "Start Date",
                    "End Date",
                    "Lock Status",
                    "Vouchers",
                    "Locked By",
                    "Locked At",
                    "Action",
                  ].map((h) => (
                    <th
                      key={h}
                      className={h === "Vouchers" ? `${tableHeadClass} text-right` : tableHeadClass}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {periods.map((p) => {
                  const lock = getLockForPeriod(p.periodKey);
                  const isLocked = Boolean(lock);
                  const voucherCount = vouchers.filter(
                    (v) => v.date >= p.startDate && v.date <= p.endDate,
                  ).length;

                  return (
                    <tr
                      key={p.periodKey}
                      className={
                        isLocked ? "bg-red-50/50 hover:bg-red-50" : "bg-white hover:bg-gray-50"
                      }
                    >
                      <td className={`${tableCellClass} font-medium`}>{p.label}</td>
                      <td className={tableCellClass}>{p.startDate}</td>
                      <td className={tableCellClass}>{p.endDate}</td>
                      <td className={tableCellClass}>
                        {isLocked ? (
                          <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-[10px] font-bold tracking-wide flex items-center gap-1 w-max">
                            <Lock size={12} /> Locked
                          </span>
                        ) : (
                          <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-[10px] font-bold tracking-wide flex items-center gap-1 w-max">
                            <Unlock size={12} /> Open
                          </span>
                        )}
                      </td>
                      <td className={`${tableCellClass} text-right font-medium`}>{voucherCount}</td>
                      <td className={tableCellClass}>{lock?.lockedByName || ""}</td>
                      <td className={tableCellClass}>
                        {lock?.lockedAt ? new Date(lock.lockedAt).toLocaleString() : ""}
                      </td>
                      <td className={tableCellClass}>
                        {isLocked ? (
                          <button
                            className="text-[11px] font-medium text-red-600 hover:text-red-800 transition-colors flex items-center gap-1"
                            onClick={() => openUnlockModal(p)}
                          >
                            <Unlock size={14} /> Unlock Period
                          </button>
                        ) : (
                          <button
                            className="text-[11px] font-medium text-[#1557b0] hover:text-[#0f4a96] transition-colors flex items-center gap-1"
                            onClick={() => openLockModal(p)}
                          >
                            <Lock size={14} /> Lock Period
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "Lock Settings" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className={cardClass}>
            <div className="flex items-center gap-2 mb-4 border-b border-gray-100 pb-2">
              <Lock size={16} className="text-gray-500" />
              <h2 className="text-[14px] font-semibold text-gray-800">PIN Configuration</h2>
            </div>

            <div
              className={`p-3 rounded-md border text-[12px] mb-4 flex items-center gap-2 ${requiredPin ? "bg-green-50 border-green-200 text-green-800" : "bg-amber-50 border-amber-200 text-amber-800"}`}
            >
              {requiredPin ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
              Current Period Lock PIN is:{" "}
              <b className="uppercase">{requiredPin ? "Set" : "Not Set"}</b>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-1">
                  Set New PIN (4 digits)
                </label>
                <input
                  className={inputClass}
                  type="password"
                  maxLength={4}
                  placeholder="Enter 4-digit PIN"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-1">
                  Confirm PIN
                </label>
                <input
                  className={inputClass}
                  type="password"
                  maxLength={4}
                  placeholder="Confirm 4-digit PIN"
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))}
                />
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                <button
                  className="text-[11px] text-red-600 hover:text-red-800 font-medium transition-colors"
                  onClick={clearPin}
                >
                  Clear PIN (Disable Protection)
                </button>
                <button className={primaryBtn} onClick={savePin}>
                  Save PIN
                </button>
              </div>
            </div>
          </div>

          <div className={cardClass}>
            <div className="flex items-center gap-2 mb-4 border-b border-gray-100 pb-2">
              <Settings size={16} className="text-gray-500" />
              <h2 className="text-[14px] font-semibold text-gray-800">Auto-Lock Settings</h2>
            </div>

            <p className="text-[11px] text-gray-500 mb-4">
              Automatically lock accounting periods after a specified number of days past the period
              end date to ensure compliance.
            </p>

            <div className="space-y-4">
              <label className="flex items-center gap-2 cursor-pointer p-3 border border-gray-200 rounded-md bg-gray-50 hover:bg-gray-100 transition-colors">
                <input
                  type="checkbox"
                  className="rounded text-[#1557b0] focus:ring-[#1557b0]"
                  checked={autoLockEnabled}
                  onChange={(e) => setAutoLockEnabled(e.target.checked)}
                />
                <div className="text-[12px] font-medium text-gray-700">
                  Enable Auto-Lock for periods
                </div>
              </label>

              <div className={autoLockEnabled ? "opacity-100" : "opacity-50 pointer-events-none"}>
                <label className="block text-[11px] font-medium text-gray-600 mb-1">
                  Grace Period (Days past period end)
                </label>
                <div className="flex gap-2 items-center">
                  <input
                    className={`${inputClass} w-32`}
                    type="number"
                    value={autoLockDays}
                    onChange={(e) => setAutoLockDays(Number(e.target.value))}
                    min={0}
                  />
                  <span className="text-[11px] text-gray-500">Days</span>
                </div>
              </div>

              <div className="flex justify-end pt-2 border-t border-gray-100 mt-6">
                <button className={primaryBtn} onClick={saveAutoLockSettings}>
                  Save Settings
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "Data Health Check" && (
        <div className="space-y-6">
          <div className={cardClass}>
            <div className="flex flex-col md:flex-row justify-between gap-4 items-center">
              <div>
                <h2 className="text-[14px] font-semibold text-gray-800 flex items-center gap-2 mb-1">
                  <Activity
                    size={16}
                    className={
                      healthScore >= 90
                        ? "text-green-600"
                        : healthScore >= 60
                          ? "text-amber-500"
                          : "text-red-600"
                    }
                  />
                  Data Health Monitor
                </h2>
                <p className="text-[11px] text-gray-500">
                  Scan your accounting, inventory, and party data for structural integrity issues.
                </p>
              </div>

              <div className="flex items-center gap-6">
                <div className="text-center">
                  <div className="text-[10px] font-bold tracking-wide text-gray-500 mb-0.5">
                    Health Score
                  </div>
                  <div
                    className={`text-[24px] font-black leading-none ${healthScore >= 90 ? "text-green-600" : healthScore >= 60 ? "text-amber-500" : "text-red-600"}`}
                  >
                    {healthScore}%
                  </div>
                </div>
                <div className="w-[1px] h-10 bg-gray-200"></div>
                <div className="flex flex-col gap-2">
                  <button className={primaryBtn} onClick={runHealthCheck}>
                    <RefreshCw size={14} /> Run Scan
                  </button>
                  <button className={outlineBtn} onClick={exportHealthReport}>
                    <Download size={14} /> Export Report
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className={cardClass}>
            <div className="overflow-x-auto rounded-md border border-gray-200">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    {[
                      "Category",
                      "Issue Description",
                      "Issues Found",
                      "Severity",
                      "Auto-Fix",
                      "Action",
                    ].map((h) => (
                      <th key={h} className={tableHeadClass}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {healthChecks.map((c, idx) => (
                    <React.Fragment key={idx}>
                      <tr className="bg-white hover:bg-gray-50 transition-colors">
                        <td className={`${tableCellClass} font-medium`}>{c.category}</td>
                        <td className={tableCellClass}>{c.issue}</td>
                        <td className={tableCellClass}>
                          {c.count > 0 ? (
                            <span className="inline-flex items-center justify-center bg-red-100 text-red-700 h-6 px-2 rounded-full text-[11px] font-bold">
                              {c.count} Found
                            </span>
                          ) : (
                            <span className="inline-flex items-center justify-center bg-green-50 text-green-700 h-6 px-2 rounded-full text-[11px] font-bold gap-1">
                              <CheckCircle size={10} /> All Good
                            </span>
                          )}
                        </td>
                        <td className={tableCellClass}>
                          <span
                            className={`${severityClass(c.severity)} px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide`}
                          >
                            {c.severity}
                          </span>
                        </td>
                        <td className={tableCellClass}>
                          {c.canAutoFix ? (
                            <span className="text-green-600 font-medium text-[11px]">
                              Available
                            </span>
                          ) : (
                            <span className="text-gray-400 text-[11px]">Manual Only</span>
                          )}
                        </td>
                        <td className={tableCellClass}>
                          <div className="flex items-center gap-2">
                            <button
                              className="text-[11px] font-medium text-[#1557b0] hover:underline"
                              onClick={() =>
                                setExpandedHealthIndex(expandedHealthIndex === idx ? null : idx)
                              }
                              disabled={c.count === 0}
                            >
                              {expandedHealthIndex === idx ? "Hide Details" : "View Details"}
                            </button>

                            {c.canAutoFix && c.count > 0 && (
                              <button
                                className="text-[11px] font-medium text-amber-600 hover:underline flex items-center gap-1"
                                onClick={() => autoFix(c)}
                              >
                                <RefreshCw size={10} /> Auto-Fix
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {expandedHealthIndex === idx && (
                        <tr>
                          <td
                            colSpan={6}
                            className="bg-gray-50 p-4 border-b border-gray-200 shadow-inner"
                          >
                            <div className="font-semibold text-[12px] mb-3 text-gray-700 flex items-center gap-2">
                              <AlertCircle size={14} className="text-amber-500" /> Sample of
                              Affected Records
                            </div>
                            {(c.records || []).length === 0 ? (
                              <div className="text-[11px] text-gray-500 italic">
                                No record sample available.
                              </div>
                            ) : (
                              <div className="bg-white border border-gray-200 rounded-md overflow-hidden max-h-64 overflow-y-auto">
                                <table className="w-full border-collapse">
                                  <thead className="bg-gray-100 sticky top-0">
                                    <tr>
                                      <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase">
                                        ID
                                      </th>
                                      <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase">
                                        Name / Reference
                                      </th>
                                      <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase">
                                        Details
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-100">
                                    {(c.records || []).map((r, ri) => (
                                      <tr key={ri} className="hover:bg-gray-50">
                                        <td className="px-3 py-1.5 text-[11px] text-gray-500 font-mono">
                                          {r.id?.substring(0, 8) || "..."}
                                        </td>
                                        <td className="px-3 py-1.5 text-[11px] font-medium text-gray-800">
                                          {r.name || r.invoiceNo || r.voucherNo || "N/A"}
                                        </td>
                                        <td className="px-3 py-1.5 text-[11px] text-gray-600">
                                          {r.date ? (
                                            <span className="mr-2">Date: {r.date}</span>
                                          ) : (
                                            ""
                                          )}
                                          {r.type ? (
                                            <span className="mr-2">
                                              Type:{" "}
                                              <span className="bg-gray-100 px-1 rounded">
                                                {r.type}
                                              </span>
                                            </span>
                                          ) : (
                                            ""
                                          )}
                                          {r.status ? (
                                            <span className="mr-2">
                                              Status:{" "}
                                              <span className="bg-gray-100 px-1 rounded">
                                                {r.status}
                                              </span>
                                            </span>
                                          ) : (
                                            ""
                                          )}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}

                  {!healthChecks.length && (
                    <tr>
                      <td
                        colSpan={6}
                        className="text-center p-10 text-gray-500 text-[12px] bg-gray-50"
                      >
                        <Activity size={24} className="mx-auto text-gray-400 mb-2 opacity-50" />
                        <p>No health scan results available.</p>
                        <p className="mt-1">
                          Click "Run Scan" to check your books for structural integrity issues.
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <Modal
        open={confirmModal}
        title={actionType === "lock" ? "Confirm Period Lock" : "Confirm Period Unlock"}
        onClose={() => setConfirmModal(false)}
      >
        {actionPeriod && (
          <div className="space-y-4">
            <div
              className={`p-3 rounded-md border text-[12px] flex items-start gap-2 ${actionType === "lock" ? "bg-amber-50 border-amber-200 text-amber-800" : "bg-red-50 border-red-200 text-red-800"}`}
            >
              <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
              <div>
                You are about to <b>{actionType}</b> the accounting period for{" "}
                <b>{actionPeriod.label}</b>.
                {actionType === "lock" && (
                  <p className="mt-1">
                    This will prevent any new vouchers from being posted or edited in this date
                    range.
                  </p>
                )}
                {actionType === "unlock" && (
                  <p className="mt-1">
                    This will allow users to modify historical records, potentially affecting
                    financial reports.
                  </p>
                )}
              </div>
            </div>

            {requiredPin && (
              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-1">
                  Enter Admin PIN
                </label>
                <input
                  className={inputClass}
                  type="password"
                  maxLength={4}
                  placeholder="4-digit PIN"
                  value={pinEntry}
                  onChange={(e) => setPinEntry(e.target.value.replace(/\D/g, ""))}
                />
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 mt-2">
              <button className={outlineBtn} onClick={() => setConfirmModal(false)}>
                Cancel
              </button>
              <button
                className={actionType === "unlock" ? dangerBtn : primaryBtn}
                onClick={confirmPeriodAction}
              >
                {actionType === "unlock" ? "Confirm Unlock" : "Confirm Lock"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
