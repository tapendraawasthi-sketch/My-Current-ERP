// @ts-nocheck
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Billing & Invoicing — tabbed register for:
 *   Sales Invoices · Purchase Invoices · Sales Returns · Purchase Returns
 */

import React, { useMemo, useState, useEffect } from "react";
import { useStore } from "../store/useStore";
import { Select, NepaliDatePicker, PartySelect, DualDate } from "../components/ui";
import SalesInvoiceForm from "../components/invoice/SalesInvoiceForm";
import { Plus, Eye, Printer, RefreshCw, Search, Download } from "lucide-react";
import { formatNumber } from "../lib/utils";
import { VoucherType, VoucherStatus, PaymentStatus } from "../lib/types";
import { generateInvoicePDF } from "../lib/printUtils";
import toast from "react-hot-toast";
import { ReportEmptyState } from "../components/ReportEmptyState";

type TabKey = "sales" | "purchase" | "sales-return" | "purchase-return";

const TAB_META: Record<TabKey, { label: string; vt: VoucherType }> = {
  sales: { label: "Sales invoices", vt: VoucherType.SALES_INVOICE },
  purchase: { label: "Purchase invoices", vt: VoucherType.PURCHASE_INVOICE },
  "sales-return": { label: "Sales returns", vt: VoucherType.SALES_RETURN },
  "purchase-return": { label: "Purchase returns", vt: VoucherType.PURCHASE_RETURN },
};

const th = "px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide";
const td = "px-3 py-2.5 text-[12px] text-gray-700 border-b border-gray-100";
const btnPrimary =
  "h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md inline-flex items-center gap-1.5";
const btnOutline =
  "h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 inline-flex items-center gap-1.5";
const inputCls =
  "h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]";

const paymentBadge = (status: string) => {
  if (status === PaymentStatus.PAID) return "bg-green-100 text-green-700";
  if (status === PaymentStatus.PARTIAL) return "bg-amber-100 text-amber-700";
  if (status === PaymentStatus.UNPAID) return "bg-red-100 text-red-700";
  return "bg-gray-100 text-gray-700";
};

const statusBadge = (status: string) => {
  if (status === VoucherStatus.POSTED) return "bg-green-100 text-green-700";
  if (status === VoucherStatus.CANCELLED) return "bg-red-100 text-red-700";
  return "bg-gray-100 text-gray-700";
};

const BillingInvoice: React.FC = () => {
  const { invoices, accounts, parties, companySettings, currentPage, setCurrentPage } = useStore();
  const symbol = companySettings?.currencySymbol || "Rs.";

  const [tab, setTab] = useState<TabKey>("sales");
  const [mode, setMode] = useState<"list" | "new" | "edit">("list");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editType, setEditType] = useState<TabKey>("sales");

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [partyId, setPartyId] = useState("");
  const [paymentFilter, setPaymentFilter] = useState<string>("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [pageSize, setPageSize] = useState(50);

  const meta = TAB_META[tab];

  useEffect(() => {
    if (currentPage === "sales-invoice") setTab("sales");
    else if (currentPage === "purchase-invoice") setTab("purchase");
    else if (currentPage === "sales-return") setTab("sales-return");
    else if (currentPage === "purchase-return") setTab("purchase-return");
  }, [currentPage]);

  const handleTabChange = (k: TabKey) => {
    setTab(k);
    setSearchTerm("");
    if (k === "sales") setCurrentPage("sales-invoice");
    else if (k === "purchase") setCurrentPage("purchase-invoice");
    else setCurrentPage(k);
  };

  const filtered = useMemo(() => {
    return invoices
      .filter((i) => i.type === meta.vt)
      .filter((i) => !fromDate || i.date >= fromDate)
      .filter((i) => !toDate || i.date <= toDate)
      .filter((i) => !partyId || i.partyId === partyId)
      .filter((i) => paymentFilter === "ALL" || i.paymentStatus === paymentFilter)
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  }, [invoices, meta.vt, fromDate, toDate, partyId, paymentFilter]);

  const searched = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return filtered;
    return filtered.filter(
      (row) =>
        (row.invoiceNo || "").toLowerCase().includes(q) ||
        (row.partyName || "").toLowerCase().includes(q) ||
        (row.referenceNo || "").toLowerCase().includes(q) ||
        (row.narration || "").toLowerCase().includes(q),
    );
  }, [filtered, searchTerm]);

  const displayed = useMemo(() => searched.slice(0, pageSize), [searched, pageSize]);

  const openNew = () => {
    setActiveId(null);
    setEditType(tab);
    setMode("new");
  };

  const openEdit = (row: any) => {
    const t =
      (Object.entries(TAB_META) as [TabKey, any][]).find(([, m]) => m.vt === row.type)?.[0] ||
      "sales";
    setActiveId(row.id);
    setEditType(t);
    setMode("edit");
  };

  const backToList = () => {
    setMode("list");
    setActiveId(null);
  };

  const handlePrint = async (row: any) => {
    try {
      const blob = await generateInvoicePDF(row, companySettings, accounts, parties);
      const url = URL.createObjectURL(blob);
      const win = window.open(url);
      if (win) win.focus();
    } catch {
      toast.error("Failed to generate PDF.");
    }
  };

  const exportCsv = () => {
    const headers = ["Invoice No", "Date", "Party", "Grand Total", "VAT", "Payment", "Status"];
    const rows = searched.map((row) =>
      [
        row.invoiceNo,
        row.date,
        row.partyName,
        row.grandTotal,
        row.vatAmount,
        row.paymentStatus,
        row.status,
      ]
        .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
        .join(","),
    );
    const blob = new Blob([[headers.join(","), ...rows].join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${tab}-invoices.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (mode === "new" || mode === "edit") {
    return (
      <SalesInvoiceForm
        key={`${editType}-${activeId || "new"}`}
        invoiceId={mode === "edit" ? activeId! : undefined}
        type={editType}
        onSave={backToList}
        onCancel={backToList}
      />
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#f5f6fa]">
      <div className="p-4 pb-0 shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-[15px] font-semibold text-gray-800">Billing & invoicing</h1>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Manage sales and purchase invoices and returns
            </p>
          </div>
          <button type="button" className={btnPrimary} onClick={openNew}>
            <Plus className="h-3.5 w-3.5" />
            New {meta.label.replace(/s$/, "")}
          </button>
        </div>

        <div className="flex gap-1 mb-3 bg-white border border-gray-200 rounded-md p-1 w-fit flex-wrap">
          {(Object.keys(TAB_META) as TabKey[]).map((k) => {
            const m = TAB_META[k];
            const count = invoices.filter((i) => i.type === m.vt).length;
            const active = tab === k;
            return (
              <button
                key={k}
                type="button"
                onClick={() => handleTabChange(k)}
                className={`flex items-center gap-1.5 h-8 px-3 text-[12px] font-medium rounded-md transition-colors ${
                  active ? "bg-[#1557b0] text-white" : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                {m.label}
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                    active ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="no-print flex flex-wrap items-center gap-2 mb-3 p-3 bg-white border border-gray-200 rounded-md">
          <span className="text-[11px] text-gray-500">From</span>
          <div className="w-32">
            <NepaliDatePicker value={fromDate} onChange={setFromDate} />
          </div>
          <span className="text-[11px] text-gray-500">To</span>
          <div className="w-32">
            <NepaliDatePicker value={toDate} onChange={setToDate} />
          </div>
          <span className="text-[11px] text-gray-500">Party</span>
          <div className="w-48">
            <PartySelect value={partyId} onChange={setPartyId} placeholder="All parties" />
          </div>
          <span className="text-[11px] text-gray-500">Payment</span>
          <div className="w-32">
            <Select
              options={[
                { value: "ALL", label: "All" },
                { value: PaymentStatus.PAID, label: "Paid" },
                { value: PaymentStatus.PARTIAL, label: "Partial" },
                { value: PaymentStatus.UNPAID, label: "Unpaid" },
              ]}
              value={paymentFilter}
              onChange={setPaymentFilter}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-3 no-print">
          <div className="relative max-w-xs flex-1 min-w-[200px]">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search invoice no, party or reference…"
              className={`${inputCls} w-full pl-8`}
            />
          </div>
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className={inputCls}
          >
            <option value={25}>25 rows</option>
            <option value={50}>50 rows</option>
            <option value={100}>100 rows</option>
          </select>
          <span className="text-[11px] text-gray-500 whitespace-nowrap">
            {searched.length} record{searched.length === 1 ? "" : "s"}
          </span>
          <button type="button" className={btnOutline} onClick={exportCsv}>
            <Download className="h-3.5 w-3.5" />
            Export
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4 min-h-0">
        {searched.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-md">
            <ReportEmptyState
              message={`No ${meta.label.toLowerCase()} found`}
              hint="Adjust date filters or click New to create an invoice."
            />
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-[#f5f6fa] border-b border-gray-200">
                    <th className={th}>Invoice no</th>
                    <th className={th}>Date</th>
                    <th className={th}>Party</th>
                    <th className={`${th} text-right`}>Grand total</th>
                    <th className={`${th} text-right`}>VAT</th>
                    <th className={`${th} text-center`}>Payment</th>
                    <th className={`${th} text-center`}>Status</th>
                    <th className={`${th} text-right`}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {displayed.map((row) => (
                    <tr
                      key={row.id}
                      className="group cursor-pointer hover:bg-gray-50 border-l-[3px] border-l-transparent hover:border-l-[#1557b0]"
                      onClick={() => openEdit(row)}
                    >
                      <td className={`${td} font-mono font-medium text-gray-800`}>
                        {row.invoiceNo}
                      </td>
                      <td className={td}>
                        <DualDate
                          date={row.date || row.adDate}
                          dateNepali={row.dateNepali || row.bsDate}
                        />
                      </td>
                      <td className={td}>{row.partyName || "—"}</td>
                      <td className={`${td} font-mono text-right font-medium`}>
                        {symbol} {formatNumber(row.grandTotal || 0)}
                      </td>
                      <td className={`${td} font-mono text-right text-gray-500`}>
                        {symbol} {formatNumber(row.vatAmount || 0)}
                      </td>
                      <td className={`${td} text-center`}>
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${paymentBadge(row.paymentStatus)}`}
                        >
                          {(row.paymentStatus || "").toUpperCase() || "—"}
                        </span>
                      </td>
                      <td className={`${td} text-center`}>
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${statusBadge(row.status)}`}
                        >
                          {(row.status || "").toUpperCase()}
                        </span>
                      </td>
                      <td className={`${td} text-right`}>
                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {companySettings?.cbmsEnabled && !row.cbmsSubmitted && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                useStore.getState().retryCBMS(row.id);
                              }}
                              className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-gray-300 bg-white text-amber-600 hover:bg-amber-50"
                              title="Retry CBMS sync"
                            >
                              <RefreshCw className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEdit(row);
                            }}
                            className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
                            title="View / edit"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePrint(row);
                            }}
                            className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
                            title="Print"
                          >
                            <Printer className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-3 py-2 border-t border-gray-200 bg-[#f5f6fa] text-[11px] text-gray-500">
              Showing {displayed.length} of {searched.length} {meta.label.toLowerCase()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BillingInvoice;
