// src/pages/PDCManagement.tsx
// @ts-nocheck
// NEW PAGE — Post-dated cheques
// Tracks cheques received from customers (for collection) and
// cheques issued to suppliers (for payment).
// Alerts when PDCs are due for deposit.

import React, { useEffect, useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import * as XLSX from "xlsx";
import toast from "@/lib/appToast";
import {
  Plus,
  Download,
  Edit2,
  Trash2,
  X,
  AlertTriangle,
  CheckCircle,
  Clock,
  Ban,
} from "lucide-react";
import { useBranchFilter } from "../hooks/useBranchFilter";
import { readActiveBranchId } from "../lib/activeBranch";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  Number(n || 0).toLocaleString("en-NP", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const today = () => new Date().toISOString().split("T")[0];

const daysFromToday = (dateStr: string): number => {
  if (!dateStr) return 9999;
  return Math.ceil((new Date(dateStr).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
};

const inputCls =
  "h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white " +
  "focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-full";
const labelCls = "text-[12px] font-semibold text-gray-500 uppercase tracking-wide block mb-1";
const thCls =
  "px-3 py-2.5 text-left text-[12px] font-semibold text-gray-500 " +
  "uppercase tracking-wide bg-[var(--ds-surface-muted)] border-b border-gray-200 whitespace-nowrap";
const tdCls = "px-3 py-2.5 text-[12px] text-gray-700 border-b border-gray-100";
const amtCls = `${tdCls} font-mono text-right`;

const emptyPDC = () => ({
  type: "received" as "received" | "issued",
  partyId: "",
  partyName: "",
  bankName: "",
  branchName: "",
  chequeNo: "",
  chequeDate: "",
  amount: 0,
  status: "pending" as const,
  bankAccountId: "",
  linkedInvoiceNo: "",
  narration: "",
});

const statusColors: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  deposited: "bg-green-100 text-green-700",
  dishonoured: "bg-red-100 text-red-700",
  cancelled: "bg-gray-100 text-gray-500",
  returned: "bg-blue-100 text-blue-700",
};

const StatusIcon = ({ status }: { status: string }) => {
  if (status === "deposited") return <CheckCircle className="h-3.5 w-3.5 text-green-600" />;
  if (status === "dishonoured") return <Ban className="h-3.5 w-3.5 text-red-600" />;
  if (status === "pending") return <Clock className="h-3.5 w-3.5 text-amber-600" />;
  return null;
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function PDCManagement() {
  const store = useStore() as any;
  const parties = store.parties || [];
  const accounts = store.accounts || [];
  const pdcRegister: any[] = store.pdcRegister || [];
  const { branchFilter, setBranchFilter, matchBranch, branchOptions } = useBranchFilter();

  const [activeTab, setActiveTab] = useState<"received" | "issued">("received");
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyPDC());
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Load on mount
  useEffect(() => {
    if (store.loadPDCRegister) store.loadPDCRegister();
  }, []);

  // Bank accounts for deposit account selection
  const bankAccounts = useMemo(
    () => accounts.filter((a: any) => !a.isGroup && (a.name || "").toLowerCase().includes("bank")),
    [accounts],
  );

  // ── Filtered PDCs (branchName = bank branch; org scope uses branchId) ─────
  const filtered = useMemo(() => {
    return pdcRegister
      .filter((p: any) => {
        if (!matchBranch(p.branchId)) return false;
        if (p.type !== activeTab) return false;
        if (statusFilter !== "ALL" && p.status !== statusFilter) return false;
        const q = searchTerm.toLowerCase();
        if (
          q &&
          !(
            (p.chequeNo || "").toLowerCase().includes(q) ||
            (p.partyName || "").toLowerCase().includes(q) ||
            (p.bankName || "").toLowerCase().includes(q) ||
            (p.linkedInvoiceNo || "").toLowerCase().includes(q)
          )
        )
          return false;
        return true;
      })
      .sort((a: any, b: any) => a.chequeDate.localeCompare(b.chequeDate));
  }, [pdcRegister, activeTab, statusFilter, searchTerm, matchBranch, branchFilter]);

  // ── Summary stats ─────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const scoped = pdcRegister.filter((p: any) => matchBranch(p.branchId));
    const received = scoped.filter((p: any) => p.type === "received");
    const issued = scoped.filter((p: any) => p.type === "issued");
    const todayStr = today();
    const in7Days = new Date();
    in7Days.setDate(in7Days.getDate() + 7);
    const in7DaysStr = in7Days.toISOString().split("T")[0];

    return {
      pendingReceived: received.filter((p: any) => p.status === "pending").length,
      pendingIssuedAmt: issued
        .filter((p: any) => p.status === "pending")
        .reduce((s: number, p: any) => s + p.amount, 0),
      pendingReceivedAmt: received
        .filter((p: any) => p.status === "pending")
        .reduce((s: number, p: any) => s + p.amount, 0),
      dueSoon: scoped.filter(
        (p: any) =>
          p.status === "pending" && p.chequeDate >= todayStr && p.chequeDate <= in7DaysStr,
      ).length,
      overdue: scoped.filter((p: any) => p.status === "pending" && p.chequeDate < todayStr)
        .length,
      dishonouredCount: scoped.filter((p: any) => p.status === "dishonoured").length,
    };
  }, [pdcRegister, matchBranch, branchFilter]);

  // ── Save PDC ───────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.partyId) {
      toast.error("Select a party");
      return;
    }
    if (!form.chequeNo.trim()) {
      toast.error("Cheque number required");
      return;
    }
    if (!form.chequeDate) {
      toast.error("Cheque date required");
      return;
    }
    if (!form.amount || form.amount <= 0) {
      toast.error("Amount must be > 0");
      return;
    }
    if (!form.bankName.trim()) {
      toast.error("Bank name required");
      return;
    }

    try {
      const payload = {
        ...form,
        branchId: form.branchId || readActiveBranchId() || undefined,
      };
      if (editingId) {
        await store.updatePDC(editingId, payload);
        toast.success("PDC updated");
      } else {
        await store.addPDC(payload);
        toast.success("PDC recorded");
      }
      setShowModal(false);
      setEditingId(null);
      setForm(emptyPDC());
    } catch {
      toast.error("Failed to save PDC");
    }
  };

  // ── Quick status update ───────────────────────────────────────────────────
  const quickUpdateStatus = async (
    id: string,
    newStatus: string,
    extras: Record<string, any> = {},
  ) => {
    await store.updatePDC(id, { status: newStatus, ...extras });
    toast.success(`PDC marked as ${newStatus}`);
  };

  // ── Export ────────────────────────────────────────────────────────────────
  const exportToExcel = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        filtered.map((p: any) => ({
          Type: p.type,
          Party: p.partyName,
          "Cheque No": p.chequeNo,
          Bank: p.bankName,
          Branch: p.branchName || "",
          "Cheque Date": p.chequeDate,
          Amount: p.amount,
          Status: p.status,
          Invoice: p.linkedInvoiceNo || "",
          Narration: p.narration || "",
        })),
      ),
      "PDC Register",
    );
    XLSX.writeFile(wb, `PDC_${activeTab}_${today()}.xlsx`);
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-6 bg-[var(--ds-surface-muted)] min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-900">
            Post-dated cheques
          </h1>
          <p className="text-[12px] text-gray-500 mt-0.5">
            Track cheques received from customers and issued to suppliers
          </p>
        </div>
        <div className="flex gap-2 items-center">
          {branchOptions.length > 0 && (
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
              aria-label="Branch"
            >
              <option value="all">All branches</option>
              {branchOptions.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name || b.code || b.id}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={exportToExcel}
            className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-lg hover:bg-gray-50 flex items-center gap-1.5"
          >
            <Download className="h-3.5 w-3.5" /> Export
          </button>
          <button
            onClick={() => {
              setForm({ ...emptyPDC(), type: activeTab });
              setEditingId(null);
              setShowModal(true);
            }}
            className="h-8 px-3 bg-[var(--ds-action-primary)] hover:bg-[var(--ds-action-primary-hover)] text-white text-[12px] font-medium rounded-md flex items-center gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" /> Add PDC
          </button>
        </div>
      </div>

      {/* Alert banners */}
      {stats.overdue > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3 flex items-center gap-2 text-[12px] text-red-800">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <strong>{stats.overdue} PDC(s) are overdue</strong> — cheque date has passed but status is
          still Pending.
        </div>
      )}
      {stats.dueSoon > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3 flex items-center gap-2 text-[12px] text-amber-800">
          <Clock className="h-4 w-4 shrink-0" />
          <strong>{stats.dueSoon} PDC(s) due within 7 days.</strong> Prepare to deposit or make
          payment.
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
        {[
          {
            label: "PDCs to Collect",
            value: "Rs. " + fmt(stats.pendingReceivedAmt),
            color: "text-green-700",
          },
          {
            label: "PDCs to Pay",
            value: "Rs. " + fmt(stats.pendingIssuedAmt),
            color: "text-red-600",
          },
          { label: "Due This Week", value: stats.dueSoon, color: "text-amber-700" },
          { label: "Overdue", value: stats.overdue, color: "text-red-600" },
          { label: "Dishonoured", value: stats.dishonouredCount, color: "text-red-600" },
          {
            label: "Pending Received",
            value: stats.pendingReceived + " cheques",
            color: "text-gray-700",
          },
        ].map((k) => (
          <div key={k.label} className="bg-white border border-gray-200 rounded-lg p-3">
            <p className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide leading-tight">
              {k.label}
            </p>
            <p className={`font-bold mt-1 ${k.color} text-[13px]`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4">
        {(["received", "issued"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`h-8 px-4 text-[12px] font-medium rounded-md capitalize transition-colors ${
              activeTab === tab
                ? "bg-[var(--ds-action-primary)] text-white"
                : "bg-white border border-gray-300 text-gray-600 hover:bg-gray-50"
            }`}
          >
            {tab === "received" ? "Received (from Customers)" : "Issued (to Suppliers)"}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-lg p-3 mb-4 flex flex-wrap gap-3 items-end no-print">
        <div className="flex-1 min-w-[180px]">
          <label className={labelCls}>Search</label>
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cheque no, party, bank..."
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Status</label>
          <div className="flex rounded-lg border border-gray-300 overflow-hidden">
            {["ALL", "pending", "deposited", "dishonoured", "cancelled", "returned"].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`h-8 px-2.5 text-[12px] font-medium capitalize transition-colors ${
                  statusFilter === s
                    ? "bg-[var(--ds-action-primary)] text-white"
                    : "bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                {s === "ALL" ? "All" : s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* PDC Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full" style={{ minWidth: 1050 }}>
            <thead>
              <tr>
                <th className={thCls}>Cheque No.</th>
                <th className={thCls}>{activeTab === "received" ? "Customer" : "Supplier"}</th>
                <th className={thCls}>Bank / Branch</th>
                <th className={thCls}>Cheque Date</th>
                <th className={thCls}>Days</th>
                <th className={`${thCls} text-right`}>Amount</th>
                <th className={thCls}>Invoice / Ref</th>
                <th className={thCls}>Status</th>
                <th className={thCls}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-[12px] text-gray-400">
                    No PDCs found. Click "Add PDC" to record a post-dated cheque.
                  </td>
                </tr>
              )}
              {filtered.map((pdc: any) => {
                const days = daysFromToday(pdc.chequeDate);
                const isOverdue = pdc.status === "pending" && days < 0;
                const isDueSoon = pdc.status === "pending" && days >= 0 && days <= 7;
                return (
                  <tr
                    key={pdc.id}
                    className={`hover:bg-gray-50 ${isOverdue ? "bg-red-50" : isDueSoon ? "bg-amber-50" : ""}`}
                  >
                    <td className="px-3 py-2.5 text-[12px] font-mono font-semibold text-gray-700 border-b border-gray-100">
                      {pdc.chequeNo}
                    </td>
                    <td className={tdCls}>{pdc.partyName}</td>
                    <td className={tdCls}>
                      <div>{pdc.bankName}</div>
                      {pdc.branchName && (
                        <div className="text-[12px] text-gray-400">{pdc.branchName}</div>
                      )}
                    </td>
                    <td
                      className={`${tdCls} ${isOverdue ? "text-red-600 font-semibold" : isDueSoon ? "text-amber-700 font-semibold" : ""}`}
                    >
                      {pdc.chequeDate}
                    </td>
                    <td className="px-3 py-2.5 text-[12px] border-b border-gray-100">
                      {pdc.status === "pending" ? (
                        <span
                          className={`px-2 py-0.5 rounded text-[12px] font-semibold ${
                            isOverdue
                              ? "bg-red-100 text-red-700"
                              : isDueSoon
                                ? "bg-amber-100 text-amber-700"
                                : "bg-blue-100 text-blue-700"
                          }`}
                        >
                          {isOverdue
                            ? `${Math.abs(days)}d overdue`
                            : days === 0
                              ? "Today"
                              : `${days}d`}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className={`${amtCls} font-semibold text-gray-700`}>{fmt(pdc.amount)}</td>
                    <td className="px-3 py-2.5 text-[12px] font-mono text-gray-500 border-b border-gray-100">
                      {pdc.linkedInvoiceNo || pdc.narration || "—"}
                    </td>
                    <td className="px-3 py-2.5 border-b border-gray-100">
                      <span
                        className={`px-2 py-0.5 text-[12px] font-semibold rounded uppercase flex items-center gap-1 w-fit ${statusColors[pdc.status] || "bg-gray-100 text-gray-700"}`}
                      >
                        <StatusIcon status={pdc.status} />
                        {pdc.status}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 border-b border-gray-100">
                      <div className="flex gap-1 flex-wrap">
                        {pdc.status === "pending" && (
                          <>
                            <button
                              onClick={() =>
                                quickUpdateStatus(pdc.id, "deposited", { depositDate: today() })
                              }
                              className="h-6 px-2 text-[12px] font-medium bg-green-100 text-green-700 rounded hover:bg-green-200"
                              title="Mark as Deposited"
                            >
                              ✓ Deposit
                            </button>
                            <button
                              onClick={() => {
                                const reason = prompt("Dishonour reason?");
                                if (reason)
                                  quickUpdateStatus(pdc.id, "dishonoured", {
                                    dishonourDate: today(),
                                    dishonourReason: reason,
                                  });
                              }}
                              className="h-6 px-2 text-[12px] font-medium bg-red-100 text-red-700 rounded hover:bg-red-200"
                              title="Mark as Dishonoured"
                            >
                              ✗ Bounced
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => {
                            setForm({ ...pdc });
                            setEditingId(pdc.id);
                            setShowModal(true);
                          }}
                          className="p-1.5 rounded hover:bg-gray-100 text-gray-500"
                          title="Edit"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={async () => {
                            if (confirm("Delete this PDC record?")) {
                              await store.deletePDC(pdc.id);
                              toast.success("PDC deleted");
                            }
                          }}
                          className="p-1.5 rounded hover:bg-red-50 text-red-500"
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>

            {/* Footer total */}
            {filtered.length > 0 && (
              <tfoot>
                <tr className="bg-[var(--ds-action-primary)] border-t-2 border-[var(--ds-border-default)] font-bold">
                  <td colSpan={5} className="px-3 py-2.5 text-[12px] font-bold text-gray-700">
                    TOTAL ({filtered.length} cheques)
                  </td>
                  <td className="px-3 py-2.5 text-[12px] font-bold font-mono text-right text-[var(--ds-action-primary)] border-b border-gray-100">
                    Rs. {fmt(filtered.reduce((s: number, p: any) => s + p.amount, 0))}
                  </td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      <p className="text-[12px] text-gray-400 mt-3">
        PDCs sorted by cheque date • Overdue = cheque date past but not yet deposited
      </p>

      {/* ── Add / Edit Modal ───────────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-[var(--ds-z-dropdown)] flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 bg-[var(--ds-surface-muted)] border-b border-gray-200">
              <h3 className="text-[14px] font-semibold text-gray-700">
                {editingId
                  ? "Edit PDC"
                  : `Add PDC — ${form.type === "received" ? "Received from Customer" : "Issued to Supplier"}`}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 rounded hover:bg-gray-200 text-gray-500"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {/* PDC Type */}
                <div>
                  <label className={labelCls}>PDC Type *</label>
                  <select
                    className={inputCls}
                    value={form.type}
                    onChange={(e) => setForm((f: any) => ({ ...f, type: e.target.value }))}
                  >
                    <option value="received">Received (from Customer)</option>
                    <option value="issued">Issued (to Supplier)</option>
                  </select>
                </div>

                {/* Party */}
                <div>
                  <label className={labelCls}>
                    {form.type === "received" ? "Customer *" : "Supplier *"}
                  </label>
                  <select
                    className={inputCls}
                    value={form.partyId}
                    onChange={(e) => {
                      const party = parties.find((p: any) => p.id === e.target.value);
                      setForm((f: any) => ({
                        ...f,
                        partyId: e.target.value,
                        partyName: party?.name || "",
                        partyPan: party?.pan || "",
                      }));
                    }}
                  >
                    <option value="">— Select Party —</option>
                    {parties
                      .filter((p: any) =>
                        form.type === "received"
                          ? p.type === "customer" || p.type === "both"
                          : p.type === "supplier" || p.type === "both",
                      )
                      .map((p: any) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                  </select>
                </div>

                {/* Cheque details */}
                <div>
                  <label className={labelCls}>Cheque Number *</label>
                  <input
                    className={inputCls}
                    value={form.chequeNo}
                    onChange={(e) => setForm((f: any) => ({ ...f, chequeNo: e.target.value }))}
                    placeholder="e.g. 000123456"
                  />
                </div>
                <div>
                  <label className={labelCls}>Cheque Date *</label>
                  <input
                    type="date"
                    className={inputCls}
                    value={form.chequeDate}
                    onChange={(e) => setForm((f: any) => ({ ...f, chequeDate: e.target.value }))}
                  />
                </div>
                <div>
                  <label className={labelCls}>Bank Name *</label>
                  <input
                    className={inputCls}
                    value={form.bankName}
                    onChange={(e) => setForm((f: any) => ({ ...f, bankName: e.target.value }))}
                    placeholder="e.g. Nepal Investment Bank"
                  />
                </div>
                <div>
                  <label className={labelCls}>Branch</label>
                  <input
                    className={inputCls}
                    value={form.branchName}
                    onChange={(e) => setForm((f: any) => ({ ...f, branchName: e.target.value }))}
                    placeholder="e.g. New Road"
                  />
                </div>
                <div>
                  <label className={labelCls}>Amount (Rs.) *</label>
                  <input
                    type="number"
                    className={inputCls}
                    value={form.amount || ""}
                    onChange={(e) =>
                      setForm((f: any) => ({ ...f, amount: Number(e.target.value) || 0 }))
                    }
                    min={0}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className={labelCls}>Status</label>
                  <select
                    className={inputCls}
                    value={form.status}
                    onChange={(e) => setForm((f: any) => ({ ...f, status: e.target.value }))}
                  >
                    <option value="pending">Pending</option>
                    <option value="deposited">Deposited</option>
                    <option value="dishonoured">Dishonoured / Bounced</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="returned">Returned</option>
                  </select>
                </div>

                {/* Our bank account for deposit */}
                {form.type === "received" && (
                  <div>
                    <label className={labelCls}>Deposit To (Our Bank Account)</label>
                    <select
                      className={inputCls}
                      value={form.bankAccountId}
                      onChange={(e) =>
                        setForm((f: any) => ({ ...f, bankAccountId: e.target.value }))
                      }
                    >
                      <option value="">— Select Account —</option>
                      {bankAccounts.map((a: any) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Deposit date if deposited */}
                {form.status === "deposited" && (
                  <div>
                    <label className={labelCls}>Deposit Date</label>
                    <input
                      type="date"
                      className={inputCls}
                      value={form.depositDate || ""}
                      onChange={(e) => setForm((f: any) => ({ ...f, depositDate: e.target.value }))}
                    />
                  </div>
                )}

                {/* Dishonour details */}
                {form.status === "dishonoured" && (
                  <>
                    <div>
                      <label className={labelCls}>Dishonour Date</label>
                      <input
                        type="date"
                        className={inputCls}
                        value={form.dishonourDate || ""}
                        onChange={(e) =>
                          setForm((f: any) => ({ ...f, dishonourDate: e.target.value }))
                        }
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Reason</label>
                      <input
                        className={inputCls}
                        value={form.dishonourReason || ""}
                        onChange={(e) =>
                          setForm((f: any) => ({ ...f, dishonourReason: e.target.value }))
                        }
                        placeholder="e.g. Insufficient funds"
                      />
                    </div>
                  </>
                )}

                <div>
                  <label className={labelCls}>Linked Invoice No.</label>
                  <input
                    className={inputCls}
                    value={form.linkedInvoiceNo || ""}
                    onChange={(e) =>
                      setForm((f: any) => ({ ...f, linkedInvoiceNo: e.target.value }))
                    }
                    placeholder="Invoice or bill reference"
                  />
                </div>
                <div className="col-span-2">
                  <label className={labelCls}>Narration / Notes</label>
                  <input
                    className={inputCls}
                    value={form.narration || ""}
                    onChange={(e) => setForm((f: any) => ({ ...f, narration: e.target.value }))}
                    placeholder="Any additional notes..."
                  />
                </div>
              </div>
            </div>

            <div className="px-4 py-3 border-t border-gray-200 flex justify-end gap-2 bg-gray-50">
              <button
                onClick={() => setShowModal(false)}
                className="h-8 px-4 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="h-8 px-4 bg-[var(--ds-action-primary)] hover:bg-[var(--ds-action-primary-hover)] text-white text-[12px] font-medium rounded-md"
              >
                {editingId ? "Update PDC" : "Record PDC"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
