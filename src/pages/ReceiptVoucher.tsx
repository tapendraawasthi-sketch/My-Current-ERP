// @ts-nocheck
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Receipt Vouchers — list & entry page.
 */

import { DualDate } from "../components/ui/DualDate";
import React, { useState, useMemo } from "react";
import { useStore } from "../store/useStore";
import { Select, NepaliDatePicker } from "../components/ui";
import ReceiptVoucherForm from "../components/voucher/ReceiptVoucherForm";
import { Plus, Eye, Search, Download } from "lucide-react";
import { formatNumber } from "../lib/utils";
import { VoucherType, VoucherStatus } from "../lib/types";
import { ReportEmptyState } from "../components/ReportEmptyState";

const th = "px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide";
const td = "px-3 py-2.5 text-[12px] text-gray-700 border-b border-gray-100";
const btnPrimary =
  "h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md inline-flex items-center gap-1.5";
const btnOutline =
  "h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 inline-flex items-center gap-1.5";
const inputCls =
  "h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]";

const statusBadge = (status: string) => {
  if (status === VoucherStatus.POSTED) return "bg-green-100 text-green-700";
  if (status === VoucherStatus.CANCELLED) return "bg-red-100 text-red-700";
  return "bg-gray-100 text-gray-700";
};

const ReceiptVoucher: React.FC = () => {
  const { vouchers, companySettings } = useStore();
  const symbol = companySettings?.currencySymbol || "Rs.";

  const [mode, setMode] = useState<"list" | "new" | "edit">("list");
  const [activeId, setActiveId] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [pageSize, setPageSize] = useState(50);

  const receipts = useMemo(
    () => vouchers.filter((v) => v.type === VoucherType.RECEIPT),
    [vouchers],
  );

  const filtered = useMemo(() => {
    return receipts
      .filter((v) => statusFilter === "ALL" || v.status === statusFilter)
      .filter((v) => !fromDate || v.date >= fromDate)
      .filter((v) => !toDate || v.date <= toDate)
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  }, [receipts, statusFilter, fromDate, toDate]);

  const searched = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return filtered;
    return filtered.filter(
      (row) =>
        (row.voucherNo || "").toLowerCase().includes(q) ||
        (row.narration || "").toLowerCase().includes(q) ||
        (row.partyName || "").toLowerCase().includes(q) ||
        (row.referenceNo || "").toLowerCase().includes(q),
    );
  }, [filtered, searchTerm]);

  const displayed = useMemo(() => searched.slice(0, pageSize), [searched, pageSize]);

  const openNew = () => {
    setActiveId(null);
    setMode("new");
  };
  const openEdit = (row: any) => {
    setActiveId(row.id);
    setMode("edit");
  };
  const backToList = () => {
    setMode("list");
    setActiveId(null);
  };

  const exportCsv = () => {
    const headers = ["Voucher No", "Date", "Received From", "Narration", "Amount", "Status"];
    const rows = searched.map((row) =>
      [row.voucherNo, row.date, row.partyName, row.narration, row.totalDebit, row.status]
        .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
        .join(","),
    );
    const blob = new Blob([[headers.join(","), ...rows].join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "receipt-vouchers.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  if (mode === "new" || mode === "edit") {
    return (
      <ReceiptVoucherForm
        voucherId={mode === "edit" ? activeId! : undefined}
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
            <h1 className="text-[15px] font-semibold text-gray-800">Receipt vouchers</h1>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Cash and bank receipts — customer payments, income, and deposits
            </p>
          </div>
          <button type="button" className={btnPrimary} onClick={openNew}>
            <Plus className="h-3.5 w-3.5" />
            New receipt
          </button>
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
          <span className="text-[11px] text-gray-500">Status</span>
          <div className="w-36">
            <Select
              options={[
                { value: "ALL", label: "All statuses" },
                { value: VoucherStatus.DRAFT, label: "Draft" },
                { value: VoucherStatus.POSTED, label: "Posted" },
                { value: VoucherStatus.CANCELLED, label: "Cancelled" },
              ]}
              value={statusFilter}
              onChange={setStatusFilter}
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
              placeholder="Search voucher no, payer or narration…"
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
              message="No receipt vouchers found"
              hint='Adjust filters or click "New receipt" to create your first entry.'
            />
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-[#f5f6fa] border-b border-gray-200">
                    <th className={th}>Voucher no</th>
                    <th className={th}>Date</th>
                    <th className={th}>Received from</th>
                    <th className={th}>Narration</th>
                    <th className={`${th} text-right`}>Amount</th>
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
                        {row.voucherNo}
                      </td>
                      <td className={td}>
                        <DualDate
                          date={row.date || row.adDate}
                          dateNepali={row.dateNepali || row.bsDate}
                        />
                      </td>
                      <td className={td}>{row.partyName || "—"}</td>
                      <td className={`${td} text-gray-500 max-w-[220px] truncate`}>
                        {row.narration || "—"}
                      </td>
                      <td className={`${td} font-mono text-right text-green-700 font-medium`}>
                        {symbol} {formatNumber(row.totalDebit || 0)}
                      </td>
                      <td className={`${td} text-center`}>
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${statusBadge(row.status)}`}
                        >
                          {(row.status || "").toUpperCase()}
                        </span>
                      </td>
                      <td className={`${td} text-right`}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEdit(row);
                          }}
                          className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="View / edit"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-3 py-2 border-t border-gray-200 bg-[#f5f6fa] text-[11px] text-gray-500">
              Showing {displayed.length} of {searched.length} receipt vouchers
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReceiptVoucher;
