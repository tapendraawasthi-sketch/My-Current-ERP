// src/pages/CbmsDashboard.tsx

import React, { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useStore } from "../store/useStore";
import { cbmsService } from "../lib/cbmsService";
import CbmsStatusBadge from "../components/CbmsStatusBadge";

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

function monthPrefix(date: string) {
  return date.slice(0, 7);
}

function csvEscape(value: unknown) {
  const str = String(value ?? "");
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function downloadCsv(filename: string, rows: unknown[][]) {
  const csv = rows.map((r) => r.map(csvEscape).join(",")).join("\r\n");
  const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8;" });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const CbmsDashboard: React.FC = () => {
  const { invoices, companySettings, initializeApp } = useStore() as any;

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [status, setStatus] = useState<"all" | "submitted" | "pending" | "failed">("all");
  const [bulkRunning, setBulkRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  const salesInvoices = useMemo(() => {
    return (invoices || []).filter((i: any) => i.type === "sales-invoice");
  }, [invoices]);

  const today = todayISO();
  const thisMonth = monthPrefix(today);

  const summary = useMemo(() => {
    const todayInvoices = salesInvoices.filter((i: any) => i.date === today);
    const monthInvoices = salesInvoices.filter((i: any) =>
      String(i.date || "").startsWith(thisMonth),
    );

    return {
      todaySubmitted: todayInvoices.filter((i: any) => i.cbmsSubmitted).length,
      todayPending: todayInvoices.filter((i: any) => !i.cbmsSubmitted).length,
      monthSubmitted: monthInvoices.filter((i: any) => i.cbmsSubmitted).length,
      failedCount: salesInvoices.filter((i: any) => i.cbmsStatus === "failed" || i.cbmsError)
        .length,
    };
  }, [salesInvoices, today, thisMonth]);

  const filteredInvoices = useMemo(() => {
    return salesInvoices.filter((invoice: any) => {
      if (fromDate && invoice.date < fromDate) return false;
      if (toDate && invoice.date > toDate) return false;

      if (status === "submitted") return invoice.cbmsSubmitted && invoice.cbmsIrn;
      if (status === "pending") return !invoice.cbmsSubmitted && !invoice.cbmsError;
      if (status === "failed") return invoice.cbmsStatus === "failed" || invoice.cbmsError;

      return true;
    });
  }, [salesInvoices, fromDate, toDate, status]);

  const pendingInvoices = useMemo(() => {
    return filteredInvoices.filter((i: any) => !i.cbmsSubmitted);
  }, [filteredInvoices]);

  const handleSubmitAllPending = async () => {
    if (!companySettings?.cbmsEnabled) {
      toast.error("CBMS is not enabled in company settings.");
      return;
    }

    if (pendingInvoices.length === 0) {
      toast.success("No pending invoices to submit.");
      return;
    }

    setBulkRunning(true);
    setProgress({ done: 0, total: pendingInvoices.length });

    const result = await cbmsService.bulkSubmit(pendingInvoices, companySettings, (done, total) =>
      setProgress({ done, total }),
    );

    setBulkRunning(false);

    if (result.failed > 0) {
      toast.error(`${result.passed} submitted, ${result.failed} failed.`);
    } else {
      toast.success(`${result.passed} invoices submitted successfully.`);
    }

    await initializeApp?.();
  };

  const handleExportIrnList = () => {
    const rows: unknown[][] = [
      ["InvoiceNo", "Date (BS)", "Party Name", "PAN", "IRN", "Submitted At"],
      ...filteredInvoices.map((invoice: any) => [
        invoice.invoiceNo,
        invoice.dateNepali || invoice.date,
        invoice.partyName,
        invoice.partyPan || "",
        invoice.cbmsIrn || "",
        invoice.cbmsSubmittedAt || "",
      ]),
    ];

    downloadCsv(`CBMS_IRN_List_${today}.csv`, rows);
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800">CBMS Dashboard</h1>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Nepal IRD e-Invoicing submission monitor
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportIrnList}
            className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md"
          >
            Export IRN List
          </button>

          <button
            type="button"
            disabled={bulkRunning}
            onClick={handleSubmitAllPending}
            className="h-8 px-3 bg-[#1557b0] text-white text-[12px] font-medium rounded-md disabled:opacity-50"
          >
            {bulkRunning ? `Submitting ${progress.done}/${progress.total}` : "Submit All Pending"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="bg-white border border-gray-200 rounded-md p-3">
          <div className="text-[10px] uppercase font-semibold text-gray-500">Today Submitted</div>
          <div className="text-[22px] font-bold">{summary.todaySubmitted}</div>
        </div>

        <div className="bg-white border border-gray-200 rounded-md p-3">
          <div className="text-[10px] uppercase font-semibold text-gray-500">Today Pending</div>
          <div className="text-[22px] font-bold">{summary.todayPending}</div>
        </div>

        <div className="bg-white border border-gray-200 rounded-md p-3">
          <div className="text-[10px] uppercase font-semibold text-gray-500">
            This Month Submitted
          </div>
          <div className="text-[22px] font-bold">{summary.monthSubmitted}</div>
        </div>

        <div className="bg-white border border-gray-200 rounded-md p-3">
          <div className="text-[10px] uppercase font-semibold text-gray-500">Failed Count</div>
          <div className="text-[22px] font-bold text-red-600">{summary.failedCount}</div>
        </div>
      </div>

      {bulkRunning && (
        <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
          <div className="text-[12px] font-semibold text-blue-700">
            Bulk submission in progress: {progress.done}/{progress.total}
          </div>
          <div className="h-2 bg-blue-100 rounded mt-2 overflow-hidden">
            <div
              className="h-2 bg-blue-600"
              style={{
                width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%`,
              }}
            />
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-md p-3 flex flex-wrap gap-3">
        <div>
          <label className="text-[11px] font-medium text-gray-600 block mb-1">From Date</label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md"
          />
        </div>

        <div>
          <label className="text-[11px] font-medium text-gray-600 block mb-1">To Date</label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md"
          />
        </div>

        <div>
          <label className="text-[11px] font-medium text-gray-600 block mb-1">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as any)}
            className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md"
          >
            <option value="all">All</option>
            <option value="submitted">Submitted</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
          </select>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
        <table className="w-full text-[12px]">
          <thead className="bg-[#f5f6fa] border-b border-gray-200">
            <tr>
              <th className="px-3 py-2 text-left text-[10px] uppercase font-semibold text-gray-500">
                Invoice No
              </th>
              <th className="px-3 py-2 text-left text-[10px] uppercase font-semibold text-gray-500">
                Date
              </th>
              <th className="px-3 py-2 text-left text-[10px] uppercase font-semibold text-gray-500">
                Party
              </th>
              <th className="px-3 py-2 text-left text-[10px] uppercase font-semibold text-gray-500">
                PAN
              </th>
              <th className="px-3 py-2 text-right text-[10px] uppercase font-semibold text-gray-500">
                Total
              </th>
              <th className="px-3 py-2 text-left text-[10px] uppercase font-semibold text-gray-500">
                CBMS Status
              </th>
            </tr>
          </thead>

          <tbody>
            {filteredInvoices.map((invoice: any) => (
              <tr key={invoice.id} className="border-b border-gray-100">
                <td className="px-3 py-2 font-mono">{invoice.invoiceNo}</td>
                <td className="px-3 py-2">{invoice.dateNepali || invoice.date}</td>
                <td className="px-3 py-2">{invoice.partyName}</td>
                <td className="px-3 py-2">{invoice.partyPan || "Retail"}</td>
                <td className="px-3 py-2 text-right font-mono">
                  {Number(invoice.grandTotal || 0).toLocaleString("en-NP", {
                    minimumFractionDigits: 2,
                  })}
                </td>
                <td className="px-3 py-2">
                  <CbmsStatusBadge invoice={invoice} onUpdated={() => initializeApp?.()} />
                </td>
              </tr>
            ))}

            {filteredInvoices.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-8 text-gray-500">
                  No invoices found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CbmsDashboard;
