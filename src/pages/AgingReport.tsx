/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Outstanding aging report for receivables and payables.
 */

import React, { useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import { Card, Button, Table, Select, NepaliDatePicker, ActionToolbar } from "../components/ui";
import { computeOutstandingReceivables, computeOutstandingPayables } from "../lib/accounting";
import { workbookFromArray, downloadWorkbook } from "../lib/exportUtils";
import { formatNumber, dateToAD } from "../lib/utils";
import { Invoice, VoucherType, VoucherStatus, PaymentStatus } from "../lib/types";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import toast from "react-hot-toast";

const bucketLabels = [
  { key: "current", label: "Current (0-30 days)" },
  { key: "bucket30", label: "31-60 days" },
  { key: "bucket60", label: "61-90 days" },
  { key: "bucket90plus", label: "91+ days" },
] as const;

type AgingBucketKey = (typeof bucketLabels)[number]["key"];

type AgingRow = {
  partyId: string;
  partyName: string;
  partyPan?: string;
  invoiceNo: string;
  invoiceDate: string;
  invoiceDateNepali: string;
  dueDate: string;
  daysOutstanding: number;
  current: number;
  bucket30: number;
  bucket60: number;
  bucket90plus: number;
  outstanding: number;
};

type AgingSummary = {
  current: number;
  bucket30: number;
  bucket60: number;
  bucket90plus: number;
  total: number;
};

const AgingReport: React.FC = () => {
  const { invoices, parties, currentFiscalYear, setCurrentPage, setReportFilters } = useStore();
  const [reportType, setReportType] = useState<"receivables" | "payables">("receivables");
  const [startDate, setStartDate] = useState(currentFiscalYear?.startDate || dateToAD(new Date()));
  const [endDate, setEndDate] = useState(currentFiscalYear?.endDate || dateToAD(new Date()));

  const agingData = useMemo(() => {
    const today = new Date();
    const referenceInvoices = invoices.filter((inv) => {
      if (inv.status !== VoucherStatus.POSTED) return false;
      if (inv.paymentStatus === PaymentStatus.PAID) return false;
      if (reportType === "receivables" && inv.type !== VoucherType.SALES_INVOICE) return false;
      if (reportType === "payables" && inv.type !== VoucherType.PURCHASE_INVOICE) return false;
      return inv.date >= startDate && inv.date <= endDate;
    });

    const rows: AgingRow[] = referenceInvoices.map((inv) => {
      const outstanding = Math.max(0, inv.grandTotal - (inv.paidAmount || 0));
      const referenceDate = inv.dueDate || inv.date;
      const diffDays = Math.ceil(
        (today.getTime() - new Date(referenceDate).getTime()) / (1000 * 60 * 60 * 24),
      );
      const daysOutstanding = Math.max(0, diffDays);

      const current = daysOutstanding <= 30 ? outstanding : 0;
      const bucket30 = daysOutstanding > 30 && daysOutstanding <= 60 ? outstanding : 0;
      const bucket60 = daysOutstanding > 60 && daysOutstanding <= 90 ? outstanding : 0;
      const bucket90plus = daysOutstanding > 90 ? outstanding : 0;

      return {
        partyId: inv.partyId,
        partyName: inv.partyName,
        partyPan: inv.partyPan,
        invoiceNo: inv.invoiceNo,
        invoiceDate: inv.date,
        invoiceDateNepali: inv.dateNepali,
        dueDate: referenceDate,
        daysOutstanding,
        current,
        bucket30,
        bucket60,
        bucket90plus,
        outstanding: outstanding,
      };
    });

    const summary = rows.reduce(
      (acc, row) => {
        acc.current += row.current;
        acc.bucket30 += row.bucket30;
        acc.bucket60 += row.bucket60;
        acc.bucket90plus += row.bucket90plus;
        acc.total += row.outstanding;
        return acc;
      },
      { current: 0, bucket30: 0, bucket60: 0, bucket90plus: 0, total: 0 },
    );

    const partyMap = rows.reduce<
      Record<string, { partyName: string; amount: number; daysOverdue: number }>
    >((map, row) => {
      const existing = map[row.partyId] || { partyName: row.partyName, amount: 0, daysOverdue: 0 };
      existing.amount += row.outstanding;
      existing.daysOverdue = Math.max(existing.daysOverdue, row.daysOutstanding);
      map[row.partyId] = existing;
      return map;
    }, {});

    const partyRows = Object.entries(partyMap)
      .map(([partyId, info]) => ({
        partyId,
        partyName: info.partyName,
        amount: info.amount,
        daysOverdue: info.daysOverdue,
      }))
      .sort((a, b) => b.amount - a.amount);

    return {
      rows: rows.sort((a, b) => b.outstanding - a.outstanding),
      summary,
      partyRows,
    };
  }, [invoices, reportType, startDate, endDate]);

  const bucketChart = useMemo(() => {
    const values = [
      agingData.summary.current,
      agingData.summary.bucket30,
      agingData.summary.bucket60,
      agingData.summary.bucket90plus,
    ];
    const maxValue = Math.max(...values, 1);
    return bucketLabels.map((bucket, index) => ({
      label: bucket.label,
      value: values[index],
      width: `${Math.round((values[index] / maxValue) * 100)}%`,
    }));
  }, [agingData.summary]);

  const handleExportExcel = () => {
    try {
      const headers = [
        "Party Name",
        "PAN / VAT",
        "Invoice No",
        "Invoice Date (AD)",
        "Invoice Date (BS)",
        "Due Date",
        "Days Outstanding",
        "Current",
        "31-60",
        "61-90",
        "91+",
        "Total Outstanding",
      ];
      const rows = agingData.rows.map((row) => [
        row.partyName,
        row.partyPan || "N/A",
        row.invoiceNo,
        row.invoiceDate,
        row.invoiceDateNepali,
        row.dueDate,
        row.daysOutstanding,
        row.current,
        row.bucket30,
        row.bucket60,
        row.bucket90plus,
        row.outstanding,
      ]);
      const workbook = workbookFromArray(
        headers,
        rows,
        `${reportType === "receivables" ? "Receivables" : "Payables"} Aging`,
      );
      downloadWorkbook(
        workbook,
        `${reportType === "receivables" ? "Receivables" : "Payables"}_Aging_Report.xlsx`,
      );
      toast.success("Aging report exported to Excel.");
    } catch (error: any) {
      toast.error(error?.message || "Unable to export aging report.");
    }
  };

  const handlePrintPDF = () => {
    if (!agingData.rows.length) {
      toast("No data to print.");
      return;
    }

    try {
      const doc = new jsPDF({ unit: "pt" });
      const title =
        reportType === "receivables" ? "Receivables Aging Report" : "Payables Aging Report";
      doc.setFontSize(14);
      doc.text(title, 40, 40);
      doc.setFontSize(10);
      doc.text(`Period: ${startDate} to ${endDate}`, 40, 58);

      const body = agingData.rows.map((row) => [
        row.invoiceDateNepali,
        row.invoiceNo,
        row.partyName,
        row.partyPan || "-",
        row.daysOutstanding,
        formatNumber(row.current),
        formatNumber(row.bucket30),
        formatNumber(row.bucket60),
        formatNumber(row.bucket90plus),
        formatNumber(row.outstanding),
      ]);

      autoTable(doc, {
        startY: 78,
        head: [
          [
            "Date (BS)",
            "Invoice No",
            "Party",
            "PAN / VAT",
            "Days",
            "Current",
            "31-60",
            "61-90",
            "91+",
            "Outstanding",
          ],
        ],
        body,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [30, 58, 96], textColor: 255 },
        columnStyles: {
          0: { cellWidth: 45 },
          1: { cellWidth: 45 },
          2: { cellWidth: 120 },
          3: { cellWidth: 70 },
          4: { cellWidth: 30, halign: "right" },
          5: { cellWidth: 40, halign: "right" },
          6: { cellWidth: 40, halign: "right" },
          7: { cellWidth: 40, halign: "right" },
          8: { cellWidth: 40, halign: "right" },
          9: { cellWidth: 55, halign: "right" },
        },
      });

      const blob = doc.output("blob");
      const url = URL.createObjectURL(blob);
      const win = window.open(url);
      if (win) win.focus();
    } catch (error: any) {
      toast.error(error?.message || "Failed to print aging report.");
    }
  };

  const handlePartyClick = (partyId: string) => {
    setReportFilters({ partyId });
    setCurrentPage("party-statement");
  };

  const tableColumns = [
    { key: "invoiceDateNepali", header: "Date (BS)", width: "11%" },
    { key: "invoiceNo", header: "Invoice No", width: "9%" },
    { key: "partyName", header: "Party", width: "20%" },
    { key: "partyPan", header: "PAN / VAT", width: "12%" },
    { key: "daysOutstanding", header: "Days", width: "8%", align: "right" },
    {
      key: "current",
      header: (<span className="text-green-700 text-[10px] font-semibold">0-30 days</span>) as any,
      width: "10%",
      align: "right",
      render: (value: number) => formatNumber(value),
    },
    {
      key: "bucket30",
      header: (<span className="text-amber-600 text-[10px] font-semibold">31-60</span>) as any,
      width: "10%",
      align: "right",
      render: (value: number) => formatNumber(value),
    },
    {
      key: "bucket60",
      header: (<span className="text-orange-600 text-[10px] font-semibold">61-90</span>) as any,
      width: "10%",
      align: "right",
      render: (value: number) => formatNumber(value),
    },
    {
      key: "bucket90plus",
      header: (<span className="text-red-600 text-[10px] font-semibold">90+</span>) as any,
      width: "10%",
      align: "right",
      render: (value: number) => formatNumber(value),
    },
    {
      key: "outstanding",
      header: "Outstanding",
      width: "10%",
      align: "right",
      render: (value: number) => formatNumber(value),
    },
  ];

  const partySummaryColumns = [
    { key: "partyName", header: "Party Name" },
    {
      key: "amount",
      header: "Outstanding",
      align: "right",
      render: (value: number) => formatNumber(value),
    },
    { key: "daysOverdue", header: "Days Overdue", align: "right" },
  ];

  return (
    <div className="flex flex-col gap-6 animate-fadeIn select-none text-xs">
      <ActionToolbar title="Aging Report" subtitle="Outstanding dues by age bracket" />
      <div className="flex flex-wrap justify-end gap-2 border-b border-gray-200 pb-5">
        <Button
          variant="outline"
          size="sm"
          onClick={handleExportExcel}
          icon={<span className="text-sm">📄</span>}
        >
          Export Excel
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={handlePrintPDF}
          icon={<span className="text-sm">🖨️</span>}
        >
          Print PDF
        </Button>
      </div>

      <Card border padding="md">
        <div className="grid gap-4 lg:grid-cols-4">
          <Select
            label="Report Type"
            value={reportType}
            onChange={setReportType}
            options={[
              { value: "receivables", label: "Receivables Aging" },
              { value: "payables", label: "Payables Aging" },
            ]}
          />
          <NepaliDatePicker label="From Date" value={startDate} onChange={setStartDate} />
          <NepaliDatePicker label="To Date" value={endDate} onChange={setEndDate} />
          <div className="flex items-end">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setReportType("receivables");
                setStartDate(currentFiscalYear?.startDate || dateToAD(new Date()));
                setEndDate(currentFiscalYear?.endDate || dateToAD(new Date()));
              }}
            >
              Reset
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid gap-3 md:grid-cols-5">
        <Card border padding="sm" className="bg-slate-50">
          <div className="text-[10px] uppercase tracking-[0.25em] text-slate-500">
            Total Outstanding
          </div>
          <div className="mt-2 text-lg font-bold text-slate-900">
            {formatNumber(agingData.summary.total)}
          </div>
        </Card>
        <Card border padding="sm" className="bg-slate-50">
          <div className="text-[10px] uppercase tracking-[0.25em] text-slate-500">Current</div>
          <div className="mt-2 text-lg font-bold text-slate-900">
            {formatNumber(agingData.summary.current)}
          </div>
        </Card>
        <Card border padding="sm" className="bg-slate-50">
          <div className="text-[10px] uppercase tracking-[0.25em] text-slate-500">31-60 Days</div>
          <div className="mt-2 text-lg font-bold text-slate-900">
            {formatNumber(agingData.summary.bucket30)}
          </div>
        </Card>
        <Card border padding="sm" className="bg-slate-50">
          <div className="text-[10px] uppercase tracking-[0.25em] text-slate-500">61-90 Days</div>
          <div className="mt-2 text-lg font-bold text-slate-900">
            {formatNumber(agingData.summary.bucket60)}
          </div>
        </Card>
        <Card border padding="sm" className="bg-slate-50">
          <div className="text-[10px] uppercase tracking-[0.25em] text-slate-500">91+ Days</div>
          <div className="mt-2 text-lg font-bold text-slate-900">
            {formatNumber(agingData.summary.bucket90plus)}
          </div>
        </Card>
      </div>

      <Card border padding="md" className="space-y-4">
        <div className="text-sm font-semibold text-slate-700 uppercase tracking-[0.18em]">
          Aging bucket distribution
        </div>
        <div className="space-y-3">
          {bucketChart.map((bucket) => (
            <div key={bucket.label} className="space-y-1">
              <div className="flex items-center justify-between text-[11px] text-slate-600">
                <span>{bucket.label}</span>
                <span>{formatNumber(bucket.value)}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full rounded-full bg-blue-600" style={{ width: bucket.width }} />
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <Card border padding="md">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-xs uppercase tracking-[0.22em] text-slate-500">
                Detailed Aging
              </div>
              <div className="mt-1 text-sm text-slate-700">
                List of unpaid invoices within selected range.
              </div>
            </div>
            <span className="text-xs text-slate-500">{agingData.rows.length} records</span>
          </div>

          <Table
            columns={tableColumns}
            data={agingData.rows}
            emptyMessage="No aging records found for selected range."
            rowKey={(row) => `${row.invoiceNo}-${row.partyId}`}
            stickyHeader
            onRowClick={(row) => handlePartyClick(row.partyId)}
          />
        </Card>

        <Card border padding="md" className="space-y-4">
          <div>
            <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Top Parties</div>
            <div className="mt-1 text-sm text-slate-700">Highest outstanding balances.</div>
          </div>

          <Table
            columns={partySummaryColumns}
            data={agingData.partyRows.slice(0, 8)}
            emptyMessage="No party outstanding balances."
            rowKey="partyId"
            stickyHeader
            onRowClick={(row) => handlePartyClick(row.partyId)}
          />
        </Card>
      </div>
    </div>
  );
};

export default AgingReport;
