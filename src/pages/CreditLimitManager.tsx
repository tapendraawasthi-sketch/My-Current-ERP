// @ts-nocheck
import React, { useState, useEffect, useMemo } from "react";
import { useStore } from "../store/useStore";
import { getDB, generateId } from "../lib/db";
import * as XLSX from "xlsx";
import toast from "@/lib/appToast";
import {
  Edit2,
  Save,
  AlertTriangle,
  CheckCircle,
  Download,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
  FileText,
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
  "h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md flex items-center justify-center gap-1.5 transition-colors shadow-sm";
const outlineBtn =
  "h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 transition-colors flex items-center justify-center gap-1.5 shadow-sm";
const inputClass =
  "h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] transition-shadow";

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

function getPartyBillwiseOutstanding(
  partyId: string,
  type: "sales" | "purchase",
  invoices: any[],
  vouchers: any[],
  parties: any[],
) {
  const invType = type === "sales" ? ["sales-invoice", "sales"] : ["purchase-invoice", "purchase"];

  const partyInvoices = (invoices || []).filter(
    (i) =>
      invType.includes(i.type) &&
      i.partyId === partyId &&
      i.status === "posted" &&
      (i.paymentStatus === "unpaid" || i.paymentStatus === "partial"),
  );

  return partyInvoices
    .map((inv) => {
      const paid = (vouchers || [])
        .filter(
          (v) =>
            (v.linkedInvoiceId === inv.id ||
              (v.billWiseDetails || []).some((b: any) => b.invoiceId === inv.id)) &&
            v.status === "posted",
        )
        .reduce((s: number, v: any) => s + Number(v.grandTotal || v.amount || 0), 0);

      const balance = Math.max(0, Number(inv.grandTotal || 0) - paid);
      const party = (parties || []).find((p: any) => p.id === partyId);
      const creditDays = Number(party?.creditDays || 30);

      const invoiceDate = new Date(inv.date);
      const dueDate = new Date(invoiceDate);
      dueDate.setDate(dueDate.getDate() + creditDays);

      const daysOverdue = Math.max(
        0,
        Math.floor((new Date().getTime() - dueDate.getTime()) / 86400000),
      );

      const interestRate = Number(party?.interestRate || 0);
      const interest =
        balance > 0 && daysOverdue > 0 ? balance * (interestRate / 100 / 365) * daysOverdue : 0;

      return {
        ...inv,
        paid,
        balance,
        dueDate: dueDate.toISOString().split("T")[0],
        daysOverdue,
        interest,
        invoiceDate: inv.date,
      };
    })
    .filter((i) => i.balance > 0);
}

export function checkCreditBlock(
  partyId: string,
  parties: any[],
  creditSettings: any[],
  currentOutstanding: number,
): { isBlocked: boolean; reason: string; outstandingAmount: number; creditLimit: number } {
  const party = (parties || []).find((p) => p.id === partyId);
  const settings = (creditSettings || []).find((s) => s.partyId === partyId);
  const creditLimit = Number(settings?.creditLimit || party?.creditLimit || 0);
  const isBlocked = Boolean(settings?.isCreditBlocked);
  const isOverLimit = creditLimit > 0 && currentOutstanding > creditLimit;

  if (isBlocked) {
    return {
      isBlocked: true,
      reason: "Credit blocked by administrator",
      outstandingAmount: currentOutstanding,
      creditLimit,
    };
  }

  if (isOverLimit) {
    return {
      isBlocked: false,
      reason: `Outstanding Rs. ${currentOutstanding.toLocaleString("en-IN")} exceeds credit limit Rs. ${creditLimit.toLocaleString("en-IN")}`,
      outstandingAmount: currentOutstanding,
      creditLimit,
    };
  }

  return {
    isBlocked: false,
    reason: "",
    outstandingAmount: currentOutstanding,
    creditLimit,
  };
}

function Modal({ open, title, children, onClose }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white border border-gray-200 shadow-xl rounded-lg w-full max-w-xl flex flex-col max-h-[90vh]">
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

function statusForUtilization(pct: number, blocked: boolean) {
  if (blocked) return "Blocked";
  if (pct > 100) return "Over Limit";
  if (pct >= 70) return "At Risk";
  return "Normal";
}

function statusBadge(status: string) {
  if (status === "Normal")
    return (
      <span className="px-2 py-0.5 bg-green-50 text-green-700 border border-green-200 rounded text-[10px] font-semibold uppercase tracking-wide">
        Normal
      </span>
    );
  if (status === "At Risk")
    return (
      <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded text-[10px] font-semibold uppercase tracking-wide">
        At Risk
      </span>
    );
  if (status === "Over Limit")
    return (
      <span className="px-2 py-0.5 bg-red-50 text-red-700 border border-red-200 rounded text-[10px] font-semibold uppercase tracking-wide">
        Over Limit
      </span>
    );
  if (status === "Blocked")
    return (
      <span className="px-2 py-0.5 bg-gray-800 text-white border border-gray-900 rounded text-[10px] font-semibold uppercase tracking-wide">
        Blocked
      </span>
    );
  return (
    <span className="px-2 py-0.5 bg-gray-100 text-gray-700 border border-gray-200 rounded text-[10px] font-semibold uppercase tracking-wide">
      {status}
    </span>
  );
}

export default function CreditLimitManager() {
  const {
    invoices = [],
    parties = [],
    vouchers = [],
    companySettings = {},
    accounts = [],
    currentFiscalYear = {},
    addVoucher,
    currentUser = {},
  } = useStore();

  const [creditSettings, setCreditSettings] = useState([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");

  const [editModal, setEditModal] = useState(false);
  const [editingParty, setEditingParty] = useState(null);
  const [form, setForm] = useState({
    creditLimit: "",
    creditDays: "30",
    interestRate: "0",
    isCreditBlocked: false,
    notes: "",
  });

  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkType, setBulkType] = useState("customer");
  const [bulkLimit, setBulkLimit] = useState("");
  const [bulkDays, setBulkDays] = useState("30");

  useEffect(() => {
    const db = getDB();
    db.table("partyCreditSettings")
      .toArray()
      .catch(() => [])
      .then(setCreditSettings);
  }, []);

  const rows = useMemo(() => {
    return (parties || []).map((party) => {
      const settings = creditSettings.find((s) => s.partyId === party.id);
      const billsSales = getPartyBillwiseOutstanding(
        party.id,
        "sales",
        invoices,
        vouchers,
        parties,
      );
      const billsPurchase = getPartyBillwiseOutstanding(
        party.id,
        "purchase",
        invoices,
        vouchers,
        parties,
      );

      const salesOutstanding = billsSales.reduce((s, b) => s + Number(b.balance || 0), 0);
      const purchaseOutstanding = billsPurchase.reduce((s, b) => s + Number(b.balance || 0), 0);

      const partyType = String(party.type || "").toLowerCase();
      const isSupplier = partyType.includes("supplier") || partyType.includes("creditor");
      const outstanding = isSupplier ? purchaseOutstanding : salesOutstanding;

      const creditLimit = Number(settings?.creditLimit || party.creditLimit || 0);
      const creditDays = Number(settings?.creditDays || party.creditDays || 30);
      const interestRate = Number(settings?.interestRate || party.interestRate || 0);
      const isCreditBlocked = Boolean(settings?.isCreditBlocked);

      const pct = creditLimit > 0 ? (outstanding / creditLimit) * 100 : 0;
      const status = statusForUtilization(pct, isCreditBlocked);

      return {
        party,
        settings,
        outstanding,
        creditLimit,
        creditDays,
        interestRate,
        isCreditBlocked,
        pct,
        status,
      };
    });
  }, [parties, creditSettings, invoices, vouchers]);

  const filteredRows = useMemo(() => {
    const q = search.toLowerCase();

    return rows.filter((r) => {
      if (
        q &&
        !String(r.party.name || "")
          .toLowerCase()
          .includes(q)
      )
        return false;

      if (typeFilter !== "All") {
        const pt = String(r.party.type || "").toLowerCase();
        if (
          typeFilter === "Customer" &&
          !(pt.includes("customer") || pt.includes("debtor") || pt === "")
        ) {
          return false;
        }
        if (typeFilter === "Supplier" && !(pt.includes("supplier") || pt.includes("creditor"))) {
          return false;
        }
      }

      return true;
    });
  }, [rows, search, typeFilter]);

  const stats = useMemo(() => {
    const totalLimit = filteredRows.reduce((s, r) => s + Number(r.creditLimit || 0), 0);
    const totalOutstanding = filteredRows.reduce((s, r) => s + Number(r.outstanding || 0), 0);
    const utilization = totalLimit > 0 ? (totalOutstanding / totalLimit) * 100 : 0;
    const overLimit = filteredRows.filter(
      (r) => r.status === "Over Limit" || r.status === "Blocked",
    ).length;

    return {
      totalLimit,
      totalOutstanding,
      utilization,
      overLimit,
    };
  }, [filteredRows]);

  function openEdit(row: any) {
    setEditingParty(row.party);
    setForm({
      creditLimit: String(row.creditLimit || ""),
      creditDays: String(row.creditDays || 30),
      interestRate: String(row.interestRate || 0),
      isCreditBlocked: Boolean(row.isCreditBlocked),
      notes: row.settings?.notes || "",
    });
    setEditModal(true);
  }

  async function saveSettings() {
    if (!editingParty) return;

    const row = {
      id: generateId(),
      partyId: editingParty.id,
      creditLimit: Number(form.creditLimit || 0),
      creditDays: Number(form.creditDays || 30),
      interestRate: Number(form.interestRate || 0),
      isCreditBlocked: Boolean(form.isCreditBlocked),
      notes: form.notes,
      updatedAt: new Date().toISOString(),
    };

    const db = getDB();
    await db
      .table("partyCreditSettings")
      .put(row)
      .catch(() => {});

    setCreditSettings((rows) => rows.filter((x) => x.partyId !== editingParty.id).concat(row));
    setEditModal(false);
    toast.success("Credit settings updated for " + editingParty.name);
  }

  const bulkAffected = useMemo(() => {
    const type = bulkType.toLowerCase();
    return parties.filter((p) =>
      String(p.type || "")
        .toLowerCase()
        .includes(type),
    );
  }, [parties, bulkType]);

  async function applyBulkUpdate() {
    if (bulkAffected.length === 0) return toast.error("No parties found for selected type");
    if (!bulkLimit) return toast.error("Enter credit limit");
    if (!confirm(`Will update ${bulkAffected.length} parties. Confirm?`)) return;

    const db = getDB();
    const newRows = [];

    for (const party of bulkAffected) {
      const row = {
        id: generateId(),
        partyId: party.id,
        creditLimit: Number(bulkLimit || 0),
        creditDays: Number(bulkDays || 30),
        interestRate: Number(party.interestRate || 0),
        isCreditBlocked: false,
        notes: `Bulk update by ${currentUser?.name || "User"}`,
        updatedAt: new Date().toISOString(),
      };

      await db
        .table("partyCreditSettings")
        .put(row)
        .catch(() => {});
      newRows.push(row);
    }

    setCreditSettings((old) =>
      old.filter((x) => !bulkAffected.some((p) => p.id === x.partyId)).concat(newRows),
    );

    toast.success("Bulk credit settings updated");
    setBulkOpen(false);
  }

  function exportExcel() {
    const data = filteredRows.map((r) => ({
      "Party Name": r.party.name,
      Type: r.party.type || "",
      "Credit Limit NPR": r.creditLimit,
      "Outstanding NPR": r.outstanding,
      "% Utilized": r.pct,
      "Credit Days": r.creditDays,
      "Interest Rate %": r.interestRate,
      Status: r.status,
      "Credit Blocked": r.isCreditBlocked ? "Yes" : "No",
    }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "Credit Limits");
    XLSX.writeFile(wb, "Credit_Limit_Manager.xlsx");
    toast.success("Credit limit report exported");
  }

  return (
    <div className="min-h-screen bg-[#f5f6fa] p-4 text-gray-800">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800 flex items-center gap-2">
            <ShieldAlert size={18} className="text-[#1557b0]" /> Credit Limit Manager
          </h1>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Manage party-wise credit limits, credit days, overdue interest and invoice blocking
            controls.
          </p>
        </div>

        <button className={outlineBtn} onClick={exportExcel}>
          <Download size={14} /> Export to Excel
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-md p-4 shadow-sm flex flex-col justify-center">
          <div className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-1">
            Total Limit Extended
          </div>
          <div className="text-[20px] font-bold text-gray-800">Rs. {money(stats.totalLimit)}</div>
        </div>

        <div className="bg-white border border-gray-200 rounded-md p-4 shadow-sm flex flex-col justify-center">
          <div className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-1">
            Total Outstanding
          </div>
          <div className="text-[20px] font-bold text-gray-800">
            Rs. {money(stats.totalOutstanding)}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-md p-4 shadow-sm flex flex-col justify-center">
          <div className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-1">
            Overall Utilization
          </div>
          <div className="text-[20px] font-bold text-gray-800">{money(stats.utilization)}%</div>
        </div>

        <div className="bg-red-50/50 border border-red-200 rounded-md p-4 shadow-sm flex flex-col justify-center">
          <div className="text-[11px] font-medium text-red-700 uppercase tracking-wide flex items-center gap-1.5 mb-1">
            <AlertTriangle size={14} /> Over Limit / Blocked
          </div>
          <div className="text-[20px] font-bold text-red-800">{stats.overLimit} Parties</div>
        </div>
      </div>

      <div className={`${cardClass} mb-6`}>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <input
              className={inputClass}
              placeholder="Search party name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div>
            <select
              className={inputClass}
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option>All Parties</option>
              <option>Customer</option>
              <option>Supplier</option>
            </select>
          </div>

          <div className="md:col-span-2 flex justify-end">
            <button className={outlineBtn} onClick={() => setBulkOpen(!bulkOpen)}>
              {bulkOpen ? (
                <ChevronUp size={14} className="text-gray-400" />
              ) : (
                <ChevronDown size={14} className="text-gray-400" />
              )}
              Bulk Update
            </button>
          </div>
        </div>

        {bulkOpen && (
          <div className="mt-4 border border-indigo-200 rounded-md p-4 bg-indigo-50/30">
            <h2 className="text-[13px] font-semibold text-indigo-900 mb-3 flex items-center gap-2">
              Set Credit Limit for Party Group
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
              <div>
                <label className="block text-[11px] font-medium text-indigo-800 mb-1">
                  Party Type
                </label>
                <select
                  className={inputClass}
                  value={bulkType}
                  onChange={(e) => setBulkType(e.target.value)}
                >
                  <option value="customer">Customer</option>
                  <option value="supplier">Supplier</option>
                  <option value="both">Both</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-indigo-800 mb-1">
                  Credit Limit (NPR)
                </label>
                <input
                  className={inputClass}
                  type="number"
                  placeholder="0.00"
                  value={bulkLimit}
                  onChange={(e) => setBulkLimit(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-indigo-800 mb-1">
                  Credit Days
                </label>
                <input
                  className={inputClass}
                  type="number"
                  value={bulkDays}
                  onChange={(e) => setBulkDays(e.target.value)}
                />
              </div>

              <div className="text-[12px] text-indigo-700 bg-white border border-indigo-100 rounded h-8 flex items-center px-3 font-medium">
                Target: {bulkAffected.length} part{bulkAffected.length === 1 ? "y" : "ies"}
              </div>

              <div>
                <button className={primaryBtn} onClick={applyBulkUpdate}>
                  Apply to All
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className={cardClass}>
        <div className="overflow-x-auto rounded-md border border-gray-200">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {[
                  "Party Name",
                  "Type",
                  "Credit Limit",
                  "Outstanding",
                  "% Utilized",
                  "Credit Days",
                  "Interest %",
                  "Status",
                  "Actions",
                ].map((h) => (
                  <th key={h} className={tableHeadClass}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {filteredRows.map((r) => {
                const pct = Math.max(0, Number(r.pct || 0));

                return (
                  <tr key={r.party.id} className="bg-white hover:bg-gray-50">
                    <td className={`${tableCellClass} font-medium`}>{r.party.name}</td>
                    <td className={tableCellClass}>
                      <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded uppercase tracking-wide">
                        {r.party.type || "Other"}
                      </span>
                    </td>
                    <td className={tableCellClass}>
                      {r.creditLimit > 0 ? (
                        `Rs. ${money(r.creditLimit)}`
                      ) : (
                        <span className="text-gray-400 font-medium italic">Unlimited</span>
                      )}
                    </td>
                    <td
                      className={`${tableCellClass} font-semibold ${r.outstanding > 0 ? "text-gray-900" : "text-gray-500"}`}
                    >
                      Rs. {money(r.outstanding)}
                    </td>

                    <td className={tableCellClass}>
                      {r.creditLimit > 0 ? (
                        <div className="flex items-center gap-2">
                          <div className="w-24 bg-gray-100 rounded-full h-1.5 overflow-hidden border border-gray-200/50">
                            <div
                              style={{ width: Math.min(100, pct) + "%" }}
                              className={`h-full rounded-full transition-all duration-300 ${
                                pct < 70 ? "bg-green-500" : pct < 90 ? "bg-amber-500" : "bg-red-500"
                              }`}
                            />
                          </div>
                          <span
                            className={`text-[11px] font-semibold w-12 ${
                              pct < 70
                                ? "text-green-700"
                                : pct < 90
                                  ? "text-amber-700"
                                  : "text-red-700"
                            }`}
                          >
                            {money(pct)}%
                          </span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-gray-400 uppercase tracking-wide">
                          N/A
                        </span>
                      )}
                    </td>

                    <td className={tableCellClass}>{r.creditDays}</td>
                    <td className={tableCellClass}>{money(r.interestRate)}%</td>
                    <td className={tableCellClass}>{statusBadge(r.status)}</td>
                    <td className={tableCellClass}>
                      <button
                        className="text-[11px] font-medium text-[#1557b0] hover:underline flex items-center gap-1"
                        onClick={() => openEdit(r)}
                      >
                        <Edit2 size={12} /> Edit
                      </button>
                    </td>
                  </tr>
                );
              })}

              {!filteredRows.length && (
                <tr>
                  <td
                    colSpan={9}
                    className="text-center p-8 text-gray-500 text-[12px] bg-gray-50/50"
                  >
                    No parties found matching the search criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={editModal} title="Edit Credit Settings" onClose={() => setEditModal(false)}>
        {editingParty && (
          <div className="space-y-4">
            <div className="bg-gray-50 border border-gray-200 rounded-md p-3 text-[12px]">
              <div className="font-semibold text-gray-800 text-[14px] mb-1">
                {editingParty.name}
              </div>
              <div className="text-gray-500">
                Type:{" "}
                <span className="font-medium text-gray-700 uppercase tracking-wide">
                  {editingParty.type || "Other"}
                </span>{" "}
                • PAN:{" "}
                <span className="font-medium text-gray-700">
                  {editingParty.panNumber || editingParty.vatNumber || "N/A"}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-1">
                  Credit Limit (NPR)
                </label>
                <input
                  className={inputClass}
                  type="number"
                  placeholder="Enter limit (0 for unlimited)"
                  value={form.creditLimit}
                  onChange={(e) => setForm({ ...form, creditLimit: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-1">
                  Credit Days
                </label>
                <input
                  className={inputClass}
                  type="number"
                  value={form.creditDays}
                  onChange={(e) => setForm({ ...form, creditDays: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-1">
                  Interest Rate % (Per Annum)
                </label>
                <input
                  className={inputClass}
                  type="number"
                  value={form.interestRate}
                  onChange={(e) => setForm({ ...form, interestRate: e.target.value })}
                />
              </div>
            </div>

            <div className="mt-2 p-3 bg-red-50/30 border border-red-100 rounded-md">
              <label className="flex items-center gap-2 cursor-pointer mb-1 text-red-900 font-semibold">
                <input
                  type="checkbox"
                  className="rounded border-red-300 text-red-600 focus:ring-red-500"
                  checked={form.isCreditBlocked}
                  onChange={(e) => setForm({ ...form, isCreditBlocked: e.target.checked })}
                />
                Block Credit / Invoice Creation
              </label>

              {form.isCreditBlocked && (
                <div className="text-[11px] text-red-700 ml-6 flex items-center gap-1.5 mt-1.5 font-medium">
                  <AlertTriangle size={12} />
                  System will prevent new sales invoices from being created for this party.
                </div>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-medium text-gray-600 mb-1">
                Notes / Reason (Internal)
              </label>
              <textarea
                className={`${inputClass} h-auto py-2`}
                rows={3}
                placeholder="Reason for updating limit or blocking credit..."
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
              <button className={outlineBtn} onClick={() => setEditModal(false)}>
                Cancel
              </button>
              <button className={primaryBtn} onClick={saveSettings}>
                <Save size={14} /> Save Settings
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
