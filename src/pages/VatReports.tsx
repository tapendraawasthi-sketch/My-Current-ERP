// @ts-nocheck
import React, { useState, useMemo, useCallback } from "react";
import { useStore } from "../store/useStore";
import { Download, FileSpreadsheet, Printer } from "lucide-react";
import * as XLSX from "xlsx";
import toast from "react-hot-toast";
import ReportDateRangePicker, { DateRange } from "../components/ui/ReportDateRangePicker";
import { ReportEmptyState } from "../components/ReportEmptyState";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Column {
  key: string;
  label: string; // was "header" — fixed to "label" throughout
  width?: string;
  align?: "left" | "right" | "center";
  render?: (value: any, row?: any) => React.ReactNode;
}

interface AnnexEntry {
  sno: number;
  date: string;
  dateNepali?: string;
  invoiceNo: string;
  partyName: string;
  partyPan: string;
  partyAddress?: string;
  taxableAmount: number;
  vatAmount: number;
  totalAmount: number;
  type: string;
  exemptAmount?: number;
}

// ─── ReportShell ──────────────────────────────────────────────────────────────

interface ReportShellProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  printable?: boolean;
}

const ReportShell: React.FC<ReportShellProps> = ({
  title,
  subtitle,
  children,
  actions,
  className = "",
  printable = true,
}) => {
  return (
    <div
      className={`flex h-full min-h-0 flex-col bg-[#f5f6fa] overflow-y-auto p-4 md:p-6 ${className}`}
    >
      <div className="flex items-center justify-between mb-4 no-print">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800">{title}</h1>
          {subtitle && <p className="text-[11px] text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      <div className={printable ? "print-content flex-1 min-h-0 flex flex-col" : ""}>
        {children}
      </div>
    </div>
  );
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function money(n: number): string {
  return Number(n || 0).toLocaleString("en-NP", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

function firstDayOfMonth(): string {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().split("T")[0];
}

// Convert string date to nepali BS representation (simple helper)
function formatBSDate(adDateStr: string): string {
  if (!adDateStr) return "—";
  // For now return the AD date; in production use a BS converter
  return adDateStr;
}

// Parse a string or Date to Date safely
function toDate(val: string | Date): Date {
  if (val instanceof Date) return val;
  // Fix: convert string to Date properly — never pass raw string where Date is needed
  return new Date(val.includes("T") ? val : val + "T00:00:00");
}

function isDateInRange(dateStr: string, fromStr: string, toStr: string): boolean {
  if (!dateStr) return false;
  // Convert strings to Date objects for comparison
  const d = toDate(dateStr);
  const from = toDate(fromStr);
  const to = toDate(toStr);
  if (typeof toStr === "string" && !toStr.includes("T")) {
    to.setHours(23, 59, 59, 999);
  }
  return d >= from && d <= to;
}

// ─── DataTable ────────────────────────────────────────────────────────────────

interface DataTableProps {
  columns: Column[];
  data: any[];
  emptyMessage?: string;
  footerRow?: React.ReactNode;
}

const DataTable: React.FC<DataTableProps> = ({
  columns,
  data,
  emptyMessage = "No data found.",
  footerRow,
}) => {
  if (data.length === 0) {
    return (
      <ReportEmptyState
        message={emptyMessage}
        hint="Adjust the date range or post invoices for this period."
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-max border-collapse">
        <thead>
          <tr className="bg-[#f5f6fa] border-b border-gray-200">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-3 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wide ${
                  col.align === "right"
                    ? "text-right"
                    : col.align === "center"
                      ? "text-center"
                      : "text-left"
                } ${col.width ?? ""}`}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIdx) => (
            <tr
              key={rowIdx}
              className="group hover:bg-gray-50 border-l-[3px] border-l-transparent hover:border-l-[#1557b0] border-b border-gray-100"
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={`px-3 py-2.5 text-[12px] text-gray-700 ${
                    col.align === "right"
                      ? "text-right font-mono"
                      : col.align === "center"
                        ? "text-center"
                        : ""
                  }`}
                >
                  {col.render ? col.render(row[col.key], row) : (row[col.key] ?? "—")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {footerRow && <tfoot>{footerRow}</tfoot>}
      </table>
    </div>
  );
};

// ─── Main Component ────────────────────────────────────────────────────────────

const VatReports: React.FC = () => {
  const { invoices, companySettings, currentFiscalYear } = useStore();

  const [activeAnnex, setActiveAnnex] = useState<"A" | "B" | "C" | "D" | "summary">("summary");
  const [dateRange, setDateRange] = useState<DateRange>({
    fromDate: firstDayOfMonth(),
    toDate: todayISO(),
  });

  const { fromDate, toDate } = dateRange;

  // ── Filter invoices by date range ─────────────────────────────────────────
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      if (!inv.date) return false;
      // Fix: use toDate() helper to convert string dates to Date objects properly
      return isDateInRange(inv.date, dateRange.fromDate, dateRange.toDate);
    });
  }, [invoices, dateRange.fromDate, dateRange.toDate]);

  // ── Annex A: Sales to VAT registered parties ──────────────────────────────
  const annexAData = useMemo<AnnexEntry[]>(() => {
    return filteredInvoices
      .filter(
        (inv) =>
          (inv.type === "sales-invoice" || inv.type === "sales_invoice") &&
          inv.status === "posted" &&
          inv.partyPan &&
          inv.partyPan.trim() !== "",
      )
      .map((inv, idx) => ({
        sno: idx + 1,
        date: inv.date,
        dateNepali: inv.dateNepali ?? formatBSDate(inv.date),
        invoiceNo: inv.invoiceNo,
        partyName: inv.partyName ?? "—",
        partyPan: inv.partyPan ?? "—",
        partyAddress: "",
        taxableAmount: inv.taxableAmount ?? 0,
        vatAmount: inv.vatAmount ?? 0,
        totalAmount: inv.grandTotal ?? 0,
        type: "sales",
        exemptAmount: inv.exemptAmount ?? 0,
      }));
  }, [filteredInvoices]);

  // ── Annex B: Sales to non-VAT registered / retail ─────────────────────────
  const annexBData = useMemo<AnnexEntry[]>(() => {
    return filteredInvoices
      .filter(
        (inv) =>
          (inv.type === "sales-invoice" || inv.type === "sales_invoice") &&
          inv.status === "posted" &&
          (!inv.partyPan || inv.partyPan.trim() === ""),
      )
      .map((inv, idx) => ({
        sno: idx + 1,
        date: inv.date,
        dateNepali: inv.dateNepali ?? formatBSDate(inv.date),
        invoiceNo: inv.invoiceNo,
        partyName: inv.partyName ?? "Walk-in Customer",
        partyPan: "—",
        taxableAmount: inv.taxableAmount ?? 0,
        vatAmount: inv.vatAmount ?? 0,
        totalAmount: inv.grandTotal ?? 0,
        type: "retail",
        exemptAmount: inv.exemptAmount ?? 0,
      }));
  }, [filteredInvoices]);

  // ── Annex C: Purchases ─────────────────────────────────────────────────────
  const annexCData = useMemo<AnnexEntry[]>(() => {
    return filteredInvoices
      .filter(
        (inv) =>
          (inv.type === "purchase-invoice" || inv.type === "purchase_invoice") &&
          inv.status === "posted",
      )
      .map((inv, idx) => ({
        sno: idx + 1,
        date: inv.date,
        dateNepali: inv.dateNepali ?? formatBSDate(inv.date),
        invoiceNo: inv.invoiceNo,
        partyName: inv.partyName ?? "—",
        partyPan: inv.partyPan ?? "—",
        taxableAmount: inv.taxableAmount ?? 0,
        vatAmount: inv.vatAmount ?? 0,
        totalAmount: inv.grandTotal ?? 0,
        type: "purchase",
        exemptAmount: inv.exemptAmount ?? 0,
      }));
  }, [filteredInvoices]);

  // ── Annex D: Import purchases ─────────────────────────────────────────────
  const annexDData = useMemo<AnnexEntry[]>(() => {
    return filteredInvoices
      .filter((inv) => inv.type === "import-purchase" && inv.status === "posted")
      .map((inv, idx) => ({
        sno: idx + 1,
        date: inv.date,
        dateNepali: inv.dateNepali ?? formatBSDate(inv.date),
        invoiceNo: inv.invoiceNo,
        partyName: inv.partyName ?? "—",
        partyPan: inv.partyPan ?? "—",
        taxableAmount: inv.taxableAmount ?? 0,
        vatAmount: inv.vatAmount ?? 0,
        totalAmount: inv.grandTotal ?? 0,
        type: "import",
        exemptAmount: inv.exemptAmount ?? 0,
      }));
  }, [filteredInvoices]);

  // ── VAT Summary ───────────────────────────────────────────────────────────
  const vatSummary = useMemo(() => {
    let outputVat = 0,
      inputVat = 0,
      outputTaxable = 0,
      inputTaxable = 0;
    let outputCount = 0,
      inputCount = 0;

    for (const inv of filteredInvoices) {
      if (inv.status !== "posted") continue;
      const t = String(inv.type || "").toLowerCase();
      const vat = Number(inv.vatAmount || inv.taxAmount || 0);
      const taxable = Number(inv.taxableAmount || 0);

      if (t.includes("sales-invoice") || t === "sales_invoice") {
        outputVat += vat;
        outputTaxable += taxable;
        outputCount++;
      }
      if (t.includes("purchase-invoice") || t === "purchase_invoice") {
        inputVat += vat;
        inputTaxable += taxable;
        inputCount++;
      }
    }

    const netVat = outputVat - inputVat;
    return { outputVat, inputVat, netVat, outputTaxable, inputTaxable, outputCount, inputCount };
  }, [filteredInvoices]);

  const fmtVat = (n: number) =>
    "Rs. " +
    Math.abs(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // ── Column definitions — using "label" not "header" ────────────────────────

  const annexAColumns: Column[] = [
    { key: "sno", label: "S.N.", width: "w-12", align: "center" },
    { key: "dateNepali", label: "Date (BS)", width: "w-28" },
    { key: "invoiceNo", label: "Invoice No.", width: "w-28" },
    { key: "partyName", label: "Buyer Name" },
    { key: "partyPan", label: "PAN No.", width: "w-28" },
    {
      key: "taxableAmount",
      label: "Taxable Amt",
      align: "right",
      render: (value: number) => money(value),
    },
    {
      key: "exemptAmount",
      label: "Exempt Amt",
      align: "right",
      render: (value: number) => money(value ?? 0),
    },
    {
      key: "vatAmount",
      label: "VAT (13%)",
      align: "right",
      render: (value: number) => money(value),
    },
    {
      key: "totalAmount",
      label: "Total Amt",
      align: "right",
      render: (value: number) => money(value),
    },
  ];

  const annexBColumns: Column[] = [
    { key: "sno", label: "S.N.", width: "w-12", align: "center" },
    { key: "dateNepali", label: "Date (BS)", width: "w-28" },
    { key: "invoiceNo", label: "Invoice No.", width: "w-28" },
    { key: "partyName", label: "Buyer Name" },
    {
      key: "taxableAmount",
      label: "Taxable Amt",
      align: "right",
      render: (value: number) => money(value),
    },
    {
      key: "exemptAmount",
      label: "Exempt Amt",
      align: "right",
      render: (value: number) => money(value ?? 0),
    },
    {
      key: "vatAmount",
      label: "VAT (13%)",
      align: "right",
      render: (value: number) => money(value),
    },
    {
      key: "totalAmount",
      label: "Total Amt",
      align: "right",
      render: (value: number) => money(value),
    },
  ];

  const annexCColumns: Column[] = [
    { key: "sno", label: "S.N.", width: "w-12", align: "center" },
    { key: "dateNepali", label: "Date (BS)", width: "w-28" },
    { key: "invoiceNo", label: "Invoice No.", width: "w-28" },
    { key: "partyName", label: "Supplier Name" },
    { key: "partyPan", label: "PAN No.", width: "w-28" },
    {
      key: "taxableAmount",
      label: "Taxable Amt",
      align: "right",
      render: (value: number) => money(value),
    },
    {
      key: "vatAmount",
      label: "VAT (13%)",
      align: "right",
      render: (value: number) => money(value),
    },
    {
      key: "totalAmount",
      label: "Total Amt",
      align: "right",
      render: (value: number) => money(value),
    },
  ];

  // ── Export to Excel ───────────────────────────────────────────────────────
  const handleExportExcel = useCallback(
    (tabName: string, data: AnnexEntry[], columns: Column[]) => {
      try {
        const companyName = companySettings?.name || companySettings?.companyName || "Company";
        const fyName = currentFiscalYear?.name ?? "";

        const headers = columns.map((c) => c.label);
        const rows = data.map((row) =>
          columns.map((col) => {
            const val = (row as any)[col.key];
            return val ?? "";
          }),
        );

        const wb = XLSX.utils.book_new();
        const wsData = [
          [companyName],
          [`VAT Report — ${tabName}`],
          [`Period: ${fromDate} to ${toDate}`],
          fyName ? [`Fiscal Year: ${fyName}`] : [],
          [],
          headers,
          ...rows,
        ].filter((r) => r.length > 0);

        const ws = XLSX.utils.aoa_to_sheet(wsData);
        XLSX.utils.book_append_sheet(wb, ws, tabName);
        XLSX.writeFile(wb, `VAT_${tabName}_${fromDate}_${toDate}.xlsx`);
        toast.success(`${tabName} exported to Excel.`);
      } catch {
        toast.error("Export failed.");
      }
    },
    [companySettings, currentFiscalYear, fromDate, toDate],
  );

  const handlePrint = () => window.print();

  // ── Footer totals for annex tables ────────────────────────────────────────
  const annexATotal = useMemo(
    () => ({
      taxable: annexAData.reduce((s, r) => s + r.taxableAmount, 0),
      vat: annexAData.reduce((s, r) => s + r.vatAmount, 0),
      total: annexAData.reduce((s, r) => s + r.totalAmount, 0),
      exempt: annexAData.reduce((s, r) => s + (r.exemptAmount ?? 0), 0),
    }),
    [annexAData],
  );

  const annexBTotal = useMemo(
    () => ({
      taxable: annexBData.reduce((s, r) => s + r.taxableAmount, 0),
      vat: annexBData.reduce((s, r) => s + r.vatAmount, 0),
      total: annexBData.reduce((s, r) => s + r.totalAmount, 0),
      exempt: annexBData.reduce((s, r) => s + (r.exemptAmount ?? 0), 0),
    }),
    [annexBData],
  );

  const annexCTotal = useMemo(
    () => ({
      taxable: annexCData.reduce((s, r) => s + r.taxableAmount, 0),
      vat: annexCData.reduce((s, r) => s + r.vatAmount, 0),
      total: annexCData.reduce((s, r) => s + r.totalAmount, 0),
    }),
    [annexCData],
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    // ReportShell: NO "actions" prop — buttons rendered as children
    <ReportShell title="VAT Reports" subtitle="Annex A, B, C and VAT summary for IRD submission">
      <div className="no-print bg-white border border-gray-200 rounded-md p-3 mb-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <ReportDateRangePicker value={dateRange} onChange={setDateRange} label="" compact />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 inline-flex items-center gap-1.5"
            >
              <Printer className="h-3.5 w-3.5" />
              Print
            </button>
            <button
              type="button"
              onClick={() => {
                const data =
                  activeAnnex === "A"
                    ? annexAData
                    : activeAnnex === "B"
                      ? annexBData
                      : activeAnnex === "C"
                        ? annexCData
                        : annexDData;
                const cols =
                  activeAnnex === "A"
                    ? annexAColumns
                    : activeAnnex === "B"
                      ? annexBColumns
                      : annexCColumns;
                handleExportExcel("Annex_" + activeAnnex, data, cols);
              }}
              className="h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md inline-flex items-center gap-1.5"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              Export Excel
            </button>
          </div>
        </div>
        <p className="text-[11px] text-gray-500 mt-2">
          {filteredInvoices.length} posted invoice{filteredInvoices.length === 1 ? "" : "s"} in
          period
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <div className="bg-white border border-gray-200 rounded-md px-3 py-2.5">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
            Output VAT (sales)
          </p>
          <p className="text-[14px] font-semibold text-[#1557b0] mt-0.5 font-mono">
            {fmtVat(vatSummary.outputVat)}
          </p>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Taxable {fmtVat(vatSummary.outputTaxable)} · {vatSummary.outputCount} invoices
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-md px-3 py-2.5">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
            Input VAT (purchases)
          </p>
          <p className="text-[14px] font-semibold text-green-700 mt-0.5 font-mono">
            {fmtVat(vatSummary.inputVat)}
          </p>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Taxable {fmtVat(vatSummary.inputTaxable)} · {vatSummary.inputCount} bills
          </p>
        </div>
        <div
          className={`border rounded-md px-3 py-2.5 ${
            vatSummary.netVat >= 0 ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200"
          }`}
        >
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
            {vatSummary.netVat >= 0 ? "Net VAT payable to IRD" : "Net VAT refundable"}
          </p>
          <p
            className={`text-[14px] font-semibold mt-0.5 font-mono ${
              vatSummary.netVat >= 0 ? "text-red-700" : "text-green-700"
            }`}
          >
            {fmtVat(Math.abs(vatSummary.netVat))}
          </p>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Output − input = {vatSummary.netVat >= 0 ? "Payable" : "Refundable"}
          </p>
        </div>
      </div>

      <div className="no-print flex items-end border-b-2 border-gray-200 bg-white border border-gray-200 rounded-t-md overflow-x-auto mb-0">
        {[
          { key: "summary" as const, label: "Summary", sub: "VAT computation" },
          { key: "A" as const, label: "Annex A", sub: "Sales register" },
          { key: "B" as const, label: "Annex B", sub: "Retail sales" },
          { key: "C" as const, label: "Annex C", sub: "Purchases" },
          { key: "D" as const, label: "Annex D", sub: "Import purchases" },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveAnnex(tab.key)}
            className={`h-auto min-w-[120px] px-4 py-2 -mb-0.5 text-left border-b-2 transition-colors whitespace-nowrap ${
              activeAnnex === tab.key
                ? "border-[#1557b0] text-[#1557b0]"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <span
              className={`block text-[12px] ${
                activeAnnex === tab.key ? "font-semibold" : "font-medium"
              }`}
            >
              {tab.label}
            </span>
            <span className="block text-[10px] text-gray-400 mt-0.5">{tab.sub}</span>
          </button>
        ))}
      </div>

      {activeAnnex === "summary" && (
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-b-md rounded-t-none overflow-hidden">
            <div className="px-3 py-2 border-b border-gray-200 bg-[#f5f6fa]">
              <h3 className="text-[12px] font-semibold text-gray-800">
                VAT return statement — {companySettings?.name ?? "Company"}
              </h3>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Period: {fromDate} to {toDate}
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-[#f5f6fa] border-b border-gray-200">
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Particulars
                    </th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-40">
                      Taxable amount
                    </th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-40">
                      VAT amount
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="bg-green-50">
                    <td
                      colSpan={3}
                      className="px-3 py-2 text-[11px] font-semibold text-green-800 uppercase tracking-wide"
                    >
                      Output VAT (sales)
                    </td>
                  </tr>
                  <tr className="group hover:bg-gray-50 border-l-[3px] border-l-transparent hover:border-l-[#1557b0] border-b border-gray-100">
                    <td className="px-3 py-2.5 text-[12px] text-gray-700 pl-8">
                      Annex A — Sales to VAT registered buyers
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-[12px] text-gray-700">
                      {money(annexATotal.taxable)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-[12px] text-gray-700">
                      {money(annexATotal.vat)}
                    </td>
                  </tr>
                  <tr className="group hover:bg-gray-50 border-l-[3px] border-l-transparent hover:border-l-[#1557b0] border-b border-gray-100">
                    <td className="px-3 py-2.5 text-[12px] text-gray-700 pl-8">
                      Annex B — Retail sales (non-VAT registered)
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-[12px] text-gray-700">
                      {money(annexBTotal.taxable)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-[12px] text-gray-700">
                      {money(annexBTotal.vat)}
                    </td>
                  </tr>
                  <tr className="bg-[#eef2ff] border-t-2 border-[#c7d2fe] font-bold text-[12px]">
                    <td className="px-3 py-2.5 text-gray-800 pl-8">Total output VAT</td>
                    <td className="px-3 py-2.5 text-right font-mono text-gray-800">
                      {money(vatSummary.outputTaxable)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-gray-800">
                      {money(vatSummary.outputVat)}
                    </td>
                  </tr>

                  <tr className="bg-amber-50">
                    <td
                      colSpan={3}
                      className="px-3 py-2 text-[11px] font-semibold text-amber-800 uppercase tracking-wide"
                    >
                      Input VAT (purchases)
                    </td>
                  </tr>
                  <tr className="group hover:bg-gray-50 border-l-[3px] border-l-transparent hover:border-l-[#1557b0] border-b border-gray-100">
                    <td className="px-3 py-2.5 text-[12px] text-gray-700 pl-8">
                      Annex C — Local purchases
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-[12px] text-gray-700">
                      {money(annexCTotal.taxable)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-[12px] text-gray-700">
                      {money(annexCTotal.vat)}
                    </td>
                  </tr>
                  <tr className="bg-[#eef2ff] border-t-2 border-[#c7d2fe] font-bold text-[12px]">
                    <td className="px-3 py-2.5 text-gray-800 pl-8">Total input VAT</td>
                    <td className="px-3 py-2.5 text-right font-mono text-gray-800">
                      {money(vatSummary.inputTaxable)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-gray-800">
                      {money(vatSummary.inputVat)}
                    </td>
                  </tr>

                  <tr
                    className={`border-t-2 font-bold text-[12px] ${
                      vatSummary.netVat >= 0
                        ? "bg-red-50 border-red-200"
                        : "bg-green-50 border-green-200"
                    }`}
                  >
                    <td
                      className={`px-3 py-2.5 ${
                        vatSummary.netVat >= 0 ? "text-red-800" : "text-green-800"
                      }`}
                    >
                      Net VAT {vatSummary.netVat >= 0 ? "payable" : "refundable"}
                    </td>
                    <td className="px-3 py-2.5" />
                    <td
                      className={`px-3 py-2.5 text-right font-mono ${
                        vatSummary.netVat >= 0 ? "text-red-800" : "text-green-800"
                      }`}
                    >
                      {vatSummary.netVat >= 0 ? "" : "("}
                      {money(Math.abs(vatSummary.netVat))}
                      {vatSummary.netVat < 0 ? ")" : ""}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="px-3 py-2 border-t border-gray-200 bg-[#f5f6fa] text-[11px] text-gray-500">
              VAT summary for IRD submission
            </div>
          </div>
        </div>
      )}

      {activeAnnex === "A" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[12px] font-semibold text-gray-800">
                Annex A — Sales to VAT registered parties
              </h3>
              <p className="text-[11px] text-gray-500 mt-0.5">
                {annexAData.length} invoices · Taxable: {money(annexATotal.taxable)} · VAT:{" "}
                {money(annexATotal.vat)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleExportExcel("Annex_A", annexAData, annexAColumns)}
              className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 inline-flex items-center gap-1.5"
            >
              <Download className="h-3.5 w-3.5" />
              Export
            </button>
          </div>

          <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
            <DataTable
              columns={annexAColumns}
              data={annexAData}
              emptyMessage="No sales to VAT-registered parties in this period."
              footerRow={
                <tr className="bg-[#eef2ff] border-t-2 border-[#c7d2fe] font-bold text-[12px]">
                  <td colSpan={5} className="px-3 py-2.5 text-gray-800">
                    Total
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-gray-800">
                    {money(annexATotal.taxable)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-gray-800">
                    {money(annexATotal.exempt)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-gray-800">
                    {money(annexATotal.vat)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-gray-800">
                    {money(annexATotal.total)}
                  </td>
                </tr>
              }
            />
            {annexAData.length > 0 && (
              <div className="px-3 py-2 border-t border-gray-200 bg-[#f5f6fa] text-[11px] text-gray-500">
                {annexAData.length} record{annexAData.length === 1 ? "" : "s"}
              </div>
            )}
          </div>
        </div>
      )}

      {activeAnnex === "B" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[12px] font-semibold text-gray-800">
                Annex B — Retail sales (non-VAT registered)
              </h3>
              <p className="text-[11px] text-gray-500 mt-0.5">
                {annexBData.length} invoices · Taxable: {money(annexBTotal.taxable)} · VAT:{" "}
                {money(annexBTotal.vat)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleExportExcel("Annex_B", annexBData, annexBColumns)}
              className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 inline-flex items-center gap-1.5"
            >
              <Download className="h-3.5 w-3.5" />
              Export
            </button>
          </div>

          <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
            <DataTable
              columns={annexBColumns}
              data={annexBData}
              emptyMessage="No retail sales in this period."
              footerRow={
                <tr className="bg-[#eef2ff] border-t-2 border-[#c7d2fe] font-bold text-[12px]">
                  <td colSpan={4} className="px-3 py-2.5 text-gray-800">
                    Total
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-gray-800">
                    {money(annexBTotal.taxable)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-gray-800">
                    {money(annexBTotal.exempt)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-gray-800">
                    {money(annexBTotal.vat)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-gray-800">
                    {money(annexBTotal.total)}
                  </td>
                </tr>
              }
            />
            {annexBData.length > 0 && (
              <div className="px-3 py-2 border-t border-gray-200 bg-[#f5f6fa] text-[11px] text-gray-500">
                {annexBData.length} record{annexBData.length === 1 ? "" : "s"}
              </div>
            )}
          </div>
        </div>
      )}

      {activeAnnex === "C" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[12px] font-semibold text-gray-800">
                Annex C — Purchase invoices
              </h3>
              <p className="text-[11px] text-gray-500 mt-0.5">
                {annexCData.length} invoices · Taxable: {money(annexCTotal.taxable)} · VAT:{" "}
                {money(annexCTotal.vat)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleExportExcel("Annex_C", annexCData, annexCColumns)}
              className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 inline-flex items-center gap-1.5"
            >
              <Download className="h-3.5 w-3.5" />
              Export
            </button>
          </div>

          <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
            <DataTable
              columns={annexCColumns}
              data={annexCData}
              emptyMessage="No purchase invoices in this period."
              footerRow={
                <tr className="bg-[#eef2ff] border-t-2 border-[#c7d2fe] font-bold text-[12px]">
                  <td colSpan={5} className="px-3 py-2.5 text-gray-800">
                    Total
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-gray-800">
                    {money(annexCTotal.taxable)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-gray-800">
                    {money(annexCTotal.vat)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-gray-800">
                    {money(annexCTotal.total)}
                  </td>
                </tr>
              }
            />
            {annexCData.length > 0 && (
              <div className="px-3 py-2 border-t border-gray-200 bg-[#f5f6fa] text-[11px] text-gray-500">
                {annexCData.length} record{annexCData.length === 1 ? "" : "s"}
              </div>
            )}
          </div>
        </div>
      )}

      {activeAnnex === "D" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[12px] font-semibold text-gray-800">
                Annex D — Import purchases
              </h3>
              <p className="text-[11px] text-gray-500 mt-0.5">{annexDData.length} records</p>
            </div>
            <button
              type="button"
              onClick={() => handleExportExcel("Annex_D", annexDData, annexCColumns)}
              className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 inline-flex items-center gap-1.5"
            >
              <Download className="h-3.5 w-3.5" />
              Export
            </button>
          </div>

          <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
            <DataTable
              columns={annexCColumns}
              data={annexDData}
              emptyMessage="No import purchases recorded in this period."
            />
            {annexDData.length > 0 && (
              <div className="px-3 py-2 border-t border-gray-200 bg-[#f5f6fa] text-[11px] text-gray-500">
                {annexDData.length} record{annexDData.length === 1 ? "" : "s"}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Print styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          @page { size: A4 landscape; margin: 10mm; }
        }
      `}</style>
    </ReportShell>
  );
};

export default VatReports;
