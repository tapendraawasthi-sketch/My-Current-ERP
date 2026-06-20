/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from "react";
import { useStore } from "../store/useStore";
import {
  Card,
  Badge,
  Table,
  Button,
  Input,
  Select,
  Modal,
  NepaliDatePicker,
  AccountSelect,
} from "./ui";
import Pagination from "./ui/Pagination";
import {
  Receipt,
  Plus,
  Search,
  Eye,
  XOctagon,
  Printer,
  Trash,
  AlertCircle,
  FileSpreadsheet,
  PlusCircle,
} from "lucide-react";
import { formatCurrency, formatNumber } from "../lib/utils";
import { VoucherType, VoucherStatus } from "../lib/types";
import { generateVoucherPDF } from "../lib/printUtils";
import { exportVouchersToExcel } from "../lib/exportUtils";
import toast from "react-hot-toast";

const VouchersRegister: React.FC = () => {
  const {
    vouchers,
    accounts,
    addVoucher,
    cancelVoucher,
    companySettings,
    currentPage,
    setCurrentPage,
  } = useStore();

  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<"ALL" | VoucherType>("ALL");
  const [typeFilter, setTypeFilter] = useState("");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  useEffect(() => {
    if (currentPage === "sales-register") {
      setActiveTab(VoucherType.SALES_INVOICE);
    } else if (currentPage === "purchase-register") {
      setActiveTab(VoucherType.PURCHASE_INVOICE);
    } else {
      setActiveTab("ALL");
    }
  }, [currentPage]);

  const tabs = useMemo(() => {
    const list = [
      "ALL",
      ...Object.values(VoucherType).filter((t) => !t.includes("invoice") && !t.includes("return")),
    ];
    if (activeTab === VoucherType.SALES_INVOICE && !list.includes(VoucherType.SALES_INVOICE)) {
      list.push(VoucherType.SALES_INVOICE);
    }
    if (
      activeTab === VoucherType.PURCHASE_INVOICE &&
      !list.includes(VoucherType.PURCHASE_INVOICE)
    ) {
      list.push(VoucherType.PURCHASE_INVOICE);
    }
    return list;
  }, [activeTab]);

  // Form Creation states (if current view sub-mode is active)
  const [isCreating, setIsCreating] = useState(false);
  const [vType, setVType] = useState<VoucherType>(VoucherType.JOURNAL);
  const [vDate, setVDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [vDateNP, setVDateNP] = useState("");
  const [vNarration, setVNarration] = useState("");
  const [refNo, setRefNo] = useState("");
  const [lines, setLines] = useState<any[]>([
    { accountId: "", debit: 0, credit: 0, narration: "" },
    { accountId: "", debit: 0, credit: 0, narration: "" },
  ]);

  // Selected Detail Modal states
  const [selectedVoucher, setSelectedVoucher] = useState<any | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const filteredVouchers = useMemo(() => {
    return vouchers.filter((v) => {
      const matchesSearch =
        v.voucherNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.narration.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesTab = activeTab === "ALL" || v.type === activeTab;
      if (typeFilter && v.type !== typeFilter) return false;
      return matchesSearch && matchesTab;
    });
  }, [vouchers, searchTerm, activeTab, typeFilter]);

  const paginatedVouchers = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredVouchers.slice(start, start + pageSize);
  }, [filteredVouchers, page, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredVouchers.length / pageSize));

  useEffect(() => {
    setPage(1);
  }, [searchTerm, activeTab, typeFilter]);

  const handlePrintVoucherPDF = (v: any) => {
    try {
      const blob = generateVoucherPDF(v, companySettings, accounts);
      const url = URL.createObjectURL(blob);
      const win = window.open(url);
      if (win) win.focus();
    } catch (e) {
      toast.error("Failed to compile PDF report.");
    }
  };

  const handleExportExcel = () => {
    exportVouchersToExcel(vouchers, accounts);
    toast.success("Spreadsheet exported.");
  };

  // Line creation helpers
  const handleAddLine = () => {
    setLines([...lines, { accountId: "", debit: 0, credit: 0, narration: "" }]);
  };

  const handleRemoveLine = (idx: number) => {
    if (lines.length <= 2) {
      toast.error("Double Entry Accounting rules require at least 2 ledger postings.");
      return;
    }
    setLines(lines.filter((_, i) => i !== idx));
  };

  const handleLineChange = (idx: number, field: string, val: any) => {
    setLines(
      lines.map((line, i) => {
        if (i !== idx) return line;
        const updated = { ...line, [field]: val };
        // Mutual exclusion validation: Debit vs Credit
        if (field === "debit" && val > 0) {
          updated.credit = 0;
        } else if (field === "credit" && val > 0) {
          updated.debit = 0;
        }
        return updated;
      }),
    );
  };

  const sums = useMemo(() => {
    const dr = lines.reduce((s, l) => s + (l.debit || 0), 0);
    const cr = lines.reduce((s, l) => s + (l.credit || 0), 0);
    return {
      debit: parseFloat(dr.toFixed(2)),
      credit: parseFloat(cr.toFixed(2)),
      balanced: Math.abs(dr - cr) < 0.01,
    };
  }, [lines]);

  const handleSaveVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vNarration.trim()) {
      toast.error("Voucher master Narration statement is required.");
      return;
    }

    if (!sums.balanced) {
      toast.error(
        `Ledger unbalanced. Difference is Rs. ${Math.abs(sums.debit - sums.credit).toFixed(2)}. DR and CR columns must balance.`,
      );
      return;
    }

    const invalidLine = lines.some((l) => !l.accountId || (l.debit === 0 && l.credit === 0));
    if (invalidLine) {
      toast.error(
        "Voucher compilation failed: Postings must specify an Account ledger and have non-zero debit/credit postings.",
      );
      return;
    }

    try {
      // Direct integration call
      const cleanLines = lines.map((l) => {
        const acc = accounts.find((a) => a.id === l.accountId);
        return {
          accountId: l.accountId,
          accountName: acc?.name || "",
          debit: l.debit || 0,
          credit: l.credit || 0,
          narration: l.narration || undefined,
        };
      });

      // Local conversion BS String
      const { ADToBSString } = await import("../lib/nepaliDate");
      const bsStr = ADToBSString(vDate);

      await addVoucher({
        date: vDate,
        dateNepali: bsStr || "2083-04-15",
        type: vType,
        narration: vNarration.trim(),
        referenceNo: refNo.trim() || undefined,
        lines: cleanLines,
        status: VoucherStatus.POSTED,
      });

      toast.success("Double Entry voucher posted and locked into ledger accounts.");
      setIsCreating(false);

      // Reset state
      setVNarration("");
      setRefNo("");
      setLines([
        { accountId: "", debit: 0, credit: 0, narration: "" },
        { accountId: "", debit: 0, credit: 0, narration: "" },
      ]);
    } catch (err: any) {
      toast.error(err.message || "Validation error.");
    }
  };

  const handleConfirmCancel = async () => {
    if (!cancelReason.trim()) {
      toast.error("A cancellation log details reason must be given.");
      return;
    }

    try {
      await cancelVoucher(selectedVoucher.id, cancelReason);
      toast.success("Voucher record set to void status.");
      setCancelOpen(false);
      setSelectedVoucher(null);
    } catch (err: any) {
      toast.error("Operation failed.");
    }
  };

  if (isCreating || currentPage === "vouchers-new") {
    return (
      <div className="flex flex-col gap-6 animate-fadeIn text-xs font-semibold select-none">
        <div className="flex items-center justify-between border-b border-gray-200 pb-5">
          <div>
            <h2 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
              <Receipt className="h-5 w-5 text-blue-700" />
              <span>POST DOUBLE ENTRY VOUCHER</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1 leading-none uppercase tracking-wider font-bold">
              Generate auditable transaction bookkeeping voucher
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setIsCreating(false);
              if (currentPage === "vouchers-new") setCurrentPage("vouchers");
            }}
          >
            Discard & Go Back
          </Button>
        </div>

        <form onSubmit={handleSaveVoucher} className="flex flex-col gap-6">
          <Card border padding="md">
            <div className="grid grid-cols-4 gap-4">
              <Select
                label="Voucher Classification"
                options={[
                  { value: VoucherType.JOURNAL, label: "Journal Voucher (JV)" },
                  { value: VoucherType.RECEIPT, label: "Receipt Voucher (RV)" },
                  { value: VoucherType.PAYMENT, label: "Payment Voucher (PV)" },
                  { value: VoucherType.CONTRA, label: "Contra Voucher (CV)" },
                ]}
                value={vType}
                onChange={(val) => setVType(val as VoucherType)}
                required
              />
              <NepaliDatePicker
                label="Voucher Posting Date"
                value={vDate}
                onChange={setVDate}
                required
              />
              <Input
                label="Source Ref Document No"
                placeholder="e.g. Bank-Dep-2083"
                value={refNo}
                onChange={setRefNo}
              />
              {/* Dummy Auto generated voucher no preview */}
              <Input
                label="Generated Serial (Auto)"
                value="[AUTOMATIC SERIAL GENERATION IN METADATA]"
                onChange={() => {}}
                disabled
              />
            </div>
          </Card>

          {/* Posting ledger entries table builder */}
          <Card title="Ledger Accounts Posting Details Grid">
            <div className="flex flex-col gap-4">
              <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase tracking-wider font-bold">
                    <tr>
                      <th className="px-4 py-2.5 w-[45%]">Post Account Ledger</th>
                      <th className="px-4 py-2.5 w-[20%] text-right">Debit Balance (Dr)</th>
                      <th className="px-4 py-2.5 w-[20%] text-right">Credit Balance (Cr)</th>
                      <th className="px-4 py-2.5 w-[15%] text-center">Lines clear</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-150">
                    {lines.map((line, idx) => (
                      <tr key={idx} className="hover:bg-gray-50/50">
                        <td className="px-3 py-2">
                          <AccountSelect
                            value={line.accountId}
                            onChange={(val) => handleLineChange(idx, "accountId", val)}
                            placeholder="Choose ledger head..."
                            required
                          />
                          <input
                            type="text"
                            placeholder="Line narration memo..."
                            value={line.narration}
                            onChange={(e) => handleLineChange(idx, "narration", e.target.value)}
                            className="w-full h-8 px-2 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 mt-1.5 font-medium"
                          />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Input
                            type="number"
                            placeholder="0.00"
                            value={line.debit === 0 ? "" : line.debit}
                            onChange={(v) => handleLineChange(idx, "debit", parseFloat(v) || 0)}
                            align="right"
                          />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Input
                            type="number"
                            placeholder="0.00"
                            value={line.credit === 0 ? "" : line.credit}
                            onChange={(v) => handleLineChange(idx, "credit", parseFloat(v) || 0)}
                            align="right"
                          />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveLine(idx)}
                            className="p-1 rounded text-red-500 hover:bg-red-50 transition-colors"
                            title="Remove entry posting line"
                          >
                            <Trash className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {/* Validation sums tfoot wrapper */}
                  <tfoot className="bg-slate-50 border-t border-gray-200 text-gray-800 font-bold">
                    <tr>
                      <td className="px-4 py-3 text-right text-xs uppercase tracking-wider font-extrabold text-slate-500">
                        Verification sum totals:
                      </td>
                      <td className="px-4 py-3 text-right text-xs font-mono font-extrabold text-blue-700">
                        Rs. {formatNumber(sums.debit)}
                      </td>
                      <td className="px-4 py-3 text-right text-xs font-mono font-extrabold text-amber-700">
                        Rs. {formatNumber(sums.credit)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant={sums.balanced ? "success" : "danger"}>
                          {sums.balanced ? "BALANCED" : "UNBALANCED"}
                        </Badge>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="flex justify-between items-center bg-gray-50 border border-gray-200 rounded-lg p-3">
                <span className="text-[11px] text-gray-500 leading-none">
                  Accounting validation: Double-entry rules require DR = CR sum balance exactly.
                </span>
                <button
                  type="button"
                  onClick={handleAddLine}
                  className="px-3 py-1.5 text-xs text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md font-bold transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <PlusCircle className="h-4 w-4" />
                  <span>Insert Post Row</span>
                </button>
              </div>

              {/* Master Narration box */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-400 leading-none">
                  General Voucher Narration / Explanation
                </label>
                <textarea
                  required
                  placeholder="e.g. Paid electricity bill amount for the Month of Mangsir via Nabil Bank Current Account No. 2024..."
                  rows={3}
                  value={vNarration}
                  onChange={(e) => setVNarration(e.target.value)}
                  className="w-full text-xs font-medium p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white shadow-sm"
                />
              </div>

              <div className="flex justify-end gap-2.5 mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsCreating(false);
                    if (currentPage === "vouchers-new") setCurrentPage("vouchers");
                  }}
                >
                  Cancel & Exit
                </Button>
                <Button variant="primary" size="sm" type="submit" onClick={handleSaveVoucher}>
                  Post & Commit Voucher
                </Button>
              </div>
            </div>
          </Card>
        </form>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 animate-fadeIn text-xs select-none">
      {/* List Page title */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800">Vouchers Register</h1>
          <p className="text-[11px] text-gray-500 mt-0.5">All posted and draft vouchers</p>
        </div>

        <div className="shrink-0 flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportExcel}
            icon={<FileSpreadsheet className="h-4 w-4" />}
          >
            Export Register Spreadsheet
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsCreating(true)}
            icon={<Plus className="h-4 w-4" />}
          >
            Generate Voucher Book
          </Button>
        </div>
      </div>

      {/* FILTER SEARCH PANEL */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 border border-gray-200 rounded-xl shadow-sm no-print">
        <div className="w-full md:max-w-xs relative bg-white">
          <Input
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Search voucher ledger memo..."
            inputClassName="pl-9 text-xs"
          />
          <div className="absolute left-3 top-2.5 text-gray-400">
            <Search className="h-4 w-4" />
          </div>
        </div>

        <select value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(1); }} className="h-8 px-2 border rounded-md text-[12px] font-semibold text-gray-700 bg-white" style={{ borderColor: "var(--border)" }}>
          <option value="">All Types</option>
          <option value="journal">Journal</option>
          <option value="payment">Payment</option>
          <option value="receipt">Receipt</option>
          <option value="contra">Contra</option>
        </select>

        <div className="flex flex-wrap gap-1 border border-transparent select-none shrink-0">
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab as any)}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-colors select-none uppercase tracking-wide ${activeTab === tab ? "bg-[#1557b0] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
            >
              {tab === "ALL" ? "Show All" : tab.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid display table */}
      {/* Main Grid display table */}
      <Card border padding="none">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Voucher Serial</th>
                <th>Date (BS)</th>
                <th>Voucher Class</th>
                <th>General Narration Description</th>
                <th className="th-right">Amount (Dr)</th>
                <th className="th-right">Amount (Cr)</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {paginatedVouchers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-gray-500">
                    No financial transaction vouchers cataloged in this filter criteria yet.
                  </td>
                </tr>
              ) : (
                paginatedVouchers.map((v) => (
                  <tr key={v.id} onClick={() => setSelectedVoucher(v)} className="cursor-pointer">
                    <td>
                      <span className="font-mono font-bold text-slate-900">{v.voucherNo}</span>
                    </td>
                    <td>
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-800 leading-tight">{v.dateNepali}</span>
                        <span className="text-[10px] font-medium text-slate-400 mt-0.5">
                          {v.date} (AD)
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className={`badge badge-${v.type?.replace(/-/g,'')}`}>{v.type?.replace(/-/g,' ').toUpperCase()}</span>
                    </td>
                    <td>
                      <p className="text-gray-650 line-clamp-2 max-w-sm font-medium leading-relaxed" title={v.narration}>
                        {v.narration}
                      </p>
                    </td>
                    <td className="amt amt-dr">
                      {v.type === 'payment' || v.type === 'journal' || v.type === 'sales_invoice' || v.type === 'sales_return' ? formatCurrency(v.totalDebit) : "-"}
                    </td>
                    <td className="amt amt-cr">
                      {v.type === 'receipt' || v.type === 'contra' || v.type === 'purchase_invoice' || v.type === 'purchase_return' ? formatCurrency(v.totalDebit) : "-"}
                    </td>
                    <td>
                      <Badge
                        variant={
                          v.status === VoucherStatus.POSTED
                            ? "success"
                            : v.status === VoucherStatus.DRAFT
                              ? "warning"
                              : "danger"
                        }
                      >
                        {v.status === VoucherStatus.POSTED
                          ? "POSTED ✓"
                          : v.status === VoucherStatus.DRAFT
                            ? "DRAFT"
                            : "VOIDED Ø"}
                      </Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          page={page}
          totalPages={totalPages}
          totalRecords={filteredVouchers.length}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(s) => {
            setPageSize(s);
            setPage(1);
          }}
        />
      </Card>

      {/* SELECTED VOUCHER DETAILS MODEL OVERLAY OVERLAY */}
      {selectedVoucher && (
        <Modal
          isOpen={!!selectedVoucher}
          onClose={() => setSelectedVoucher(null)}
          title={`Corporate Voucher details: ${selectedVoucher.voucherNo}`}
          size="lg"
          footer={
            <div className="flex items-center justify-between w-full">
              <div>
                {selectedVoucher.status === VoucherStatus.POSTED && (
                  <Button
                    variant="danger"
                    size="sm"
                    icon={<XOctagon className="h-4 w-4" />}
                    onClick={() => {
                      setCancelReason("");
                      setCancelOpen(true);
                    }}
                  >
                    Cancel/Void Voucher
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePrintVoucherPDF(selectedVoucher)}
                  icon={<Printer className="h-4 w-4" />}
                >
                  Print PDF Voucher
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setSelectedVoucher(null)}>
                  Close
                </Button>
              </div>
            </div>
          }
        >
          <div className="flex flex-col gap-6 select-none font-semibold text-slate-755 text-xs">
            {/* Header meta grid details */}
            <div className="grid grid-cols-4 gap-4 bg-slate-50 border border-gray-200 p-4 rounded-xl">
              <div>
                <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  Voucher No
                </span>
                <span className="font-mono font-extrabold text-slate-900 text-sm">
                  {selectedVoucher.voucherNo}
                </span>
              </div>
              <div>
                <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  Date (B.S.)
                </span>
                <span className="font-bold text-slate-800 text-sm">
                  {selectedVoucher.dateNepali}
                </span>
              </div>
              <div>
                <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  Date (A.D.)
                </span>
                <span className="font-bold text-slate-800 text-sm">{selectedVoucher.date}</span>
              </div>
              <div>
                <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  Voucher Class
                </span>
                <span className="text-blue-700 font-extrabold uppercase shrink-0 mt-1 block">
                  {selectedVoucher.type}
                </span>
              </div>
            </div>

            {/* General Narration description */}
            <div className="flex flex-col gap-1.5">
              <span className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">
                Executive Narration statement
              </span>
              <p className="bg-white border rounded-lg p-3 text-gray-600 shadow-sm leading-relaxed font-semibold">
                {selectedVoucher.narration}
              </p>
            </div>

            {/* Line postings list */}
            <div className="flex flex-col gap-2">
              <span className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">
                Ledger Accounts Postings details
              </span>
              <div className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
                <table className="w-full text-left text-xs border-collapse font-bold">
                  <thead className="bg-gray-50 border-b text-gray-500 select-none">
                    <tr>
                      <th className="px-4 py-2 w-1/2">Ledger Head</th>
                      <th className="px-4 py-2 text-right w-1/4">Debit Balance (Dr)</th>
                      <th className="px-4 py-2 text-right w-1/4">Credit Balance (Cr)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-150">
                    {selectedVoucher.lines.map((l: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50/20">
                        <td className="px-4 py-2 flex flex-col">
                          <span className="text-slate-800 font-bold">{l.accountName}</span>
                          {l.narration && (
                            <span className="text-[10px] font-semibold text-slate-400 mt-0.5">
                              {l.narration}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-right font-mono amt amt-dr">
                          {l.debit > 0 ? `Rs. ${formatNumber(l.debit)}` : "-"}
                        </td>
                        <td className="px-4 py-2 text-right font-mono amt amt-cr">
                          {l.credit > 0 ? `Rs. ${formatNumber(l.credit)}` : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 border-t border-gray-200 font-bold">
                    <tr>
                      <td className="px-4 py-2.5 text-right font-extrabold uppercase text-slate-500">
                        Totals:
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-sm amt amt-dr">
                        Rs. {formatNumber(selectedVoucher.totalDebit)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-sm amt amt-cr">
                        Rs. {formatNumber(selectedVoucher.totalCredit)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {selectedVoucher.status === VoucherStatus.CANCELLED && (
              <div className="bg-red-50/50 border border-red-200 rounded-xl p-4 flex gap-3 text-red-700">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <div className="flex flex-col">
                  <span className="font-bold text-red-800 leading-none">
                    Void / Cancelled log details
                  </span>
                  <p className="text-[11px] font-semibold text-red-650 mt-1">
                    {selectedVoucher.cancellationReason}
                  </p>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* CANCEL REASON STATEMENT OVERLAY POPUP */}
      <Modal
        isOpen={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="Record Cancel reason statement"
        size="sm"
        footer={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setCancelOpen(false)}>
              Back
            </Button>
            <Button variant="danger" size="sm" onClick={handleConfirmCancel}>
              Void Record
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4 text-xs select-none">
          <p className="text-gray-600 leading-relaxed font-semibold">
            Are you sure you want to cancel and void this posted voucher? This will balance reverse
            from all ledgers accounts. This log transaction cannot be undone.
          </p>
          <Input
            label="Provide Cancellation/Void Reason statement"
            placeholder="e.g. Paid duplicate entry, corrected wrong bank ledger..."
            value={cancelReason}
            onChange={setCancelReason}
            required
            autoFocus
          />
        </div>
      </Modal>
    </div>
  );
};

export default VouchersRegister;
