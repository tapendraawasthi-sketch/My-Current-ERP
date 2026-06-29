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
}

const ReportShell: React.FC<ReportShellProps> = ({ title, subtitle, children }) => (
  <div className="p-4 md:p-6 bg-[#f5f6fa] min-h-screen">
    <div className="flex items-center justify-between mb-4">
      <div>
        <h1 className="text-[15px] font-semibold text-gray-800">{title}</h1>
        {subtitle && (
          <p className="text-[11px] text-gray-500 mt-0.5">{subtitle}</p>
        )}
      </div>
    </div>
    {children}
  </div>
);

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
  return new Date(val);
}

function isDateInRange(
  dateStr: string,
  fromStr: string,
  toStr: string,
): boolean {
  if (!dateStr) return false;
  // Convert strings to Date objects for comparison
  const d = toDate(dateStr);
  const from = toDate(fromStr);
  const to = toDate(toStr);
  // Set to end of day for 'to'
  to.setHours(23, 59, 59, 999);
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
    <table className="w-full min-w-max">
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
                  {col.render
                    ? col.render(row[col.key], row)
                    : row[col.key] ?? "—"}
                </td>
              ))}
            </tr>
          ))
        )}
      </tbody>
      {footerRow && (
        <tfoot>
          {footerRow}
        </tfoot>
      )}
    </table>
  </div>
);

// ─── Main Component ────────────────────────────────────────────────────────────

type ActiveTab = "summary" | "annexA" | "annexB" | "annexC" | "annexD";

const VatReports: React.FC = () => {
  const {
    invoices,
    parties,
    companySettings,
    currentFiscalYear,
  } = useStore();

  const [activeTab, setActiveTab] = useState<ActiveTab>("summary");
  const [fromDate, setFromDate] = useState(firstDayOfMonth());
  const [toDate, setToDate] = useState(todayISO());
  const [loading, setLoading] = useState(false);

  // ── Filter invoices by date range ─────────────────────────────────────────
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      if (!inv.date) return false;
      // Fix: use toDate() helper to convert string dates to Date objects properly
      return isDateInRange(inv.date, fromDate, toDate);
    });
  }, [invoices, fromDate, toDate]);

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
          (inv.type === "purchase-invoice" ||
            inv.type === "purchase_invoice") &&
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
      .filter(
        (inv) =>
          inv.type === "import-purchase" && inv.status === "posted",
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
        type: "import",
        exemptAmount: inv.exemptAmount ?? 0,
      }));
  }, [filteredInvoices]);

  // ── VAT Summary ───────────────────────────────────────────────────────────
  const vatSummary = useMemo<VatSummary>(() => {
    const salesInvoices = filteredInvoices.filter(
      (inv) =>
        (inv.type === "sales-invoice" || inv.type === "sales_invoice") &&
        inv.status === "posted",
    );
    const purchaseInvoices = filteredInvoices.filter(
      (inv) =>
        (inv.type === "purchase-invoice" ||
          inv.type === "purchase_invoice") &&
        inv.status === "posted",
    );

    const totalSalesVat = salesInvoices.reduce(
      (s, inv) => s + (inv.vatAmount ?? 0),
      0,
    );
    const totalPurchaseVat = purchaseInvoices.reduce(
      (s, inv) => s + (inv.vatAmount ?? 0),
      0,
    );
    const totalSalesTaxable = salesInvoices.reduce(
      (s, inv) => s + (inv.taxableAmount ?? 0),
      0,
    );
    const totalPurchaseTaxable = purchaseInvoices.reduce(
      (s, inv) => s + (inv.taxableAmount ?? 0),
      0,
    );

    return {
      totalSalesVat,
      totalPurchaseVat,
      totalSalesTaxable,
      totalPurchaseTaxable,
      vatPayable: totalSalesVat - totalPurchaseVat,
      annexACount: annexAData.length,
      annexBCount: annexBData.length,
      annexCCount: annexCData.length,
      annexDCount: annexDData.length,
    } as any;
  }, [filteredInvoices, annexAData, annexBData, annexCData, annexDData]);

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
        const companyName =
          companySettings?.name ||
          companySettings?.companyName ||
          "Company";
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
    <ReportShell
      title="VAT Reports"
      subtitle="Annex A, B, C and VAT summary for IRD submission"
    >
      {/* Toolbar — rendered as children, NOT as "actions" prop */}
      <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <div>
            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-0.5">
              From Date
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
            />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-0.5">
              To Date
            </label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
            />
          </div>
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
                activeTab === "annexA"
                  ? annexAData
                  : activeTab === "annexB"
                  ? annexBData
                  : activeTab === "annexC"
                  ? annexCData
                  : annexDData;
              const cols =
                activeTab === "annexA"
                  ? annexAColumns
                  : activeTab === "annexB"
                  ? annexBColumns
                  : annexCColumns;
              handleExportExcel(activeTab.toUpperCase(), data, cols);
            }}
            className="h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md flex items-center gap-1.5 transition-colors"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            Export Excel
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-4 border-b border-gray-200">
        {(
          [
            { id: "summary", label: "VAT Summary" },
            { id: "annexA", label: "Annex A (Sales — VAT Reg.)" },
            { id: "annexB", label: "Annex B (Sales — Retail)" },
            { id: "annexC", label: "Annex C (Purchases)" },
            { id: "annexD", label: "Annex D (Imports)" },
          ] as { id: ActiveTab; label: string }[]
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`h-8 px-3 text-[12px] font-medium rounded-t-md transition-colors border-b-2 -mb-px ${
              activeTab === tab.id
                ? "border-[#1557b0] text-[#1557b0] bg-white"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Summary Tab ──────────────────────────────────────────────────────── */}
      {activeTab === "summary" && (
        <div className="space-y-4">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                Output VAT (Sales)
              </p>
              <p className="text-[20px] font-bold text-[#1557b0] mt-1 font-mono">
                {money(vatSummary.totalSalesVat)}
              </p>
              <p className="text-[10px] text-gray-400 mt-1">
                Taxable: {money(vatSummary.totalSalesTaxable)}
              </p>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                Input VAT (Purchases)
              </p>
              <p className="text-[20px] font-bold text-amber-600 mt-1 font-mono">
                {money(vatSummary.totalPurchaseVat)}
              </p>
              <p className="text-[10px] text-gray-400 mt-1">
                Taxable: {money(vatSummary.totalPurchaseTaxable)}
              </p>
            </div>

            <div
              className={`bg-white border rounded-lg p-4 shadow-sm ${
                vatSummary.vatPayable >= 0
                  ? "border-red-200"
                  : "border-green-200"
              }`}
            >
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                VAT Payable / (Refund)
              </p>
              <p
                className={`text-[20px] font-bold mt-1 font-mono ${
                  vatSummary.vatPayable >= 0
                    ? "text-red-600"
                    : "text-green-600"
                }`}
              >
                {vatSummary.vatPayable >= 0 ? "" : "("}
                {money(Math.abs(vatSummary.vatPayable))}
                {vatSummary.vatPayable < 0 ? ")" : ""}
              </p>
              <p className="text-[10px] text-gray-400 mt-1">
                {vatSummary.vatPayable >= 0
                  ? "Payable to IRD"
                  : "Refundable from IRD"}
              </p>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                Invoice Counts
              </p>
              <div className="mt-2 space-y-1 text-[11px]">
                <div className="flex justify-between text-gray-600">
                  <span>Annex A</span>
                  <span className="font-semibold">{annexAData.length}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Annex B</span>
                  <span className="font-semibold">{annexBData.length}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Annex C</span>
                  <span className="font-semibold">{annexCData.length}</span>
                </div>
              </div>
            </div>
          </div>

          {/* VAT Return Summary Table */}
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-gray-200 bg-[#f5f6fa]">
              <h3 className="text-[12px] font-semibold text-gray-700">
                VAT Return Statement —{" "}
                {companySettings?.name ?? "Company"}
              </h3>
              <p className="text-[10px] text-gray-500 mt-0.5">
                Period: {fromDate} to {toDate}
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
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
                      {money(vatSummary.totalSalesTaxable)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-[12px] font-bold text-green-800">
                      {money(vatSummary.totalSalesVat)}
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
                      {money(vatSummary.totalPurchaseTaxable)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-[12px] font-bold text-amber-800">
                      {money(vatSummary.totalPurchaseVat)}
                    </td>
                  </tr>

                  {/* Net VAT payable */}
                  <tr
                    className={`border-t-2 ${
                      vatSummary.vatPayable >= 0
                        ? "bg-red-50 border-red-200"
                        : "bg-green-50 border-green-200"
                    }`}
                  >
                    <td
                      className={`px-4 py-3 text-[13px] font-bold ${
                        vatSummary.vatPayable >= 0
                          ? "text-red-800"
                          : "text-green-800"
                      }`}
                    >
                      Net VAT{" "}
                      {vatSummary.vatPayable >= 0 ? "Payable" : "Refundable"}
                    </td>
                    <td className="px-4 py-3" />
                    <td
                      className={`px-4 py-3 text-right font-mono text-[13px] font-bold ${
                        vatSummary.vatPayable >= 0
                          ? "text-red-800"
                          : "text-green-800"
                      }`}
                    >
                      {vatSummary.vatPayable >= 0 ? "" : "("}
                      {money(Math.abs(vatSummary.vatPayable))}
                      {vatSummary.vatPayable < 0 ? ")" : ""}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Annex A Tab ───────────────────────────────────────────────────────── */}
      {activeTab === "annexA" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[13px] font-semibold text-gray-800">
                Annex A — Sales to VAT Registered Parties
              </h3>
              <p className="text-[10px] text-gray-500 mt-0.5">
                {annexAData.length} invoices · Taxable:{" "}
                {money(annexATotal.taxable)} · VAT:{" "}
                {money(annexATotal.vat)}
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                handleExportExcel("Annex_A", annexAData, annexAColumns)
              }
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
                  <td
                    colSpan={5}
                    className="px-3 py-2.5 text-[12px] font-bold text-gray-800"
                  >
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
      {activeTab === "annexB" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[13px] font-semibold text-gray-800">
                Annex B — Retail Sales (Non-VAT Registered)
              </h3>
              <p className="text-[10px] text-gray-500 mt-0.5">
                {annexBData.length} invoices · Taxable:{" "}
                {money(annexBTotal.taxable)} · VAT:{" "}
                {money(annexBTotal.vat)}
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                handleExportExcel("Annex_B", annexBData, annexBColumns)
              }
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
                  <td
                    colSpan={4}
                    className="px-3 py-2.5 text-[12px] font-bold text-gray-800"
                  >
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
      {activeTab === "annexC" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[13px] font-semibold text-gray-800">
                Annex C — Purchase Invoices
              </h3>
              <p className="text-[10px] text-gray-500 mt-0.5">
                {annexCData.length} invoices · Taxable:{" "}
                {money(annexCTotal.taxable)} · VAT:{" "}
                {money(annexCTotal.vat)}
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                handleExportExcel("Annex_C", annexCData, annexCColumns)
              }
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
                  <td
                    colSpan={5}
                    className="px-3 py-2.5 text-[12px] font-bold text-gray-800"
                  >
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
      {activeTab === "annexD" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[13px] font-semibold text-gray-800">
                Annex D — Import Purchases
              </h3>
              <p className="text-[10px] text-gray-500 mt-0.5">
                {annexDData.length} records
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                handleExportExcel("Annex_D", annexDData, annexCColumns)
              }
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
