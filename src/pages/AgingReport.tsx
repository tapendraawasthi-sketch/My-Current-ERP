import React, { useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import { Card, Button, Select, NepaliDatePicker } from "../components/ui";
import { formatNumber, dateToAD } from "../lib/utils";
import { VoucherType, VoucherStatus, PaymentStatus } from "../lib/types";
import toast from "react-hot-toast";

const AgingReport: React.FC = () => {
  const { invoices, parties, currentFiscalYear, companySettings } = useStore();
  const [reportType, setReportType] = useState<"receivables" | "payables">("receivables");
  const [startDate, setStartDate] = useState(currentFiscalYear?.startDate || dateToAD(new Date()));
  const [endDate, setEndDate] = useState(currentFiscalYear?.endDate || dateToAD(new Date()));

  // Compute aging data
  const agingData = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const referenceInvoices = invoices.filter((inv) => {
      if (inv.status !== VoucherStatus.POSTED) return false;
      if (inv.paymentStatus === PaymentStatus.PAID) return false;
      if (reportType === "receivables" && inv.type !== VoucherType.SALES_INVOICE) return false;
      if (reportType === "payables" && inv.type !== VoucherType.PURCHASE_INVOICE) return false;
      return inv.date >= startDate && inv.date <= endDate;
    });

    const rows = referenceInvoices.map((inv) => {
      const outstanding = Math.max(0, inv.grandTotal - (inv.paidAmount || 0));

      // Due date fallback
      let dueDateStr = inv.dueDate;
      if (!dueDateStr) {
        const d = new Date(inv.date);
        d.setDate(d.getDate() + 30);
        dueDateStr = d.toISOString().split("T")[0];
      }

      const refDate = new Date(dueDateStr);
      refDate.setHours(0, 0, 0, 0);
      const diffTime = today.getTime() - refDate.getTime();
      const daysOutstanding = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      // Buckets: Not Due, 0-30 days, 31-60 days, 61-90 days, 91-180 days, 181-365 days, >365 days overdue
      const notDue = daysOutstanding < 0 ? outstanding : 0;
      const b0_30 = daysOutstanding >= 0 && daysOutstanding <= 30 ? outstanding : 0;
      const b31_60 = daysOutstanding >= 31 && daysOutstanding <= 60 ? outstanding : 0;
      const b61_90 = daysOutstanding >= 61 && daysOutstanding <= 90 ? outstanding : 0;
      const b91_180 = daysOutstanding >= 91 && daysOutstanding <= 180 ? outstanding : 0;
      const b181_365 = daysOutstanding >= 181 && daysOutstanding <= 365 ? outstanding : 0;
      const b365plus = daysOutstanding > 365 ? outstanding : 0;

      return {
        id: inv.id,
        invoiceNo: inv.invoiceNo,
        date: inv.date,
        dateNepali: inv.dateNepali,
        dueDate: dueDateStr,
        partyId: inv.partyId,
        partyName: inv.partyName,
        daysOutstanding,
        outstanding,
        notDue,
        b0_30,
        b31_60,
        b61_90,
        b91_180,
        b181_365,
        b365plus,
      };
    });

    // Grand totals
    const grandTotals = rows.reduce(
      (acc, r) => {
        acc.notDue += r.notDue;
        acc.b0_30 += r.b0_30;
        acc.b31_60 += r.b31_60;
        acc.b61_90 += r.b61_90;
        acc.b91_180 += r.b91_180;
        acc.b181_365 += r.b181_365;
        acc.b365plus += r.b365plus;
        acc.outstanding += r.outstanding;
        return acc;
      },
      {
        notDue: 0,
        b0_30: 0,
        b31_60: 0,
        b61_90: 0,
        b91_180: 0,
        b181_365: 0,
        b365plus: 0,
        outstanding: 0,
      },
    );

    return {
      rows: rows.sort((a, b) => b.daysOutstanding - a.daysOutstanding),
      grandTotals,
    };
  }, [invoices, reportType, startDate, endDate]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    if (!agingData.rows.length) {
      toast.error("No data to export.");
      return;
    }

    const headers = [
      "Invoice No",
      "Date",
      "Due Date",
      "Party",
      "Days Overdue",
      "Not Due",
      "0-30 days",
      "31-60 days",
      "61-90 days",
      "91-180 days",
      "181-365 days",
      ">365 days",
      "Total Outstanding",
    ];

    const rows = agingData.rows.map((r) => [
      r.invoiceNo,
      companySettings?.dateFormat === "BS" ? r.dateNepali : r.date,
      r.dueDate,
      r.partyName,
      r.daysOutstanding,
      r.notDue,
      r.b0_30,
      r.b31_60,
      r.b61_90,
      r.b91_180,
      r.b181_365,
      r.b365plus,
      r.outstanding,
    ]);

    // Totals row
    rows.push([
      "TOTAL",
      "",
      "",
      "",
      "",
      agingData.grandTotals.notDue.toString(),
      agingData.grandTotals.b0_30.toString(),
      agingData.grandTotals.b31_60.toString(),
      agingData.grandTotals.b61_90.toString(),
      agingData.grandTotals.b91_180.toString(),
      agingData.grandTotals.b181_365.toString(),
      agingData.grandTotals.b365plus.toString(),
      agingData.grandTotals.outstanding.toString(),
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers, ...rows].map((e) => e.map((val) => `"${val}"`).join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `${reportType === "receivables" ? "Receivables" : "Payables"}_Aging_Report.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Aging report exported to CSV.");
  };

  const getColorClass = (days: number) => {
    if (days < 0) return "text-gray-500";
    if (days <= 30) return "text-[#b45309] font-medium"; // 0-30 = yellow (#b45309 text)
    if (days <= 90) return "text-orange-600 font-medium"; // 31-90 = orange
    return "text-[#dc2626] font-bold"; // >90 = red (#dc2626)
  };

  return (
    <div className="flex flex-col gap-6 animate-fadeIn select-none text-xs page-wrapper">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-4 no-print">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800">Aging Report</h1>
          <p className="text-[11px] text-gray-500 mt-0.5">Outstanding aging analysis</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            icon={<span className="text-sm">📄</span>}
          >
            Export CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
            icon={<span className="text-sm">🖨️</span>}
          >
            Print
          </Button>
        </div>
      </div>

      {/* Date Filters */}
      <Card border padding="md" className="no-print">
        <div className="grid gap-4 lg:grid-cols-4">
          <NepaliDatePicker label="From Date" value={startDate} onChange={setStartDate} />
          <NepaliDatePicker label="To Date" value={endDate} onChange={setEndDate} />
          <div className="flex items-end">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setStartDate(currentFiscalYear?.startDate || dateToAD(new Date()));
                setEndDate(currentFiscalYear?.endDate || dateToAD(new Date()));
              }}
            >
              Reset
            </Button>
          </div>
        </div>
      </Card>

      {/* Receivables / Payables Tabs */}
      <div className="flex border-b border-gray-200 mb-2 no-print">
        <button
          className={`px-4 py-2 text-[12px] font-medium border-b-2 transition-colors ${
            reportType === "receivables"
              ? "border-[#1557b0] text-[#1557b0] font-bold"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
          onClick={() => setReportType("receivables")}
        >
          Receivables (Sales Dues)
        </button>
        <button
          className={`px-4 py-2 text-[12px] font-medium border-b-2 transition-colors ${
            reportType === "payables"
              ? "border-[#1557b0] text-[#1557b0] font-bold"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
          onClick={() => setReportType("payables")}
        >
          Payables (Purchase Dues)
        </button>
      </div>

      {/* Main Outstanding Table */}
      <div className="w-full overflow-x-auto border border-gray-200 rounded-lg shadow-sm bg-white">
        <table className="data-table w-full border-collapse text-xs">
          <thead>
            <tr className="bg-[#eef1f8] border-b-2 border-[#c5cad8]">
              <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-left">
                Invoice No
              </th>
              <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-left">
                Date
              </th>
              <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-left">
                Due Date
              </th>
              <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-left">
                Party Name
              </th>
              <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-center">
                Age (Days)
              </th>
              <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-right">
                Not Due
              </th>
              <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-right">
                0-30
              </th>
              <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-right">
                31-60
              </th>
              <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-right">
                61-90
              </th>
              <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-right">
                91-180
              </th>
              <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-right">
                181-365
              </th>
              <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-right">
                &gt;365
              </th>
              <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-right">
                Outstanding
              </th>
              <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-center no-print">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-150">
            {agingData.rows.length === 0 ? (
              <tr>
                <td colSpan={14} className="text-center py-6 text-gray-400">
                  No outstanding invoices found.
                </td>
              </tr>
            ) : (
              agingData.rows.map((row) => (
                <tr key={row.id} className="hover:bg-[#e8eeff] bg-white transition-colors">
                  <td className="px-3 py-2 text-[12px] text-gray-700 font-medium">
                    {row.invoiceNo}
                  </td>
                  <td className="px-3 py-2 text-[12px] text-gray-700">
                    {companySettings?.dateFormat === "BS" ? row.dateNepali : row.date}
                  </td>
                  <td className="px-3 py-2 text-[12px] text-gray-700">{row.dueDate}</td>
                  <td className="px-3 py-2 text-[12px] text-gray-700 font-semibold">
                    {row.partyName}
                  </td>
                  <td
                    className={`px-3 py-2 text-[12px] text-center ${getColorClass(row.daysOutstanding)}`}
                  >
                    {row.daysOutstanding > 0
                      ? `${row.daysOutstanding} days`
                      : row.daysOutstanding === 0
                        ? "Today"
                        : "Not Due"}
                  </td>
                  <td className="px-3 py-2 text-[12px] text-right font-mono text-gray-650">
                    {row.notDue > 0 ? formatNumber(row.notDue) : "-"}
                  </td>
                  <td
                    className={`px-3 py-2 text-[12px] text-right font-mono ${row.b0_30 > 0 ? getColorClass(row.daysOutstanding) : ""}`}
                  >
                    {row.b0_30 > 0 ? formatNumber(row.b0_30) : "-"}
                  </td>
                  <td
                    className={`px-3 py-2 text-[12px] text-right font-mono ${row.b31_60 > 0 ? getColorClass(row.daysOutstanding) : ""}`}
                  >
                    {row.b31_60 > 0 ? formatNumber(row.b31_60) : "-"}
                  </td>
                  <td
                    className={`px-3 py-2 text-[12px] text-right font-mono ${row.b61_90 > 0 ? getColorClass(row.daysOutstanding) : ""}`}
                  >
                    {row.b61_90 > 0 ? formatNumber(row.b61_90) : "-"}
                  </td>
                  <td
                    className={`px-3 py-2 text-[12px] text-right font-mono ${row.b91_180 > 0 ? getColorClass(row.daysOutstanding) : ""}`}
                  >
                    {row.b91_180 > 0 ? formatNumber(row.b91_180) : "-"}
                  </td>
                  <td
                    className={`px-3 py-2 text-[12px] text-right font-mono ${row.b181_365 > 0 ? getColorClass(row.daysOutstanding) : ""}`}
                  >
                    {row.b181_365 > 0 ? formatNumber(row.b181_365) : "-"}
                  </td>
                  <td
                    className={`px-3 py-2 text-[12px] text-right font-mono ${row.b365plus > 0 ? getColorClass(row.daysOutstanding) : ""}`}
                  >
                    {row.b365plus > 0 ? formatNumber(row.b365plus) : "-"}
                  </td>
                  <td className="px-3 py-2 text-[12px] text-right font-mono font-bold text-gray-800">
                    {formatNumber(row.outstanding)}
                  </td>
                  <td className="px-3 py-2 text-[12px] text-center no-print">
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        toast.success("Feature coming soon");
                      }}
                    >
                      Send Reminder
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {agingData.rows.length > 0 && (
            <tfoot className="bg-[#eef2ff] font-bold text-[12px] border-t-2 border-[#c7d2fe] text-gray-800">
              <tr>
                <td colSpan={5} className="px-3 py-2.5 text-left font-bold">
                  GRAND TOTAL
                </td>
                <td className="px-3 py-2.5 text-right font-mono text-gray-650">
                  {agingData.grandTotals.notDue > 0
                    ? formatNumber(agingData.grandTotals.notDue)
                    : "-"}
                </td>
                <td className="px-3 py-2.5 text-right font-mono text-[#b45309]">
                  {agingData.grandTotals.b0_30 > 0
                    ? formatNumber(agingData.grandTotals.b0_30)
                    : "-"}
                </td>
                <td className="px-3 py-2.5 text-right font-mono text-orange-600">
                  {agingData.grandTotals.b31_60 > 0
                    ? formatNumber(agingData.grandTotals.b31_60)
                    : "-"}
                </td>
                <td className="px-3 py-2.5 text-right font-mono text-orange-600">
                  {agingData.grandTotals.b61_90 > 0
                    ? formatNumber(agingData.grandTotals.b61_90)
                    : "-"}
                </td>
                <td className="px-3 py-2.5 text-right font-mono text-[#dc2626]">
                  {agingData.grandTotals.b91_180 > 0
                    ? formatNumber(agingData.grandTotals.b91_180)
                    : "-"}
                </td>
                <td className="px-3 py-2.5 text-right font-mono text-[#dc2626]">
                  {agingData.grandTotals.b181_365 > 0
                    ? formatNumber(agingData.grandTotals.b181_365)
                    : "-"}
                </td>
                <td className="px-3 py-2.5 text-right font-mono text-[#dc2626]">
                  {agingData.grandTotals.b365plus > 0
                    ? formatNumber(agingData.grandTotals.b365plus)
                    : "-"}
                </td>
                <td className="px-3 py-2.5 text-right font-mono font-bold text-gray-900">
                  {formatNumber(agingData.grandTotals.outstanding)}
                </td>
                <td className="no-print"></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Print-Only Header */}
      <div className="print-only hidden">
        <div className="mb-6 flex justify-between items-end border-b pb-4">
          <div>
            <h1 className="text-[18px] font-bold text-gray-800">SUTRA ERP</h1>
            <h2 className="text-[14px] font-bold text-gray-800 uppercase">
              {reportType === "receivables" ? "Receivables Aging Report" : "Payables Aging Report"}
            </h2>
            <p className="text-[11px] text-gray-500 mt-1">
              Period: {startDate} to {endDate}
            </p>
          </div>
          <div className="text-right text-[10px] text-gray-400">
            Report Date: {new Date().toISOString().split("T")[0]}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgingReport;
