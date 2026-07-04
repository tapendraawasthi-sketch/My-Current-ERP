// @ts-nocheck
import React, { useState, useMemo, useCallback } from "react";
import { useStore } from "../store/useStore";
import {
  Download,
  FileSpreadsheet,
  Printer,
  RefreshCw,
  Filter,
  ChevronDown,
  Eye,
  X,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";
import * as XLSX from "xlsx";
import toast from "react-hot-toast";
import ReportDateRangePicker, { DateRange } from "../components/ui/ReportDateRangePicker";

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

interface VatSummary {
  totalSalesVat: number;
  totalPurchaseVat: number;
  totalSalesTaxable: number;
  totalPurchaseTaxable: number;
  vatPayable: number;
  annexACount: number;
  annexBCount: number;
  annexCCount: number;
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
    <div className={`p-4 md:p-6 bg-[#f5f6fa] min-h-screen flex flex-col gap-4 ${className}`}>
      <div className="flex items-center justify-between mb-4 no-print">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800">{title}</h1>
          {subtitle && <p className="text-[11px] text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      <div className={printable ? "print-content" : ""}>{children}</div>
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
}) => (
  <div className="overflow-x-auto">
    <table className="report-table w-full min-w-max">
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
              {/* Use col.label — NOT col.header */}
              {col.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {data.length === 0 ? (
          <tr>
            <td
              colSpan={columns.length}
              className="px-3 py-12 text-center text-[12px] text-gray-400"
            >
              {emptyMessage}
            </td>
          </tr>
        ) : (
          data.map((row, rowIdx) => (
            <tr key={rowIdx} className="hover:bg-gray-50">
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
          ))
        )}
      </tbody>
      {footerRow && <tfoot>{footerRow}</tfoot>}
    </table>
  </div>
);

// ─── Main Component ────────────────────────────────────────────────────────────

const VatReports: React.FC = () => {
  const { invoices, parties, companySettings, currentFiscalYear } = useStore();

  const [activeAnnex, setActiveAnnex] = useState<"A" | "B" | "C" | "D" | "summary">("summary");
  const [dateRange, setDateRange] = useState<DateRange>({
    fromDate: firstDayOfMonth(),
    toDate: todayISO(),
  });
  const [loading, setLoading] = useState(false);

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
      {/* Toolbar — rendered as children, NOT as "actions" prop */}
      <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <ReportDateRangePicker value={dateRange} onChange={setDateRange} label="" compact />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrint}
            className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 flex items-center gap-1.5 transition-colors"
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
            className="h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md flex items-center gap-1.5 transition-colors"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            Export Excel
          </button>
        </div>
      </div>

      {/* KPI cells */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          borderBottom: "2px solid #e5e7eb",
          background: "#ffffff",
          marginBottom: 16,
        }}
      >
        {/* Output VAT */}
        <div style={{ padding: "14px 20px", borderRight: "1px solid #e5e7eb" }}>
          <div
            style={{
              fontSize: 9,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "#6b7280",
            }}
          >
            Output VAT (Sales)
          </div>
          <div
            style={{
              fontSize: 20,
              fontWeight: 700,
              fontFamily: "'Courier New', monospace",
              color: "#1557b0",
              marginTop: 4,
              lineHeight: 1.2,
            }}
          >
            {fmtVat(vatSummary.outputVat)}
          </div>
          <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 3 }}>
            Taxable: {fmtVat(vatSummary.outputTaxable)} · {vatSummary.outputCount} invoices
          </div>
        </div>

        {/* Input VAT */}
        <div style={{ padding: "14px 20px", borderRight: "1px solid #e5e7eb" }}>
          <div
            style={{
              fontSize: 9,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "#6b7280",
            }}
          >
            Input VAT (Purchases)
          </div>
          <div
            style={{
              fontSize: 20,
              fontWeight: 700,
              fontFamily: "'Courier New', monospace",
              color: "#059669",
              marginTop: 4,
              lineHeight: 1.2,
            }}
          >
            {fmtVat(vatSummary.inputVat)}
          </div>
          <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 3 }}>
            Taxable: {fmtVat(vatSummary.inputTaxable)} · {vatSummary.inputCount} bills
          </div>
        </div>

        {/* Net VAT Payable */}
        <div
          style={{
            padding: "14px 20px",
            background: vatSummary.netVat >= 0 ? "#fef9f0" : "#f0fdf4",
          }}
        >
          <div
            style={{
              fontSize: 9,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "#6b7280",
            }}
          >
            {vatSummary.netVat >= 0 ? "Net VAT Payable to IRD" : "Net VAT Refundable"}
          </div>
          <div
            style={{
              fontSize: 20,
              fontWeight: 700,
              fontFamily: "'Courier New', monospace",
              color: vatSummary.netVat >= 0 ? "#dc2626" : "#059669",
              marginTop: 4,
              lineHeight: 1.2,
            }}
          >
            {fmtVat(Math.abs(vatSummary.netVat))}
          </div>
          <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 3 }}>
            Output − Input = {vatSummary.netVat >= 0 ? "Payable" : "Refundable"}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          borderBottom: "2px solid #e5e7eb",
          background: "#ffffff",
          overflowX: "auto",
          marginBottom: 16,
        }}
      >
        {[
          {
            key: "summary" as const,
            label: "Summary",
            sub: "VAT Computation",
            total: vatSummary.netVat,
            color: "#7c3aed",
          },
          {
            key: "A" as const,
            label: "Annex A",
            sub: "Sales Register",
            total: vatSummary.outputVat,
            color: "#1557b0",
          },
          { key: "B" as const, label: "Annex B", sub: "Retail Sales", total: 0, color: "#059669" },
          {
            key: "C" as const,
            label: "Annex C",
            sub: "Purchases",
            total: vatSummary.inputVat,
            color: "#d97706",
          },
          {
            key: "D" as const,
            label: "Annex D",
            sub: "Import Purchases",
            total: 0,
            color: "#4f46e5",
          },
        ].map((tab) => {
          const isActive = activeAnnex === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveAnnex(tab.key)}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                gap: 2,
                padding: "10px 20px",
                background: "transparent",
                border: "none",
                borderBottom: isActive ? `2px solid ${tab.color}` : "2px solid transparent",
                marginBottom: -2,
                cursor: "pointer",
                transition: "border-color 150ms ease",
                whiteSpace: "nowrap",
                minWidth: 140,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span
                  style={{ fontSize: 12, fontWeight: 700, color: isActive ? tab.color : "#374151" }}
                >
                  {tab.label}
                </span>
                {tab.total !== 0 && (
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 700,
                      background: isActive ? `${tab.color}18` : "#f3f4f6",
                      color: isActive ? tab.color : "#9ca3af",
                      border: `1px solid ${isActive ? tab.color + "40" : "#e5e7eb"}`,
                      borderRadius: 10,
                      padding: "0 6px",
                    }}
                  >
                    {Math.abs(tab.total).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                  </span>
                )}
              </div>
              <span style={{ fontSize: 10, color: "#9ca3af" }}>{tab.sub}</span>
            </button>
          );
        })}
      </div>

      {/* ── Summary Tab ──────────────────────────────────────────────────────── */}
      {activeAnnex === "summary" && (
        <div className="space-y-4">
          {/* VAT Return Summary Table */}
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-gray-200 bg-[#f5f6fa]">
              <h3 className="text-[12px] font-semibold text-gray-700">
                VAT Return Statement — {companySettings?.name ?? "Company"}
              </h3>
              <p className="text-[10px] text-gray-500 mt-0.5">
                Period: {fromDate} to {toDate}
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="report-table w-full">
                <thead>
                  <tr className="bg-[#f5f6fa] border-b border-gray-200">
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Particulars
                    </th>
                    <th className="px-4 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-40">
                      Taxable Amount
                    </th>
                    <th className="px-4 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-40">
                      VAT Amount
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {/* Output VAT section */}
                  <tr className="bg-green-50">
                    <td
                      colSpan={3}
                      className="px-4 py-2 text-[11px] font-bold text-green-800 uppercase tracking-wide"
                    >
                      Output VAT (Sales)
                    </td>
                  </tr>
                  <tr className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 text-[12px] text-gray-700 pl-8">
                      Annex A — Sales to VAT Registered Buyers
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-[12px] text-gray-700">
                      {money(annexATotal.taxable)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-[12px] text-gray-700">
                      {money(annexATotal.vat)}
                    </td>
                  </tr>
                  <tr className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 text-[12px] text-gray-700 pl-8">
                      Annex B — Retail Sales (Non-VAT Registered)
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-[12px] text-gray-700">
                      {money(annexBTotal.taxable)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-[12px] text-gray-700">
                      {money(annexBTotal.vat)}
                    </td>
                  </tr>
                  <tr className="bg-green-50 border-t border-green-200">
                    <td className="px-4 py-2.5 text-[12px] font-bold text-green-800 pl-8">
                      Total Output VAT
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-[12px] font-bold text-green-800">
                      {money(vatSummary.outputTaxable)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-[12px] font-bold text-green-800">
                      {money(vatSummary.outputVat)}
                    </td>
                  </tr>

                  {/* Input VAT section */}
                  <tr className="bg-amber-50">
                    <td
                      colSpan={3}
                      className="px-4 py-2 text-[11px] font-bold text-amber-800 uppercase tracking-wide"
                    >
                      Input VAT (Purchases)
                    </td>
                  </tr>
                  <tr className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 text-[12px] text-gray-700 pl-8">
                      Annex C — Local Purchases
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-[12px] text-gray-700">
                      {money(annexCTotal.taxable)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-[12px] text-gray-700">
                      {money(annexCTotal.vat)}
                    </td>
                  </tr>
                  <tr className="bg-amber-50 border-t border-amber-200">
                    <td className="px-4 py-2.5 text-[12px] font-bold text-amber-800 pl-8">
                      Total Input VAT
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-[12px] font-bold text-amber-800">
                      {money(vatSummary.inputTaxable)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-[12px] font-bold text-amber-800">
                      {money(vatSummary.inputVat)}
                    </td>
                  </tr>

                  {/* Net VAT payable */}
                  <tr
                    className={`border-t-2 ${
                      vatSummary.netVat >= 0
                        ? "bg-red-50 border-red-200"
                        : "bg-green-50 border-green-200"
                    }`}
                  >
                    <td
                      className={`px-4 py-3 text-[13px] font-bold ${
                        vatSummary.netVat >= 0 ? "text-red-800" : "text-green-800"
                      }`}
                    >
                      Net VAT {vatSummary.netVat >= 0 ? "Payable" : "Refundable"}
                    </td>
                    <td className="px-4 py-3" />
                    <td
                      className={`px-4 py-3 text-right font-mono text-[13px] font-bold ${
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
          </div>
        </div>
      )}

      {/* ── Annex A Tab ───────────────────────────────────────────────────────── */}
      {activeAnnex === "A" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[13px] font-semibold text-gray-800">
                Annex A — Sales to VAT Registered Parties
              </h3>
              <p className="text-[10px] text-gray-500 mt-0.5">
                {annexAData.length} invoices · Taxable: {money(annexATotal.taxable)} · VAT:{" "}
                {money(annexATotal.vat)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleExportExcel("Annex_A", annexAData, annexAColumns)}
              className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 flex items-center gap-1.5 transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              Export
            </button>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
            <DataTable
              columns={annexAColumns}
              data={annexAData}
              emptyMessage="No sales to VAT-registered parties in this period."
              footerRow={
                <tr className="bg-[#eef2ff] border-t-2 border-[#c7d2fe]">
                  <td colSpan={5} className="px-3 py-2.5 text-[12px] font-bold text-gray-800">
                    Total
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-[12px] font-bold text-gray-800">
                    {money(annexATotal.taxable)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-[12px] font-bold text-gray-800">
                    {money(annexATotal.exempt)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-[12px] font-bold text-gray-800">
                    {money(annexATotal.vat)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-[12px] font-bold text-gray-800">
                    {money(annexATotal.total)}
                  </td>
                </tr>
              }
            />
          </div>
        </div>
      )}

      {/* ── Annex B Tab ───────────────────────────────────────────────────────── */}
      {activeAnnex === "B" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[13px] font-semibold text-gray-800">
                Annex B — Retail Sales (Non-VAT Registered)
              </h3>
              <p className="text-[10px] text-gray-500 mt-0.5">
                {annexBData.length} invoices · Taxable: {money(annexBTotal.taxable)} · VAT:{" "}
                {money(annexBTotal.vat)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleExportExcel("Annex_B", annexBData, annexBColumns)}
              className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 flex items-center gap-1.5 transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              Export
            </button>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
            <DataTable
              columns={annexBColumns}
              data={annexBData}
              emptyMessage="No retail sales in this period."
              footerRow={
                <tr className="bg-[#eef2ff] border-t-2 border-[#c7d2fe]">
                  <td colSpan={4} className="px-3 py-2.5 text-[12px] font-bold text-gray-800">
                    Total
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-[12px] font-bold text-gray-800">
                    {money(annexBTotal.taxable)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-[12px] font-bold text-gray-800">
                    {money(annexBTotal.exempt)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-[12px] font-bold text-gray-800">
                    {money(annexBTotal.vat)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-[12px] font-bold text-gray-800">
                    {money(annexBTotal.total)}
                  </td>
                </tr>
              }
            />
          </div>
        </div>
      )}

      {/* ── Annex C Tab ───────────────────────────────────────────────────────── */}
      {activeAnnex === "C" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[13px] font-semibold text-gray-800">
                Annex C — Purchase Invoices
              </h3>
              <p className="text-[10px] text-gray-500 mt-0.5">
                {annexCData.length} invoices · Taxable: {money(annexCTotal.taxable)} · VAT:{" "}
                {money(annexCTotal.vat)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleExportExcel("Annex_C", annexCData, annexCColumns)}
              className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 flex items-center gap-1.5 transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              Export
            </button>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
            <DataTable
              columns={annexCColumns}
              data={annexCData}
              emptyMessage="No purchase invoices in this period."
              footerRow={
                <tr className="bg-[#eef2ff] border-t-2 border-[#c7d2fe]">
                  <td colSpan={5} className="px-3 py-2.5 text-[12px] font-bold text-gray-800">
                    Total
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-[12px] font-bold text-gray-800">
                    {money(annexCTotal.taxable)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-[12px] font-bold text-gray-800">
                    {money(annexCTotal.vat)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-[12px] font-bold text-gray-800">
                    {money(annexCTotal.total)}
                  </td>
                </tr>
              }
            />
          </div>
        </div>
      )}

      {/* ── Annex D Tab ───────────────────────────────────────────────────────── */}
      {activeAnnex === "D" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[13px] font-semibold text-gray-800">
                Annex D — Import Purchases
              </h3>
              <p className="text-[10px] text-gray-500 mt-0.5">{annexDData.length} records</p>
            </div>
            <button
              type="button"
              onClick={() => handleExportExcel("Annex_D", annexDData, annexCColumns)}
              className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 flex items-center gap-1.5 transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              Export
            </button>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
            <DataTable
              columns={annexCColumns}
              data={annexDData}
              emptyMessage="No import purchases recorded in this period."
            />
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
